import Phaser from 'phaser';
import type { Mechanic } from './index';
import { engine } from '../engine/engine';
import { makeImage, sparkle } from '../engine/ui';
import { runDialog } from '../engine/dialog';
import { HintLadder, softRipple } from '../engine/hints';

/**
 * Tap numbered paw prints in order 1..N, then (optionally) a final target such as the window.
 * Settings come from the scene file's "params" (see content/scenes/s01_house.json).
 */
export const followTrail: Mechanic = {
  assets: d => [
    ...(d.params?.prints ?? []).map((p: any) => p.sprite),
    d.params?.final_target?.highlight_sprite,
    ...(d.params?.final_target?.glow_frames ?? [])
  ].filter(Boolean),

  audio: d => Array.from({ length: d.params?.prints?.length ?? 0 }, (_, i) => `number_${i + 1}`),

  start({ scene, data, params, ready, complete }) {
    const prints: { id: string; sprite: string; x: number; y: number; scale?: number }[] = params.prints ?? [];
    const sequential = (params.reveal ?? 'sequential') === 'sequential';
    const final = params.final_target as { x: number; y: number; highlight_sprite?: string; glow_frames?: string[]; glow_x?: number; glow_y?: number; on_tap?: string } | undefined;
    const hintAudio: string[] = data.hint_audio ?? [];
    const items: { go: Phaser.GameObjects.Container; found: boolean }[] = [];
    let next = 0;               // index of the print she should tap now
    let phase: 'prints' | 'final' | 'done' = 'prints';
    let pulseTween: Phaser.Tweens.Tween | undefined;

    // ---- build the prints (hidden until revealed) ----
    prints.forEach((p, i) => {
      const img = makeImage(scene, p.sprite, 0, 0, 120, 120);
      if (img instanceof Phaser.GameObjects.Image) {
        const h = 96 * (p.scale ?? 1);                 // "scale" in the scene file: smaller = farther away
        img.setDisplaySize(img.width * h / img.height, h);
      }
      // point each print toward the next one (the last points at the window)
      const to = prints[i + 1] ?? params.final_target;
      if (params.face_next !== false && to) img.setAngle(Phaser.Math.RadToDeg(Math.atan2(to.y - p.y, to.x - p.x)) + 90);
      const numeral = scene.add.text(0, 0, String(i + 1), {
        fontSize: '64px', fontStyle: 'bold', color: '#ffffff', stroke: '#5a3418', strokeThickness: 10
      }).setOrigin(0.5).setVisible(false);
      const go = scene.add.container(p.x, p.y, [img, numeral]).setSize(150, 130).setDepth(10).setAlpha(0);
      go.setData('numeral', numeral);
      go.setInteractive({ useHandCursor: true });
      go.on('pointerdown', () => tapPrint(i));
      items.push({ go, found: false });
    });

    const reveal = (i: number) => {
      const it = items[i];
      if (!it) return;
      it.go.setScale(0.6);
      scene.tweens.add({ targets: it.go, alpha: 1, scale: 1, duration: 450, ease: 'Back.easeOut' });
      if (params.print_glow) {
        scene.tweens.add({ targets: it.go, scale: 1.1, duration: 800, yoyo: true, repeat: -1, delay: 500, ease: 'Sine.easeInOut' });
      }
    };

    // ---- final target (the window) ----
    let windowGlow: Phaser.GameObjects.GameObject | undefined;
    const showWindow = () => {
      if (!final) return;
      const w = 200, h = 300;
      let glow: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image | Phaser.GameObjects.Container;
      const frames = (final.glow_frames ?? []).filter(k => scene.textures.exists(k));
      if (frames.length) {
        // animated glow: the pictures fade into each other in a loop
        const imgs = frames.map(k => scene.add.image(0, 0, k));
        glow = scene.add.container(final.glow_x ?? final.x, final.glow_y ?? final.y, imgs);
        const n = imgs.length;
        scene.tweens.addCounter({
          from: 0, to: n, duration: 900 * n, repeat: -1,
          onUpdate: tw => {
            const v = tw.getValue() ?? 0;
            imgs.forEach((im, i) => { const d = Math.abs(v - i); im.setAlpha(Math.max(0, 1 - Math.min(d, n - d))); });
          }
        });
        glow.setDepth(5).setAlpha(0);
        scene.tweens.add({ targets: glow, alpha: 1, duration: 600 });
        windowGlow = glow;
      } else if (final.highlight_sprite && scene.textures.exists(final.highlight_sprite)) {
        glow = scene.add.image(final.x, final.y, final.highlight_sprite);
      } else {
        glow = scene.add.graphics();
        glow.fillStyle(0xfff0a0, 0.45).fillRoundedRect(final.x - w / 2, final.y - h / 2, w, h, 24);
        glow.lineStyle(8, 0xffe066, 0.95).strokeRoundedRect(final.x - w / 2, final.y - h / 2, w, h, 24);
      }
      if (!frames.length) {
        glow.setDepth(5).setAlpha(0);
        scene.tweens.add({ targets: glow, alpha: 1, duration: 500 });
        scene.tweens.add({ targets: glow, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, delay: 500 });
        windowGlow = glow;
      }
      const zone = scene.add.zone(final.x, final.y, w, h).setInteractive({ useHandCursor: true }).setDepth(30);
      zone.on('pointerdown', () => tapWindow(zone));
      ladder.reset();
    };

    // ---- hint ladder (same rules for prints and window) ----
    const target = (): Phaser.GameObjects.GameObject | undefined => (phase === 'prints' ? items[next]?.go : windowGlow);
    const ladder = new HintLadder({
      hintAudio,
      pulse: () => {
        const t = target() as any;
        if (!t) return;
        pulseTween?.remove();
        pulseTween = scene.tweens.add({ targets: t, scale: (t.scale ?? 1) * 1.35, duration: 280, yoyo: true, repeat: 5 });
      },
      autoComplete: params.auto_complete === false ? undefined : () => {   // "auto_complete": false = never tap it for her
        if (phase === 'prints') scene.time.delayedCall(1200, () => tapPrint(next, true));
        else if (phase === 'final') scene.time.delayedCall(1200, () => tapWindow());
      }
    });

    // ---- tapping ----
    const tapPrint = async (i: number, byHelp = false) => {
      if (engine.locked || phase !== 'prints') return;
      const it = items[i];
      if (it.found) return;
      if (i !== next) {                       // a print out of order (only possible when all are showing)
        softRipple(scene, it.go.x, it.go.y, 'sfx_try_again');
        await engine.play(`number_${i + 1}`);   // always say what she tapped
        engine.replayPrompt();
        ladder.miss();
        return;
      }
      it.found = true;
      ladder.reset();
      scene.tweens.killTweensOf(it.go);
      it.go.setScale(1);
      (it.go.getData('numeral') as Phaser.GameObjects.Text).setVisible(true);
      sparkle(scene, it.go.x, it.go.y);
      scene.tweens.add({ targets: it.go, scale: 1.25, duration: 160, yoyo: true });
      next++;
      engine.lockInput(true);
      await engine.play(`number_${i + 1}`);
      engine.lockInput(false);
      void byHelp;
      if (next < prints.length) {
        if (sequential) reveal(next);
      } else {
        phase = 'final';
        engine.lockInput(true);
        await (scene as any).celebrate?.();                // she jumps for joy: all the prints are found
        if (final) {
          engine.setPrompt(data.window_prompt_audio ?? null);
          showWindow();                                   // the window starts to glow...
          const line = data.all_found_dialog;             // ...and Dad says what's next
          if (line) await runDialog(scene, [{ ...line, audio: line.audio ?? data.all_found_audio }], (scene as any).applySwap);
          else await engine.play(data.all_found_audio);
          engine.lockInput(false);
        } else { await engine.play(data.all_found_audio); phase = 'done'; complete(); }
      }
    };

    const tapWindow = async (zone?: Phaser.GameObjects.Zone) => {
      if ((engine.locked && zone) || phase !== 'final') return;
      phase = 'done';
      zone?.disableInteractive();
      engine.lockInput(true);
      sparkle(scene, final!.x, final!.y);
      if (final?.on_tap === 'zoom_to_window_then_next') {
        scene.cameras.main.setBounds(0, 0, 1024, 768);   // keep the zoom inside the picture
        scene.cameras.main.pan(final.x, final.y, 1400, 'Sine.easeInOut');
        scene.cameras.main.zoomTo(2.4, 1400, 'Sine.easeInOut');
        await new Promise<void>(r => scene.time.delayedCall(1500, () => r()));
      }
      complete();
    };

    // ---- taps on empty floor are "not quite": soft ripple, then the ladder helps ----
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (engine.locked || phase === 'done' || over.length) return;
      if (p.x > 880 && p.y > 640) return;     // the ear button area
      if (p.x < 160 && p.y < 160) return;     // the grown-ups corner
      softRipple(scene, p.worldX, p.worldY);
      ladder.miss();
    });

    ready.then(() => {
      if (sequential) reveal(0); else items.forEach((_, i) => reveal(i));
    });
  }
};
