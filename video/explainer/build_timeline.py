"""Explainer: lay the narration out on the film's clock and write src/explainer/timeline.json.

Picture (Remotion) and sound (audio/mix.py) both read timeline.json, so a line moving shifts its
scene, its captions and its sound cues together. Times are seconds.
"""
import contextlib
import json
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / "explainer"
FPS = 30
n = json.loads((HERE / "narration.json").read_text())
dur = {}
for sc in n["scenes"]:
    for l in sc["lines"]:
        with contextlib.closing(wave.open(str(HERE / "audio-src" / f"{l['id']}.wav"))) as w:
            dur[l["id"]] = w.getnframes() / w.getframerate()

# Each scene: lead-in before its first line, gaps after given lines, tail after the last.
PLAN = {
    "hype":    {"lead": 1.2, "gaps": {"E1": 0.8}, "tail": 2.4},
    "dayone":  {"lead": 0.8, "gaps": {"E3": 1.2}, "tail": 2.2},
    "soon":    {"lead": 0.8, "gaps": {"E5": 1.6}, "tail": 2.6},   # the calendar flies between E5 and E6
    "trust":   {"lead": 0.8, "gaps": {"E7": 1.0}, "tail": 2.0},
    "meet":    {"lead": 0.8, "gaps": {"E9": 1.0}, "tail": 2.8},   # the seal lands after E10
    "vault":   {"lead": 0.8, "gaps": {"E11": 1.0}, "tail": 1.8},
    "swarm":   {"lead": 0.6, "gaps": {"E13": 0.8}, "tail": 3.6},  # the vote finishes after E14
    "verdict": {"lead": 0.6, "gaps": {"E15": 2.4}, "tail": 2.4},
    "real":    {"lead": 0.8, "gaps": {}, "tail": 2.6},
    "end":     {"lead": 0.8, "gaps": {"E18": 1.2}, "tail": 3.6},
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
(ROOT / "src" / "explainer" / "timeline.json").write_text(json.dumps(out, indent=2))
for s in scenes:
    print(f"{s['id']:8s} {s['start']:7.2f} -> {s['end']:7.2f}  ({s['end'] - s['start']:.1f}s)")
print("TOTAL", round(t, 2), "s =", f"{int(t // 60)}:{t % 60:05.2f}")
