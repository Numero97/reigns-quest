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
    "cabin_outside.png": "bg_cabin_outside",
    "sunlit_forest_trail.png": ("bg_forest_trail", 0.45),   # wide picture: cropped to 4:3; 0.45 = how far across to centre the crop
}
SPRITES = {  # source file -> (game id, final height in pixels)
    "paw_print.png": ("spr_pawprint", 160),
    "sprite_reign.png": ("spr_reign", 480),
    "sprite_reign_surprised.png": ("spr_reign_surprised", 480),
    "sprite_dad.png": ("spr_dad", 480),
    "sprite_betsy.png": ("spr_betsy", 360),
}
SPRITES_BY_WIDTH = {  # source file -> (game id, width in pixels). Keeps the whole set the same size.
    "Log_1 (1).png": ("spr_log_1", 230),
    "Log_1.png": ("spr_log_1", 230),
    "Log_2.png": ("spr_log_2", 230),
    "Log_3.png": ("spr_log_3", 230),
    "Log_4.png": ("spr_log_4", 230),
    "Log_5.png": ("spr_log_5", 230),
    "snake_wrapped_around_trunk.png": ("spr_snake_trunk", 250),
    "snake_wrapped_around_branch.png": ("spr_snake_branch", 400),
    "snake_ground.png": ("spr_snake_ground", 440),
    "log_stack_1.png": ("spr_log_stack_1", 150),   # one log
    "log_stack_2.png": ("spr_log_stack_2", 175),
    "log_stack_3.png": ("spr_log_stack_3", 195),
    "log_stack_4.png": ("spr_log_stack_4", 205),
    "log_stack_5.png": ("spr_log_stack_5", 215),
}
# Window glow frames: full-room pictures with the window glowing. Only the window area is cut out
# (with soft edges) so it can be laid over the normal background and animated.
GLOW_FILES = ["family_cabine_glow_{n}.png", "family_cabin_glow_{n}.png"]   # either spelling works
GLOW_REGION = (735, 40, 1024, 330)   # left, top, right, bottom on the 1024x768 picture
GLOW_FEATHER = 40
# Poses that must be drawn at the same size as another picture (so swapping them doesn't make her grow or shrink)
SAME_SIZE_AS = {"sprite_reign_surprised.png": "sprite_reign.png"}
# Snake head frames for the dialog box: green removed, same square canvas for all three so the mouth does not jump
CUTOUT_FACES = {"snake_head_closed.png": "snake_head_closed", "snake_head_middle.png": "snake_head_middle", "snake_head_open.png": "snake_head_open"}
FACES = {  # source file -> game id
    "face_dad_closed.png": "dad_face_closed",
    "face_dad_middle.png": "dad_face_middle",
    "face_dad_open.png": "dad_face_open",
    "face_dad_worried_closed.png": "dad_face_worried_closed",
    "face_dad_worried_middle.png": "dad_face_worried_middle",
    "face_dad_worried_open.png": "dad_face_worried_open",
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

    for src, spec in BACKGROUNDS.items():
        p = SRC / src
        if not p.exists():
            continue
        name, focus = (spec, 0.5) if isinstance(spec, str) else spec
        img = Image.open(p).convert("RGB")
        if abs(img.width / img.height - 4 / 3) > 0.02:   # not 4:3: crop a 4:3 window out of it
            cw = round(img.height * 4 / 3) if img.width / img.height > 4 / 3 else img.width
            ch = img.height if cw != img.width else round(img.width * 3 / 4)
            left = round(min(max(img.width * focus - cw / 2, 0), img.width - cw))
            top = round((img.height - ch) / 2)
            img = img.crop((left, top, left + cw, top + ch))
        img.resize((1024, 768), Image.LANCZOS).save(OUT / "backgrounds" / f"{name}.png", optimize=True)
        print("background:", name)

    for src, (name, height) in SPRITES.items():
        p = SRC / src
        if not p.exists():
            continue
        img = remove_flat_background(Image.open(p))
        img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
        ref = SAME_SIZE_AS.get(src)
        if ref and (SRC / ref).exists():   # use the other picture's shrink amount
            r = remove_flat_background(Image.open(SRC / ref))
            ref_h = r.crop(r.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()).height
            k = SPRITES[ref][1] / ref_h
            w, height = round(img.width * k), round(img.height * k)
        else:
            w = round(img.width * height / img.height)
        img.resize((w, height), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
        print("sprite:", name)

    for src, (name, width) in SPRITES_BY_WIDTH.items():
        p = SRC / src
        if not p.exists():
            continue
        img = remove_flat_background(Image.open(p))
        img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
        img.resize((width, round(img.height * width / img.width)), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
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

    for src, name in CUTOUT_FACES.items():
        p = SRC / src
        if p.exists():
            remove_flat_background(Image.open(p)).resize((256, 256), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("face (cut out):", name)

    for src, name in FACES.items():
        p = SRC / src
        if p.exists():
            Image.open(p).convert("RGB").resize((256, 256), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("face:", name)


if __name__ == "__main__":
    main()
