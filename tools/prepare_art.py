"""Turns the raw pictures in art_source/ into game-ready files in public/assets/.

Run from the project folder:   python tools/prepare_art.py

- Backgrounds are shrunk to 1024x768.
- Sprites sit on a flat colour (green). That colour is made see-through, the picture is
  trimmed to the edges of the drawing and shrunk to the height in the list below.
- Dialog faces are just shrunk (no cut-out).
To add a picture: add a line to the lists below, then run the script again.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art_source"
OUT = ROOT / "public" / "assets"

BACKGROUNDS = {  # source file -> game id
    "family_cabin.png": "bg_cabin_morning",
}
SPRITES = {  # source file -> (game id, final height in pixels)
    "paw_print.png": ("spr_pawprint", 160),
    "sprite_reign.png": ("spr_reign", 480),
    "sprite_dad.png": ("spr_dad", 480),
    "sprite_betsy.png": ("spr_betsy", 360),
}
# Window glow frames: full-room pictures with the window glowing. Only the window area is cut out
# (with soft edges) so it can be laid over the normal background and animated.
GLOW_FILES = ["family_cabine_glow_{n}.png", "family_cabin_glow_{n}.png"]   # either spelling works
GLOW_REGION = (735, 40, 1024, 330)   # left, top, right, bottom on the 1024x768 picture
GLOW_FEATHER = 40
FACES = {  # source file -> game id
    "face_dad_closed.png": "dad_face_closed",
    "face_dad_middle.png": "dad_face_middle",
    "face_dad_open.png": "dad_face_open",
}


def remove_flat_background(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(float)
    # background colour = average of the four corners
    corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]).mean(axis=0)
    dist = np.sqrt(((rgb - corners) ** 2).sum(axis=2))
    lo, hi = 45.0, 95.0  # below lo = background, above hi = picture, between = soft edge
    alpha = np.clip((dist - lo) / (hi - lo), 0, 1)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    # tidy the edge: pull away any background tint from half-see-through pixels
    edge = (alpha > 0) & (alpha < 1)
    for c in range(3):
        ch = out[:, :, c].astype(float)
        ch[edge] = np.clip((ch[edge] - corners[c] * (1 - alpha[edge])) / np.maximum(alpha[edge], 0.2), 0, 255)
        out[:, :, c] = ch.astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    for d in ("backgrounds", "sprites"):
        (OUT / d).mkdir(parents=True, exist_ok=True)

    for src, name in BACKGROUNDS.items():
        p = SRC / src
        if p.exists():
            Image.open(p).convert("RGB").resize((1024, 768), Image.LANCZOS).save(OUT / "backgrounds" / f"{name}.png", optimize=True)
            print("background:", name)

    for src, (name, height) in SPRITES.items():
        p = SRC / src
        if not p.exists():
            continue
        img = remove_flat_background(Image.open(p))
        img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
        w = round(img.width * height / img.height)
        img.resize((w, height), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
        print("sprite:", name)

    for n in (1, 2, 3):
        p = next((SRC / f.format(n=n) for f in GLOW_FILES if (SRC / f.format(n=n)).exists()), None)
        if not p:
            continue
        full = Image.open(p).convert("RGB").resize((1024, 768), Image.LANCZOS)
        l, t, r, b = GLOW_REGION
        patch = full.crop(GLOW_REGION).convert("RGBA")
        w, h = patch.size
        yy, xx = np.mgrid[0:h, 0:w]
        # fade to see-through toward the left, top and bottom edges (the right edge is the screen edge)
        edge = np.minimum.reduce([xx, yy, h - 1 - yy]).astype(float)
        a = np.clip(edge / GLOW_FEATHER, 0, 1)
        patch.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
        patch.save(OUT / "sprites" / f"spr_window_glow_{n}.png", optimize=True)
        print("window glow frame:", n, "centre", ((l + r) / 2, (t + b) / 2))

    for src, name in FACES.items():
        p = SRC / src
        if p.exists():
            Image.open(p).convert("RGB").resize((256, 256), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("face:", name)


if __name__ == "__main__":
    main()
