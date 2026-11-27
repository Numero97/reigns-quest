import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { sceneOrder, scenes, config } from '../engine/content';
import { save } from '../engine/save';
import have from 'virtual:asset-list';

/** The first screen: one big Play button. Tapping it also unlocks sound on the iPad. */
export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  preload() {
    this.load.setPath('assets');
    engine.loadSfx(this.load, this.cache, have.audio);
  }

  create() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x9ec8f0, 0x9ec8f0, 0xe9f6d8, 0xe9f6d8, 1).fillRect(0, 0, 1024, 768);
    this.add.text(512, 150, "Reign's Quest", { fontSize: '84px', color: '#2d4a7a', fontStyle: 'bold' }).setOrigin(0.5);

    // Play = start from the beginning. Continue (only shown once she has played) = pick up at the scene she was last in.
    const resumeId = save.lastScene && sceneOrder.includes(save.lastScene) ? save.lastScene : null;
    const playX = resumeId ? 340 : 512;
    const btn = this.add.container(playX, 440);
    btn.add([
      this.add.circle(0, 8, 170, 0x000000, 0.15),
      this.add.circle(0, 0, 170, 0xffd54a).setStrokeStyle(10, 0xe0a800),
      this.add.graphics().fillStyle(0x2d4a7a, 1).fillTriangle(-50, -85, -50, 85, 90, 0)
    ]);
    btn.setSize(340, 340).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: btn, scale: 1.06, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    let starting = false;
    const begin = (sceneId: string) => {
      if (starting) return;
      starting = true;
      engine.sfx('sfx_mouse_click');
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state !== 'running') ctx.resume();
      this.sound.mute = save.muted;
      engine.startScene(sceneId);
    };
    btn.on('pointerdown', () => begin(sceneOrder[0]));

    if (resumeId) {
      const cont = this.add.container(740, 440);
      cont.add([
        this.add.circle(0, 6, 120, 0x000000, 0.15),
        this.add.circle(0, 0, 120, 0xa9e07a).setStrokeStyle(8, 0x6fb03c),
        this.add.graphics().fillStyle(0x2d4a7a, 1).fillTriangle(-62, -52, -62, 52, 2, 0).fillTriangle(4, -52, 4, 52, 68, 0),
        this.add.text(0, 150, 'Continue', { fontSize: '30px', color: '#2d4a7a', fontStyle: 'bold' }).setOrigin(0.5)
      ]);
      cont.setSize(240, 240).setInteractive({ useHandCursor: true });
      cont.on('pointerdown', () => begin(resumeId));
    }

    // Scene picker: small numbered buttons along the bottom (set "show_scene_picker": false in config.json to hide)
    if (config.show_scene_picker !== false && sceneOrder.length > 1) {
      const gap = Math.min(110, 900 / sceneOrder.length);
      const x0 = 512 - ((sceneOrder.length - 1) * gap) / 2;
      sceneOrder.forEach((id, i) => {
        const b = this.add.container(x0 + i * gap, 655);
        b.add([
          this.add.circle(0, 0, 30, 0xffffff, 0.75).setStrokeStyle(3, 0x2d4a7a),
          this.add.text(0, -2, String(i + 1), { fontSize: '30px', color: '#2d4a7a', fontStyle: 'bold' }).setOrigin(0.5),
          this.add.text(0, 40, String(scenes[id].title ?? id), { fontSize: '15px', color: '#2d4a7a', align: 'center', wordWrap: { width: gap - 6 } }).setOrigin(0.5, 0)
        ]);
        b.setSize(gap - 6, 100).setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => begin(id));
      });
    }
  }
}
