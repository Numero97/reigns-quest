import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { scenes, collectAudioIds, type SceneData } from '../engine/content';
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

  constructor() { super('Stage'); }

  init(args: { sceneId: string }) {
    this.data_ = scenes[args.sceneId];
    engine.lockInput(true);
  }

  private dialogLines(): DialogLine[] { return (this.data_.dialog as DialogLine[] | undefined) ?? []; }

  preload() {
    const d = this.data_;
    this.add.rectangle(512, 384, 1024, 768, 0xcfe6ff);
    this.loadingPaw = bouncingPaw(this);

    this.load.setPath('assets');
    // Only load files that really exist; anything else becomes a placeholder / silent line.
    const mechanic = mechanics[d.mechanic] ?? fallback;
    const portraits = [...this.dialogLines(), d.success_dialog].filter(Boolean)
      .flatMap((l: DialogLine) => (l.portrait ? [`${l.portrait}_closed`, `${l.portrait}_open`] : []));
    const sprites = new Set<string>([...(mechanic.assets?.(d) ?? []), ...(d.objects ?? []).map(o => o.sprite), ...portraits]);
    const audio = new Set<string>([...collectAudioIds(d), ...(mechanic.audio?.(d) ?? [])]);
    if (d.background && have.backgrounds.includes(d.background) && !this.textures.exists(d.background)) this.load.image(d.background, `backgrounds/${d.background}.png`);
    sprites.forEach(s => { if (have.sprites.includes(s) && !this.textures.exists(s)) this.load.image(s, `sprites/${s}.png`); });
    audio.forEach(id => { if (have.audio.includes(id) && !this.cache.audio.exists(id)) this.load.audio(id, `audio/${id}.m4a`); });
  }

  create() {
    const d = this.data_;
    this.loadingPaw?.destroy();
    makeBackground(this, d.background);
    for (const o of d.objects ?? []) makeImage(this, o.sprite, o.x, o.y);

    this.cameras.main.fadeIn(600);
    const mechanic = mechanics[d.mechanic] ?? fallback;
    engine.setPrompt(d.prompt_audio ?? d.params?.prompt_audio ?? null);

    let unlock!: () => void;
    const ready = new Promise<void>(r => (unlock = r));
    this.idle = new IdleReplay(this);
    this.events.once('shutdown', () => this.idle?.stop());
    mechanic.start({ scene: this, data: d, params: d.params ?? {}, ready, complete: () => this.finish() });

    // 1. narration (dialog, or just the intro line)  2. then input turns on  3. quiet-time prompt replays begin
    this.time.delayedCall(650, async () => {
      if (this.dialogLines().length) await runDialog(this, this.dialogLines());
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
    const sd = d.success_dialog as DialogLine | undefined;
    if (sd) await runDialog(this, [{ ...sd, audio: sd.audio ?? d.success_audio }]);
    else await engine.play(d.success_audio);
    this.cameras.main.fadeOut(600);
    this.time.delayedCall(650, () => engine.finishScene(d.id));
  }
}
