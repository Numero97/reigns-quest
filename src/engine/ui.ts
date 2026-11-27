import Phaser from 'phaser';
import { engine } from './engine';

/** Draws an image if it exists; otherwise a coloured box labelled with its id (placeholder). */
export function makeImage(scene: Phaser.Scene, key: string, x: number, y: number, w = 200, h = 200): Phaser.GameObjects.Container | Phaser.GameObjects.Image {
  if (scene.textures.exists(key)) return scene.add.image(x, y, key);
  const hue = [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.45, 0.65).color;
  const box = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(4, 0x555555);
  const label = scene.add.text(0, 0, key, { fontSize: '22px', color: '#222', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5);
  return scene.add.container(x, y, [box, label]).setSize(w, h);
}

export function makeBackground(scene: Phaser.Scene, key: string | undefined) {
  if (key && scene.textures.exists(key)) return scene.add.image(512, 384, key).setDisplaySize(1024, 768);
  const g = scene.add.graphics();
  g.fillGradientStyle(0xbfe0ff, 0xbfe0ff, 0xe9f6d8, 0xe9f6d8, 1).fillRect(0, 0, 1024, 768);
  if (key) scene.add.text(512, 384, key, { fontSize: '40px', color: '#7a8aa0' }).setOrigin(0.5).setAlpha(0.6);
  return g;
}

/** Bouncing paw (drawn with shapes, no art files needed). */
export function bouncingPaw(scene: Phaser.Scene) {
  const c = scene.add.container(512, 384);
  const brown = 0x966b3f;
  c.add([
    scene.add.ellipse(0, 18, 64, 52, brown),
    scene.add.ellipse(-38, -14, 24, 30, brown), scene.add.ellipse(-14, -38, 24, 30, brown),
    scene.add.ellipse(14, -38, 24, 30, brown), scene.add.ellipse(38, -14, 24, 30, brown)
  ]);
  scene.tweens.add({ targets: c, y: 330, duration: 450, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
  return c;
}

export function sparkle(scene: Phaser.Scene, x: number, y: number, quiet = false) {
  if (!quiet) engine.sfx('sfx_success');   // the happy sparkle sound goes with every sparkle
  for (let i = 0; i < 10; i++) {
    const star = scene.add.star(x, y, 5, 5, 12, 0xffd54a).setDepth(50);
    const a = (i / 10) * Math.PI * 2, d = 60 + Math.random() * 50;
    scene.tweens.add({ targets: star, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.3, duration: 600, onComplete: () => star.destroy() });
  }
}
