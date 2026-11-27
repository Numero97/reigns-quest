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
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art_source"
OUT = ROOT / "public" / "assets"

BACKGROUNDS = {  # source file -> game id
    "family_cabin.png": "bg_cabin_morning",
    "cabin_outside.png": "bg_cabin_outside",
    "forest_path_thicket.png": ("bg_forest_thicket", 0.5),
    "broken_bridge_background.png": ("bg_bridge_broken", 0.5, 0.2),   # square picture: 0.2 = how far down to take the crop from
    "repaired_bridge_background.png": ("bg_bridge_repaired", 0.5, 0.2),
    "sunlit_forest_trail.png": ("bg_forest_trail", 0.45),   # wide picture: cropped to 4:3; 0.45 = how far across to centre the crop
}
SPRITES = {  # source file -> (game id, final height in pixels)
    "paw_print.png": ("spr_pawprint", 160),
    "sprite_reign.png": ("spr_reign", 480),
    "sprite_reign_surprised.png": ("spr_reign_surprised", 480),
    "sprite_reign_excited.png": ("spr_reign_excited", 480),
    "sprite_dad.png": ("spr_dad", 480),
    "sprite_betsy.png": ("spr_betsy", 360),
    "sprite_bunny_sad.png": ("spr_bunny_sad", 440),
    "sprite_bunny_empty_basket.png": ("spr_bunny_empty_basket", 440),
    "sprite_bunny_full_basket.png": ("spr_bunny_full_basket", 440),
    "sprite_beaver_happy.png": ("spr_beaver", 440),
}
# Vegetables: cream background removed, drawn on a square canvas so every one is the same size
VEGETABLES = {
    "match_game_vegetable_beet.png": "spr_veg_beet",
    "match_game_vegetable_broccoli.png": "spr_veg_broccoli",
    "match_game_vegetable_carrot.png": "spr_veg_carrot",
    "match_game_vegetable_pumpkin.png": "spr_veg_pumpkin",
    "match_game_vegetable_squash.png": "spr_veg_squash",
    "match_game_zucchini.png": "spr_veg_zucchini",
}
# Bunny and beaver faces for the dialog box (green removed, put on a square canvas)
SQUARE_FACES = {}
for _mood in ("sad", "happy"):
    for _m in ("closed", "middle", "open"):
        SQUARE_FACES[f"face_bunny_{_mood}_mouth_{_m}.png"] = f"bunny_{_mood}_face_{_m}"
for _m in ("closed", "middle", "open"):
    SQUARE_FACES[f"face_beaver_{_m}.png"] = f"beaver_face_{_m}"
CARD_BACK = ("bunny_match_card_back.png", "spr_card_back")
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
SAME_SIZE_AS = {"sprite_reign_surprised.png": "sprite_reign.png", "sprite_reign_excited.png": "sprite_reign.png"}
# Snake head frames for the dialog box: green removed, same square canvas for all three so the mouth does not jump
CUTOUT_FACES = {"snake_head_closed.png": "snake_head_closed", "snake_head_middle.png": "snake_head_middle", "snake_head_open.png": "snake_head_open"}
FACES = {  # source file -> game id
    "face_dad_closed.png": "dad_face_closed",
    "face_dad_middle.png": "dad_face_middle",
    "face_dad_open.png": "dad_face_open",
    "face_dad_worried_closed.png": "dad_face_worried_closed",
    "face_dad_worried_middle.png": "dad_face_worried_middle",
    "face_dad_worried_open.png": "dad_face_worried_open",
    "face_dad_shocked_closed.png": "dad_face_shocked_closed",
    "face_dad_shocked_middle.png": "dad_face_shocked_middle",
    "face_dad_shocked_open (1).png": "dad_face_shocked_open",
    "face_dad_shocked_open.png": "dad_face_shocked_open",
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


def remove_background_keep_inside(img: Image.Image) -> Image.Image:
    """Like remove_flat_background, but only removes background that is connected to the picture's edge, so
    parts of the character that happen to be close to the background colour (brown shorts on green) stay solid."""
    from collections import deque
    rgb = np.asarray(img.convert("RGB")).astype(float)
    h, w, _ = rgb.shape
    bg = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]).mean(axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    near = dist < 45
    outside = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; q.append((ny, nx))
    # soft edge: only in a thin ring just outside the character, next to the removed background
    ring = Image.fromarray((outside * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    ring = np.asarray(ring) > 0
    soft = np.clip((dist - 45.0) / 50.0, 0, 1)
    alpha = np.where(outside, 0.0, np.where(ring, soft, 1.0))
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    edge = ring & ~outside & (alpha < 1)
    for c in range(3):
        ch = out[:, :, c].astype(float)
        ch[edge] = np.clip((ch[edge] - bg[c] * (1 - alpha[edge])) / np.maximum(alpha[edge], 0.2), 0, 255)
        out[:, :, c] = ch.astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def remove_bright_green(img: Image.Image) -> Image.Image:
    """For pictures on a pure bright-green screen: removes that green everywhere, including little gaps inside
    curly hair. Only safe when nothing on the character is bright green."""
    rgb = np.asarray(img.convert("RGB")).astype(float)
    other = np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    greenness = rgb[:, :, 1] - other                       # how much more green than red or blue
    alpha = np.clip((120.0 - greenness) / 90.0, 0, 1)      # very green = see-through
    rgb[:, :, 1] = np.where(greenness > 8, other + 8, rgb[:, :, 1])   # take the green tint off the edges
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")


def main():
    for d in ("backgrounds", "sprites"):
        (OUT / d).mkdir(parents=True, exist_ok=True)

    for src, spec in BACKGROUNDS.items():
        p = SRC / src
        if not p.exists():
            continue
        name, focus, *down = (spec, 0.5) if isinstance(spec, str) else spec
        img = Image.open(p).convert("RGB")
        if abs(img.width / img.height - 4 / 3) > 0.02:   # not 4:3: crop a 4:3 window out of it
            cw = round(img.height * 4 / 3) if img.width / img.height > 4 / 3 else img.width
            ch = img.height if cw != img.width else round(img.width * 3 / 4)
            left = round(min(max(img.width * focus - cw / 2, 0), img.width - cw))
            top = round((img.height - ch) * (down[0] if down else 0.5))
            img = img.crop((left, top, left + cw, top + ch))
        img.resize((1024, 768), Image.LANCZOS).save(OUT / "backgrounds" / f"{name}.png", optimize=True)
        print("background:", name)

    for src, (name, height) in SPRITES.items():
        p = SRC / src
        if not p.exists():
            continue
        img = (remove_background_keep_inside if src.startswith(("sprite_bunny", "sprite_beaver")) else remove_flat_background)(Image.open(p))
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

    # Glowing-trail pulse frames (pulse_01..04.png): light on a green screen. Opacity = how much light was added
    # over the green, so the soft glow stays soft (a normal green-removal would chop it off).
    for n in (1, 2, 3, 4):
        p = SRC / f"pulse_0{n}.png"
        if not p.exists():
            continue
        rgb = np.asarray(Image.open(p).convert("RGB")).astype(float)
        bg = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]).mean(axis=0)
        alpha = np.clip((rgb[:, :, 0] - bg[0]) / (250.0 - bg[0]), 0, 1)
        alpha = np.clip((alpha - 0.03) / 0.97, 0, 1)
        # colour of the light itself = what is left once the green behind it is taken away (using the TRUE amount of light)
        colour = (rgb - bg * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 0.05)
        colour = np.clip(colour, 0, 255)
        colour[:, :, 1] = np.minimum(colour[:, :, 1], colour[:, :, 0])   # light is never greener than it is red: removes any green tint
        tint = np.array([255.0, 240.0, 130.0])           # where there is hardly any light, use plain warm yellow
        w8 = np.clip(alpha / 0.15, 0, 1)[..., None]
        colour = colour * w8 + tint * (1 - w8)
        alpha = alpha ** 0.7   # lift the faint parts a little so the glow is easy to see (after the colour is worked out)
        out = Image.fromarray(np.dstack([colour, alpha * 255]).astype(np.uint8), "RGBA")
        out = out.resize((out.width * 2 // 3, out.height * 2 // 3), Image.LANCZOS)
        out.save(OUT / "sprites" / f"spr_trail_pulse_{n}.png", optimize=True)
        print("trail pulse frame:", n)

    def square(img: Image.Image, size: int) -> Image.Image:
        side = max(img.width, img.height)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
        return canvas.resize((size, size), Image.LANCZOS)

    for src, name in VEGETABLES.items():
        p = SRC / src
        if p.exists():
            img = remove_flat_background(Image.open(p))
            img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
            square(img, 300).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("vegetable:", name)

    for src, name in SQUARE_FACES.items():
        p = SRC / src
        if p.exists():
            square(remove_flat_background(Image.open(p)), 256).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("face (cut out, square):", name)

    p = SRC / CARD_BACK[0]
    if p.exists():
        from PIL import ImageDraw
        back = Image.open(p).convert("RGBA").resize((300, 300), Image.LANCZOS)
        mask = Image.new("L", (1200, 1200), 0)   # drawn big, shrunk = smooth rounded corners (same roundness as the card border in the game)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 1199, 1199), radius=137, fill=255)
        back.putalpha(mask.resize((300, 300), Image.LANCZOS))
        back.save(OUT / "sprites" / f"{CARD_BACK[1]}.png", optimize=True)
        print("card back")

    # Big scrolling map for the top-down running scene (saved as .webp: much smaller download than .png)
    p = SRC / "top_down_forest_map.png"
    if p.exists():
        Image.open(p).convert("RGB").save(OUT / "backgrounds" / "map_forest.webp", quality=90, method=6)
        print("map: map_forest")

    # The same map with the bridge broken (shown at the same size as the first map)
    p = SRC / "forest_map_bridge_broken.png"
    if p.exists():
        Image.open(p).convert("RGB").resize((2400, 2625), Image.LANCZOS).save(OUT / "backgrounds" / "map_forest_broken.webp", quality=90, method=6)
        print("map: map_forest_broken")

    # The map with the bridge repaired (the chase across it)
    p = SRC / "forest_map_bridge_repaired.png"
    if p.exists():
        Image.open(p).convert("RGB").resize((2400, 2625), Image.LANCZOS).save(OUT / "backgrounds" / "map_forest_repaired.webp", quality=90, method=6)
        print("map: map_forest_repaired")

    # Walking pictures: every frame goes on the same square canvas, lined up by the top and middle of her head,
    # so she doesn't jump around or change size while walking. Down/up/right each get their own size.
    for direction, stand_height in (("down", 215), ("up", 245), ("right", 240)):
        frames = []
        for n in (1, 2, 3):
            p = next(iter(sorted(SRC.glob(f"reign_{direction}_walk_{n}*.png"))), None)
            if p:   # same starting size for every drawing, whatever size it was exported at
                img = remove_bright_green(Image.open(p).convert("RGB").resize((800, 800), Image.LANCZOS))
                frames.append((n, img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())))
        if len(frames) != 3:
            continue
        k = stand_height / frames[1][1].height   # frame 2 (legs together) sets the size
        for n, img in frames:
            img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
            head = img.crop((0, 0, img.width, round(img.height * 0.4))).getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
            canvas = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
            canvas.paste(img, (round(150 - (head[0] + head[2]) / 2), 280 - stand_height), img)
            canvas.save(OUT / "sprites" / f"spr_walk_{direction}_{n}.png", optimize=True)
            print("walking:", direction, n)

    # One-picture dialog faces on bright green (no talking mouth): the question mark and the howling wolf
    for src, name in (("Face_unknown.png", "unknown_face_closed"), ("face_howling_wolf.png", "wolf_howl_face_closed")):
        p = SRC / src
        if p.exists():
            img = remove_bright_green(Image.open(p))
            img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
            side = round(max(img.size) * 1.06)
            canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
            canvas.resize((256, 256), Image.LANCZOS).save(OUT / "sprites" / f"{name}.png", optimize=True)
            print("face (single):", name)

    # Wolf running pictures: same square canvas for every frame, feet on the same line, centred
    for direction, fit_width, fit_height in (("down", None, 200), ("up", None, 200), ("right", 270, None)):
        frames = []
        for n in (1, 2, 3):
            p = SRC / f"wolf_{direction}_walk_{n}.png"
            if p.exists():
                raw = Image.open(p).convert("RGB")
                img = remove_bright_green(raw.resize((800, 800), Image.LANCZOS))
                img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
                if direction == "right" and raw.width > 1000:   # that one drawing is a little bigger than the others
                    img = img.resize((round(img.width * 0.92), round(img.height * 0.92)), Image.LANCZOS)
                frames.append((n, img))
        if len(frames) != 3:
            continue
        k = fit_width / max(f.width for _, f in frames) if fit_width else fit_height / frames[1][1].height
        for n, img in frames:
            img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
            canvas = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
            canvas.paste(img, (round(150 - img.width / 2), 280 - img.height), img)
            canvas.save(OUT / "sprites" / f"spr_wolf_{direction}_{n}.png", optimize=True)
            print("wolf:", direction, n)

    # Floating logs: three frames of the same log in the water, all trimmed by the same box so the log stays put
    logs = [SRC / f"floating_log_{n}.png" for n in (1, 2, 3)]
    if all(p.exists() for p in logs):
        frames = [Image.open(p).convert("RGBA") for p in logs]
        boxes = [f.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox() for f in frames]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        for n, f in enumerate(frames, 1):
            f = f.crop(box)
            f.resize((540, round(f.height * 540 / f.width)), Image.LANCZOS).save(OUT / "sprites" / f"spr_float_log_{n}.png", optimize=True)
            print("floating log:", n)

    # The railings and posts of the near end of the broken bridge, cut out so floating logs can pass BEHIND them.
    # The corners below are positions on the original 1254 x 1254 picture.
    p = SRC / "broken_bridge_background.png"
    if p.exists():
        from PIL import ImageDraw
        pic = Image.open(p).convert("RGB")
        k = 4   # drawn big, shrunk = smooth edges
        mask = Image.new("L", (pic.width * k, pic.height * k), 0)
        draw = ImageDraw.Draw(mask)
        for shape in (
            # left side: front post, back post, top rail, lower rail, small middle post, rail leaving the picture
            [(27, 642), (62, 612), (112, 612), (136, 634), (138, 950), (104, 958), (27, 928)],
            [(255, 525), (285, 511), (323, 521), (325, 716), (291, 724), (255, 714)],
            [(134, 628), (258, 560), (258, 612), (134, 696)],
            [(322, 541), (332, 537), (333, 574), (322, 578)],
            [(134, 764), (258, 680), (298, 648), (298, 690), (258, 722), (134, 818)],
            [(193, 645), (230, 628), (231, 790), (194, 802)],
            [(0, 760), (28, 738), (28, 800), (0, 818)],
            # right side
            [(1123, 640), (1150, 621), (1210, 620), (1241, 645), (1240, 940), (1170, 962), (1123, 940)],
            [(937, 520), (970, 511), (1006, 522), (1006, 718), (972, 722), (938, 700)],
            [(1004, 558), (1124, 636), (1124, 706), (1004, 612)],
            [(930, 538), (940, 538), (940, 580), (930, 572)],
            [(962, 650), (1004, 668), (1124, 764), (1124, 816), (1004, 718), (962, 690)],
            [(1030, 640), (1068, 655), (1068, 795), (1030, 770)],
            [(1240, 738), (1254, 746), (1254, 826), (1240, 818)],
        ):
            draw.polygon([(x * k, y * k) for x, y in shape], fill=255)
        cut = pic.convert("RGBA")
        cut.putalpha(mask.resize(pic.size, Image.LANCZOS))
        top = round((cut.height - round(cut.width * 3 / 4)) * 0.2)   # same trim as the background
        cut.crop((0, top, cut.width, top + round(cut.width * 3 / 4))).resize((1024, 768), Image.LANCZOS).save(OUT / "sprites" / "spr_bridge_rails.png", optimize=True)
        print("bridge rails")

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
