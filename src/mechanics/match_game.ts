import Phaser from 'phaser';
import type { Mechanic } from './index';
import { engine } from '../engine/engine';
import { sparkle } from '../engine/ui';
import { runDialog, type DialogLine } from '../engine/dialog';
import { showTrailPrints, showExit } from '../engine/exit';

/**
 * Memory-match cards. Settings come from the scene file's "params" (see content/scenes/s04_bunny.json):
 *   pairs: [{ sprite, audio? }]   one entry per picture (each becomes two cards)
 *   card_back, panel {x,y,w,h}, columns, card (size), gap, mismatch_delay (ms), flip_ms,
 *   side_positions: where characters step to once the cards appear { picture id: {x, y, height} }
 * Card positions are worked out from these numbers, so changing the card size or count just works.
 */
export const matchGame: Mechanic = {
  assets: d => [
    d.params?.card_back ?? 'spr_card_back',
    ...(d.params?.trail_prints ?? []).map((p: any) => p.sprite),
    ...(d.params?.exit?.glow_frames ?? []),
    ...(d.params?.pairs ?? []).map((p: any) => (typeof p === 'string' ? p : p.sprite))
  ],

  audio: d => [...(d.params?.pairs ?? []).map((p: any) => p?.audio), d.params?.exit?.prompt_audio].filter(Boolean),

  start({ scene, data, params, ready, complete }) {
    const pairs: { sprite: string; audio?: string }[] = (params.pairs ?? []).map((p: any) => (typeof p === 'string' ? { sprite: p } : p));
    const backKey: string = params.card_back ?? 'spr_card_back';
    const panel = { x: 184, y: 134, w: 656, h: 500, ...(params.panel ?? {}) };
    const cols: number = params.columns ?? 4;
    const size: number = params.card ?? 140;
    const gap: number = params.gap ?? 16;
    const mismatchDelay: number = params.mismatch_delay ?? 1200;
    const flipMs: number = params.flip_ms ?? 400;
    const rows = Math.ceil((pairs.length * 2) / cols);
    const gridW = cols * size + (cols - 1) * gap, gridH = rows * size + (rows - 1) * gap;
    const left = panel.x + (panel.w - gridW) / 2 + size / 2;
    const top = panel.y + (panel.h - gridH) / 2 + size / 2;

    // ---- the backing panel (hidden until the narrator is finished) ----
    const bg = scene.add.graphics().setDepth(5).setAlpha(0);
    bg.fillStyle(0xffffff, 0.3).fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 28);
    bg.lineStyle(5, 0xffffff, 0.7).strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 28);

    // ---- shuffle: two of every picture, random each round ----
    const deck = pairs.flatMap((_, i) => [i, i]);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }

    interface Card { box: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; front: Phaser.GameObjects.Container; pair: number; up: boolean; matched: boolean }
    const cards: Card[] = [];
    const rounded = (g: Phaser.GameObjects.Graphics, fill: number | null, line: number) => {
      if (fill !== null) g.fillStyle(fill, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 16);
      g.lineStyle(5, line, 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 16);
    };

    deck.forEach((pairIndex, n) => {
      const x = left + (n % cols) * (size + gap), y = top + Math.floor(n / cols) * (size + gap);
      // back (the card-back picture, or a plain card if it is missing)
      const backG = scene.add.graphics(); rounded(backG, 0x2f6b3a, 0xe0b94a);
      const backParts: Phaser.GameObjects.GameObject[] = [backG];
      if (scene.textures.exists(backKey)) backParts.push(scene.add.image(0, 0, backKey).setDisplaySize(size, size));
      backParts.push(scene.add.graphics().lineStyle(5, 0xe0b94a, 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 16));
      const back = scene.add.container(0, 0, backParts);
      // front (cream card with the vegetable)
      const frontG = scene.add.graphics(); rounded(frontG, 0xfff8e8, 0xe0b94a);
      const frontParts: Phaser.GameObjects.GameObject[] = [frontG];
      const s = pairs[pairIndex].sprite;
      if (scene.textures.exists(s)) frontParts.push(scene.add.image(0, 0, s).setDisplaySize(size * 0.78, size * 0.78));
      else frontParts.push(scene.add.text(0, 0, s, { fontSize: '16px', color: '#333', align: 'center', wordWrap: { width: size - 12 } }).setOrigin(0.5));
      const front = scene.add.container(0, 0, frontParts).setVisible(false);
      const box = scene.add.container(x, y, [back, front]).setSize(size, size).setDepth(6).setAlpha(0);
      box.setInteractive({ useHandCursor: true });
      const card: Card = { box, back, front, pair: pairIndex, up: false, matched: false };
      box.on('pointerdown', () => tap(card));
      cards.push(card);
    });

    // ---- game rules ----
    let busy = true;            // true while cards are flipping / being checked, or before the game starts
    let first: Card | null = null;
    let matches = 0;
    const homes: [Phaser.GameObjects.Image, { x: number; y: number; w: number; h: number }][] = [];   // where the characters started

    const flip = (c: Card, up: boolean) => new Promise<void>(resolve => {
      engine.sfx('sfx_mouse_click');
      scene.tweens.add({
        targets: c.box, scaleX: 0, duration: flipMs / 2, ease: 'Sine.easeIn',
        onComplete: () => {
          c.up = up; c.back.setVisible(!up); c.front.setVisible(up);
          scene.tweens.add({ targets: c.box, scaleX: 1, duration: flipMs / 2, ease: 'Sine.easeOut', onComplete: () => resolve() });
        }
      });
    });
    const pop = (c: Card) => new Promise<void>(resolve =>
      scene.tweens.add({ targets: c.box, scale: 1.15, duration: 140, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => resolve() }));
    const wait = (ms: number) => new Promise<void>(r => scene.time.delayedCall(ms, () => r()));

    const tap = async (c: Card) => {
      if (busy || engine.locked || c.up || c.matched) return;
      busy = true;
      await flip(c, true);
      if (!first) { first = c; busy = false; return; }
      const a = first, b = c;
      first = null;
      if (a.pair === b.pair) {
        a.matched = b.matched = true;
        a.box.disableInteractive(); b.box.disableInteractive();
        sparkle(scene, (a.box.x + b.box.x) / 2, (a.box.y + b.box.y) / 2);
        void engine.play(pairs[a.pair].audio);          // says the vegetable's name (silent until recorded)
        await Promise.all([pop(a), pop(b)]);
        matches++;
        if (matches === pairs.length) { await finishRound(); return; }
      } else {
        engine.sfx('sfx_try_again');
        await wait(mismatchDelay);
        await Promise.all([flip(a, false), flip(b, false)]);
      }
      busy = false;
    };

    const finishRound = async () => {
      engine.lockInput(true);
      for (const c of cards) sparkle(scene, c.box.x, c.box.y, true);
      sparkle(scene, panel.x + panel.w / 2, panel.y + panel.h / 2);
      await (scene as any).celebrate?.();                 // Reign jumps for joy
      await wait(300);
      // the game disappears and the characters walk back to where they stood on the trail
      scene.tweens.add({ targets: [bg, ...cards.map(c => c.box)], alpha: 0, duration: 600 });
      for (const [img, o] of homes) scene.tweens.add({ targets: img, x: o.x, y: o.y, displayWidth: o.w, displayHeight: o.h, duration: 800, ease: 'Sine.easeInOut' });
      await wait(1000);
      // paw prints lead into the forest while the closing conversation plays (swap / hide lines work here too)
      showTrailPrints(scene, params.trail_prints ?? []);
      const closing: DialogLine[] = ([] as DialogLine[]).concat(data.all_found_dialog ?? []);
      if (closing.length) await runDialog(scene, closing, (scene as any).applySwap);
      await showExit(scene, params.exit, complete);      // the pulsing light: tap it to go on
    };

    // ---- when the narrator is finished: characters step aside, panel and cards appear ----
    ready.then(() => {
      (scene as any).applySwap?.({ text: '', swap: params.swap });   // "swap": change pictures when the cards appear
      for (const [id, p] of Object.entries<any>(params.side_positions ?? {})) {
        const img = (scene as any).getPlaced?.(id) as Phaser.GameObjects.Image | undefined;
        if (!img) continue;
        homes.push([img, { x: img.x, y: img.y, w: img.displayWidth, h: img.displayHeight }]);
        const k = p.height / img.displayHeight;
        scene.tweens.add({ targets: img, x: p.x, y: p.y, displayWidth: img.displayWidth * k, displayHeight: p.height, duration: 700, ease: 'Sine.easeInOut' });
      }
      scene.tweens.add({ targets: bg, alpha: 1, duration: 500, delay: 300 });
      cards.forEach((c, i) => {
        c.box.setScale(0.6);
        scene.tweens.add({ targets: c.box, alpha: 1, scale: 1, duration: 350, delay: 500 + i * 60, ease: 'Back.easeOut' });
      });
      scene.time.delayedCall(500 + cards.length * 60 + 400, () => { busy = false; });
    });
  }
};
