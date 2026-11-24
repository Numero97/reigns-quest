import Phaser from 'phaser';
import type { Mechanic } from './index';
import { engine } from '../engine/engine';
import { makeImage, sparkle } from '../engine/ui';
import { HintLadder, softRipple } from '../engine/hints';
import { runDialog, type DialogLine } from '../engine/dialog';
import { ALPHABET, isKnown, letterName, letterSound, pickLetters, recordLetter, shuffle } from '../engine/letters';

/**
 * Letters on objects (logs). Dad names a letter; she taps the object that has it.
 * Each correct object flies to a pile that grows, and Dad praises her.
 * Everything is set in the scene file's "params" (see content/scenes/s02_logs.json).
 */
export const letterHunt: Mechanic = {
  assets: d => [
    ...(d.params?.logs ?? []).map((l: any) => l.sprite),
    ...(d.params?.stack?.sprites ?? []),
    ...(d.params?.trail_prints ?? []).map((p: any) => p.sprite)
  ],

  audio: d => [
    ...(d.params?.letter_pool ?? ALPHABET).flatMap((l: string) => [letterName(l), letterSound(l)]),
    d.params?.thats_audio, ...(d.params?.find_audio ?? [])
  ].filter(Boolean),

  start({ scene, data, params, ready, complete }) {
    const spots: { sprite: string; x: number; y: number; angle?: number }[] = params.logs ?? [];
    const pool: string[] = params.letter_pool ?? ALPHABET.slice(0, 10);
    const findAudio: string[] = params.find_audio ?? [];          // e.g. ["s02_find_log"] then the letter's name
    const praise: DialogLine[] = shuffle(data.praise_dialog ?? []);
    const hintAudio: string[] = data.hint_audio ?? [];

    // ---- random letters, one per log; random order for asking ----
    const letters = pickLetters(pool, spots.length);
    const queue = shuffle(letters.map((_, i) => i));
    let asked = 0, found = 0;
    const target = () => queue[asked];

    // ---- the pile next to the house ----
    const stackSprites: string[] = params.stack?.sprites ?? [];
    let stackImg: Phaser.GameObjects.GameObject | undefined;
    const showStack = (n: number) => {
      const key = stackSprites[n - 1];
      if (!key) return;
      stackImg?.destroy();
      const img = makeImage(scene, key, params.stack.x, params.stack.y, 150 + n * 12, 70);
      if (img instanceof Phaser.GameObjects.Image) img.setOrigin(0.5, 1);
      (img as any).setDepth(6);
      stackImg = img;
      scene.tweens.add({ targets: img, scale: { from: 0.75, to: 1 }, duration: 350, ease: 'Back.easeOut' });
    };

    // ---- the scattered logs, each with its letter ----
    const logs = spots.map((sp, i) => {
      const img = makeImage(scene, sp.sprite, 0, 0, 230, 120);
      const w = img instanceof Phaser.GameObjects.Image ? img.displayWidth : 230;
      const h = img instanceof Phaser.GameObjects.Image ? img.displayHeight : 120;
      const text = scene.add.text(0, 2, letters[i], {
        fontSize: '84px', fontStyle: 'bold', fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        color: '#fff3c9', stroke: '#3d220f', strokeThickness: 14
      }).setOrigin(0.5);
      const go = scene.add.container(sp.x, sp.y, [img, text]).setSize(w, Math.max(h, 110)).setDepth(10 + i).setAlpha(0);
      go.setInteractive({ useHandCursor: true });
      go.on('pointerdown', () => tap(i));
      return { go, letter: letters[i], found: false };
    });

    const promptFor = (i: number) => [...findAudio, letterName(logs[i].letter)];
    const askNext = async () => {
      engine.setPrompt(promptFor(target()));
      engine.lockInput(false);
      await engine.replayPrompt();
    };

    // ---- hint ladder: 2 misses = pulse the right log, 4 = do it for her ----
    let pulse: Phaser.Tweens.Tween | undefined;
    const ladder = new HintLadder({
      hintAudio,
      pulse: () => {
        const t = logs[target()]?.go;
        if (!t) return;
        pulse?.remove();
        pulse = scene.tweens.add({ targets: t, scale: 1.3, duration: 280, yoyo: true, repeat: 5 });
      },
      autoComplete: () => scene.time.delayedCall(1300, () => tap(target(), true))
    });

    // ---- tapping a log ----
    const tap = async (i: number, byHelp = false) => {
      if ((engine.locked && !byHelp) || asked >= queue.length) return;
      const L = logs[i];
      if (L.found) return;
      engine.lockInput(true);

      if (i !== target()) {                       // a different letter: name it, then repeat what to find
        recordLetter(L.letter, false);
        recordLetter(letters[target()], false);
        scene.tweens.add({ targets: L.go, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => L.go.setAngle(0) });
        await engine.play(params.thats_audio);
        await engine.play(letterName(L.letter));
        await askNext();
        ladder.miss();
        return;
      }

      // right log
      L.found = true;
      if (!byHelp) recordLetter(L.letter, true);
      ladder.reset();
      pulse?.remove();
      L.go.setScale(1);
      sparkle(scene, L.go.x, L.go.y);
      found++;
      scene.tweens.add({
        targets: L.go, x: params.stack.x, y: params.stack.y - 30, scale: 0.35, alpha: 0.2, duration: 750, delay: 250, ease: 'Sine.easeIn',
        onComplete: () => { L.go.destroy(); showStack(found); }
      });
      await engine.play(letterName(L.letter));
      if (!isKnown(L.letter)) await engine.play(letterSound(L.letter));   // new letter: say its sound too

      asked++;
      if (asked < queue.length) {
        const line = praise[(found - 1) % Math.max(1, praise.length)];
        if (line) await runDialog(scene, [line]);
        await askNext();
      } else {
        // all logs picked up: thank her and show the trail leading into the forest
        const trail: { sprite: string; x: number; y: number; scale?: number; angle?: number }[] = params.trail_prints ?? [];
        trail.forEach((p, k) => scene.time.delayedCall(500 + k * 450, () => {
          const img = makeImage(scene, p.sprite, p.x, p.y, 40, 40);
          if (img instanceof Phaser.GameObjects.Image) img.setDisplaySize(img.width * 68 * (p.scale ?? 1) / img.height, 68 * (p.scale ?? 1));
          (img as any).setAngle(p.angle ?? 0).setDepth(4).setAlpha(0);
          scene.tweens.add({ targets: img, alpha: 0.95, duration: 400 });
          sparkle(scene, p.x, p.y);
        }));
        if (data.all_found_dialog) await runDialog(scene, [data.all_found_dialog]);
        await new Promise<void>(r => scene.time.delayedCall(1200, () => r()));
        complete();
      }
    };

    // ---- taps on empty ground just make a soft ring ----
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (engine.locked || over.length) return;
      if (p.x > 880 && p.y > 640) return;
      if (p.x < 160 && p.y < 160) return;
      softRipple(scene, p.worldX, p.worldY);
    });

    ready.then(async () => {
      logs.forEach((L, i) => {
        L.go.setScale(0.6);
        scene.tweens.add({ targets: L.go, alpha: 1, scale: 1, duration: 400, delay: i * 180, ease: 'Back.easeOut' });
      });
      await new Promise<void>(r => scene.time.delayedCall(logs.length * 180 + 500, () => r()));
      await askNext();
    });
  }
};
