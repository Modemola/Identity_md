"""Short 01, Imdelivering: score and sound design, keyed to src/shorts/imdelivering.json.

    python audio/short_imdelivering.py     # writes out/imdelivering-mix.wav, -14 LUFS, true peak <= -1 dBTP
"""

import json
import os

os.environ.setdefault("KEPT_TIMELINE", "src/shorts/imdelivering.json")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, N, ROOT, SR, db, hz  # noqa: E402

Q = json.loads((ROOT / "src/shorts/imdelivering.json").read_text())["cues"]
BEAT = 60 / 112
BAR = 4 * BEAT
CMAJ = [48, 55, 64, 67, 72]
GMAJ = [43, 55, 62, 67, 71]
AMIN = [45, 52, 60, 64, 69]
FMAJ = [41, 53, 60, 65, 69]

# name, start, end, chords, brightness, bass steps per bar, arpeggio, drums (0 to 3)
SECTIONS = [
    ("list", 0.0, Q["scratch"], [CMAJ, GMAJ, AMIN, FMAJ], 0.75, 8, True, 3),
    ("check", Q["robots"], Q["stamp"], [AMIN, FMAJ, AMIN, GMAJ], 0.45, 8, False, 2),
    ("payoff", Q["stamp"], Q["card"], [CMAJ, FMAJ, GMAJ, CMAJ], 0.9, 8, True, 3),
    ("card", Q["card"], DUR + 1, [FMAJ, CMAJ], 0.8, 2, False, 0),
]


def grid(a, b, every):
    k = int(np.ceil(a / every))
    while k * every < b:
        yield k * every, k
        k += 1


def score():
    pad = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))
    for name, a, b, chords, bright, steps, arpeggio, kit in SECTIONS:
        t, i = a, 0
        while t < b - 0.05:
            ch = chords[i % len(chords)]
            length = min(BAR if name != "card" else b - t, b - t)
            n = int((length + 1.4) * SR)
            env = env_adsr(n, 0.05 if t == a else 0.15, 0.3, 0.8, 1.2, sustain_len=max(0, length - 0.4))
            for m in ch[1:]:
                add(pad, pad_voice(hz(m), n, bright=bright) * env[:, None], t, gain=0.12 / np.sqrt(len(ch)))
            step = BAR / steps
            for k in range(int(length / step + 0.5)):
                root = ch[0] - 12 + (12 if k % 2 and steps >= 8 else 0)
                add(bass, bass_note(hz(root), step * 0.7), t + k * step, gain=0.2)
            if arpeggio:
                notes = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 24, ch[4] + 12, ch[3] + 12, ch[1] + 24]
                for k in range(int(length / (BEAT / 2) + 0.5)):
                    add(arp, pluck(hz(notes[k % 8]), 0.8, bright=1.1), t + k * BEAT / 2, gain=0.1 * (1 if k % 2 == 0 else 0.65), pan=0.4 * np.sin(k * 1.7))
            t += length
            i += 1
        if kit:
            for gt, k in grid(a, b - 0.02, BEAT):
                add(drums, kick(0.6 if k % 2 == 0 else 0.45), gt, gain=0.4)
                if k % 2 == 1:
                    add(drums, sfx_clap(), gt, gain=0.2, pan=0.1)
            for gt, k in grid(a, b - 0.02, BEAT / 2):
                if k % 2:
                    add(drums, hat(0.09, 45), gt, pan=0.25)
            if kit >= 3:
                for gt, k in grid(a, b - 0.02, BEAT / 4):
                    add(drums, shaker(0.07 if k % 2 else 0.045), gt, pan=-0.3)
    ir = reverb_ir(2.0, 6000)
    return hp(pad + arp + bass + drums + reverb(pad * 0.5 + arp * 0.8, ir) * 0.4, 40)


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.2):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    put(sfx_impact(60, 0.9, 0.7), Q["im"], -14)
    for k, at in enumerate(Q["words"]):
        put(sfx_tick(2600 + 120 * k, 0.05), at, -18, pan=-0.3 + 0.08 * k)
        put(sfx_zip(True, 0.1), at - 0.04, -30)
    for at in np.arange(Q["scratch"], Q["freeze"], 1 / 30):
        put(sfx_tick(3400, 0.02), at, -26)
    put(sfx_scratch(0.5), Q["scratch"], -13, wet=0.1)
    put(sfx_low_hit(), Q["freeze"], -24)
    put(sfx_pop(700), Q["team"], -17, pan=-0.6)
    put(sfx_pop(1000), Q["team"] + 0.3, -21, pan=-0.4)
    for i in range(9):
        put(sfx_zip(True, 0.22), Q["robots"] + i * 0.06, -25, pan=0.8 - 0.15 * i)
    for k, at in enumerate(np.arange(Q["scan"] + 0.1, Q["votes"][0] - 0.1, 0.15)):
        put(sfx_beep(1400 + 300 * (k % 4), 0.05), at, -30, pan=[-0.6, 0, 0.6][k % 3])
    notes = [72, 74, 76, 79, 81, 84, 86, 88]
    y = 0
    for i, at in enumerate(Q["votes"]):
        if i == Q["no"]:
            put(sfx_buzz(0.3), at, -22)
            continue
        put(bell(hz(notes[y]), 0.9), at, -19, pan=-0.6 + 0.15 * i, wet=0.3)
        y += 1
        if y == 7:
            put(sfx_party(), at + 0.02, -16, wet=0.4)
    put(sfx_riser(0.5, 400, 2400), Q["stamp"] - 0.5, -24)
    put(sfx_impact(52, 2.2, 1.0), Q["stamp"] + 0.14, -9, wet=0.35)
    put(sfx_party(), Q["stamp"] + 0.16, -13, wet=0.4)
    put(sfx_shimmer(86, 2.4), Q["stamp"] + 0.3, -20, wet=0.6)
    for c in range(12):
        put(sfx_clink(2400 + 70 * c), Q["stamp"] + 0.3 + c * 0.08 + 0.6, -24, pan=-0.6)
    put(sfx_pop(900), Q["sub"], -22)
    put(sfx_whoosh(0.6, 300, 6000, 0.5), Q["card"] - 0.5, -22)
    put(sfx_impact(46, 3.0, 1.0), Q["card"], -12, wet=0.4)
    put(sfx_shimmer(84, 3.0), Q["card"] + 0.2, -20, wet=0.6)
    return fx + reverb(send, reverb_ir(1.6, 7000)) * 0.6


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    music = score() * keyframes([(0, -4), (Q["scratch"], -4), (Q["scratch"] + 0.03, -80), (Q["robots"] - 0.05, -80), (Q["robots"] + 0.4, -6), (Q["stamp"], -4), (Q["stamp"] + 0.1, 0), (Q["card"], -1), (DUR - 2.5, -2), (DUR - 0.1, -60), (DUR + 1, -80)])[:, None]
    fx = sound_design() * keyframes([(0, 0), (DUR - 0.6, 0), (DUR - 0.05, -60), (DUR + 1, -80)])[:, None]
    mix = hp((music * db(3) + fx)[: int(DUR * SR)], 25)
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS integrated, true peak {measure_tp(mix):.2f} dBTP")
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "imdelivering-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
