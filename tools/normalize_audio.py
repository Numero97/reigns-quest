"""Gets Dad's recordings ready for the game.

Put recordings in audio_raw/ (named by line id, e.g. s01_d1.m4a, .wav or .mp3 also work),
then run from the project folder:   python tools/normalize_audio.py

For each one it trims silence at the start and end, evens out the loudness so every line
is about the same volume, and saves public/assets/audio/<id>.m4a. Needs ffmpeg.
Only files that are new or changed are redone.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "audio_raw"
OUT = ROOT / "public" / "assets" / "audio"
EXTS = {".m4a", ".wav", ".mp3", ".aac", ".caf", ".ogg", ".flac"}

TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05"
FILTER = f"{TRIM},areverse,{TRIM},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.05"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in RAW.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        print("No recordings found in audio_raw/")
        return
    for src in files:
        dst = OUT / f"{src.stem}.m4a"
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            print("up to date:", dst.name)
            continue
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", FILTER,
               "-ar", "44100", "-c:a", "aac", "-b:a", "128k", str(dst)]
        r = subprocess.run(cmd)
        print(("done:       " if r.returncode == 0 else "FAILED:     ") + dst.name)


if __name__ == "__main__":
    sys.exit(main())
