# Scene 1 art prompts (for ChatGPT image generation)

Reign and Betsy are approved (images generated). Still needed: Dad's look (replace wearing a navy backwards baseball cap, short brown hair, light stubble, freckles, olive-green eyes, and a navy t-shirt). Style is confirmed as cozy storybook.

## Style paragraph (paste at the start of EVERY prompt)

> Cozy children's storybook illustration in soft watercolor and ink: gentle painterly textures, fine warm-brown linework (not heavy black outlines), warm natural light, rounded friendly shapes, no text or letters anywhere in the image. Consistent palette: cornflower blue, warm cream, soft gold, earthy browns, forest green.

(Rewritten to match the approved Reign illustration, which has soft linework and watercolor texture. When generating anything new, attach that Reign image as a style reference too.)

## 1. Character sheet (generate first, reuse as reference image for everything else)

> [STYLE PARAGRAPH] Character reference sheet on a plain flat light-grey background. Left to right: Reign, a 4-year-old girl with blonde hair and blue eyes in a blue floral puff-sleeve dress with a blue hair bow, standing; Dad, a friendly man wearing a navy backwards baseball cap, short brown hair, light stubble, freckles, olive-green eyes, and a navy t-shirt, shoulders-up portrait; Betsy, a large fluffy Maine Coon cat with a brown tabby coat, dark stripes, cream chest ruff, yellow-green eyes, lynx-like ear tufts, and a big bushy ringed tail, sitting. Same art style for all three, full body for Reign and Betsy.

## 2. bg_cabin_morning (background, 4:3 landscape, no characters)

> [STYLE PARAGRAPH] Interior of a cozy log cabin in the forest, morning, wide view, 4:3. Left side: a small child's bed with rumpled blankets. Middle: a kitchen area with a wooden table and counter. Right side: a living area with a rug, couch and fireplace. On the far right wall, a large window with open curtains showing forest trees outside. The floor has plenty of clear empty space for objects to be added later. No people, no animals, no text.

## 3. spr_pawprint (sprite, flat-color background)

> [STYLE PARAGRAPH] A single cat paw print, slightly muddy brown, centered, on a plain flat bright green background, filling about 60% of the frame, nothing else in the image.

Then run `tools/remove_bg.py` for a transparent PNG. Target size about 128 px.

## 4. dad_face (two frames, dialog portrait)

> [STYLE PARAGRAPH] Shoulders-up portrait of Dad wearing a navy backwards baseball cap, short brown hair, light stubble, freckles, olive-green eyes, and a navy t-shirt, looking at the viewer with a warm friendly smile, mouth closed, on a plain flat green background (or the dialog-box color; no cutout needed for portraits).

Generate the second frame by attaching the first portrait and asking: "Same image, same framing and expression, only change the mouth to open mid-speech." This keeps the crop identical so the mouth flip doesn't make his face jump. The engine flips between the two while his audio plays.

## 5. Window (no image needed)

The approved cabin background already has the window open, which fits the story: Betsy went out through it. So skip the open-window sprite. The final tap glows the window in code, then zooms to the forest outside and moves to the next scene.

## Tips
- Keep every sprite in the manifest with its prompt so you can regenerate one without losing the style.
- If a new image drifts from the character sheet, attach the sheet again and say "match this character exactly".
