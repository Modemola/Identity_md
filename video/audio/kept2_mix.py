"""KEPT 2.0, the film: a warm, modern score and quiet product sound design, keyed to the timeline.

    python audio/kept2_mix.py     # writes out/kept2-mix.wav, -14 LUFS, true peak <= -1 dBTP

Word times are estimated exactly as src/kept2/kit.tsx estimates them, so every click and chime
lands on the frame the picture moves.
"""

import os

os.environ.setdefault("KEPT_TIMELINE", "src/kept2/timeline.json")
os.environ.setdefault("KEPT_VO", "kept2/audio-src")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, LINE, LE, L, N, ROOT, RNG, S, E, SR, SCENE, db, hz  # noqa: E402

TLS = [s["id"] for s in sorted(SCENE.values(), key=lambda s: s["start"])]

BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
# D major, voiced open
DMAJ = [38, 57, 62, 66, 69, 73]
BMIN = [35, 54, 59, 62, 66, 69]
GMAJ = [43, 55, 59, 62, 66, 71]
AMAJ = [45, 57, 61, 64, 69, 73]
EMIN = [40, 55, 59, 62, 67, 71]
FSH = [42, 54, 58, 61, 66, 70]

SELLS = wt("K2", "sells")
GONE = wt("K2", "gone")
KEPT = wt("K5", "KEPT")
EVEN = wt("K25", "Even")

SECTIONS = [
    # name, start, end, chords, brightness, bass pulse per bar, arp, drums
    ("open", 0.0, SELLS - 0.1, [DMAJ, BMIN, GMAJ, AMAJ], 0.65, 2, True, 1),
    ("fall", SELLS - 0.1, S("meet"), [BMIN, GMAJ, EMIN, FSH], 0.3, 1, False, 0),
    ("meet", S("meet"), KEPT - 0.05, [EMIN, AMAJ], 0.35, 1, False, 0),
    ("lift", KEPT - 0.05, S("record"), [DMAJ, GMAJ, BMIN, AMAJ], 0.75, 2, True, 0),
    ("record", S("record"), S("money"), [DMAJ, AMAJ, BMIN, GMAJ], 0.6, 4, True, 2),
    ("money", S("money"), S("groups"), [BMIN, GMAJ, DMAJ, AMAJ], 0.6, 4, True, 2),
    ("groups", S("groups"), S("live"), [GMAJ, AMAJ, BMIN, DMAJ], 0.65, 4, True, 3),
    ("live", S("live"), S("telegram"), [DMAJ, AMAJ, BMIN, GMAJ], 0.7, 4, True, 3),
    ("tg", S("telegram"), S("launchpads"), [GMAJ, DMAJ, AMAJ, BMIN], 0.65, 4, True, 2),
    ("pads", S("launchpads"), S("promises"), [DMAJ, AMAJ, GMAJ, GMAJ], 0.65, 4, True, 2),
    ("promise", S("promises"), EVEN - 0.1, [BMIN, GMAJ, DMAJ, AMAJ], 0.55, 2, True, 1),
    ("ours", EVEN - 0.1, S("end"), [GMAJ, AMAJ], 0.8, 2, True, 0),
    ("end", S("end"), DUR + 1, [DMAJ, GMAJ, DMAJ, DMAJ], 0.6, 1, True, 0),
]


def score():
    pad = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))

    def grid(a, b, every):
        k = int(np.ceil(a / every))
        while k * every < b:
            yield k * every, k
            k += 1

    for name, a, b, chords, bright, pulse, arpeggio, kit_ in SECTIONS:
        t = a
        i = 0
        while t < b - 0.05:
            ch = chords[i % len(chords)]
            length = min(BAR, b - t)
            n = int((length + 2.0) * SR)
            env = env_adsr(n, 0.6 if t == a else 0.25, 0.4, 0.8, 1.8, sustain_len=max(0, length - 0.6))
            for m in ch[1:]:
                add(pad, pad_voice(hz(m), n, bright=bright, detune=0.05) * env[:, None], t, gain=0.1 / np.sqrt(len(ch)))
            step = BAR / pulse
            k = 0
            while k * step < length - 0.05:
                add(bass, bass_note(hz(ch[0]), min(step * 0.85, length - k * step)), t + k * step, gain=0.16 if pulse < 4 else 0.13)
                k += 1
            if arpeggio:
                notes = [ch[2] + 12, ch[4] + 12, ch[3] + 12, ch[5] + 12, ch[2] + 24, ch[5] + 12, ch[4] + 12, ch[3] + 12]
                k = 0
                every = BEAT / 2
                while k * every < length - 0.05:
                    if not (name in ("end", "lift", "promise") and k % 2):
                        add(arp, pluck(hz(notes[k % 8]), 1.4, bright=0.8), t + k * every, gain=0.075 * (1 if k % 2 == 0 else 0.6), pan=0.45 * np.sin(k * 1.3))
                    k += 1
            t += length
            i += 1
        if kit_:
            for gt, k in grid(a, b - 0.02, BEAT):
                if k % 2 == 0 or kit_ >= 2:
                    add(drums, kick(0.5 if k % 2 == 0 else 0.32), gt, gain=0.3)
                if kit_ >= 2 and k % 2 == 1:
                    add(drums, sfx_clap(), gt, gain=0.08, pan=0.1)
            for gt, k in grid(a, b - 0.02, BEAT / 2):
                if k % 2:
                    add(drums, hat(0.07, 50), gt, pan=0.25)
            if kit_ >= 3:
                for gt, k in grid(a, b - 0.02, BEAT / 4):
                    add(drums, shaker(0.05 if k % 2 else 0.03), gt, pan=-0.3)
    # the repeat offender: a clock under "again"
    for gt, k in grid(S("again") + 0.3, S("meet") - 0.5, BEAT):
        add(drums, sfx_tick(2600 if k % 2 else 2000, 0.05), gt, gain=0.05, pan=0.3 if k % 2 else -0.3)

    ir = reverb_ir(2.8, 5500)
    dry = pad + arp + bass + drums
    wet = reverb(pad * 0.6 + arp * 0.9, ir) * 0.45
    d = int(BEAT * 0.75 * SR)
    echo = np.zeros_like(arp)
    echo[d:, 0] += arp[:-d, 1] * 0.22
    echo[d:, 1] += arp[:-d, 0] * 0.22
    return hp(dry + wet + echo, 35)


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.25):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    def click(at, pan=0.0):
        put(sfx_click(), at, -22, pan, wet=0.1)

    # act transitions: a soft air whoosh into every blur dissolve
    for sid in TLS[1:]:
        put(sfx_whoosh(0.9, 200, 4000, 0.6), S(sid) - 0.5, -27, wet=0.4)
        put(sfx_air(1.4), S(sid) - 0.3, -32, wet=0.5)

    # --- launch
    put(sfx_shimmer(86, 2.4), 0.4, -30, wet=0.7)
    piles = wt("K1", "piles")
    for i in range(9):
        put(sfx_pop(900 + 80 * (i % 4), 0.06), piles - 0.2 + i * 0.22 + 0.3, -32, pan=-0.6 if i % 2 == 0 else 0.6, wet=0.2)
    put(sfx_riser(1.6, 200, 900), SELLS - 1.6, -32, wet=0.4)
    put(sfx_low_hit(), SELLS + 0.05, -16)
    put(sfx_whoosh(0.7, 2000, 150, 0.2), SELLS + 0.1, -24)
    put(sfx_impact(42, 3.0, 1.0), GONE, -15, wet=0.5)

    # --- again: each wallet's launch rises then drops
    for at in (L("K3") + 0.1, wt("K3", "again", 1) - 0.1, wt("K3", "wallet") - 0.3):
        put(sfx_pop(700, 0.1), at, -26, wet=0.3)
        put(sfx_whoosh(0.4, 1800, 200, 0.2), at + 1.15, -30, wet=0.2)
    grid0 = L("K4") - 0.4
    for i in range(15):
        put(sfx_tick(3000 + 50 * i, 0.03), grid0 + 0.05 + ((i % 5) + i // 5) * 0.06, -36, pan=-0.6 + 0.3 * (i % 5))

    # --- meet: the reveal
    put(sfx_riser(2.0, 150, 1600), KEPT - 2.0, -28, wet=0.5)
    put(sfx_impact(48, 3.4, 0.8), KEPT, -15, wet=0.5)
    put(sfx_shimmer(86, 3.4), KEPT + 0.05, -22, wet=0.7)
    for i, m in enumerate((74, 78, 81, 86)):
        put(bell(hz(m), 2.0), KEPT + 0.12 + i * 0.09, -26, pan=-0.3 + 0.2 * i, wet=0.6)
    put(bell(hz(90), 2.0), wt("K5", "20") + 0.05, -26, pan=0.3, wet=0.6)

    # --- record: click, type, click
    type_at = wt("K7", "launch") - 0.3
    go = LE("K7") + 0.25
    click(type_at - 0.35, 0.1)
    for k in range(4):
        put(sfx_key(), type_at + k * 0.13, -26, pan=0.05)
    click(go, 0.2)
    put(sfx_whoosh(0.5, 400, 5000, 0.5), go + 0.2, -28, wet=0.3)
    for w in ("Red", "Amber", "Green", "Grey"):
        put(pluck(hz({"Red": 81, "Amber": 78, "Green": 85, "Grey": 74}[w]), 1.0, bright=0.7), wt("K9", w) - 0.1, -26, pan=0.5, wet=0.5)
    put(sfx_pop(1100), wt("K10", "63") - 0.05, -28, pan=0.5)
    put(sfx_pop(1300), wt("K10", "98") - 0.05, -28, pan=0.5)

    # --- money
    fund = L("K12") + 0.5
    for k in range(4):
        put(sfx_clink(2800 + 300 * k), fund + 0.4 + k * 1.3, -34, wet=0.4)
    put(sfx_whoosh(0.8, 300, 3000, 0.5), L("K13") - 1.0, -26, wet=0.3)
    for w in ("never", "8", "6"):
        put(sfx_pop(900), wt("K14", w) - 0.1, -28, pan=0.6)
    put(bell(hz(76), 1.6), wt("K15", "amber") - 0.1, -24, wet=0.5)

    # --- groups
    put(sfx_pop(800), wt("K16", "5") - 0.1, -28, pan=0.5)
    put(sfx_pop(1000), wt("K16", "139") - 0.1, -28, pan=0.6)
    q = wt("K17", "quarter")
    put(sfx_riser(0.9, 400, 1400), q - 0.2, -32, wet=0.4)
    put(bell(hz(81), 1.4), q + 0.7, -26, wet=0.5)

    # --- live
    vibe = wt("K18", "vibevibe")
    click(vibe - 0.1, 0.3)
    click(wt("K18", "IMD"), 0.3)
    every = wt("K19", "Every")
    for i in range(7):
        put(sfx_tick(2400, 0.04), every - 0.6 + i * 0.42, -32, pan=0.5)
    for i in range(3):
        put(sfx_pop(600 + 100 * i, 0.08), wt("K20", "Red") - 0.1 + i * 0.12, -30, pan=0.5)
    put(sfx_chime(84), wt("K20", "alerts") - 0.15, -24, pan=-0.4, wet=0.4)

    # --- telegram
    put(sfx_pop(900), wt("K21", "paste") - 0.1, -28, pan=0.3)
    put(sfx_whoosh(0.3, 600, 4000, 0.5), wt("K21", "record") - 0.2, -30, pan=0.3)
    click(wt("K21", "Watch") - 0.05, 0.3)
    put(sfx_chime(88), wt("K21", "sell") - 0.1, -22, pan=0.3, wet=0.4)

    # --- launchpads
    for w in ("badge", "share", "API"):
        put(sfx_pop(950), wt("K22", w) - 0.15, -28, pan=0.6)

    # --- promises
    put(sfx_impact(60, 0.8, 0.4), wt("K24", "Lock"), -26)
    for i in range(6):
        put(sfx_beep(1500 + 200 * (i % 3), 0.05), wt("K24", "swarm") + i * 0.14, -36, pan=-0.4 + 0.16 * i)
    kept = wt("K25", "Kept")
    for i, m in enumerate((79, 83, 86)):
        put(bell(hz(m), 1.6), kept + i * 0.08, -24, pan=-0.3, wet=0.5)
    missed = wt("K25", "Missed")
    put(sfx_low_hit(), missed + 0.05, -20, pan=0.3)
    put(sfx_burn(1.8), wt("K25", "burn") - 0.1, -26, pan=0.4, wet=0.2)
    put(sfx_impact(46, 2.6, 0.8), EVEN, -17, wet=0.5)

    # --- end
    logo = L("K27") - 0.5
    put(sfx_shimmer(86, 3.4), logo, -22, wet=0.7)
    put(sfx_impact(44, 3.4, 0.7), logo + 0.1, -18, wet=0.5)
    for i, m in enumerate((74, 78, 81, 86)):
        put(bell(hz(m), 2.4), logo + 0.2 + i * 0.1, -27, pan=-0.3 + 0.2 * i, wet=0.6)

    return fx + reverb(send, reverb_ir(2.0, 7000)) * 0.6


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    print("narration…")
    vo, vo_abs = narration()
    print("score…")
    music = score()
    print("sound design…")
    fx = sound_design()
    curve = keyframes([
        (0.0, -40), (1.2, -4), (SELLS, -4), (SELLS + 0.4, -7), (S("meet"), -9), (KEPT - 0.2, -6), (KEPT + 0.3, -1),
        (S("record"), -3), (S("promises"), -3), (EVEN - 0.2, -4), (EVEN + 0.2, 0), (S("end"), -2),
        (DUR - 2.0, -3), (DUR - 0.1, -60), (DUR + 1, -80),
    ])
    music = music * curve[:, None] * duck(vo_abs, -11)[:, None]
    fx = fx * duck(vo_abs, -3)[:, None] * keyframes([(0, 0), (DUR - 0.8, 0), (DUR - 0.05, -60), (DUR + 1, -80)])[:, None]
    mix = vo + music * db(3.0) + fx * db(-1)
    mix = hp(mix[: int(DUR * SR)], 25)
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS integrated, true peak {measure_tp(mix):.2f} dBTP")
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "kept2-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
