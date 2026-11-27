// Final-Fantasy-style dialog box: portrait on the left, words beside it.
// Lines advance by themselves when the audio ends. She never has to tap.
import Phaser from 'phaser';
import { engine } from './engine';
import { makeImage } from './ui';
import { config } from './content';

// Names that show in color in Dad's text box (edit "name_colors" in content/config.json)
const nameColors: Record<string, string> = config.name_colors ?? { Reign: '#c9a0ff', Betsy: '#6cc3ff' };
const STYLE = { fontSize: '34px', color: '#ffffff', fontFamily: 'Andika, sans-serif' };

/** Writes a sentence word by word so special names can have their own color. Returns the pieces so they can be cleared. */
function layoutText(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, str: string, width: number) {
  const names = Object.keys(nameColors);
  const re = names.length ? new RegExp(`(${names.join('|')})`, 'g') : null;
  const pieces: Phaser.GameObjects.Text[] = [];
  const probe = scene.add.text(0, 0, 'a b', STYLE), probe2 = scene.add.text(0, 0, 'ab', STYLE);
  const space = probe.width - probe2.width || 10;   // width of one space
  probe.destroy(); probe2.destroy();
  const lineH = 34 * 1.35 + 8;
  let cx = 0, cy = 0;
  for (const word of str.split(/\s+/).filter(Boolean)) {
    const parts = (re ? word.split(re) : [word]).filter(Boolean).map(t => scene.add.text(0, 0, t, { ...STYLE, color: nameColors[t] ?? STYLE.color }));
    const w = parts.reduce((a, t) => a + t.width, 0);
    if (cx > 0 && cx + w > width) { cx = 0; cy += lineH; }
    for (const t of parts) { t.setPosition(x + cx, y + cy); root.add(t); pieces.push(t); cx += t.width; }
    cx += space;
  }
  return pieces;
}

export interface DialogLine { speaker?: string; portrait?: string; audio?: string; text: string; swap?: Record<string, string>; hide?: string[] }

/** Plays the lines one after another, then removes the box. */
export async function runDialog(scene: Phaser.Scene, lines: DialogLine[], onLine?: (line: DialogLine) => void) {
  if (!lines.length) return;
  const boxY = 566, boxH = 186;
  const root = scene.add.container(0, 0).setDepth(80).setScrollFactor(0);   // stays put even when the camera moves
  const panel = scene.add.graphics();
  panel.fillStyle(0x000000, 0.25).fillRoundedRect(26, boxY + 6, 850, boxH, 22);
  panel.fillStyle(0x1b2a6b, 0.96).fillRoundedRect(20, boxY, 850, boxH, 22);
  panel.lineStyle(6, 0xffffff, 1).strokeRoundedRect(20, boxY, 850, boxH, 22);
  panel.lineStyle(2, 0x8fa8ff, 1).strokeRoundedRect(30, boxY + 10, 830, boxH - 20, 16);
  root.add(panel);
  let words: Phaser.GameObjects.Text[] = [];
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 250 });

  let portrait: Phaser.GameObjects.GameObject | undefined;
  let portraitKey = '';

  for (const line of lines) {
    // portrait: "<name>_closed" / "<name>_open" pictures; a labelled box if they don't exist yet
    const key = line.portrait ?? '';
    if (key !== portraitKey) {
      portrait?.destroy();
      portraitKey = key;
      if (key) {
        const holder = scene.add.rectangle(128, boxY + boxH / 2, 168, 168, 0x0e1640).setStrokeStyle(4, 0xffffff);
        const img = makeImage(scene, `${key}_closed`, 128, boxY + boxH / 2, 160, 160);
        if (img instanceof Phaser.GameObjects.Image) img.setDisplaySize(160, 160);
        portrait = scene.add.container(0, 0, [holder, img]);
        root.add(portrait);
      }
    }
    // mouth frames: closed > middle > open > middle (the middle picture is optional and just smooths it out)
    const setMouth = (frame: 'closed' | 'middle' | 'open') => {
      const c = portrait as Phaser.GameObjects.Container | undefined;
      const img = c?.list[1];
      const k = `${key}_${frame}`;
      if (img instanceof Phaser.GameObjects.Image && scene.textures.exists(k)) img.setTexture(k).setDisplaySize(160, 160);
    };
    const cycle: ('closed' | 'middle' | 'open')[] = ['closed', 'middle', 'open', 'middle'];

    words.forEach(w => w.destroy());
    words = layoutText(scene, root, 236, boxY + 26, line.text, 600);
    onLine?.(line);
    let step = 0;
    const mouth = scene.time.addEvent({ delay: 110, loop: true, callback: () => { step = (step + 1) % cycle.length; setMouth(cycle[step]); } });

    if (line.audio && engine.hasAudio(line.audio)) await engine.play(line.audio);
    else await new Promise<void>(r => setTimeout(r, Math.max(1500, line.text.length * 65))); // not recorded yet: leave time to read it

    mouth.remove();
    setMouth('closed');
    await new Promise<void>(r => setTimeout(r, 350));
  }

  await new Promise<void>(r => scene.tweens.add({ targets: root, alpha: 0, duration: 250, onComplete: () => r() }));
  root.destroy();
}
