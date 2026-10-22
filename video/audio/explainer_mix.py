"""KEPT explainer: a bright, bouncy score and cartoon sound design, keyed to the explainer timeline.

    python audio/explainer_mix.py     # writes out/explainer-mix.wav, -14 LUFS, true peak <= -1 dBTP

Word times are estimated exactly as src/explainer/kit.tsx estimates them, so a pop lands on the
frame the picture pops.
"""

import os

os.environ.setdefault("KEPT_TIMELINE", "src/explainer/timeline.json")
os.environ.setdefault("KEPT_VO", "explainer/audio-src")

from kit import *  # noqa: E402,F401,F403
from kit import DUR, LINE, LE, L, N, ROOT, RNG, S, E, SR, SCENE, db, hz  # noqa: E402

TLS = [s["id"] for s in sorted(SCENE.values(), key=lambda s: s["start"])]


# -------------------------------------------------------------------------------------------
# Score: 112 bpm, C major, bouncy. The "coming soon" acts go sparse and minor.

BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
CMAJ = [48, 55, 64, 67, 72]
GMAJ = [43, 55, 62, 67, 71]
AMIN = [45, 52, 60, 64, 69]
FMAJ = [41, 53, 60, 65, 69]
DMIN = [50, 57, 62, 65, 69]
EMAJ = [40, 52, 59, 64, 68]

CATCH = (LINE["E3"]["start"] - 0.05, wt("E3", "On") - 0.1)  # the record scratch: music stops
SEAL = LINE["E10"]["start"] - 0.1 + 0.38

SECTIONS = [
    # name, start, end, chords, brightness, pulse, arp, drums
    ("hype", 0.0, S("dayone"), [CMAJ, GMAJ, AMIN, FMAJ], 0.75, 4, True, 2),
    ("dayone", S("dayone"), CATCH[0], [CMAJ], 0.6, 4, True, 2),
    ("catch", CATCH[1], S("soon"), [CMAJ, AMIN, FMAJ, GMAJ], 0.55, 2, True, 1),
    ("soon", S("soon"), S("trust"), [AMIN, FMAJ, DMIN, EMAJ], 0.3, 1, False, 0),
    ("trust", S("trust"), S("meet"), [DMIN, AMIN, FMAJ, EMAJ], 0.35, 2, False, 0),
    ("meet-q", S("meet"), SEAL, [FMAJ, GMAJ], 0.45, 1, False, 0),
    ("meet", SEAL, S("vault"), [CMAJ, FMAJ], 0.85, 2, True, 1),
    ("vault", S("vault"), S("swarm"), [CMAJ, FMAJ, AMIN, GMAJ], 0.7, 4, True, 2),
    ("swarm", S("swarm"), S("verdict"), [AMIN, FMAJ, CMAJ, GMAJ], 0.65, 4, True, 3),
    ("verdict", S("verdict"), S("real"), [CMAJ, GMAJ, FMAJ, CMAJ], 0.8, 4, True, 2),
    ("real", S("real"), S("end"), [FMAJ, GMAJ, CMAJ, AMIN], 0.85, 4, True, 3),
    ("end", S("end"), DUR + 1, [FMAJ, GMAJ, CMAJ, CMAJ], 0.85, 2, True, 1),
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

    for name, a, b, chords, bright, pulse, arpeggio, kit in SECTIONS:
        t = a
        i = 0
        while t < b - 0.05:
            ch = chords[i % len(chords)]
            length = min(BAR, b - t)
            n = int((length + 1.6) * SR)
            env = env_adsr(n, 0.4 if t == a else 0.15, 0.3, 0.8, 1.4, sustain_len=max(0, length - 0.6))
            for m in ch[1:]:
                add(pad, pad_voice(hz(m), n, bright=bright) * env[:, None], t, gain=0.12 / np.sqrt(len(ch)))
            step = BAR / pulse / 2 if pulse >= 4 else BAR / pulse
            k = 0
            while k * step < length - 0.05:
                root = ch[0] - 12 + (12 if (pulse >= 4 and k % 2) else 0)
                add(bass, bass_note(hz(root), min(step * 0.7, length - k * step)), t + k * step, gain=0.2)
                k += 1
            if arpeggio:
                notes = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 24, ch[4] + 12, ch[3] + 12, ch[1] + 24]
                k = 0
                while k * (BEAT / 2) < length - 0.05:
                    if not (name == "end" and k % 2):
                        add(arp, pluck(hz(notes[k % 8]), 0.9, bright=1.1), t + k * BEAT / 2, gain=0.1 * (1 if k % 2 == 0 else 0.65), pan=0.4 * np.sin(k * 1.7))
                    k += 1
            t += length
            i += 1
        if kit:
            for gt, k in grid(a, b - 0.02, BEAT):
                add(drums, kick(0.6 if k % 2 == 0 else 0.45), gt, gain=0.4)
                if k % 2 == 1:
                    add(drums, sfx_clap(), gt, gain=0.18, pan=0.1)
            if kit >= 2:
                for gt, k in grid(a, b - 0.02, BEAT / 2):
                    if k % 2:
                        add(drums, hat(0.09, 45), gt, pan=0.25)
            if kit >= 3:
                for gt, k in grid(a, b - 0.02, BEAT / 4):
                    add(drums, shaker(0.07 if k % 2 else 0.045), gt, pan=-0.3)
    # the coming-soon clock: tick, tock
    for gt, k in grid(S("soon") + 0.4, S("trust"), BEAT):
        add(drums, sfx_tick(3200 if k % 2 else 2400, 0.05), gt, gain=0.07, pan=0.3 if k % 2 else -0.3)

    ir = reverb_ir(2.2, 6000)
    dry = pad + arp + bass + drums
    wet = reverb(pad * 0.5 + arp * 0.8, ir) * 0.4
    d = int(BEAT * 0.75 * SR)
    echo = np.zeros_like(arp)
    echo[d:, 0] += arp[:-d, 1] * 0.25
    return hp(dry + wet + echo, 40)


# -------------------------------------------------------------------------------------------
# Events: every sound mirrors a moment in src/explainer/Acts*.tsx.


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.2):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    # transitions: whips, and an iris shimmer into "meet" and "end"
    for sid in TLS[1:]:
        if sid in ("meet", "end"):
            put(sfx_riser(1.2, 300, 2400), S(sid) - 1.1, -24, wet=0.4)
            put(sfx_shimmer(84, 2.0), S(sid) - 0.1, -24, wet=0.6)
        else:
            put(sfx_whoosh(0.6, 300, 6000, 0.5), S(sid) - 0.45, -22, wet=0.2)

    # --- hype
    team = wt("E1", "team")
    roadmap = wt("E1", "roadmap") - 0.25
    cheer = wt("E2", "Everyone's")
    put(sfx_zip(False, 0.35), 0.28, -28)
    put(sfx_clink(2600), 0.63, -16, wet=0.4)
    put(sfx_impact(70, 0.8, 0.5), 0.63, -22)
    put(sfx_shimmer(91, 1.4), 0.66, -26, wet=0.6)
    put(sfx_pop(700), team, -18)
    put(sfx_pop(1500, 0.08), team + 0.6, -24)
    put(sfx_impact(60, 0.9, 0.7), roadmap + 0.38, -16)
    for i, w in enumerate(("mobile", "Mainnet", "partnerships")):
        put(pluck(hz(76 + [0, 4, 7][i]), 0.6), wt("E2", w), -20, pan=0.4)
    put(pluck(hz(84), 0.8), cheer + 0.5, -20, pan=0.4)
    for i in range(4):
        put(sfx_pop(500 + 140 * i), cheer + i * 0.08, -20, pan=[-0.8, -0.5, 0.5, 0.8][i])
    put(sfx_party(), cheer + 0.1, -18, pan=-0.6, wet=0.4)
    put(sfx_party(), cheer + 0.2, -18, pan=0.6, wet=0.4)
    put(sfx_pop(1100), cheer + 0.3, -22, pan=-0.3)
    put(sfx_pop(1300), cheer + 0.5, -22, pan=0.4)

    # --- day one: the record scratch, the pile, the lock, the calendar
    put(sfx_scratch(0.5), CATCH[0] - 0.05, -14, wet=0.1)
    pile = wt("E3", "holds") - 0.3
    for k in range(36):
        put(sfx_clink(2400 + 900 * RNG.random()), pile + k * 0.045 + 0.3, -30 + (k % 3), pan=RNG.uniform(-0.4, 0.6), wet=0.1)
    put(sfx_boing(160), wt("E3", "giant"), -18)
    lock = wt("E4", "locked") - 0.1
    put(sfx_impact(50, 1.6, 1.0), lock + 0.38, -13, wet=0.3)
    for k in range(10):
        put(sfx_clack(), lock + 0.4 + k * 0.05, -24, pan=-0.4 + 0.08 * k)
    put(sfx_click(), lock + 0.6, -18)
    month = wt("E4", "month") - 0.4
    put(sfx_pop(900), month - 0.4, -22, pan=0.7)
    put(sfx_flip(), month, -18, pan=0.7)
    for i in range(3):
        put(sfx_clink(3000), month + 0.6 + i * 0.18 + 0.7, -22, pan=-0.2)

    # --- coming soon
    E5 = LINE["E5"]
    cal = wt("E5", "calendar")
    year = wt("E6", "later")
    mfun = lambda t: min(12, tw(t, cal, cal + 0.6) + tw(t, E5["end"] + 0.1, year, 0, 11))
    k = 0
    for tt_ in np.arange(S("soon"), E("soon"), 1 / 120):
        while k < 12 and mfun(tt_) >= k + 0.5:
            put(sfx_flip(), tt_, -20, pan=-0.5)
            put(sfx_clink(3200), tt_ + 0.65, -27, pan=-0.7)
            k += 1
    put(sfx_impact(70, 0.6, 0.4), wt("E5", "never"), -18, pan=0.5)
    put(sfx_buzz(0.3), wt("E5", "never") + 0.02, -26, pan=0.5)
    put(sfx_boing(140, 0.8), wt("E6", "coming") - 0.2, -18, pan=0.3)
    put(sfx_pop(600), wt("E6", "app") + 0.1, -22, pan=0.2)
    tail = LINE["E6"]["end"] + 0.2
    put(sfx_wind(E("soon") - tail + 0.5), tail - 0.3, -22, pan=0.3, wet=0.3)
    put(sfx_crickets(2.6), year + 0.8, -32, pan=0.5)

    # --- trust
    E7 = LINE["E7"]
    put(sfx_pop(800), E7["start"] + 0.2, -22, pan=-0.3)
    put(sfx_pop(950), E7["start"] + 0.35, -22, pan=0.3)
    put(pluck(hz(84), 0.6), wt("E7", "builders"), -20, pan=-0.3)
    put(pluck(hz(72), 0.6), wt("E7", "talkers"), -20, pan=0.3)
    same = wt("E7", "same") - 0.3
    put(bell(hz(79), 1.2), same, -22)
    put(sfx_wahwah(), wt("E8", "trust") - 0.2, -20, wet=0.3)
    put(sfx_zip(False, 0.3), wt("E8", "honest") + 0.2, -24, pan=-0.5)

    # --- meet: the question, then the seal
    put(sfx_riser(2.4, 160, 1800), SEAL - 2.4, -22, wet=0.4)
    put(sfx_impact(46, 3.0, 1.0), SEAL, -10, wet=0.35)
    put(sfx_party(), SEAL + 0.02, -15, wet=0.4)
    for i in range(4):
        put(pluck(hz([72, 76, 79, 84][i]), 0.8), wt("E10", "KEPT") + i * 0.08, -18, pan=-0.3 + 0.2 * i)
    put(sfx_chime(84), LINE["E10"]["end"] + 0.3, -22, wet=0.5)

    # --- vault
    vland = S("vault") + 0.15 + 0.38
    put(sfx_impact(44, 1.8, 1.0), vland, -12, wet=0.25)
    throw = wt("E11", "locks") - 0.1
    for k in range(12):
        put(sfx_zip(True, 0.12), throw + k * 0.12, -32, pan=-0.6)
        put(sfx_clink(2600 + 120 * (k % 4)), throw + k * 0.12 + 0.55, -24, pan=-0.3 + 0.2 * (k % 4))
    split = wt("E11", "split")
    for i in range(4):
        put(sfx_click(), split + i * 0.15 + 0.2, -18, pan=-0.3 + 0.2 * i)
    put(sfx_pop(1200), wt("E11", "anyone") - 0.1, -22, pan=0.7)
    for i, w in enumerate(("release", "website", "Deploy", "number")):
        at = wt("E12", w) - 0.15
        put(sfx_pop(700 + 120 * i), at, -18, pan=-0.3 + 0.2 * i)
        put(bell(hz(79 + [0, 2, 4, 7][i]), 1.0), at + 0.08, -24, pan=-0.3 + 0.2 * i, wet=0.4)

    # --- swarm
    hit = wt("E13", "hits")
    t0 = S("swarm") + 0.1
    for k, at in enumerate(np.arange(t0, hit, BEAT / 2)):
        put(sfx_tick(3000 if k % 2 else 2200, 0.05), at, -24, pan=0.2 if k % 2 else -0.2)
    put(sfx_alarm(1.4), hit, -20)
    put(sfx_buzz(0.5), wt("E13", "word"), -18, pan=-0.4)
    swarm = wt("E14", "swarm") - 0.2
    for i in range(9):
        put(sfx_zip(True, 0.25), swarm + i * 0.07, -26, pan=0.8 - 0.15 * i)
    look = wt("E14", "look") - 0.2
    agree = wt("E14", "agree") - 0.2
    for k, at in enumerate(np.arange(look + 0.6, agree, 0.16)):
        put(sfx_beep(1400 + 300 * (k % 4), 0.05), at, -32, pan=[-0.6, 0, 0.6][k % 3])
    yes_notes = [72, 74, 76, 79, 81, 84, 86, 88]
    y = 0
    for i in range(9):
        at = agree + 0.6 + i * 0.3
        if i == 5:
            put(sfx_buzz(0.3), at, -22, pan=0.1)
        else:
            put(bell(hz(yes_notes[y]), 0.9), at, -20, pan=-0.6 + 0.15 * i, wet=0.3)
            y += 1
            if y == 7:
                put(sfx_party(), at + 0.02, -15, wet=0.4)
                put(sfx_impact(58, 1.2, 0.6), at, -16)

    # --- verdict
    kept = wt("E15", "kept") + 0.1
    put(sfx_impact(56, 1.4, 0.9), kept + 0.14, -11, pan=-0.4)
    put(sfx_party(), kept + 0.2, -17, pan=-0.5, wet=0.4)
    go = wt("E15", "go") - 0.2
    for k in range(14):
        put(sfx_clink(2400 + 700 * RNG.random()), go + k * 0.09 + 0.7, -24, pan=-0.5)
    broken = wt("E16", "broken") + 0.1
    put(sfx_impact(48, 1.6, 1.0), broken + 0.14, -11, pan=0.4)
    put(sfx_low_hit(), broken + 0.15, -18, pan=0.4)
    burn = wt("E16", "burn") - 0.2
    put(sfx_burn(E("verdict") - burn), burn, -16, pan=0.5, wet=0.2)
    put(sfx_wahwah()[: int(1.2 * SR)], wt("E16", "Gone"), -26, pan=0.5)

    # --- real
    locked = wt("E17", "locked")
    for k in range(18):
        put(sfx_tick(2600 + 60 * k, 0.04), locked + k * 0.08, -28)
    put(sfx_impact(60, 1.0, 0.5), locked + 1.4, -18)
    put(sfx_pop(900), wt("E17", "Robinhood"), -20, pan=0.4)
    two = wt("E17", "two")
    put(sfx_pop(1100), two, -20, pan=0.4)
    put(sfx_impact(62, 0.8, 0.5), two + 0.55, -17, pan=0.5)
    put(sfx_impact(62, 0.8, 0.5), two + 0.8, -17, pan=0.6)
    put(sfx_party(), two + 0.6, -17, pan=0.6, wet=0.4)

    # --- end
    mp = LINE["E18"]["start"] - 0.5
    put(sfx_impact(60, 0.9, 0.7), mp + 0.38, -16, pan=-0.4)
    cross = wt("E18", "roadmap") + 0.1
    put(sfx_whoosh(0.25, 800, 6000, 0.5), cross, -20, pan=-0.4)
    put(sfx_whoosh(0.25, 800, 6000, 0.5), cross + 0.2, -20, pan=-0.4)
    put(sfx_pop(800), wt("E18", "Check") - 0.1, -16, pan=0.3)
    logo = LINE["E19"]["start"] - 0.2
    put(sfx_impact(44, 3.4, 1.0), logo + 0.1, -11, wet=0.4)
    put(sfx_shimmer(86, 3.2), logo + 0.3, -20, wet=0.6)
    put(sfx_party(), logo + 0.5, -16, wet=0.4)
    for i in range(6):
        put(sfx_pop(600 + 110 * i), logo + 0.3 + i * 0.07, -24, pan=-0.8 + 0.32 * i)

    return fx + reverb(send, reverb_ir(1.8, 7000)) * 0.6


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
        (0.0, -30), (0.5, -3), (CATCH[0], -3), (CATCH[0] + 0.02, -60), (CATCH[1] - 0.05, -60), (CATCH[1] + 0.3, -5),
        (S("soon"), -6), (S("trust"), -6), (S("meet"), -7), (SEAL - 0.1, -4), (SEAL + 0.2, 0), (S("vault"), -3),
        (S("swarm"), -3), (S("verdict"), -2.5), (S("real"), -2.5), (S("end"), -1.5), (DUR - 2.0, -2.5), (DUR - 0.1, -60), (DUR + 1, -80),
    ])
    music = music * curve[:, None] * duck(vo_abs, -12)[:, None]
    fx = fx * duck(vo_abs, -3)[:, None] * keyframes([(0, 0), (DUR - 0.8, 0), (DUR - 0.05, -60), (DUR + 1, -80)])[:, None]
    mix = vo + music * db(4.0) + fx * db(-1)
    mix = hp(mix[: int(DUR * SR)], 25)
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS integrated, true peak {measure_tp(mix):.2f} dBTP")
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "explainer-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
