import Phaser from 'phaser';
import type { Mechanic } from './index';
import { engine } from '../engine/engine';
import { makeImage, sparkle } from '../engine/ui';
import { HintLadder, softRipple } from '../engine/hints';
import { runDialog, type DialogLine } from '../engine/dialog';
import { showTrailPrints, showExit } from '../engine/exit';
import { shuffle } from '../engine/letters';
import have from 'virtual:asset-list';

/**
 * Numbered logs float down a river. Dad names a number (voice only); she taps the log that has it.
 * After enough right logs there is a thank-you, the picture changes (the bridge is fixed), and a glowing exit appears.
 * Everything is set in the scene file's "params" (see content/scenes/s06_bridge.json).
 */
const numberAudio = (n: number) => `number_${n}`;
const LEFT = -200, RIGHT = 1224;   // logs float from just off the left side to just off the right side, then come round again
const EDGE = 130;                  // they fade in and out over this distance at each end, so nothing pops

interface Lane { y: number; scale: number; speed: number; logs: number }

export const numberLogs: Mechanic = {
  assets: d => [
    ...(d.params?.log_frames ?? []),
    ...(d.params?.stack?.sprites ?? []),
    ...(d.params?.front_picture ? [d.params.front_picture] : []),
    ...(d.params?.trail_prints ?? []).map((p: any) => p.sprite),
    ...(d.params?.exit?.glow_frames ?? [])
  ],

  preload(scene, d) {
    const pic = d.params?.done_background;
    if (pic && have.backgrounds.includes(pic) && !scene.textures.exists(pic)) scene.load.image(pic, `backgrounds/${pic}.png`);
  },

  audio: d => [
    ...(d.params?.numbers ?? []).map(numberAudio),
    ...(d.params?.find_audio ?? []), d.params?.exit?.prompt_audio
  ].filter(Boolean),

  start({ scene, data, params, ready, complete }) {
    const stage = scene as any;
    const pool: number[] = params.numbers ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const toFind: number = params.to_find ?? 5;
    const findAudio: string[] = params.find_audio ?? [];
    const frames: string[] = params.log_frames ?? [];
    const lanes: Lane[] = params.lanes ?? [{ y: 370, scale: 1, speed: 60, logs: 5 }];
    const wait = (ms: number) => new Promise<void>(r => scene.time.delayedCall(ms, () => r()));
    const fade = (targets: unknown, alpha: number, duration = 600) => scene.tweens.add({ targets: targets as object, alpha, duration });

    // the near railings, drawn again on top so logs pass behind them
    const front = params.front_picture && scene.textures.exists(params.front_picture)
      ? scene.add.image(512, 384, params.front_picture).setDisplaySize(1024, 768).setDepth(1.9).setAlpha(0) : undefined;

    // ---- the logs in the river ----
    let found = 0, wanted = 0, playing = false, clock = 0;
    const asked: number[] = [];
    const numbers = shuffle([...pool]);
    const logs: {
      lane: Lane; x: number; num: number; state: 'afloat' | 'taken'; ready: boolean; offset: number; entered: number;
      go: Phaser.GameObjects.Container; img: Phaser.GameObjects.Container | Phaser.GameObjects.Image; text: Phaser.GameObjects.Text;
    }[] = [];

    lanes.forEach((lane, row) => {
      // logs sharing a lane start spread out, with an uneven gap, and move at the same speed so they never bump
      const gap = (RIGHT - LEFT) / lane.logs;
      const first = 150 + Math.random() * 450 + row * 160;
      for (let k = 0; k < lane.logs; k++) {
        const x = LEFT + ((first + k * gap + (k ? (Math.random() - 0.5) * gap * 0.25 : 0) - LEFT) % (RIGHT - LEFT));
        const img = makeImage(scene, frames[0] ?? 'spr_float_log_1', 21, -2, 540, 90);
        const disc = scene.add.circle(0, -6, 40, 0xfff3c9, 0.95).setStrokeStyle(5, 0x3d220f);
        const num = numbers[logs.length % numbers.length];
        const text = scene.add.text(0, -7, String(num), { fontSize: '52px', fontStyle: 'bold', fontFamily: 'Andika, sans-serif', color: '#3d220f' }).setOrigin(0.5);
        const go = scene.add.container(x, lane.y, [img, disc, text]).setSize(290, 100).setScale(lane.scale).setDepth(1 + row * 0.1).setAlpha(0);
        const i = logs.length;
        go.setInteractive({ useHandCursor: true });
        go.on('pointerdown', () => tap(i));
        logs.push({ lane, x, num, state: 'afloat', ready: false, offset: Math.random() * 10, entered: -9, go, img, text });
      }
    });

    /** A log coming round again gets a number nobody else in the river is showing. */
    const freshNumber = (i: number) => {
      const used = logs.filter((L, k) => k !== i && L.state === 'afloat').map(L => L.num);
      const free = pool.filter(n => !used.includes(n));
      const unasked = free.filter(n => !asked.includes(n));
      const from = unasked.length ? unasked : free;
      return from[Math.floor(Math.random() * from.length)] ?? logs[i].num;
    };

    const span = RIGHT - LEFT;
    /** Where could a new log appear in this lane? The emptiest stretch of river in view, never on top of another log.
     *  Returns undefined if the lane has no room just now. */
    const emptySpot = (i: number) => {
      let best: number | undefined, bestRoom = -1;
      for (let x = 60; x <= 780; x += 40) {
        let room = 2000, fits = true;
        logs.forEach((o, k) => {
          if (k === i || o.state !== 'afloat') return;
          const apart = Math.abs(o.x - x);
          if (o.lane === logs[i].lane && Math.min(apart, span - apart) < 500) fits = false;
          room = Math.min(room, apart + Math.abs(o.lane.y - logs[i].lane.y));
        });
        if (fits && room > bestRoom) { best = x; bestRoom = room; }
      }
      return best;
    };

    let gone = false;
    const update = (_: number, delta: number) => {
      if (gone) return;
      const dt = Math.min(delta, 50) / 1000;
      clock += dt;
      logs.forEach((L, i) => {
        if (L.state === 'taken') {   // soon after she takes one, a new log fades in where the river is emptiest
          const x = L.ready && playing ? emptySpot(i) : undefined;
          if (x === undefined) return;
          L.state = 'afloat'; L.ready = false; L.x = x; L.entered = clock;
          L.go.setVisible(true).setAlpha(0).setScale(L.lane.scale);
          L.num = freshNumber(i);
          L.text.setText(String(L.num));
        }
        L.x += L.lane.speed * dt;
        if (L.x > RIGHT) {   // off the right side: round it comes again, usually with a new number
          L.x -= span;
          if (!(playing && L.num === wanted)) { L.num = freshNumber(i); L.text.setText(String(L.num)); }
        }
        L.go.setPosition(L.x, L.lane.y + Math.sin((clock + L.offset) * 2.2) * 5);   // gentle bobbing
        if (playing) {   // soft at both ends of the river, and a new log fades in
          const atEnds = Math.min(1, (L.x - LEFT) / EDGE, (RIGHT - L.x) / EDGE);
          L.go.setAlpha(Math.max(0, Math.min(atEnds, (clock - L.entered) / 0.8)));
        }
        const key = frames[[0, 1, 2, 1][Math.floor((clock + L.offset) * (params.frames_per_second ?? 4)) % 4]];
        if (key && L.img instanceof Phaser.GameObjects.Image && L.img.texture.key !== key && scene.textures.exists(key)) L.img.setTexture(key);
      });
    };
    scene.events.on('update', update);
    scene.events.once('shutdown', () => { gone = true; scene.events.off('update', update); });

    // ---- the pile of logs she has collected ----
    const stackSprites: string[] = params.stack?.sprites ?? [];
    let pile: Phaser.GameObjects.GameObject | undefined;
    const showPile = (n: number) => {
      const key = stackSprites[n - 1];
      if (!key) return;
      pile?.destroy();
      const img = makeImage(scene, key, params.stack.x, params.stack.y, 150 + n * 12, 70);
      if (img instanceof Phaser.GameObjects.Image) img.setOrigin(0.5, 1);
      (img as any).setDepth(3);
      pile = img;
      scene.tweens.add({ targets: img, scale: { from: 0.75, to: 1 }, duration: 350, ease: 'Back.easeOut' });
    };

    // ---- asking ----
    const target = () => logs.findIndex(L => L.state === 'afloat' && L.num === wanted);
    const askNext = async () => {
      // pick a log she can see now (with time left to tap it), with a number not asked yet; if none, wait a moment
      let choices: typeof logs = [];
      for (let tries = 0; !choices.length; tries++) {
        const unasked = logs.filter(L => L.state === 'afloat' && !asked.includes(L.num));
        choices = unasked.filter(L => L.x > 100 && L.x < 760);
        if (!choices.length && tries > 20) choices = unasked.length ? unasked : logs.filter(L => L.state === 'afloat');
        if (!choices.length) await wait(300);
      }
      wanted = choices[Math.floor(Math.random() * choices.length)].num;
      asked.push(wanted);
      engine.setPrompt([...findAudio, numberAudio(wanted)]);
      engine.lockInput(false);
      await engine.replayPrompt();
    };

    // ---- hint ladder: 2 misses = pulse the right log, 4 = do it for her ----
    let pulse: Phaser.Tweens.Tween | undefined;
    const stopPulse = () => { pulse?.remove(); pulse = undefined; logs.forEach(L => { if (L.state === 'afloat') L.go.setScale(L.lane.scale); }); };
    const helpHer = () => {
      const i = target();
      if (i < 0) return;
      if (logs[i].x > 100 && logs[i].x < 924) void tap(i, true);
      else scene.time.delayedCall(400, helpHer);   // wait until it floats into view
    };
    const ladder = new HintLadder({
      hintAudio: data.hint_audio ?? [],
      pulse: () => {
        const L = logs[target()];
        if (!L) return;
        stopPulse();
        pulse = scene.tweens.add({ targets: L.go, scale: L.lane.scale * 1.3, duration: 280, yoyo: true, repeat: 5 });
      },
      autoComplete: params.auto_complete === false ? undefined : () => scene.time.delayedCall(1300, helpHer)
    });

    // ---- tapping a log ----
    const tap = async (i: number, byHelp = false) => {
      const L = logs[i];
      if (!playing || (engine.locked && !byHelp) || L.state !== 'afloat') return;
      engine.lockInput(true);

      if (L.num !== wanted) {   // a different number: say it, then repeat what to find
        engine.sfx('sfx_try_again');
        scene.tweens.add({ targets: L.go, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => L.go.setAngle(0) });
        await engine.play(numberAudio(L.num));
        engine.lockInput(false);
        await engine.replayPrompt();
        ladder.miss();
        return;
      }

      // right log: it jumps out of the river onto the pile
      ladder.reset();
      stopPulse();
      L.state = 'taken';
      found++;
      const n = found;
      sparkle(scene, L.go.x, L.go.y);
      L.go.setDepth(6);
      scene.tweens.add({
        targets: L.go, x: params.stack?.x ?? 512, y: (params.stack?.y ?? 660) - 30, scale: 0.35, alpha: 0.2, duration: 750, delay: 250, ease: 'Sine.easeIn',
        onComplete: () => { L.go.setVisible(false).setDepth(1 + lanes.indexOf(L.lane) * 0.1); L.ready = true; showPile(n); }
      });
      await engine.play(numberAudio(L.num));
      await wait(900);
      if (found < toFind) await askNext();
      else await finishGame();
    };

    // ---- all the logs are found ----
    const characters = (): Phaser.GameObjects.Image[] => (params.leave ?? []).map((id: string) => stage.getPlaced(id)).filter(Boolean);

    const finishGame = async () => {
      playing = false;
      engine.setPrompt(null);
      engine.lockInput(true);
      logs.forEach(L => { L.go.disableInteractive(); fade(L.go, 0); });

      // Reign comes back and jumps for joy, then the beaver pops up
      const [reign, beaver] = characters();
      if (reign) fade(reign, 1, 400);
      await wait(500);
      await stage.celebrate?.();
      if (beaver) {
        const sx = beaver.scaleX, sy = beaver.scaleY;
        beaver.setAlpha(1).setScale(sx, 0);
        scene.tweens.add({ targets: beaver, scaleY: sy, duration: 550, ease: 'Back.easeOut' });
        await wait(700);
      }
      await runDialog(scene, ([] as DialogLine[]).concat(data.done_dialog ?? []), stage.applySwap);

      // the picture changes: the bridge is fixed
      const pic = params.done_background;
      if (pic && scene.textures.exists(pic)) {
        const after = scene.add.image(512, 384, pic).setDisplaySize(1024, 768).setDepth(0.5).setAlpha(0);
        if (front) fade(front, 0, 900);
        if (pile) fade(pile, 0, 900);
        fade(after, 1, 900);
        await wait(700);
        sparkle(scene, 512, 330);
        await wait(900);
      }
      await runDialog(scene, ([] as DialogLine[]).concat(data.after_fix_dialog ?? []), stage.applySwap);

      // paw prints up the trail and the glowing exit
      showTrailPrints(scene, params.trail_prints ?? []);
      await wait(500 + (params.trail_prints?.length ?? 0) * 450);
      await showExit(scene, params.exit, complete);
    };

    // ---- taps on empty water just make a soft ring ----
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (engine.locked || over.length) return;
      if (p.x > 880 && p.y > 640) return;
      if (p.x < 160 && p.y < 160) return;
      softRipple(scene, p.worldX, p.worldY);
    });

    // after the talking: Reign and the beaver step out of the way, the logs float in, and Dad asks for the first number
    ready.then(async () => {
      engine.lockInput(true);
      fade(characters(), 0);
      if (front) fade(front, 1);
      logs.forEach(L => { L.entered = clock; });
      playing = true;
      await wait(1100);
      await askNext();
    });
  }
};
