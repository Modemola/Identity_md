"""Lay the narration out on the film's clock and write src/timeline.json.

Picture (Remotion) and sound (audio/mix.py) both read timeline.json, so a line moving shifts its
scene, its captions and its sound cues together. Times are seconds.
"""
import contextlib
import json
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FPS = 30
n = json.loads((ROOT / "narration.json").read_text())
dur = {}
for sc in n["scenes"]:
    for l in sc["lines"]:
        with contextlib.closing(wave.open(str(ROOT / "audio-src" / f"{l['id']}.wav"))) as w:
            dur[l["id"]] = w.getnframes() / w.getframerate()

# Each scene: lead-in before its first line, gaps after given lines, tail after the last.
PLAN = {
    "open":    {"lead": 1.6, "gaps": {"L1": 0.5}, "tail": 4.6},   # the seal reveal after L2
    "problem": {"lead": 0.8, "gaps": {"L3": 0.7}, "tail": 1.2},
    "lock":    {"lead": 0.8, "gaps": {"L5": 0.6}, "tail": 1.4},
    "swarm":   {"lead": 0.8, "gaps": {"L7": 1.2}, "tail": 1.4},   # the panel agrees between L7 and L8
    "verdict": {"lead": 0.6, "gaps": {"L9": 1.6}, "tail": 2.2},   # the stamp lands after L9, the burn after L10
    "live":    {"lead": 0.8, "gaps": {"L11": 0.9}, "tail": 1.8},
    "fund":    {"lead": 0.8, "gaps": {}, "tail": 1.4},
    "proof":   {"lead": 0.8, "gaps": {}, "tail": 2.4},
    "end":     {"lead": 1.4, "gaps": {}, "tail": 4.6},
}

t = 0.0
scenes, lines = [], []
for sc in n["scenes"]:
    p = PLAN[sc["id"]]
    start = t
    t += p["lead"]
    for l in sc["lines"]:
        lines.append({"id": l["id"], "scene": sc["id"], "start": round(t, 3), "end": round(t + dur[l["id"]], 3), "caption": l["caption"]})
        t += dur[l["id"]] + p["gaps"].get(l["id"], 0.0)
    t += p["tail"]
    scenes.append({"id": sc["id"], "start": round(start, 3), "end": round(t, 3)})

out = {"fps": FPS, "duration": round(t, 3), "frames": int(round(t * FPS)), "scenes": scenes, "lines": lines}
(ROOT / "src" / "timeline.json").write_text(json.dumps(out, indent=2))
for s in scenes:
    print(f"{s['id']:8s} {s['start']:7.2f} -> {s['end']:7.2f}  ({s['end'] - s['start']:.1f}s)")
print("TOTAL", round(t, 2), "s =", f"{int(t // 60)}:{t % 60:05.2f}")
