"""Short 05, Vesting vs KEPT: score and sound, keyed to src/shorts3d/vesting.json.

    python audio/short_vesting.py     # writes out/vesting-mix.wav, -14 LUFS, true peak <= -1 dBTP

The trailer's synths (audio/trailer_mix.py) at 120 bpm: a swell into the drop, four bars that each
carry a clink for the left lane's unlock and nine rising pings plus a stamp for the right lane's
verdict, a breakdown on the result, a dark hit for "time isn't proof", a bright one for
"delivery is", a braam on the logo.
"""

import json
import os

os.environ["KEPT_TIMELINE"] = "src/shorts3d/vesting.json"

from kit import *  # noqa: E402,F401,F403
from kit import DUR, N, ROOT, SR, db, hz  # noqa: E402
from trailer_mix import braam, chord, grains, grid, reverse_swell, snare, sub808, tight_kick  # noqa: E402

Q = json.loads((ROOT / "src/shorts3d/vesting.json").read_text())["cues"]
BEAT = 0.5
BAR = 2.0
DM = [38, 50, 57, 62, 65, 69]
BB = [34, 46, 53, 58, 62, 65]
FM = [41, 53, 57, 60, 65, 69]
CM = [36, 48, 55, 60, 64, 67]
PROG = [DM, BB, FM, CM]
verdict = lambda k: Q["quarters"][k] + Q["verdict"]
unlock = lambda k: Q["quarters"][k] + Q["unlock"]
vote = lambda k, j: Q["quarters"][k] + Q["votes"] + j * 0.09


def score():
    pads = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    drums = np.zeros((N, 2))
    lead = np.zeros((N, 2))
    kicks = []

    def kick_at(t, lv=1.0):
        add(drums, tight_kick(lv), t, gain=0.55)
        kicks.append(t)

    add(pads, reverse_swell(DM[1:], Q["drop"]), 0.0, gain=0.4)
    add(bass, sub808(hz(26), 2.5, drive=1.0), 0.0, gain=0.2)
    for gt, k in grid(Q["lanes"], Q["drop"], BEAT / 2):
        add(drums, snare(), gt, gain=0.05 + 0.18 * (gt - Q["lanes"]) / (Q["drop"] - Q["lanes"]))
    a, b = Q["drop"], Q["result"]
    for i, (gt, k) in enumerate(grid(a, b, BAR)):
        ch = PROG[i % 4]
        add(pads, chord(ch[1:], BAR, bright=0.8, attack=0.005, release=0.3), gt, gain=0.36)
        for st, kk in grid(gt, gt + BAR, BEAT):
            add(bass, sub808(hz(ch[0] + (12 if kk % 4 == 3 else 0)), BEAT * 0.9, drive=2.0), st, gain=0.4)
        notes = [ch[3] + 12, ch[4] + 12, ch[5] + 12, ch[4] + 12]
        for st, kk in grid(gt, gt + BAR, BEAT / 4):
            add(lead, pluck(hz(notes[kk % 4]), 0.25, bright=1.2), st, gain=0.06, pan=0.5 * np.sin(kk * 1.3))
    for gt, k in grid(a, b - 0.01, BEAT):
        kick_at(gt, 1.0)
        if k % 2:
            add(drums, sfx_clap(), gt, gain=0.38)
    for gt, k in grid(a, b, BEAT / 4):
        add(drums, hat(0.1 if k % 2 else 0.06, 60), gt, pan=0.3 if k % 2 else -0.3)
    # the result: breakdown
    add(pads, chord([34, 46, 53, 58, 62], Q["timeNot"] - Q["result"], bright=0.35, attack=0.4, release=0.6), Q["result"], gain=0.45)
    add(bass, sub808(hz(22), 3.0, drive=1.5), Q["result"], gain=0.35)
    # time isn't proof: dark; delivery is: bright, driving
    add(pads, chord([38, 50, 53, 57], 1.1, bright=0.2, attack=0.005), Q["timeNot"], gain=0.45)
    add(bass, sub808(hz(26), 1.1, drive=2.5), Q["timeNot"], gain=0.5)
    add(pads, chord(FM[1:] + [72], Q["logo"] - Q["delivery"], bright=0.95, attack=0.005, release=0.3), Q["delivery"], gain=0.42)
    add(bass, sub808(hz(29), Q["logo"] - Q["delivery"], drive=2.0), Q["delivery"], gain=0.45)
    for gt, k in grid(Q["delivery"], Q["logo"] - 0.01, BEAT):
        kick_at(gt, 1.0)
    # the mark
    add(pads, braam([26, 38, 45, 50, 57], 4.0), Q["logo"], gain=0.45)
    add(bass, sub808(hz(26), 3.6, drive=2.0), Q["logo"], gain=0.5)
    add(pads, chord([50, 57, 62, 64, 69], 4.0, bright=0.55, attack=0.05, release=2.0), Q["logo"], gain=0.35)

    pump = np.ones(N)
    tt_ = np.arange(N) / SR
    for k in kicks:
        i = int(k * SR)
        j = min(N, i + int(0.3 * SR))
        pump[i:j] = np.minimum(pump[i:j], 1 - 0.6 * np.exp(-(tt_[i:j] - k) / 0.09))
    melodic = (pads + lead) * pump[:, None]
    wet = reverb(melodic * 0.6, reverb_ir(2.4, 7000)) * 0.35
    return hp(melodic + wet + bass * pump[:, None] ** 0.5 + drums, 30)


def sound_design():
    fx = np.zeros((N, 2))
    send = np.zeros((N, 2))

    def put(sig, at, gain_db, pan=0.0, wet=0.25):
        add(fx, sig, at, db(gain_db), pan)
        add(send, sig, at, db(gain_db) * wet, pan)

    put(sfx_whoosh(1.0, 200, 6000, 0.6), Q["title"] - 0.1, -22)
    for i, at in enumerate((Q["title"], Q["title"] + 0.25, Q["title"] + 0.45)):
        put(sfx_impact(60, 0.7, 0.6), at, -20, pan=[-0.5, 0, 0.5][i])
    put(sfx_riser(1.1, 200, 3000), Q["drop"] - 1.1, -20, wet=0.3)
    put(sfx_impact(44, 2.0, 1.1), Q["drop"], -10, wet=0.35)
    notes = [74, 77, 79, 81, 84, 86, 89, 91, 93]
    for k in range(4):
        q = Q["quarters"][k]
        put(sfx_whoosh(0.5, 300, 6000, 0.5), q - 0.3, -24, pan=0.1)
        # left: vesting pays, no questions asked
        put(sfx_clink(2600), unlock(k), -16, pan=-0.6)
        put(grains(1.0, 70, 2500, 6000), unlock(k) + 0.05, -24, pan=-0.6, wet=0.3)
        # right: nine votes, then the verdict
        kept = Q["kept"][k]
        y = 0
        for j in range(9):
            yes = j != 4 if kept else j < 2
            if yes:
                put(bell(hz(notes[y]), 0.5), vote(k, j), -24, pan=0.5, wet=0.3)
                y += 1
            else:
                put(sfx_buzz(0.12), vote(k, j), -28, pan=0.5)
        if kept:
            put(sfx_impact(52, 1.2, 0.9), verdict(k) + 0.12, -12, pan=0.4)
            put(sfx_shimmer(91, 1.4), verdict(k) + 0.15, -22, pan=0.5, wet=0.5)
            put(grains(1.2, 80), verdict(k) + 0.25, -22, pan=0.6, wet=0.3)
        else:
            put(sfx_low_hit(), verdict(k) + 0.12, -12, pan=0.4)
            put(sfx_burn(1.8), verdict(k) + 0.3, -16, pan=0.5)
    put(sfx_whoosh(1.2, 200, 4000, 0.5), Q["result"] - 0.2, -20)
    for k in range(10):
        put(sfx_tick(2400 + 80 * k, 0.03), Q["result"] + 0.5 + k * 0.05, -30)
    put(sfx_glitch(0.3), Q["timeNot"], -18)
    put(sfx_impact(40, 1.4, 1.2), Q["timeNot"], -10, wet=0.3)
    put(sfx_impact(46, 2.0, 1.1), Q["delivery"], -9, wet=0.4)
    put(sfx_shimmer(86, 1.6), Q["delivery"] + 0.05, -18, wet=0.6)
    put(sfx_riser(1.0, 200, 3000), Q["logo"] - 1.0, -20)
    put(sfx_impact(38, 4.0, 1.3), Q["logo"], -7, wet=0.45)
    put(sfx_shimmer(84, 3.6), Q["logo"] + 0.2, -18, wet=0.7)
    put(bell(hz(74), 3.0), Q["logo"] + 1.3, -24, wet=0.7)
    return fx + reverb(send, reverb_ir(2.2, 7000)) * 0.6


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    music = score()
    fx = sound_design()
    gate = keyframes([(0, -60), (0.2, 0), (DUR - 1.2, 0), (DUR - 0.1, -60), (DUR + 1, -80)])
    mix = (music * db(2) + fx) * gate[:, None]
    mix = np.tanh(mix * 1.2) / 1.2
    mix = hp(mix[: int(DUR * SR)], 25)
    meter = pyln.Meter(SR)
    for _ in range(3):
        mix = mix * db(-14.0 - meter.integrated_loudness(mix))
        mix = true_peak_limit(mix, -1.7)
    print(f"master: {meter.integrated_loudness(mix):.2f} LUFS integrated, true peak {measure_tp(mix):.2f} dBTP")
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out / "vesting-mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
