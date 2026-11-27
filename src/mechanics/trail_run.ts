import Phaser from 'phaser';
import type { Mechanic } from './index';
import { runDialog, type DialogLine } from '../engine/dialog';
import have from 'virtual:asset-list';

type Dir = 'down' | 'up' | 'right' | 'left';
type Point = [number, number];

/** Something that runs along a line drawn through points on the map, using its down / up / right pictures. */
function makeRunner(scene: Phaser.Scene, o: {
  prefix: string; route: Point[]; speed: number; stepRate: number; scale: number; shadowW: number; depth: number;
}) {
  const path = new Phaser.Curves.Spline(o.route.map(([x, y]) => new Phaser.Math.Vector2(x, y)));   // a smooth line through the points
  path.arcLengthDivisions = 600;
  const length = path.getLength();
  const start = path.getPointAt(0);
  const shadow = scene.add.ellipse(start.x, start.y, o.shadowW, o.shadowW * 0.34, 0x000000, 0.25).setDepth(o.depth - 0.5);   // above both map pictures
  const body = scene.add.image(start.x, start.y, `${o.prefix}_down_2`).setOrigin(0.5, 280 / 300).setScale(o.scale).setDepth(o.depth);

  /** Which way is it heading here? Looks a little ahead and behind so small wiggles don't flip it around. */
  const heading = (t: number, now: Dir): Dir => {
    const a = path.getPointAt(Math.max(0, t - 50 / length)), b = path.getPointAt(Math.min(1, t + 50 / length));
    const dx = b.x - a.x, dy = b.y - a.y;
    const wasSideways = now === 'left' || now === 'right';
    if (Math.abs(dx) > Math.abs(dy) * (wasSideways ? 0.8 : 1.25)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  };
  const show = (dir: Dir, frame: number) => {
    const key = `${o.prefix}_${dir === 'left' ? 'right' : dir}_${frame}`;
    if (scene.textures.exists(key)) body.setTexture(key).setOrigin(0.5, 280 / 300).setScale(o.scale).setFlipX(dir === 'left');   // left = right art, mirrored
  };

  let travelled = 0, clock = 0, running = false, dir: Dir = heading(0, 'down');
  let arrived: () => void = () => {};
  show(dir, 2);

  return {
    body, shadow,
    /** Starts running. Resolves when it reaches the end of its route. */
    go: () => new Promise<void>(resolve => { arrived = resolve; running = true; }),
    update(dt: number) {
      if (!running) return;
      travelled = Math.min(length, travelled + o.speed * dt);
      clock += dt;
      const t = travelled / length;
      const p = path.getPointAt(t);
      dir = heading(t, dir);
      show(dir, [1, 2, 3, 2][Math.floor(clock * o.stepRate) % 4]);
      body.setPosition(p.x, p.y);
      shadow.setPosition(p.x, p.y);
      if (travelled >= length) { running = false; show(dir, 2); arrived(); }
    },
    show: () => show(dir, 2),
    destroy: () => { body.destroy(); shadow.destroy(); }
  };
}

const frames = (prefix: string) => ['down', 'up', 'right'].flatMap(d => [1, 2, 3].map(n => `${prefix}_${d}_${n}`));

/**
 * Top-down running scene: Reign runs along a trail on a big map while the camera follows her.
 * Settings come from the scene file's "params" (see content/scenes/s05_trail_run.json):
 *   map, zoom, height (how big she is), end_pause (ms)
 *   route [[x, y], ...], speed, steps_per_second        her first run (points are where her feet go)
 *   stop_picture, stop_dialog                            optional: when she stops, change to this picture and talk
 *   escape { route, speed, steps_per_second }            optional: then she runs again
 *   chaser { picture, size, route, speed, delay, steps_per_second }   optional: something chases her
 *                                                        (with no "escape", it is there from the start and follows "route")
 *   start_pause (ms)                                     optional: how long before she sets off
 *   end_map, end_map_fade (ms)                           optional: the map picture it changes to when she stops
 */
export const trailRun: Mechanic = {
  assets: d => [
    ...frames('spr_walk'),
    ...(d.params?.stop_picture ? [d.params.stop_picture] : []),
    ...(d.params?.chaser ? frames(d.params.chaser.picture ?? 'spr_wolf') : [])
  ],

  preload(scene, d) {
    for (const map of [d.params?.map ?? 'map_forest', d.params?.end_map]) {
      if (map && have.backgrounds.includes(map) && !scene.textures.exists(map)) scene.load.image(map, `backgrounds/${map}.webp`);
    }
  },

  start({ scene, params, ready, complete }) {
    const mapKey: string = params.map ?? 'map_forest';
    let mapW = 2400, mapH = 2625;
    if (scene.textures.exists(mapKey)) {
      const map = scene.add.image(0, 0, mapKey).setOrigin(0).setDepth(1);
      mapW = map.width; mapH = map.height;
    }
    const size: number = params.height ?? 130;      // how tall she is on the map
    // her picture canvases are 300 x 300 with the ground at 280, and about 235 of that is her
    const girlRunner = (leg: any) => makeRunner(scene, {
      prefix: 'spr_walk', route: leg.route ?? [[200, 200], [800, 800]], speed: leg.speed ?? 190,
      stepRate: leg.steps_per_second ?? 8, scale: size / 235, shadowW: size * 0.45, depth: 3
    });

    let girl = girlRunner(params);
    let chaser: ReturnType<typeof makeRunner> | undefined;

    // the camera shows part of the map and follows her, never going past the map's edges
    const cam = scene.cameras.main;
    cam.setBounds(0, 0, mapW, mapH);
    cam.setZoom(params.zoom ?? 1);
    const follow = () => cam.startFollow(girl.body, false, 0.08, 0.08, 0, size / 2);
    cam.centerOn(girl.body.x, girl.body.y - size / 2);
    follow();

    let gone = false;
    const update = (_: number, delta: number) => {
      // The scene can close in the middle of this very frame. Its pictures are then already removed, and trying to
      // move one froze the whole game on a black screen.
      if (gone) return;
      const dt = Math.min(delta, 50) / 1000;
      girl.update(dt);
      chaser?.update(dt);
    };
    scene.events.on('update', update);
    scene.events.once('shutdown', () => { gone = true; scene.events.off('update', update); });
    const wait = (ms: number) => new Promise<void>(r => scene.time.delayedCall(ms, () => r()));

    const makeChaser = (c: any) => {
      const length: number = c.size ?? 170;   // the wolf's length when seen from the side
      return makeRunner(scene, { prefix: c.picture ?? 'spr_wolf', route: c.route, speed: c.speed ?? 240,
        stepRate: c.steps_per_second ?? 9, scale: length / 270, shadowW: length * 0.5, depth: 2.9 });
    };
    // a chase from the very first moment: it is already standing behind her when the scene opens
    const behind = !params.escape && params.chaser ? makeChaser(params.chaser) : undefined;
    chaser = behind;

    const story = async () => {
      await wait(params.start_pause ?? 400);
      const followed = behind ? wait(params.chaser.delay ?? 500).then(() => (gone ? undefined : behind.go())) : undefined;
      await girl.go();
      await followed;

      // ---- she stops, her picture changes, and they talk ----
      if (params.stop_picture && scene.textures.exists(params.stop_picture)) {
        const b = girl.body;
        b.setTexture(params.stop_picture).setFlipX(false).setOrigin(0.5, 1);
        b.setDisplaySize(b.width * size * 0.95 / b.height, size * 0.95);
      }
      const talk: DialogLine[] = params.stop_dialog ?? [];
      if (talk.length) { await wait(300); await runDialog(scene, talk, (scene as any).applySwap); }
      if (gone) return;

      // ---- she runs away (and maybe something chases her) ----
      if (params.escape) {
        const next = girlRunner(params.escape);
        girl.destroy();
        girl = next;
        follow();
        const done = girl.go();
        const c = params.chaser;
        let chaseOver: Promise<void> = Promise.resolve();
        if (c) chaseOver = new Promise<void>(over => scene.time.delayedCall(c.delay ?? 500, () => {
          chaser = makeChaser(c);
          chaser.body.setAlpha(0);
          scene.tweens.add({ targets: chaser.body, alpha: 1, duration: 250 });
          void chaser.go().then(over);
        }));
        await done;
        // she gets there: the map picture changes (e.g. the bridge breaks)
        if (params.end_map && scene.textures.exists(params.end_map)) {
          const after = scene.add.image(0, 0, params.end_map).setOrigin(0).setDisplaySize(mapW, mapH).setDepth(1.5).setAlpha(0);
          scene.tweens.add({ targets: after, alpha: 1, duration: params.end_map_fade ?? 500 });
        }
        await chaseOver;
      }
      await wait(params.end_pause ?? 1200);
      complete();
    };

    ready.then(story);
  }
};
