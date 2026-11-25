"""Explainer: lay the narration out on the film's clock and write src/explainer/timeline.json.

Picture (Remotion) and sound (audio/mix.py) both read timeline.json, so a line moving shifts its
scene, its captions and its sound cues together. Times are seconds.
"""
import contextlib
import json
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / "kept2"
FPS = 30
n = json.loads((HERE / "narration.json").read_text())
dur = {}
for sc in n["scenes"]:
    for l in sc["lines"]:
        with contextlib.closing(wave.open(str(HERE / "audio-src" / f"{l['id']}.wav"))) as w:
            dur[l["id"]] = w.getnframes() / w.getframerate()

# Each scene: lead-in before its first line, gaps after given lines, tail after the last.
PLAN = {
    "launch":     {"lead": 1.6, "gaps": {"K1": 2.6}, "tail": 3.0},            # the chart climbs, then the rug
    "again":      {"lead": 0.9, "gaps": {"K3": 1.8}, "tail": 2.4},
    "meet":       {"lead": 1.2, "gaps": {"K5": 1.6}, "tail": 3.8},            # the 2.0 logo lands
    "record":     {"lead": 0.9, "gaps": {"K7": 1.8, "K8": 0.9, "K9": 1.3}, "tail": 2.8},
    "money":      {"lead": 0.9, "gaps": {"K11": 0.9, "K12": 0.7, "K13": 2.2, "K14": 1.3}, "tail": 2.6},
    "groups":     {"lead": 0.9, "gaps": {"K16": 1.3}, "tail": 2.6},
    "live":       {"lead": 0.9, "gaps": {"K18": 1.1, "K19": 0.7}, "tail": 2.2},
    "telegram":   {"lead": 0.9, "gaps": {}, "tail": 3.2},
    "launchpads": {"lead": 0.9, "gaps": {}, "tail": 2.8},
    "promises":   {"lead": 0.9, "gaps": {"K23": 0.9, "K24": 1.4}, "tail": 3.4},
    "end":        {"lead": 1.2, "gaps": {"K26": 1.4}, "tail": 5.0},
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
(ROOT / "src" / "kept2" / "timeline.json").write_text(json.dumps(out, indent=2))
for s in scenes:
    print(f"{s['id']:8s} {s['start']:7.2f} -> {s['end']:7.2f}  ({s['end'] - s['start']:.1f}s)")
print("TOTAL", round(t, 2), "s =", f"{int(t // 60)}:{t % 60:05.2f}")
