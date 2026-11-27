import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { scenes, collectAudioIds, walkObjects, type SceneData } from '../engine/content';
import { mechanics, fallback } from '../mechanics';
import have from 'virtual:asset-list';
import { bouncingPaw, makeBackground, makeImage } from '../engine/ui';
import { runDialog, type DialogLine } from '../engine/dialog';
import { IdleReplay } from '../engine/hints';

/** Plays one scene from content/scenes/*.json. The same Phaser scene is reused for every story scene. */
export class Stage extends Phaser.Scene {
  private data_!: SceneData;
  private loadingPaw?: Phaser.GameObjects.Container;
  private idle?: IdleReplay;
  private placed = new Map<string, Phaser.GameObjects.Image>();   // picture id -> what is on screen

  constructor() { super('Stage'); }

  init(args: { sceneId: string }) {
    this.data_ = scenes[args.sceneId];
    this.placed.clear();   // forget the pictures of the previous scene (they were destroyed with it)
    engine.lockInput(true);
  }

  /** A dialog line can say "swap": { "spr_reign": "spr_reign_surprised" } to change a picture on screen. */
  applySwap = (line: DialogLine) => {
    // "hide": ["spr_veg_beet", ...] fades those pictures away
    for (const id of line.hide ?? []) {
      const img = this.placed.get(id);
      if (img) this.tweens.add({ targets: img, alpha: 0, duration: 600 });
    }
    for (const [from, to] of Object.entries(line.swap ?? {})) {
      const img = this.placed.get(from);
      if (!img || !this.textures.exists(to)) continue;
      const k = img.displayHeight / img.height;   // keep the same on-screen size
      img.setTexture(to).setDisplaySize(img.width * k, img.height * k);
    }
  };

  /** Reign jumps for joy: swaps to her excited picture, bounces up and down smoothly for about a second, then goes back. */
  celebrate = (): Promise<void> => new Promise(resolve => {
    const img = this.placed.get('spr_reign') ?? this.placed.get('spr_reign_surprised');
    if (!img || !this.textures.exists('spr_reign_excited')) { resolve(); return; }
    const before = { key: img.texture.key, w: img.displayWidth, h: img.displayHeight, y: img.y };
    const k = img.displayHeight / img.height;   // keep the same on-screen size
    img.setTexture('spr_reign_excited').setDisplaySize(img.width * k, img.height * k);
    this.tweens.add({
      targets: img, y: before.y - 60, duration: 250, ease: 'Sine.easeInOut', yoyo: true, repeat: 1,   // two smooth bounces = 1 second
      onComplete: () => { img.y = before.y; img.setTexture(before.key).setDisplaySize(before.w, before.h); resolve(); }
    });
  });

  /** Lets a mechanic move a character that the scene file placed. */
  getPlaced(id: string) { return this.placed.get(id); }

  private dialogLines(): DialogLine[] { return (this.data_.dialog as DialogLine[] | undefined) ?? []; }

  preload() {
    const d = this.data_;
    this.add.rectangle(512, 384, 1024, 768, 0xcfe6ff);
    this.loadingPaw = bouncingPaw(this);

    this.load.setPath('assets');
    // Only load files that really exist; anything else becomes a placeholder / silent line.
    const mechanic = mechanics[d.mechanic] ?? fallback;
    // every dialog line anywhere in the scene file: load its Dad/other face frames and any picture it swaps in
    const portraits: string[] = [], swapTargets: string[] = [];
    walkObjects(d, o => {
      if (typeof o.portrait === 'string') portraits.push(`${o.portrait}_closed`, `${o.portrait}_middle`, `${o.portrait}_open`);
      if (o.swap && typeof o.swap === 'object') swapTargets.push(...Object.values<string>(o.swap));
    });
    const sprites = new Set<string>([...(mechanic.assets?.(d) ?? []), ...(d.objects ?? []).map(o => o.sprite), ...portraits, ...swapTargets]);
    const audio = new Set<string>([...collectAudioIds(d), ...(mechanic.audio?.(d) ?? [])]);
    if (d.background && have.backgrounds.includes(d.background) && !this.textures.exists(d.background)) this.load.image(d.background, `backgrounds/${d.background}.png`);
    sprites.forEach(s => { if (have.sprites.includes(s) && !this.textures.exists(s)) this.load.image(s, `sprites/${s}.png`); });
    engine.loadSfx(this.load, this.cache, have.audio);
    mechanic.preload?.(this, d);
    if (have.sprites.includes('spr_reign_excited') && !this.textures.exists('spr_reign_excited')) this.load.image('spr_reign_excited', 'sprites/spr_reign_excited.png');
    audio.forEach(id => { if (have.audio.includes(id) && !this.cache.audio.exists(id)) this.load.audio(id, `audio/${id}.m4a`); });
  }

  create() {
    const d = this.data_;
    this.loadingPaw?.destroy();
    makeBackground(this, d.background);
    // objects: { sprite, x, y, height?, anchor? }  height = size on screen; anchor "bottom" = x,y is where the feet touch
    for (const o of d.objects ?? []) {
      const img = makeImage(this, o.sprite, o.x, o.y);
      if (img instanceof Phaser.GameObjects.Image) {
        if (o.height) img.setDisplaySize(img.width * o.height / img.height, o.height);
        if (o.anchor === 'bottom') img.setOrigin(0.5, 1);
        if (o.flip) img.setFlipX(true);
        if (o.rotate) img.setAngle(o.rotate);
      }
      img.setDepth(o.depth ?? 2);
      if (img instanceof Phaser.GameObjects.Image) this.placed.set(o.sprite, img);
    }

    this.cameras.main.fadeIn(d.fade_in_ms ?? 600);   // "fade_in_ms" / "fade_out_ms" in a scene file: how fast it appears / leaves
    const mechanic = mechanics[d.mechanic] ?? fallback;
    engine.setPrompt(d.prompt_audio ?? d.params?.prompt_audio ?? null);

    let unlock!: () => void;
    const ready = new Promise<void>(r => (unlock = r));
    this.idle = new IdleReplay(this);
    this.events.once('shutdown', () => this.idle?.stop());
    mechanic.start({ scene: this, data: d, params: d.params ?? {}, ready, complete: () => this.finish() });

    // 1. narration (dialog, or just the intro line)  2. then input turns on  3. quiet-time prompt replays begin
    this.time.delayedCall(650, async () => {
      if (this.dialogLines().length) await runDialog(this, this.dialogLines(), this.applySwap);
      else {
        await engine.play(d.intro_audio);
        engine.replayPrompt();
      }
      engine.lockInput(false);
      unlock();
      this.idle?.start();
    });
  }

  private async finish() {
    engine.lockInput(true);
    this.idle?.stop();
    const d = this.data_;
    const cam = this.cameras.main;
    if (cam.zoom !== 1) {   // a mechanic zoomed in: blink back to the normal view so the dialog box fits
      cam.fadeOut(350);
      await new Promise<void>(r => this.time.delayedCall(380, () => r()));
      cam.setZoom(1).centerOn(512, 384);
      cam.fadeIn(350);
    }
    const sd = d.success_dialog as DialogLine | DialogLine[] | undefined;
    if (Array.isArray(sd)) await runDialog(this, sd, this.applySwap);   // several lines in a row
    else if (sd) await runDialog(this, [{ ...sd, audio: sd.audio ?? d.success_audio }], this.applySwap);
    else await engine.play(d.success_audio);
    const fade: number = d.fade_out_ms ?? 600;
    this.cameras.main.fadeOut(fade);
    this.time.delayedCall(fade + 50, () => engine.finishScene(d.id));
  }
}
