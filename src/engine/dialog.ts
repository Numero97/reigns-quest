// Final-Fantasy-style dialog box: portrait on the left, words beside it.
// Lines advance by themselves when the audio ends. She never has to tap.
import Phaser from 'phaser';
import { engine } from './engine';
import { makeImage } from './ui';

export interface DialogLine { speaker?: string; portrait?: string; audio?: string; text: string; swap?: Record<string, string> }

/** Plays the lines one after another, then removes the box. */
export async function runDialog(scene: Phaser.Scene, lines: DialogLine[], onLine?: (line: DialogLine) => void) {
  if (!lines.length) return;
  const boxY = 566, boxH = 186;
  const root = scene.add.container(0, 0).setDepth(80);
  const panel = scene.add.graphics();
  panel.fillStyle(0x000000, 0.25).fillRoundedRect(26, boxY + 6, 850, boxH, 22);
  panel.fillStyle(0x1b2a6b, 0.96).fillRoundedRect(20, boxY, 850, boxH, 22);
  panel.lineStyle(6, 0xffffff, 1).strokeRoundedRect(20, boxY, 850, boxH, 22);
  panel.lineStyle(2, 0x8fa8ff, 1).strokeRoundedRect(30, boxY + 10, 830, boxH - 20, 16);
  const text = scene.add.text(236, boxY + 26, '', {
    fontSize: '34px', color: '#ffffff', fontFamily: 'Trebuchet MS, Verdana, sans-serif',
    wordWrap: { width: 600 }, lineSpacing: 8
  });
  root.add([panel, text]);
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

    text.setText(line.text);
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
