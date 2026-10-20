"""KEPT film: procedural score, sound design, narration placement, mix and master.

Reads src/timeline.json (the same timeline the picture renders from) so every hit lands on the
frame it belongs to, and audio-src/L*.wav (the narration). Writes out/mix.wav: 48 kHz stereo,
-14 LUFS integrated, true peak <= -1 dBTP.

    python audio/mix.py            # full mix
    python audio/mix.py --stems    # also write out/stem-{vo,music,sfx}.wav
"""

import sys

from kit import *  # noqa: F401,F403
from kit import DUR, E, L, LE, N, S, SR, db, hz

# -------------------------------------------------------------------------------------------
# Score


BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT

DM9 = [50, 57, 60, 64, 65]   # D A C E F
BB = [46, 53, 58, 62, 65]    # Bb F Bb D F
GM = [43, 50, 58, 62, 67]    # G D Bb D G
A7 = [45, 52, 57, 61, 64]    # A E A C# E
FMAJ9 = [41, 53, 57, 60, 64, 67]
CADD9 = [48, 55, 62, 64, 67]
BBMAJ7 = [46, 53, 57, 62, 65]
DMAJ9 = [50, 57, 61, 64, 66]

# swarm and verdict timing, as the picture has it
L7d = LE("L7") - L("L7")
PANEL = L("L7") + 0.42 * L7d
AGREE = [PANEL + 1.3 + k * 0.38 for k in range(8)]
KEPT_AT = L("L9") + 0.35
BURN_AT = L("L10") + 0.45
REVEAL = LE("L2") + 0.45

# (name, start, end, chords, brightness)
SECTIONS = [
    ("open", 0.0, REVEAL, [DM9, DM9], 0.25),
    ("reveal", REVEAL, S("problem"), [FMAJ9], 0.55),
    ("problem", S("problem"), L("L4") - 0.4, [DM9, BB, GM, A7], 0.35),
    ("problem-l4", L("L4") - 0.4, S("lock"), [GM, A7], 0.3),
    ("lock", S("lock"), S("swarm"), [DM9, FMAJ9, CADD9, BBMAJ7], 0.5),
    ("swarm", S("swarm"), L("L8"), [DM9, BB, FMAJ9, A7], 0.58),
    ("signed", L("L8"), S("verdict"), [DMAJ9, FMAJ9], 0.7),
    ("verdict", S("verdict"), L("L10"), [FMAJ9, CADD9], 0.6),
    ("burn", L("L10"), S("live"), [GM, A7], 0.3),
    ("live", S("live"), S("fund"), [DM9, FMAJ9, CADD9, BBMAJ7], 0.66),
    ("fund", S("fund"), S("proof"), [BBMAJ7, FMAJ9, CADD9, DM9], 0.6),
    ("proof", S("proof"), S("end"), [DM9, BBMAJ7, FMAJ9, CADD9], 0.72),
    ("end", S("end"), DUR + 1, [FMAJ9, DMAJ9], 0.55),
]
PULSE = {"problem": 2, "problem-l4": 1, "lock": 2, "swarm": 4, "signed": 2, "verdict": 2, "burn": 1, "live": 4, "fund": 2, "proof": 4}
ARP = ("lock", "swarm", "signed", "verdict", "live", "fund", "proof")


def score():
    pad = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))

    for name, a, b, chords, bright in SECTIONS:
        seg = 2 * BAR if len(chords) > 1 else (b - a)
        t = a
        i = 0
        while t < b - 0.05:
            ch = chords[i % len(chords)]
            length = min(seg, b - t)
            n = int((length + 2.2) * SR)
            env = env_adsr(n, 1.2 if t == a else 0.6, 0.5, 0.85, 2.0, sustain_len=max(0, length - 1.6))
            for m in ch:
                v = pad_voice(hz(m), n, bright=bright) * env[:, None]
                add(pad, v, t, gain=0.16 / np.sqrt(len(ch)))
            if name in PULSE:
                root = ch[0] - 12
                step = BAR / PULSE[name]
                k = 0
                while k * step < length - 0.05:
                    add(bass, bass_note(hz(root), min(step * 0.92, length - k * step)), t + k * step, gain=0.19 if PULSE[name] > 1 else 0.17)
                    k += 1
            if name in ARP:
                notes = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 24]
                step = BEAT / 2
                k = 0
                while k * step < length - 0.05:
                    if name == "lock" and k % 2:
                        k += 1
                        continue
                    vel = 0.9 if k % 2 == 0 else 0.6
                    add(arp, pluck(hz(notes[k % len(notes)]), 1.2, bright=0.8 + bright * 0.4), t + k * step, gain=0.105 * vel, pan=0.35 * np.sin(k * 1.3))
                    k += 1
            t += length
            i += 1

    def grid(a, b, every):
        k = int(np.ceil(a / every))
        while k * every < b:
            yield k * every, k
            k += 1

    for a, b, kl, hl in (
        (S("lock") + 2 * BAR, S("swarm"), 0.42, 0.0),
        (S("swarm") + 0.4, S("verdict"), 0.55, 0.05),
        (S("verdict"), L("L10"), 0.5, 0.04),
        (S("live") + BAR, S("fund"), 0.6, 0.06),
        (S("fund") + 0.4, S("proof"), 0.5, 0.045),
        (S("proof"), S("end") - 0.3, 0.62, 0.065),
    ):
        for gt, k in grid(a, b, BEAT):
            add(drums, kick(kl if k % 2 == 0 else kl * 0.7), gt, gain=0.38)
        if hl:
            for gt, k in grid(a, b, BEAT / 2):
                if k % 2:
                    add(drums, hat(hl * 1.5, 40), gt, pan=0.25)
            for gt, k in grid(a, b, BEAT / 4):
                add(drums, shaker(hl * (0.7 if k % 2 else 0.45)), gt, pan=-0.3)
    # the vesting clock: ticking under the problem
    for gt, k in grid(S("problem") + 0.6, L("L4") - 0.4, BEAT / 2):
        add(drums, sfx_tick(3400, 0.04), gt, gain=0.035 if k % 2 else 0.05, pan=0.2 if k % 2 else -0.2)

    ir = reverb_ir(3.0, 5200)
    dry = pad + arp * 0.85 + bass + drums
    wet = reverb(pad * 0.55 + arp * 0.9, ir) * 0.5
    d = int(BEAT * 0.75 * SR)
    echo = np.zeros_like(arp)
    echo[d:, 0] += arp[:-d, 1] * 0.32
    echo[2 * d:, 1] += arp[:-2 * d, 0] * 0.2
    return hp(dry + wet + echo, 40)


# -------------------------------------------------------------------------------------------
# Events: every hit mirrors a moment in the picture (see the scene files for the same times).


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.25):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    # --- open: the allocation unlocks, the roadmap stays unchecked, then the seal
    for i in range(12):
        put(sfx_clack(), L("L1") + 1.4 + i * 0.13, -27 + i * 0.3, pan=-0.5, wet=0.1)
    put(sfx_click(), L("L1") + 3.0, -19, pan=-0.5, wet=0.15)
    for i in range(4):
        put(sfx_tick(2600 + 160 * i, 0.06), L("L1") + 1.9 + i * 0.15, -29, pan=0.5, wet=0.35)
    put(sfx_glitch(0.22), L("L2") + 0.05, -27, pan=0.5, wet=0.2)
    put(sfx_riser(2.1, 140, 1600), REVEAL - 2.1, -22, wet=0.4)
    put(sfx_impact(46, 3.4), REVEAL, -9, wet=0.35)
    put(sfx_shimmer(86, 3.2), REVEAL + 0.4, -24, wet=0.6)

    for sid in ("problem", "lock", "swarm", "verdict", "live", "fund", "proof", "end"):
        put(sfx_air(1.4), S(sid) - 0.75, -27, wet=0.5)

    # --- problem: four months unlock, nothing shipped
    l3d = LE("L3") - L("L3") - 0.4
    for i in range(4):
        put(sfx_tick(1900 + 120 * i, 0.08), L("L3") + 0.6 + (i + 1) / 4 * l3d, -25, pan=-0.6 + 0.4 * i, wet=0.3)
    put(sfx_low_hit(), L("L4") + 1.3, -22, wet=0.3)

    # --- lock: the tranche, the four templates, the question
    l5 = lambda f: L("L5") + f * (LE("L5") - L("L5"))
    put(sfx_impact(58, 1.2, 0.5), l5(0.2), -21, wet=0.3)
    for i, f in enumerate((0.45, 0.6, 0.73, 0.86)):
        put(sfx_tick(2300 + 180 * i, 0.07), l5(f), -24, pan=-0.6 + 0.4 * i, wet=0.3)
    put(sfx_whoosh(0.9, 250, 4200, 0.6), L("L6") - 0.6, -25, pan=0.2, wet=0.3)
    put(sfx_chime(81), L("L6") + 1.7, -24, wet=0.5)

    # --- swarm: the panel forms, eight agree, one dissents, the verdict is signed
    put(sfx_whoosh(0.8, 400, 6000, 0.6), PANEL - 0.2, -25, pan=-0.4, wet=0.3)
    for k, at in enumerate(AGREE):
        put(sfx_tick(2200 + 140 * k, 0.07), at, -23, pan=-0.6 + 0.15 * k, wet=0.35)
    put(sfx_glitch(0.16), AGREE[-1] + 0.2, -29, pan=0.5, wet=0.2)
    put(sfx_chime(83), AGREE[6] + 0.05, -21, pan=0.3, wet=0.5)  # quorum, 7 of 9
    for i in range(14):
        put(sfx_key(), L("L8") + i * 0.085, -30, pan=0.4, wet=0.1)
    put(sfx_impact(50, 2.0, 0.8), L("L8") + 0.4, -16, wet=0.35)
    put(sfx_shimmer(86, 2.6), L("L8") + 0.5, -25, wet=0.6)

    # --- verdict: kept lands and pays out; broken burns
    put(sfx_click(), KEPT_AT, -15, pan=-0.4, wet=0.1)
    put(sfx_impact(56, 1.6, 0.8), KEPT_AT + 0.05, -14, pan=-0.3, wet=0.3)
    put(sfx_chime(86), KEPT_AT + 0.1, -21, pan=-0.3, wet=0.55)
    put(sfx_whoosh(1.6, 500, 6000, 0.5), KEPT_AT + 0.5, -27, pan=-0.4, wet=0.3)
    for i in range(10):
        put(sfx_tick(2800, 0.04), KEPT_AT + 0.6 + i * 0.17, -32, pan=-0.5, wet=0.2)
    put(sfx_click(), BURN_AT, -16, pan=0.4, wet=0.1)
    put(sfx_low_hit(), BURN_AT + 0.05, -14, pan=0.3, wet=0.35)
    put(sfx_burn(2.4), BURN_AT + 0.35, -20, pan=0.4, wet=0.3)

    # --- live: the real pledge, its two verdicts and the release
    l12 = lambda f: L("L12") + f * (LE("L12") - L("L12"))
    put(sfx_whoosh(0.9, 250, 4200, 0.6), L("L11") + 2.3, -25, pan=0.2, wet=0.3)
    put(sfx_impact(60, 1.2, 0.5), L("L11") + 3.4, -21, wet=0.3)
    for f in (0.27, 0.55):
        put(sfx_tick(2900, 0.1), l12(f) + 0.4, -22, pan=0.4, wet=0.4)
        put(sfx_chime(81 if f < 0.5 else 83), l12(f) + 0.45, -25, pan=0.3, wet=0.5)
    put(sfx_impact(52, 2.2, 0.9), l12(0.73) + 0.5, -14, wet=0.35)
    put(sfx_shimmer(86, 3.0), l12(0.73) + 0.6, -23, wet=0.6)

    # --- fund: four steps light up in turn
    l13 = lambda f: L("L13") + f * (LE("L13") - L("L13"))
    for i, f in enumerate((0.0, 0.22, 0.42, 0.72)):
        put(sfx_tick(2200 + 200 * i, 0.07), l13(f), -24, pan=-0.6 + 0.4 * i, wet=0.3)
        if i:
            put(sfx_whoosh(0.5, 600, 6000, 0.7), l13(f) - 0.4, -30, pan=-0.6 + 0.4 * i, wet=0.25)
    put(sfx_chime(86), l13(0.72) + 0.1, -23, pan=0.6, wet=0.5)

    # --- proof
    for dt in (0.1, 2.0, 3.2, 4.4):
        put(sfx_impact(62, 1.0, 0.45), L("L14") + dt, -21, wet=0.3)
        put(sfx_tick(3200, 0.08), L("L14") + dt, -26, wet=0.3)

    # --- end
    put(sfx_riser(1.6, 160, 1200), S("end") - 1.0, -26, wet=0.4)
    put(sfx_impact(44, 4.0, 1.0), S("end") + 0.6, -10, wet=0.45)
    put(sfx_shimmer(86, 4.0), S("end") + 0.9, -21, wet=0.65)
    put(sfx_chime(81), LE("L15") + 0.3, -25, wet=0.7)

    ir = reverb_ir(2.4, 6500)
    return fx + reverb(send, ir) * 0.8


def main():
    stems = "--stems" in sys.argv
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    print("narration…")
    vo, vo_abs = narration()
    print("score…")
    music = score()
    print("sound design…")
    fx = sound_design()

    # per-scene music level, before ducking (dB)
    music_curve = keyframes([
        (0.0, -40), (1.2, -6), (LE("L1"), -6), (LE("L2"), -3), (REVEAL + 0.6, 1.5), (E("open") - 1.0, 0), (E("open"), -4),
        (S("problem") + 1, -5), (L("L4"), -7), (S("lock"), -5), (S("swarm"), -4),
        (L("L8"), -3), (S("verdict"), -4.5), (L("L10"), -6), (S("live"), -4.5), (L("L12") + 8, -3),
        (S("fund"), -4.5), (S("proof"), -3.5), (S("end"), -1.5), (DUR - 3.0, -3), (DUR - 0.2, -60), (DUR + 1, -80),
    ])
    music = music * music_curve[:, None] * duck(vo_abs, -14)[:, None]
    fx = fx * duck(vo_abs, -4)[:, None]
    fx_curve = keyframes([(0, 0), (DUR - 1.0, 0), (DUR - 0.1, -60), (DUR + 1, -80)])
    fx = fx * fx_curve[:, None]

    mix = vo * db(0) + music * db(4.5) + fx * db(-2)
    mix = mix[: int(DUR * SR)]
    mix = hp(mix, 25)

    meter = pyln.Meter(SR)
    for _ in range(3):
        lufs = meter.integrated_loudness(mix)
        mix = mix * db(-14.0 - lufs)
        mix = true_peak_limit(mix, -1.7)
    lufs = meter.integrated_loudness(mix)
    tp = measure_tp(mix)
    print(f"master: {lufs:.2f} LUFS integrated, true peak {tp:.2f} dBTP")
    # fade the very ends to silence
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    if stems:
        for name, x in (("vo", vo), ("music", music * db(4.5)), ("sfx", fx * db(-2))):
            sf.write(out / f"stem-{name}.wav", x[: int(DUR * SR)].astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
