"""The sound kit both films share: timeline access, synths, sound effects, narration, mastering.

The timeline and narration folder come from KEPT_TIMELINE and KEPT_VO (relative to video/),
defaulting to the demo film, so audio/mix.py and audio/explainer_mix.py read the same code.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt, sosfiltfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 48_000
RNG = np.random.default_rng(7)

# KEPT_TIMELINE and KEPT_VO let another film (audio/explainer_mix.py) reuse this kit.
TL = json.loads((ROOT / os.environ.get("KEPT_TIMELINE", "src/timeline.json")).read_text())
VO = ROOT / os.environ.get("KEPT_VO", "audio-src")
DUR = TL["duration"]
N = int(DUR * SR) + SR  # a second of tail room, trimmed at the end
SCENE = {s["id"]: s for s in TL["scenes"]}
LINE = {l["id"]: l for l in TL["lines"]}


def S(name):
    return SCENE[name]["start"]


def E(name):
    return SCENE[name]["end"]


def L(name):
    return LINE[name]["start"]


def LE(name):
    return LINE[name]["end"]


def db(x):
    return 10 ** (x / 20)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def add(buf, sig, at, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into a stereo buffer at `at` seconds, equal-power pan."""
    i = int(round(at * SR))
    if i >= len(buf):
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    j = min(len(buf), i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
    buf[i:j] += sig[: j - i] * gain


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def env_adsr(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = n - a - d - r if sustain_len is None else int(sustain_len * SR)
    hold = max(0, hold)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a)) ** 1.6,
        np.linspace(1, s, max(1, d)),
        np.full(hold, s),
        np.linspace(s, 0, max(1, r)) ** 1.4 * (s if s > 0 else 1),
    ])
    out = np.zeros(n)
    m = min(n, len(e))
    out[:m] = e[:m]
    return out


def reverb_ir(seconds=2.6, damp=5000, predelay=0.018):
    n = int(seconds * SR)
    t = tt(n)
    decay = np.exp(-t * 6.9 / seconds)
    ir = RNG.standard_normal((n, 2)) * decay[:, None]
    ir = lp(ir, damp)
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


def reverb(x, ir):
    return np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)


# -------------------------------------------------------------------------------------------
# Instruments


def pad_voice(f, n, bright=0.5, detune=0.07):
    """Warm detuned saw stack, additive, with slow chorus drift."""
    t = tt(n)
    out = np.zeros((n, 2))
    k = 2.0 + 9.0 * bright  # harmonic roll-off
    for d, p in ((-detune, -0.6), (0.0, 0.0), (detune, 0.6)):
        fd = f * 2 ** (d / 12)
        drift = 0.0015 * np.sin(2 * np.pi * (0.13 + 0.05 * p) * t + p)
        ph = 2 * np.pi * fd * (t + np.cumsum(drift) / SR)
        sig = np.zeros(n)
        for h in range(1, 14):
            if fd * h > 9000:
                break
            sig += np.sin(h * ph + 0.7 * h * p) * (1 / h) * np.exp(-(h - 1) / k)
        a = (p + 1) * np.pi / 4
        out[:, 0] += sig * np.cos(a)
        out[:, 1] += sig * np.sin(a)
    return out / 3


def pluck(f, dur=1.6, bright=1.0):
    n = int(dur * SR)
    t = tt(n)
    sig = np.zeros(n)
    for h, amp in ((1, 1.0), (2, 0.45 * bright), (3, 0.22 * bright), (4, 0.12 * bright), (6, 0.05 * bright)):
        sig += amp * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (3.2 + 2.6 * h))
    sig *= np.minimum(1, t / 0.002)
    return sig


def bell(f, dur=2.4):
    n = int(dur * SR)
    t = tt(n)
    mod = 2.4 * np.exp(-t * 3.0) * np.sin(2 * np.pi * f * 3.5 * t)
    sig = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.1)
    sig += 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4.5)
    sig *= np.minimum(1, t / 0.0015)
    return sig


def bass_note(f, dur):
    n = int(dur * SR)
    t = tt(n)
    sig = np.sin(2 * np.pi * f * t) + 0.38 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return sig * env_adsr(n, 0.012, 0.25, 0.7, 0.12)


def kick(level=1.0):
    n = int(0.5 * SR)
    t = tt(n)
    f = 44 + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 7.5)
    click = lp(RNG.standard_normal(n) * np.exp(-t * 400), 3500)
    return (sig + 0.25 * click) * level


def hat(level=1.0, decay=38):
    n = int(0.12 * SR)
    t = tt(n)
    return hp(RNG.standard_normal(n), 7500, 4) * np.exp(-t * decay) * level


def shaker(level=1.0):
    n = int(0.09 * SR)
    t = tt(n)
    e = np.minimum(1, t / 0.012) * np.exp(-t * 45)
    return bp(RNG.standard_normal(n), 4000, 11000) * e * level


# -------------------------------------------------------------------------------------------
# Sound design


def sfx_clack():
    n = int(0.035 * SR)
    t = tt(n)
    body = bp(RNG.standard_normal(n), 1400, 5200) * np.exp(-t * 160)
    tick = np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 300)
    return body * 0.9 + tick * 0.4


def sfx_tick(f=2600, dur=0.07):
    n = int(dur * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 70) * np.minimum(1, t / 0.0008)


def sfx_click():
    """A trackpad click: two tight transients."""
    n = int(0.06 * SR)
    t = tt(n)
    a = bp(RNG.standard_normal(n), 1800, 7000) * np.exp(-t * 520)
    b = np.zeros(n)
    k = int(0.028 * SR)
    b[k:] = bp(RNG.standard_normal(n - k), 1200, 5000) * np.exp(-tt(n - k) * 700) * 0.55
    return a + b + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.3


def sfx_key():
    n = int(0.045 * SR)
    t = tt(n)
    return bp(RNG.standard_normal(n), 2200, 8000) * np.exp(-t * 260) + np.sin(2 * np.pi * 420 * t) * np.exp(-t * 160) * 0.25


def sfx_whoosh(dur=0.9, lo=300, hi=5000, rise=0.62):
    n = int(dur * SR)
    t = tt(n) / dur
    noise = RNG.standard_normal(n)
    # sweep a band through the noise in blocks
    out = np.zeros(n)
    blocks = 48
    for b in range(blocks):
        i0, i1 = b * n // blocks, (b + 1) * n // blocks
        x = (b + 0.5) / blocks
        c = lo * (hi / lo) ** (x / rise if x < rise else (1 - x) / (1 - rise))
        seg = bp(noise[max(0, i0 - 2000):i1], c * 0.7, min(c * 1.4, 20000))
        out[i0:i1] = seg[-(i1 - i0):]
    e = np.where(t < rise, (t / rise) ** 2, ((1 - t) / (1 - rise)) ** 1.5)
    return out * e


def sfx_air(dur=1.6):
    """Soft scene-turn swell: filtered noise breath."""
    n = int(dur * SR)
    t = tt(n) / dur
    x = lp(hp(RNG.standard_normal(n), 300), 2600)
    return x * np.sin(np.pi * t) ** 2


def sfx_impact(f=48, dur=2.8, body=1.0):
    n = int(dur * SR)
    t = tt(n)
    fr = f + 70 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 2.1)
    crack = lp(RNG.standard_normal(n), 6000) * np.exp(-t * 40) * 0.5
    tail = lp(RNG.standard_normal(n), 900) * np.exp(-t * 3.0) * 0.18
    return (sub * body + crack + tail) * np.minimum(1, t / 0.001)


def sfx_riser(dur=2.0, f0=180, f1=1400):
    n = int(dur * SR)
    t = tt(n)
    x = t / dur
    f = f0 * (f1 / f0) ** (x ** 1.6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.4 * np.sin(2.003 * ph)) * 0.35
    noise = hp(RNG.standard_normal(n), 2500) * 0.6
    e = x ** 2.3
    return (tone + noise * x) * e


def sfx_chime(root=81):
    sig = bell(hz(root), 2.6) * 0.7
    n = int(0.09 * SR)
    sig2 = np.concatenate([np.zeros(n), bell(hz(root + 7), 2.6)])[: len(sig)] * 0.5
    return sig + sig2


def sfx_glitch(dur=0.28):
    n = int(dur * SR)
    t = tt(n)
    sq = np.sign(np.sin(2 * np.pi * 220 * t * (1 + 3 * (RNG.random(n) > 0.97)))) * 0.5
    crushed = np.round(RNG.standard_normal(n) * 3) / 3
    gate = (np.floor(t * 70) % 2).astype(float)
    return lp(sq * 0.5 + crushed * 0.4, 5000) * gate * np.exp(-t * 9)


def sfx_low_hit():
    """A dark detuned low hit for a loss."""
    n = int(2.6 * SR)
    t = tt(n)
    f = hz(38)
    sig = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.06 * t) + 0.3 * np.sin(2 * np.pi * f * 1.5 * 1.03 * t)
    sig *= np.exp(-t * 1.6) * np.minimum(1, t / 0.004)
    return sig + lp(RNG.standard_normal(n), 400) * np.exp(-t * 8) * 0.4


def sfx_shimmer(root=86, dur=3.0):
    n = int(dur * SR)
    out = np.zeros(n)
    for i, iv in enumerate((0, 7, 12, 16, 19, 24)):
        b = bell(hz(root + iv), dur - i * 0.07)
        k = int(i * 0.07 * SR)
        out[k:k + len(b)] += b * 0.28
    return out



def sfx_burn(dur=2.2):
    """Embers: a low roar with sparse crackles, fading out."""
    n = int(dur * SR)
    t = tt(n) / dur
    roar = lp(hp(RNG.standard_normal(n), 120), 900) * 0.5
    pops = (RNG.random(n) > 0.9993) * RNG.standard_normal(n) * 6
    crackle = bp(pops, 1800, 7000)
    return (roar + crackle) * np.minimum(1, t / 0.08) * (1 - t) ** 1.3


# -------------------------------------------------------------------------------------------
# Word timing and cartoon sounds (the explainer and the shorts)


def wt(lid, word, nth=0):
    """When `word` is spoken in line `lid` (same estimate as the picture)."""
    l = LINE[lid]
    words = l["caption"].split(" ")
    w = [len(x) + 1 + (6 if x[-1] in ".?!" else 3 if x[-1] in ",:" else 0) for x in words]
    total = sum(w)
    acc = 0
    seen = 0
    for x, k in zip(words, w):
        if "".join(ch for ch in x if ch.isalnum() or ch in "'_").lower() == word.lower():
            if seen == nth:
                return l["start"] + acc / total * (l["end"] - l["start"])
            seen += 1
        acc += k
    raise KeyError(word)


def tw(t, t0, t1, a=0.0, b=1.0):
    u = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    u = u * u * (3 - 2 * u)
    return a + (b - a) * u


# -------------------------------------------------------------------------------------------
# Cartoon sounds


def sfx_pop(f=900, dur=0.12):
    n = int(dur * SR)
    t = tt(n)
    fr = f * (1.8 * np.exp(-t * 40) + 0.6)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 30) * np.minimum(1, t / 0.001)


def sfx_boing(f=180, dur=0.6):
    n = int(dur * SR)
    t = tt(n)
    fr = f * (1 + 0.5 * np.exp(-t * 4) * np.sin(2 * np.pi * 14 * t)) * (1 + 1.2 * t)
    sig = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
    return sig * np.exp(-t * 5) * np.minimum(1, t / 0.004)


def sfx_clink(f=2900):
    n = int(0.35 * SR)
    t = tt(n)
    sig = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 18), (2.76, 0.5, 30), (5.4, 0.25, 45)))
    return sig * np.minimum(1, t / 0.0005)


def sfx_clap():
    n = int(0.22 * SR)
    t = tt(n)
    noise = bp(RNG.standard_normal(n), 900, 5000)
    env = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        i = int(d * SR)
        env[i:] += np.exp(-tt(n - i) * (180 if k < 2 else 22)) * (0.7 if k < 2 else 1)
    return noise * env


def sfx_scratch(dur=0.5):
    n = int(dur * SR)
    t = tt(n) / dur
    noise = RNG.standard_normal(n)
    out = np.zeros(n)
    blocks = 40
    for b in range(blocks):
        i0, i1 = b * n // blocks, (b + 1) * n // blocks
        x = (b + 0.5) / blocks
        c = 600 + 2600 * abs(np.sin(x * np.pi * 2.5))
        seg = bp(noise[max(0, i0 - 1500):i1], c * 0.6, c * 1.6)
        out[i0:i1] = seg[-(i1 - i0):]
    return out * np.sin(np.pi * t) ** 0.5


def sfx_flip():
    n = int(0.16 * SR)
    t = tt(n) / 0.16
    return hp(RNG.standard_normal(n), 2500) * np.sin(np.pi * t) ** 2 * 0.8


def sfx_buzz(dur=0.45):
    n = int(dur * SR)
    t = tt(n)
    sq = np.sign(np.sin(2 * np.pi * 110 * t)) + 0.5 * np.sign(np.sin(2 * np.pi * 116 * t))
    return lp(sq, 2200) * np.minimum(1, t / 0.005) * np.exp(-t * 2.5) * 0.5


def sfx_wahwah():
    """Four falling notes on a muted horn: the sad trombone."""
    out = []
    for k, (m, d) in enumerate(((58, 0.42), (57, 0.42), (56, 0.42), (55, 1.2))):
        n = int(d * SR)
        t = tt(n)
        vib = 1 + (0.012 * np.sin(2 * np.pi * 6 * t) * np.minimum(1, t / 0.3) if k == 3 else 0)
        fr = hz(m) * vib * (1 - (0.03 * t if k == 3 else 0))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        sig = sum(np.sin(h * ph) / h ** 0.8 for h in range(1, 9))
        sig = lp(sig, 900 + 900 * np.exp(-t * 3)[0])
        out.append(sig * env_adsr(n, 0.03, 0.1, 0.8, 0.12))
    return np.concatenate(out) * 0.4


def sfx_alarm(dur=1.4):
    n = int(dur * SR)
    t = tt(n)
    gate = (np.sin(2 * np.pi * 18 * t) > 0).astype(float)
    return (np.sin(2 * np.pi * 2300 * t) + 0.6 * np.sin(2 * np.pi * 3100 * t)) * gate * np.exp(-t * 0.8) * 0.5


def sfx_beep(f=1600, dur=0.07):
    n = int(dur * SR)
    t = tt(n)
    return np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.002) * np.minimum(1, (dur - t) / 0.01)


def sfx_crickets(dur=2.5):
    n = int(dur * SR)
    t = tt(n)
    chirp = (np.sin(2 * np.pi * 4.4 * t) > 0.55).astype(float) * (np.sin(2 * np.pi * 34 * t) > 0).astype(float)
    return np.sin(2 * np.pi * 4700 * t) * lp(chirp, 300) * 0.4


def sfx_wind(dur=2.5):
    n = int(dur * SR)
    x = tt(n) / dur
    return bp(RNG.standard_normal(n), 300, 1400) * np.sin(np.pi * x) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * x * dur))


def sfx_party():
    """A party popper: crack plus a spray of sparkles."""
    n = int(0.08 * SR)
    t = tt(n)
    crack = hp(RNG.standard_normal(n), 1500) * np.exp(-t * 70)
    sp = sfx_shimmer(91, 1.4) * 0.6
    out = np.zeros(len(sp))
    out[:n] += crack * 1.4
    return out + sp


def sfx_zip(up=True, dur=0.22):
    n = int(dur * SR)
    t = tt(n) / dur
    f = (500 + 2500 * t) if up else (3000 - 2500 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t) * 0.6


# -------------------------------------------------------------------------------------------
# Narration


def narration():
    vo = np.zeros(N)
    meter = pyln.Meter(SR)
    for lid, line in LINE.items():
        x, sr = sf.read(VO / f"{lid}.wav")
        if x.ndim > 1:
            x = x.mean(axis=1)
        x = resample_poly(x, SR, sr)
        x = hp(x, 75)
        x = x * db(-19.0 - meter.integrated_loudness(np.pad(x, (0, max(0, SR // 2 - len(x))))))
        # gentle presence lift and de-boom
        x = x + 0.18 * bp(x, 2500, 6000) - 0.1 * bp(x, 180, 320)
        i = int(round(line["start"] * SR))
        vo[i:i + len(x)] += x[: max(0, min(len(x), N - i))]
    # a light leveling compressor
    env = np.sqrt(np.maximum(lp(vo ** 2, 12), 0) + 1e-9)
    thr = db(-24)
    gain = np.where(env > thr, (thr / env) ** (1 - 1 / 2.2), 1.0)
    vo = vo * gain * db(2.5)
    room = reverb(np.stack([vo, vo], axis=1), reverb_ir(0.9, 6000, 0.01)) * 0.06
    return np.stack([vo, vo], axis=1) * 0.98 + room, np.abs(vo)


# -------------------------------------------------------------------------------------------
# Mix + master


def keyframes(points):
    """Piecewise-linear gain curve from [(seconds, dB), ...]."""
    ts = np.array([p[0] for p in points])
    ds = np.array([p[1] for p in points])
    t = np.arange(N) / SR
    return db(np.interp(t, ts, ds))


def duck(vo_abs, depth_db=-10, attack=0.06, release=0.45, block=64):
    """Sidechain from the narration: duck fast when a word starts, recover slowly after."""
    env = lp(vo_abs, 8)
    on = np.clip(env / db(-34), 0, 1)
    nb = len(on) // block + 1
    v = np.pad(on, (0, nb * block - len(on))).reshape(nb, block).max(axis=1)
    a = np.exp(-block / (attack * SR))
    r = np.exp(-block / (release * SR))
    y = np.empty(nb)
    cur = 0.0
    for i in range(nb):
        cur = v[i] + (cur - v[i]) * (a if v[i] > cur else r)
        y[i] = cur
    out = lp(np.repeat(y, block)[: len(on)], 20)
    return db(depth_db * out)


def true_peak_limit(x, ceiling_db=-1.0, lookahead=0.004):
    """Lookahead brickwall on the 4x-oversampled peak.

    Hold the needed gain's minimum over ±lookahead, then average over a window no wider than the
    hold: every averaged value is then at most the gain needed at that sample, so nothing passes
    the ceiling, and the gain still moves smoothly.
    """
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    ceiling = db(ceiling_db)
    up = resample_poly(x, 4, 1, axis=0)
    peak = np.abs(up).max(axis=1)
    peak = np.pad(peak, (0, (-len(peak)) % 4)).reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    la = int(lookahead * SR)
    g = minimum_filter1d(need, size=2 * la + 1)
    g = uniform_filter1d(g, size=la + 1)
    return x * g[:, None]


def measure_tp(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)
