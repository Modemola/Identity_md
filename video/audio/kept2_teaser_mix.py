"""KEPT 2.0 teaser: 15 seconds of music, cut points on the beat (120 bpm), no voice.

    python audio/kept2_teaser_mix.py     # writes out/kept2-teaser-mix.wav, -14 LUFS
"""

import os

os.environ.setdefault("KEPT_TIMELINE", "kept2/teaser-timeline.json")
os.environ.setdefault("KEPT_VO", "kept2/audio-src")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, N, ROOT, SR, db, hz  # noqa: E402

BEAT = 0.5
BAR = 2.0
DMAJ = [38, 57, 62, 66, 69, 73]
BMIN = [35, 54, 59, 62, 66, 69]
GMAJ = [43, 55, 59, 62, 66, 71]
AMAJ = [45, 57, 61, 64, 69, 73]
EMIN = [40, 55, 59, 62, 67, 71]
CUTS = [2.0, 3.5, 6.0, 8.5, 10.0]
REVEAL = 10.1


def main():
    pad = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))
    fx = np.zeros((N, 2))
    # chords per bar: quiet open, a tense turn, the groove, then the reveal
    plan = [(0, BMIN), (2, EMIN), (4, DMAJ), (6, BMIN), (8, GMAJ), (10, DMAJ), (12, GMAJ), (13.0, DMAJ)]
    for i, (at, ch) in enumerate(plan):
        end = plan[i + 1][0] if i + 1 < len(plan) else DUR
        length = end - at
        n = int((length + 2.5) * SR)
        env = env_adsr(n, 0.3, 0.4, 0.8, 2.2, sustain_len=max(0, length - 0.4))
        bright = 0.35 if at < 3.5 else 0.8 if at >= 10 else 0.6
        for m in ch[1:]:
            add(pad, pad_voice(hz(m), n, bright=bright, detune=0.05) * env[:, None], at, gain=0.1 / np.sqrt(len(ch)))
        if at >= 3.5:
            k = 0
            while k * BEAT < length - 0.05:
                add(bass, bass_note(hz(ch[0]), BEAT * 0.8), at + k * BEAT, gain=0.14)
                k += 1
        notes = [ch[2] + 12, ch[4] + 12, ch[3] + 12, ch[5] + 12]
        k = 0
        step = BEAT / 2 if 3.5 <= at < 10 else BEAT
        while k * step < length - 0.05:
            add(arp, pluck(hz(notes[k % 4]), 1.2, bright=0.8), at + k * step, gain=0.07 * (1 if k % 2 == 0 else 0.6), pan=0.4 * np.sin(k * 1.4))
            k += 1
    # drums only through the app section
    b = 3.5
    while b < 9.5:
        add(drums, kick(0.55), b, gain=0.32)
        add(drums, hat(0.07, 50), b + BEAT / 2, pan=0.25)
        if int(round(b / BEAT)) % 2:
            add(drums, sfx_clap(), b, gain=0.1, pan=0.1)
        b += BEAT
    for k in range(4):
        add(drums, sfx_tick(2400 if k % 2 else 2000, 0.05), 2.0 + k * 0.375, gain=0.06, pan=0.3 if k % 2 else -0.3)

    def put(sig, at, g, pan=0.0):
        add(fx, sig, at, db(g), pan)

    put(sfx_shimmer(86, 2.0), 0.1, -30)
    put(sfx_low_hit(), 2.0, -20)
    put(sfx_riser(1.4, 200, 1400), 2.1, -30)
    for c in CUTS[1:4]:
        put(sfx_whoosh(0.6, 200, 4000, 0.6), c - 0.4, -26)
        put(sfx_impact(52, 1.2, 0.5), c, -24)
    put(sfx_riser(1.5, 150, 2000), REVEAL - 1.5, -26)
    put(sfx_impact(44, 3.4, 0.9), REVEAL, -14)
    put(sfx_shimmer(86, 3.6), REVEAL + 0.05, -20)
    for i, m in enumerate((74, 78, 81, 86)):
        put(bell(hz(m), 2.2), REVEAL + 0.15 + i * 0.09, -26, pan=-0.3 + 0.2 * i)
    put(bell(hz(90), 2.4), 12.3, -28, pan=0.2)

    ir = reverb_ir(2.6, 5500)
    music = pad + arp + bass + drums
    mix = hp(music + reverb(pad * 0.6 + arp * 0.9 + fx * 0.5, ir) * 0.45 + fx, 30)
    mix = mix * keyframes([(0, -40), (0.3, 0), (14.0, 0), (DUR - 0.05, -60), (DUR + 1, -80)])[:, None]
    mix = mix[: int(DUR * SR)]
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS, true peak {measure_tp(mix):.2f} dBTP")
    sf.write(ROOT / "out" / "kept2-teaser-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
