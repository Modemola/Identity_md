"""Narration: Kokoro-82M, voice af_heart.

    python audio/tts.py <kokoro-v1.0.onnx> <voices-v1.0.bin>

Model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Writes one wav per line to audio-src/, which build_timeline.py and mix.py read.
"""
import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

root = Path(__file__).resolve().parent.parent
spec = json.loads((root / "narration.json").read_text())
out = root / "audio-src"
out.mkdir(exist_ok=True)
tts = Kokoro(sys.argv[1], sys.argv[2])
for scene in spec["scenes"]:
    for line in scene["lines"]:
        samples, sr = tts.create(line["text"], voice=spec["voice"], speed=spec["speed"], lang="en-us")
        sf.write(out / f"{line['id']}.wav", samples, sr)
        print(line["id"], f"{len(samples) / sr:.2f}s")
