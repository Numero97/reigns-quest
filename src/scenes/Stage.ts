import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { scenes, collectAudioIds, type SceneData } from '../engine/content';
import { mechanics, fallback } from '../mechanics';
import have from 'virtual:asset-list';
import { bouncingPaw, makeBackground, makeImage } from '../engine/ui';

/** Plays one scene from content/scenes/*.json. The same Phaser scene is reused for every story scene. */
export class Stage extends Phaser.Scene {
  private data_!: SceneData;
  private loadingPaw?: Phaser.GameObjects.Container;

  constructor() { super('Stage'); }

  init(args: { sceneId: string }) {
    this.data_ = scenes[args.sceneId];
    engine.lockInput(true);
  }

  preload() {
    const d = this.data_;
    this.add.rectangle(512, 384, 1024, 768, 0xcfe6ff);
    this.loadingPaw = bouncingPaw(this);

    this.load.setPath('assets');
    // Only load files that really exist; anything else becomes a placeholder / silent line.
    const mechanic = mechanics[d.mechanic] ?? fallback;
    const sprites = new Set<string>([...(mechanic.assets?.(d) ?? []), ...(d.objects ?? []).map(o => o.sprite)]);
    if (d.background && have.backgrounds.includes(d.background) && !this.textures.exists(d.background)) this.load.image(d.background, `backgrounds/${d.background}.png`);
    sprites.forEach(s => { if (have.sprites.includes(s) && !this.textures.exists(s)) this.load.image(s, `sprites/${s}.png`); });
    collectAudioIds(d).forEach(id => { if (have.audio.includes(id) && !this.cache.audio.exists(id)) this.load.audio(id, `audio/${id}.m4a`); });
  }

  create() {
    const d = this.data_;
    this.loadingPaw?.destroy();
    makeBackground(this, d.background);
    for (const o of d.objects ?? []) makeImage(this, o.sprite, o.x, o.y);

    this.cameras.main.fadeIn(400);
    const mechanic = mechanics[d.mechanic] ?? fallback;

    // 1. intro audio, 2. then input turns on
    this.time.delayedCall(450, async () => {
      mechanic.start({ scene: this, data: d, params: d.params ?? {}, complete: () => this.finish() });
      await engine.play(d.intro_audio);
      engine.lockInput(false);
      engine.replayPrompt();
    });
  }

  private async finish() {
    engine.lockInput(true);
    const d = this.data_;
    await engine.play(d.success_audio);
    this.cameras.main.fadeOut(500);
    this.time.delayedCall(550, () => engine.finishScene(d.id));
  }
}
