"""KEPT launch trailer: a cinematic electronic score at 120 bpm, keyed to src/trailer/trailer.json.

    python audio/trailer_mix.py     # writes out/trailer-mix.wav, -14 LUFS, true peak <= -1 dBTP

Supersaw chords with sidechain pump, an 808 sub, a braam on the reveal, risers into every drop,
and a hit, ping or whoosh on every cut the picture makes.
"""

import json
import os

os.environ.setdefault("KEPT_TIMELINE", "src/trailer/trailer.json")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, N, ROOT, RNG, SR, db, hz  # noqa: E402

Q = json.loads((ROOT / "src/trailer/trailer.json").read_text())["cues"]
BEAT = 0.5
BAR = 2.0

DM = [38, 50, 57, 62, 65, 69]     # D minor
BB = [34, 46, 53, 58, 62, 65]     # Bb
FM = [41, 53, 57, 60, 65, 69]     # F
CM = [36, 48, 55, 60, 64, 67]     # C
PROG = [DM, BB, FM, CM]


# -------------------------------------------------------------------------------------------
# Synths


def saw(f, n, phase0=0.0):
    """Band-limited sawtooth (polyBLEP)."""
    f = np.broadcast_to(np.asarray(f, dtype=float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def supersaw(f, n, voices=7, detune=0.22, width=0.8):
    out = np.zeros((n, 2))
    for k in range(voices):
        d = (k / (voices - 1) - 0.5) * 2 * detune
        s = saw(f * 2 ** (d / 12), n, RNG.random())
        pan = (k / (voices - 1) - 0.5) * 2 * width
        a = (pan + 1) * np.pi / 4
        out[:, 0] += s * np.cos(a)
        out[:, 1] += s * np.sin(a)
    return out / voices


def chord(notes, dur, bright=0.5, attack=0.02, release=0.4):
    n = int(dur * SR)
    sig = sum(supersaw(hz(m), n) for m in notes) / len(notes)
    dark = lp(sig, 500 + 2500 * bright)
    sig = lp(sig, 1200 + 7000 * bright) * 0.6 + dark * 0.4
    return sig * env_adsr(n, attack, 0.2, 0.85, release)[:, None]


def sub808(f, dur, drive=1.6):
    n = int(dur * SR)
    t = tt(n)
    fr = f * (1 + 0.6 * np.exp(-t * 30))
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    s = np.tanh(s * drive) / np.tanh(drive)
    return s * np.minimum(1, t / 0.004) * np.exp(-t * (1.2 / dur))


def braam(notes, dur):
    """The cinematic horn blast: a low supersaw stack, filter opening, driven hard."""
    n = int(dur * SR)
    t = tt(n)
    sig = sum(supersaw(hz(m), n, voices=5, detune=0.35) for m in notes)
    opened = lp(sig, 2400)
    closed = lp(sig, 260)
    k = np.minimum(1, t / 0.35)[:, None]
    sig = closed * (1 - k) + opened * k
    sig = np.tanh(sig * 2.2)
    return sig * env_adsr(n, 0.01, 0.6, 0.55, dur * 0.6)[:, None]


def tight_kick(level=1.0):
    n = int(0.42 * SR)
    t = tt(n)
    f = 46 + 160 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(RNG.standard_normal(n), 3000) * np.exp(-t * 300) * 0.4
    return np.tanh((body + click) * 1.8) * level


def snare():
    n = int(0.3 * SR)
    t = tt(n)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    noise = bp(RNG.standard_normal(n), 1500, 9000) * np.exp(-t * 18)
    return tone * 0.5 + noise


def grains(dur, density=60, lo=2500, hi=7000):
    """A shimmer of tiny high grains: gold being poured."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for _ in range(int(dur * density)):
        at = int(RNG.random() * (n - SR // 10))
        g = int(0.04 * SR)
        f = RNG.uniform(lo, hi)
        tg = tt(g)
        s = np.sin(2 * np.pi * f * tg) * np.sin(np.pi * tg / tg[-1]) ** 2
        p = RNG.uniform(-0.8, 0.8)
        a = (p + 1) * np.pi / 4
        out[at:at + g, 0] += s * np.cos(a)
        out[at:at + g, 1] += s * np.sin(a)
    return out * np.sin(np.pi * np.linspace(0, 1, n))[:, None] ** 0.5


def reverse_swell(notes, dur):
    s = chord(notes, dur, bright=0.7, attack=0.01, release=0.05)
    s = reverb(s, reverb_ir(2.5, 6000))[: len(s)]
    s = s[::-1]
    return s * np.linspace(0, 1, len(s))[:, None] ** 2


# -------------------------------------------------------------------------------------------
# Score


def grid(a, b, every):
    k = int(np.ceil(a / every - 1e-9))
    while k * every < b - 1e-9:
        yield k * every, k
        k += 1


def score():
    pads = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))
    lead = np.zeros((N, 2))
    kicks = []

    def kick_at(t, lv=1.0):
        add(drums, tight_kick(lv), t, gain=0.55)
        kicks.append(t)

    # 0 to 3.9: drone, then a pulse that wants to start
    add(pads, chord([38, 50, 57], Q["shatter"] + 0.5, bright=0.15, attack=1.2, release=0.5), 0.0, gain=0.35)
    add(bass, sub808(hz(26), 3.9, drive=1.0), 0.0, gain=0.25)
    for gt, k in grid(Q["cardForm"], Q["shatter"], BEAT / 2):
        add(pads, chord(DM[1:4], 0.2, bright=0.2 + 0.5 * (gt - Q["cardForm"]) / 2.3, release=0.08), gt, gain=0.22)
    for gt, k in grid(Q["cardOn"], Q["shatter"], BEAT):
        kick_at(gt, 0.6)

    # 4.4 to 6: silence, then a reverse swell into the reveal
    add(pads, reverse_swell(DM[1:], Q["seal"] - Q["sphere"]), Q["sphere"], gain=0.45)
    # 6: the braam, then a held chord
    add(pads, braam([26, 38, 45, 50], 2.2), Q["seal"], gain=0.5)
    add(bass, sub808(hz(26), 2.2, drive=2.0), Q["seal"], gain=0.5)
    add(pads, chord(DM[1:], Q["pledge"] - Q["seal"] + 0.4, bright=0.4, attack=0.05), Q["seal"], gain=0.3)

    # 7 to 12: the groove
    a, b = Q["pledge"], Q["drop"]
    for i, (gt, k) in enumerate(grid(a, b, BAR)):
        ch = PROG[i % 4]
        build = 1.0 if gt < Q["deadline"] else 1.0 + (gt - Q["deadline"]) * 0.3
        for s, (st, kk) in enumerate(grid(gt, min(gt + BAR, b), BEAT / 2)):
            add(pads, chord(ch[2:], 0.22, bright=min(1, 0.35 + 0.2 * build + 0.3 * (st - a) / (b - a)), release=0.1), st, gain=0.24)
        add(bass, sub808(hz(ch[0]), BAR * 0.95, drive=1.4), gt, gain=0.32)
    for gt, k in grid(a, b - 0.01, BEAT):
        kick_at(gt, 0.85)
        if gt >= Q["milestones"] and k % 2:
            add(drums, sfx_clap(), gt, gain=0.3)
    for gt, k in grid(Q["milestones"], b, BEAT / 2):
        if k % 2:
            add(drums, hat(0.12, 50), gt, pan=0.3)
    # the roll into the drop
    t0 = Q["drop"] - 1.5
    for gt, k in grid(t0, Q["drop"], BEAT / 4):
        add(drums, snare(), gt, gain=0.06 + 0.2 * (gt - t0) / 1.5, pan=0.1)
    for gt, k in grid(Q["drop"] - 0.5, Q["drop"], BEAT / 8):
        add(drums, snare(), gt, gain=0.2, pan=-0.1)

    # 12 to 17: the drop
    a, b = Q["drop"], Q["brokenCard"]
    for i, (gt, k) in enumerate(grid(a, b, BAR)):
        ch = PROG[i % 4]
        add(pads, chord(ch[1:], BAR, bright=0.9, attack=0.005, release=0.3), gt, gain=0.4)
        for st, kk in grid(gt, min(gt + BAR, b), BEAT):
            add(bass, sub808(hz(ch[0] + (12 if kk % 4 == 3 else 0)), BEAT * 0.9, drive=2.2), st, gain=0.42)
        notes = [ch[3] + 12, ch[4] + 12, ch[5] + 12, ch[4] + 12]
        for st, kk in grid(gt, min(gt + BAR, b), BEAT / 4):
            add(lead, pluck(hz(notes[kk % 4]), 0.25, bright=1.3), st, gain=0.08, pan=0.5 * np.sin(kk * 1.3))
    for gt, k in grid(a, b - 0.01, BEAT):
        kick_at(gt, 1.0)
        if k % 2:
            add(drums, sfx_clap(), gt, gain=0.4)
    for gt, k in grid(a, b, BEAT / 4):
        add(drums, hat(0.1 if k % 2 else 0.06, 60), gt, pan=0.3 if k % 2 else -0.3)

    # 17 to 19: the burn, the floor drops out
    add(pads, chord([34, 46, 53, 58], 2.0, bright=0.15, attack=0.3), Q["brokenCard"], gain=0.4)
    add(bass, sub808(hz(22), 2.0, drive=2.5), Q["brokenCard"] + 0.25, gain=0.5)

    # 19 to 23: the numbers, half time
    for i, at in enumerate(Q["stats"]):
        ch = PROG[[0, 2, 3][i]]
        end = Q["stats"][i + 1] if i < 2 else Q["tagline"]
        add(pads, chord(ch[1:], end - at, bright=0.75, attack=0.005, release=0.4), at, gain=0.38)
        add(bass, sub808(hz(ch[0]), end - at, drive=2.0), at, gain=0.45)
        for gt, k in grid(at, end - 0.01, BEAT * 2):
            kick_at(gt, 1.0)
            add(drums, sfx_clap(), gt + BEAT, gain=0.32)
        for gt, k in grid(at, end, BEAT / 2):
            add(drums, hat(0.08, 60), gt, pan=0.3)

    # 23.5 to 26: the line, warm and open
    for i, ch in enumerate([FM, CM, DM]):
        at = Q["tagline"] - 0.2 + i * 0.85
        add(pads, chord(ch[1:], 1.4, bright=0.5, attack=0.25, release=0.6), at, gain=0.6)
        add(bass, sub808(hz(ch[0]), 0.85, drive=1.2), at + 0.2, gain=0.25)
    for gt, k in grid(Q["tagline"], Q["logo"], BEAT / 2):
        add(lead, pluck(hz([74, 77, 81, 79][k % 4]), 0.6, bright=0.9), gt, gain=0.12, pan=0.4 * np.sin(k))

    # 26 to 30: the mark
    add(pads, braam([26, 38, 45, 50, 57], 4.0), Q["logo"], gain=0.45)
    add(bass, sub808(hz(26), 3.6, drive=2.0), Q["logo"], gain=0.5)
    add(pads, chord([50, 57, 62, 64, 69], 4.0, bright=0.55, attack=0.05, release=2.0), Q["logo"], gain=0.35)

    # sidechain: everything melodic ducks under the kick
    pump = np.ones(N)
    tt_ = np.arange(N) / SR
    for k in kicks:
        i = int(k * SR)
        j = min(N, i + int(0.3 * SR))
        pump[i:j] = np.minimum(pump[i:j], 1 - 0.65 * np.exp(-(tt_[i:j] - k) / 0.09))
    ir = reverb_ir(2.4, 7000)
    melodic = (pads + lead) * pump[:, None]
    wet = reverb(melodic * 0.6, ir) * 0.35
    return hp(melodic + wet + bass * pump[:, None] ** 0.5 + drums, 30)


# -------------------------------------------------------------------------------------------
# Sound design: one sound per thing the picture does


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.25):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    put(bell(hz(74), 3.0), Q["promise"], -24, wet=0.6)
    put(sfx_whoosh(1.0, 200, 6000, 0.7), Q["cardForm"] - 0.2, -22, wet=0.3)
    put(sfx_shimmer(86, 1.6), Q["cardOn"], -28, wet=0.6)
    for i in range(4):
        put(sfx_glitch(0.12), Q["broken"] + 0.15 + i * 0.12, -28, pan=-0.3 + 0.2 * i)
    put(sfx_riser(0.9, 300, 3000), Q["shatter"] - 0.9, -22, wet=0.3)
    put(sfx_impact(52, 1.8, 0.8), Q["shatter"], -11, wet=0.35)
    glass = sum(bell(hz(m), 1.4) * 0.3 for m in (96, 99, 103, 106)) + hp(RNG.standard_normal(int(1.4 * SR)), 5000) * np.exp(-tt(int(1.4 * SR)) * 6) * 0.4
    put(glass, Q["shatter"], -18, wet=0.5)
    put(sfx_air(1.2), Q["introducing"] - 0.2, -24, wet=0.6)
    put(sfx_impact(40, 3.5, 1.2), Q["seal"], -8, wet=0.4)
    put(sfx_shimmer(86, 3.0), Q["seal"] + 0.1, -20, wet=0.7)

    put(sfx_whoosh(0.6, 300, 6000, 0.5), Q["pledge"] - 0.3, -22)
    for k in range(10):
        put(sfx_tick(2600 + 80 * k, 0.03), Q["pledge"] + 0.25 + k * 0.05, -32)
    put(sfx_click(), Q["lockClick"], -14)
    put(sfx_chime(86), Q["lockClick"] + 0.05, -24, wet=0.5)
    put(sfx_whoosh(0.6, 300, 6000, 0.5), Q["milestones"] - 0.3, -22)
    for i, at in enumerate(Q["locks"]):
        put(sfx_click(), at, -13, pan=-0.6 + 0.4 * i)
        put(sfx_impact(70, 0.4, 0.4), at, -24, pan=-0.6 + 0.4 * i)
    put(sfx_whoosh(0.8, 200, 5000, 0.6), Q["deadline"] - 0.4, -22)
    put(sfx_alarm(0.9), Q["deadline"] + 0.2, -34, pan=-0.5)
    for k, at in enumerate(np.arange(Q["beam"], Q["drop"] - 0.2, 0.12)):
        put(sfx_beep(1500 + 250 * (k % 4), 0.04), at, -32, pan=0.4)
    put(sfx_riser(1.5, 200, 4000), Q["drop"] - 1.5, -18, wet=0.3)

    put(sfx_impact(44, 2.4, 1.1), Q["drop"], -9, wet=0.35)
    notes = [74, 77, 79, 81, 84, 86, 89, 91]
    y = 0
    for i, at in enumerate(Q["votes"]):
        if i == Q["no"]:
            put(sfx_buzz(0.22), at, -22, pan=0.2)
            continue
        put(bell(hz(notes[y]), 0.8), at, -18, pan=-0.6 + 0.15 * i, wet=0.35)
        y += 1
        if y == 7:
            put(sfx_impact(56, 1.4, 0.8), at, -13, wet=0.35)
            put(sfx_shimmer(91, 1.8), at, -20, wet=0.6)
    for k, at in enumerate(np.arange(Q["votes"][7] + 0.15, Q["votes"][7] + 0.8, 0.035)):
        put(sfx_key(), at, -30, pan=0.2)
    put(sfx_impact(50, 1.6, 1.0), Q["kept"] + 0.12, -10, wet=0.35)
    put(sfx_click(), Q["kept"] + 0.12, -14)
    put(grains(1.8, 90), Q["stream"], -18, wet=0.4)
    for k in range(20):
        put(sfx_tick(3000 + 40 * k, 0.03), Q["stream"] + 0.5 + k * 0.055, -30, pan=0.6)

    put(sfx_low_hit(), Q["brokenCard"] + 0.25, -12, wet=0.35)
    put(sfx_impact(48, 1.4, 1.0), Q["brokenCard"] + 0.37, -12)
    put(sfx_burn(1.8), Q["burn"], -14, wet=0.25)
    put(sfx_riser(0.8, 200, 3000), Q["stats"][0] - 0.8, -22)
    for at in Q["stats"]:
        put(sfx_impact(46, 1.6, 1.0), at, -10, wet=0.4)
        put(sfx_whoosh(0.4, 400, 7000, 0.5), at - 0.25, -24)
    put(sfx_air(1.6), Q["tagline"] - 0.4, -22, wet=0.6)
    put(sfx_riser(1.8, 150, 2500), Q["logo"] - 1.8, -18, wet=0.4)
    put(sfx_impact(38, 4.0, 1.3), Q["logo"], -7, wet=0.45)
    put(sfx_shimmer(84, 3.6), Q["logo"] + 0.2, -18, wet=0.7)
    put(bell(hz(74), 3.0), Q["logo"] + 1.3, -24, wet=0.7)
    return fx + reverb(send, reverb_ir(2.2, 7000)) * 0.6


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    print("score…")
    music = score()
    print("sound design…")
    fx = sound_design()
    gate = keyframes([(0, -60), (0.3, 0), (Q["shatter"] + 0.25, 0), (Q["shatter"] + 0.55, -40), (Q["sphere"], -40), (Q["sphere"] + 0.6, -3), (Q["seal"], 0), (DUR - 1.2, 0), (DUR - 0.1, -60), (DUR + 1, -80)])
    mix = (music * db(2) + fx) * gate[:, None]
    mix = np.tanh(mix * 1.2) / 1.2  # gentle glue
    mix = hp(mix[: int(DUR * SR)], 25)
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS integrated, true peak {measure_tp(mix):.2f} dBTP")
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "trailer-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
