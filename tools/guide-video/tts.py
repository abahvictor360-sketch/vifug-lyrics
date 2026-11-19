"""Kokoro text-to-speech for guide videos.
  tts.py synth OUTDIR      reads OUTDIR/say.json, writes OUTDIR/line-N.wav and OUTDIR/tts.json (seconds per line)
  tts.py assemble OUTDIR VIDEO_OUT [INTRO.mp4]
                           mixes the lines at the recorded step times, makes the mp4, adds the logo intro.
Needs: pip install kokoro-onnx soundfile ; model files from the kokoro-onnx 'model-files-v1.0' release
(set KOKORO_DIR to the folder holding kokoro-v1.0.onnx and voices-v1.0.bin)."""
import json, os, subprocess, sys
import numpy as np, soundfile as sf

VOICE = os.environ.get("KOKORO_VOICE", "bf_emma")
SR = 24000

def synth(out):
    from kokoro_onnx import Kokoro
    d = os.environ["KOKORO_DIR"]
    k = Kokoro(f"{d}/kokoro-v1.0.onnx", f"{d}/voices-v1.0.bin")
    lines = json.load(open(f"{out}/say.json")); secs = []
    for i, t in enumerate(lines):
        if not t.strip(): secs.append(0.0); continue
        s, sr = k.create(t, voice=VOICE, speed=1.0, lang="en-gb")
        sf.write(f"{out}/line-{i}.wav", s, sr); secs.append(len(s) / sr)
    json.dump(secs, open(f"{out}/tts.json", "w")); print("synthesized", len(lines), "lines,", round(sum(secs), 1), "s of speech")

def assemble(out, vout, intro=None):
    info = json.load(open(f"{out}/steps.json")); total = info["total"]
    track = np.zeros(int((total + 1) * SR), dtype=np.float32)
    for st in info["steps"]:
        p = f"{out}/line-{st['i']}.wav"
        if not os.path.exists(p): continue
        s, sr = sf.read(p, dtype="float32"); a = int((st["start"] + 0.15) * SR)
        track[a:a + len(s)] += s[: max(0, len(track) - a)]
    sf.write(f"{out}/vo.wav", track[: int(total * SR)], SR)
    main = f"{out}/main.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{out}/raw.webm", "-i", f"{out}/vo.wav",
        "-filter_complex", "[0:v]fps=25,format=yuv420p[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,aformat=channel_layouts=mono[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "64k",
        "-shortest", "-movflags", "+faststart", main], check=True)
    if intro:
        here = os.path.dirname(os.path.abspath(__file__))
        subprocess.run([f"{here}/add_intro.sh", main, vout, intro], check=True)
    else:
        os.replace(main, vout)
    print("wrote", vout)

if __name__ == "__main__":
    if sys.argv[1] == "synth": synth(sys.argv[2])
    else: assemble(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
