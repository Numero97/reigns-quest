# Reign's Quest: Design Spec and Build Brief

A 2D story game for one 4-year-old pre-reader, played on an iPad in Safari. The narrator is her dad, recorded by him. Learning is the action of the story, never a quiz.

## Kickoff prompt (paste into Claude Code / Cursor)

> Read SPEC.md fully. Build in the milestone order at the bottom, stopping after each milestone so I can test on the iPad. I cannot code, so: keep the engine generic and put all story content in JSON and CSV files I can edit. Explain nothing in jargon; tell me exactly what to do when I need to act (record audio, drop in images, push to GitHub). Ask me before adding anything not in this spec.

## Hard constraints

- **Player:** 4-year-old who cannot read. Zero text is required to play. All instructions are spoken.
- **Device:** iPad Safari, landscape, touch only. Must work offline after first load (PWA).
- **Hosting:** GitHub Pages, deployed by GitHub Actions on push to `main`.
- **Stack:** Phaser 3 + Vite, TypeScript. No backend, no accounts, no analytics, no ads, no network calls after load.
- **Session length:** about 15 minutes for the full game. Progress autosaves so she can stop and resume anywhere.
- **No fail states.** No timers, scores, lives, or "wrong" buzzers. Wrong taps get a soft sound and the prompt replays.

## iPad Safari requirements

- Audio is locked until a user gesture. Open on a big "Play" button that unlocks audio.
- Disable pinch-zoom, double-tap zoom, text selection, rubber-band scroll, and long-press callouts.
- Use `100dvh` and safe-area insets. Scale-fit the game to the screen at a 4:3 base resolution (1024x768).
- Preload per scene with a simple non-text loading indicator (e.g. a bouncing paw).
- Provide `manifest.webmanifest` and a service worker that precaches all assets so it works with no connection once added to the home screen.
- Audio format: `.m4a` (AAC). It is the safest on iOS.

## Architecture

```
/public/assets/{backgrounds,sprites,audio,lineart}/
/src/engine/        generic: scene loader, input, audio, save, hints, parent menu
/src/mechanics/     one module per mechanic (listed below)
/content/scenes/*.json
/content/config.json
/content/audio_script.csv
/content/asset_manifest.csv
/tools/             scripts: normalize audio, remove sprite backgrounds, validate content
```

The engine reads `content/scenes/*.json` in the order given in `config.json`. Adding or reordering scenes must require no code changes.

### config.json

```json
{
  "cat_name": "Betsy",
  "cat_word": "BETSY",
  "difficulty": {
    "letters_known": ["A","B","C","D","E","F","G","H","I"],
    "letters_pool": "A-Z",
    "new_letter_ratio": 0.4,
    "count_rote_max": 20,
    "quantity_max": 10,
    "addition_max_sum": 10
  },
  "scene_order": ["s01_house","s02_snakes","s03_wolves","s04_witch","s05_spiders","s06_dragon","s07_dinner","s08_home"]
}
```

`difficulty` controls which letters appear and how large the numbers can be. Mechanics must read it and never exceed it.

### Number rules (apply to every number-based mechanic)

- **Rote counting (ordered tapping, e.g. `follow_trail`):** up to `count_rote_max` (20). She counts this far reliably, so long trails are fine.
- **Quantity ("how many are there?", `feed_count`, `count_objects`, `recipe`):** up to `quantity_max` (10). Her counting-to-quantity match is weaker than her rote counting, so start rounds at 1-5 and ramp toward 10 across the game. Never ask for a quantity above 10.
- **Addition (`combine_count`):** two groups with a sum up to `addition_max_sum` (10). Spoken like she's used to: "Two snakes, and one more snake. How many snakes?" Both groups are visible and tappable-to-count, and the answer is given by tapping a number tile (3 to 4 choices, including the right one) or dragging that many items into a basket. Keep sums to 5 or less in early scenes.
- Same hint ladder as letters: wrong answer, then the voice says the quantity she chose and recounts the real one aloud, tapping each object as it counts. Counting aloud over the objects is the teaching moment.

### Letter selection (applies to every letter-based mechanic)

- She reliably knows A-I. The pool is all 26 letters, randomized per play, so replays differ.
- Target ratio: about 60% known letters (A-I), 40% new letters (J-Z). Never present a round made only of unknown letters.
- Pass/fail is audio only, and it teaches. Right tap: success sound plus the letter name. Wrong tap: a soft, non-punitive "try again" tone, then the voice names what she tapped and repeats the target: "That's K. Find the B." This is how she learns new letters, so the name of the tapped letter must always be spoken.
- After a new letter is found correctly, the voice says its name and sound once ("K! /k/, like kitten"). Track per-letter correct and wrong counts in localStorage and weight future rounds toward letters she has missed, within the known/new ratio.
- `alphabet_path` uses a consecutive run of 4 letters starting at a random point (e.g. F-G-H-I, or K-L-M-N). For letters she doesn't know, the voice says "Next is K" as she progresses.
- The cat's name (BETSY) is a fixed target in `letter_lock` and `word_build`. She is not expected to spell it unaided: the voice prompts one letter at a time ("Find the B"), tiles include 3-4 random distractors, and the hint ladder applies. Y is the hardest; give it the earliest highlight.

### Scene JSON schema

```json
{
  "id": "s02_snakes",
  "background": "bg_bridge",
  "intro_audio": "s02_intro",
  "mechanic": "alphabet_path",
  "params": { "letters": ["A","B","C","D"], "positions": [[200,500],[400,450],[600,500],[800,450]] },
  "objects": [ { "sprite": "snake_green", "x": 300, "y": 600 } ],
  "success_audio": "s02_success",
  "next": "s03_wolves"
}
```

## Interaction rules (engine-level, apply to every mechanic)

1. Scene starts, then the intro audio plays, then input is enabled.
2. A large **ear button** (bottom corner, always visible) replays the current prompt.
3. If she is idle for 8 seconds, replay the prompt once, then every 15 seconds after.
4. Wrong tap: a soft, non-punitive "try again" tone and the character reacts gently. Do not scold. For letters, name what she tapped, then replay the prompt (see Letter selection).
5. After 2 wrong taps on the same step, softly pulse/highlight the correct target. After 4, the game completes that step for her with a cheerful sound.
6. Right tap: instant positive feedback (sparkle + sound) and the spoken word or letter ("B!").
7. Every tappable thing says its name or sound when tapped, even if it is not the target.
8. Scene complete: success audio, a short celebration, then a smooth transition.
9. Autosave to localStorage after each scene.
10. Hidden **parent menu**: long-press the top-left corner for 3 seconds. It offers scene select, reset progress, mute, and a debug toggle.

## Dialog box (Final Fantasy style)

- A box along the bottom with a character portrait on the left and the spoken text beside it, like classic JRPGs. The portrait swaps between a closed-mouth and open-mouth frame while the line's audio plays.
- Each dialog entry in a scene JSON has `speaker`, `portrait`, `audio`, `text`. Dialog advances automatically when the audio ends. Never wait for a tap, because she can't read and a tap could skip a line she hasn't heard.
- The text is decorative for her, but it helps early reading. Optional later upgrade: highlight each word as it's spoken.
- Input is disabled while dialog plays, then enabled for the scene's mechanic.
- Scene 1 is point-and-click, not walking. Reign wakes up in the bed, then the whole cabin is one screen she taps on. No movement controls.

## Mechanics (modules)

| id | What she does | Skill |
|---|---|---|
| `follow_trail` | Tap numbered paw prints in order 1..N | Counting, order |
| `alphabet_path` | Tap letters on stepping stones in alphabetical order | Letter names, order |
| `feed_count` | Drag N items to a creature that says how many it wants | Counting, quantity |
| `initial_sound_pick` | Hear a sound ("/b/"), tap the picture that starts with it | Initial sounds |
| `shape_match` | Drag shapes onto matching outlines | Shapes |
| `count_objects` | Tap each object once; spoken count rises with each tap | One-to-one counting |
| `combine_count` | Two visible groups ("2 snakes and 1 more"); pick the total | Addition to 10 |
| `letter_lock` | Tap letter tiles to match a spoken letter and open a lock | Letter recognition |
| `recipe` | Spoken recipe ("3 carrots") with drag-to-pot and visible running count | Number to quantity |
| `word_build` | Drag letter tiles into slots to spell a short word (cat word), each letter spoken as dropped | Letter-sound, blending |
| `coloring` | Fill line art with a palette | Free play (reward) |

Each mechanic is a module with the same interface: `start(scene, params, engine)`, `onComplete`. Keep them independent.

## Scene plan

| # | id | Beat | Mechanic |
|---|---|---|---|
| 1 | s01_house | House in the forest. Cat missing. Dad narrates. Follow paw prints out the door. | `follow_trail` |
| 2 | s02_snakes | Snakes block a bridge. Stepping-stone letters lead across. | `alphabet_path` |
| 3 | s03_wolves | Hungry wolves. Feed each one its number of bones. Later rounds: "this wolf wants 2 bones and his friend wants 1, how many bones total?" | `feed_count` then `combine_count` |
| 4 | s04_witch | Witch needs ingredients that start with a sound. | `initial_sound_pick` |
| 5 | s05_spiders | Spider webs: match shapes, count the legs. | `shape_match` + `count_objects` |
| 6 | s06_dragon | Dragon's cave. The cat is found. The lock needs the cat's letters. | `letter_lock` |
| 7 | s07_dinner | Make dinner with the dragon. | `recipe` |
| 8 | s08_home | Go home, everyone is friends. Spell the cat word, then color. | `word_build` then `coloring` |

Monsters are intended to be dramatic and fun, not defanged. Narration tone is Dad's call (he records it). Keep the scenes non-gory.

## Assets

### Art pipeline (images come from ChatGPT image generation)

- `asset_manifest.csv` columns: `id, type, filename, size_px, description, chatgpt_prompt`. `type` is `background`, `sprite`, or `lineart`.
- Claude Code writes a **style guide** (one paragraph of art direction) and a **character sheet prompt** first. Every later prompt starts with that style paragraph so the look stays consistent.
- **Backgrounds:** no characters, no text, no letters. Landscape 4:3.
- **Sprites:** generate on a flat solid color background, then `tools/remove_bg.py` (rembg) outputs a transparent PNG. Trim and resize to the manifest size.
- **Line art:** black outline, white fill, thick lines, large closed regions (good for flood fill).
- Never put text or letters inside generated art. Letters are drawn by the engine in a font.

### Placeholders (must exist before any real art or audio)

- Missing sprite or background: a colored rectangle labeled with its id.
- Missing audio: the engine speaks nothing, but with the debug toggle on it displays the line text from `audio_script.csv` on screen for about 3 seconds, so the game is playable and reviewable before recording.

### Audio pipeline (Dad records)

- `audio_script.csv` columns: `id, scene, text, notes`. Generated from the scene files. Every spoken line gets a row, including: intros, success lines, hint lines, each letter name and sound, each number, each object name.
- Filename = `id` + `.m4a`, in `assets/audio/`.
- `tools/normalize_audio.sh`: ffmpeg trims silence from the ends and normalizes loudness.
- `tools/validate_content.py` reports missing audio, missing assets, and scene JSON errors.
- **Letter sounds must be pure phonemes**, not letter+vowel: "mmm", "sss", "fff", "nnn" (held); stops kept short without added "uh": /b/ /d/ /g/ /k/ /p/ /t/. Record each letter twice: the **name** (`letter_b_name`) and the **sound** (`letter_b_sound`).

## Coloring

- Line-art images from the manifest. A flood-fill on tap with a palette of 10 large swatches. Undo button (picture icon only). A "done" button saves to localStorage; the home scene shows the saved pictures.

## Milestones (stop and let me test after each)

1. **Skeleton:** Vite+Phaser project, GitHub Action deploying to Pages, PWA offline, the Play button, scene loader, ear button, parent menu. One empty placeholder scene that loads.
2. **Vertical slice:** `s01_house` fully working with `follow_trail`, placeholders only, debug text for audio. I test it on the iPad.
3. **Content tooling:** generate `audio_script.csv` and `asset_manifest.csv` (with the style guide and ChatGPT prompts), plus the validate and normalize scripts. I start recording and generating art in parallel.
4. **Remaining mechanics and scenes, one at a time,** in scene order, each tested before the next.
5. **Coloring and word_build finale.**
6. **Polish:** transitions, celebrations, idle behavior, offline test (airplane mode), and a final pass on the hint ladder.

## Definition of done

- Plays start to finish on the iPad in airplane mode after being added to the home screen.
- `validate_content.py` reports zero missing assets or audio.
- A 4-year-old can finish every scene with no adult help and no reading.
