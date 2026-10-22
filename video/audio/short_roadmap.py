"""Short 02, POV your roadmap meets the swarm: score and sound, keyed to src/shorts/roadmap.json.

    python audio/short_roadmap.py     # writes out/roadmap-mix.wav, -14 LUFS, true peak <= -1 dBTP
"""

import json
import os

os.environ.setdefault("KEPT_TIMELINE", "src/shorts/roadmap.json")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, N, ROOT, SR, db, hz  # noqa: E402

Q = json.loads((ROOT / "src/shorts/roadmap.json").read_text())["cues"]
BEAT = 60 / 112
BAR = 4 * BEAT
CMAJ = [48, 55, 64, 67, 72]
GMAJ = [43, 55, 62, 67, 71]
AMIN = [45, 52, 60, 64, 69]
FMAJ = [41, 53, 60, 65, 69]

# name, start, end, chords, brightness, bass steps per bar, arpeggio, drums (0 to 3)
SECTIONS = [
    ("swagger", 0.0, Q["robots"], [CMAJ, FMAJ], 0.75, 8, True, 3),
    ("check", Q["robots"], Q["score"], [AMIN, FMAJ, AMIN, GMAJ], 0.45, 8, False, 2),
    ("verdict", Q["score"], Q["card"], [FMAJ, GMAJ, CMAJ, CMAJ], 0.9, 8, True, 3),
    ("card", Q["card"], DUR + 1, [FMAJ, CMAJ], 0.8, 2, False, 0),
]
VERDICT = [a + Q["scan"] + 0.5 for a in Q["items"]]


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

    put(sfx_pop(800), Q["title"] + 0.05, -20)
    put(sfx_impact(60, 0.9, 0.7), Q["poster"] + 0.38, -14, pan=-0.3)
    for i in range(4):
        put(pluck(hz(76 + [0, 2, 4, 7][i]), 0.5), Q["poster"] + 0.5 + i * 0.12, -24, pan=-0.3)
    put(sfx_pop(700), Q["team"], -18, pan=0.5)
    put(sfx_pop(1000), Q["team"] + 0.2, -22, pan=0.4)
    for k in range(9):
        put(sfx_zip(True, 0.22), Q["robots"] + k * 0.06, -25, pan=0.8 - 0.1 * k)
    for i, a in enumerate(Q["items"]):
        v = VERDICT[i]
        for k, at in enumerate(np.arange(a + 0.05, v - 0.45, 0.12)):
            put(sfx_beep(1400 + 300 * (k % 4), 0.05), at, -30, pan=[-0.2, 0.3, 0.6][k % 3])
        for k in range(9):
            yes = k < Q["yes"][i]
            put(sfx_tick(3000 if yes else 1500, 0.04), v - 0.45 + k * 0.05, -28, pan=0.6)
        if Q["yes"][i] >= 7:
            put(bell(hz(79 + 5 * i), 1.0), v, -17, pan=-0.3, wet=0.3)
            put(sfx_pop(1200), v, -20, pan=-0.3)
            for c in range(6):
                put(sfx_clink(2600 + 90 * c), v + 0.2 + c * 0.07 + 0.7, -24, pan=0.5)
        else:
            put(sfx_buzz(0.45), v, -17, pan=-0.3)
            put(sfx_impact(52, 1.0, 0.8), v, -16, pan=-0.3)
            put(sfx_burn(Q["score"] - v), v + 0.3, -20 + 3 * (i - 2), pan=-0.6, wet=0.2)
    put(sfx_wahwah()[: int(1.4 * SR)], VERDICT[3] + 0.3, -24, pan=0.4)
    put(sfx_whoosh(0.5, 300, 6000, 0.5), Q["score"] - 0.4, -20)
    put(sfx_impact(48, 1.8, 1.0), Q["score"], -11, wet=0.3)
    put(sfx_pop(900), Q["question"], -20)
    put(sfx_boing(170), Q["question"] + 0.35, -18)
    put(sfx_party(), Q["question"] + 0.4, -16, wet=0.4)
    put(sfx_whoosh(0.6, 300, 6000, 0.5), Q["card"] - 0.5, -22)
    put(sfx_impact(46, 3.0, 1.0), Q["card"], -12, wet=0.4)
    put(sfx_shimmer(84, 3.0), Q["card"] + 0.2, -20, wet=0.6)
    return fx + reverb(send, reverb_ir(1.6, 7000)) * 0.6


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    music = score() * keyframes([(0, -4), (Q["robots"], -4), (Q["robots"] + 0.5, -7), (Q["score"] - 0.1, -7), (Q["score"] + 0.1, -2), (Q["card"], -1), (DUR - 2.5, -2), (DUR - 0.1, -60), (DUR + 1, -80)])[:, None]
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
    sf.write(out / "roadmap-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
