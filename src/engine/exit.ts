import Phaser from 'phaser';
import { engine } from './engine';
import { makeImage, sparkle } from './ui';

export interface TrailPrint { sprite: string; x: number; y: number; scale?: number; angle?: number }
export interface ExitSpec { x: number; y: number; w: number; h: number; prompt_audio?: string; glow_frames?: string[]; glow_scale?: number; glow_opacity?: number }

/** Paw prints appear one after another, leading into the forest. */
export function showTrailPrints(scene: Phaser.Scene, trail: TrailPrint[]) {
  trail.forEach((p, k) => scene.time.delayedCall(500 + k * 450, () => {
    const img = makeImage(scene, p.sprite, p.x, p.y, 40, 40);
    if (img instanceof Phaser.GameObjects.Image) img.setDisplaySize(img.width * 68 * (p.scale ?? 1) / img.height, 68 * (p.scale ?? 1));
    (img as any).setAngle(p.angle ?? 0).setDepth(4).setAlpha(0);
    scene.tweens.add({ targets: img, alpha: 0.95, duration: 400 });
    sparkle(scene, p.x, p.y, true);
  }));
}

/** The glowing, pulsing "exit" (the trail): she taps it to go on. Calls complete() after she does. */
export async function showExit(scene: Phaser.Scene, ex: ExitSpec | undefined, complete: () => void) {
  if (!ex) { await new Promise<void>(r => scene.time.delayedCall(1200, () => r())); complete(); return; }
  const glow = scene.add.container(ex.x, ex.y).setDepth(7).setAlpha(0);
  const frames = (ex.glow_frames ?? []).filter(k => scene.textures.exists(k));
  if (frames.length) {
    // animated glow: the pictures fade into each other in a loop (same trick as the glowing window in scene 1)
    const imgs = frames.map(k => scene.add.image(0, 0, k).setScale(ex.glow_scale ?? 1));
    glow.add(imgs);
    const n = imgs.length;
    scene.tweens.addCounter({
      from: 0, to: n, duration: 450 * n, repeat: -1,
      onUpdate: tw => {
        const v = tw.getValue() ?? 0;
        imgs.forEach((im, i) => { const d = Math.abs(v - i); im.setAlpha(Math.max(0, 1 - Math.min(d, n - d))); });
      }
    });
    scene.tweens.add({ targets: glow, alpha: ex.glow_opacity ?? 0.75, duration: 600 });   // glow_opacity: 1 = full strength, lower = softer
  } else {
    const g = scene.add.graphics();
    for (let k = 6; k >= 1; k--) g.fillStyle(0xfff27a, 0.09).fillEllipse(0, 0, ex.w * (0.5 + k * 0.1), ex.h * (0.5 + k * 0.1));
    glow.add(g);
    scene.tweens.add({ targets: glow, alpha: 1, duration: 500 });
    scene.tweens.add({ targets: glow, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, delay: 500 });
  }
  const zone = scene.add.zone(ex.x, ex.y, ex.w + 40, ex.h + 40).setInteractive({ useHandCursor: true }).setDepth(30);
  zone.on('pointerdown', () => {
    if (engine.locked) return;
    zone.disableInteractive();
    engine.lockInput(true);
    sparkle(scene, ex.x, ex.y);
    scene.time.delayedCall(500, () => complete());
  });
  engine.setPrompt(ex.prompt_audio ?? null);
  engine.lockInput(false);
  await engine.replayPrompt();
}
