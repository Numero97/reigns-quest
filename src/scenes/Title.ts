import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { sceneOrder } from '../engine/content';
import { save } from '../engine/save';

/** The first screen: one big Play button. Tapping it also unlocks sound on the iPad. */
export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x9ec8f0, 0x9ec8f0, 0xe9f6d8, 0xe9f6d8, 1).fillRect(0, 0, 1024, 768);
    this.add.text(512, 150, "Reign's Quest", { fontSize: '84px', color: '#2d4a7a', fontStyle: 'bold' }).setOrigin(0.5);

    const btn = this.add.container(512, 440);
    btn.add([
      this.add.circle(0, 8, 170, 0x000000, 0.15),
      this.add.circle(0, 0, 170, 0xffd54a).setStrokeStyle(10, 0xe0a800),
      this.add.graphics().fillStyle(0x2d4a7a, 1).fillTriangle(-50, -85, -50, 85, 90, 0)
    ]);
    btn.setSize(340, 340).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: btn, scale: 1.06, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    btn.once('pointerdown', () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state !== 'running') ctx.resume();
      this.sound.mute = save.muted;
      const resume = save.lastScene && sceneOrder.includes(save.lastScene) ? save.lastScene : sceneOrder[0];
      engine.startScene(resume);
    });
  }
}
