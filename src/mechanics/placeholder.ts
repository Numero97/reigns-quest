import Phaser from 'phaser';
import type { Mechanic } from './index';
import { engine } from '../engine/engine';
import { sparkle } from '../engine/ui';

/** A big star to tap. Stands in for any mechanic that has not been built yet. */
export const placeholder: Mechanic = {
  start({ scene, data, params, complete }) {
    const label = data.mechanic === 'placeholder' ? '' : `(${data.mechanic} not built yet)`;
    if (label) scene.add.text(512, 120, label, { fontSize: '30px', color: '#556' }).setOrigin(0.5);

    const star = scene.add.star(512, 400, 5, 70, 150, 0xffd54a).setStrokeStyle(8, 0xe0a800);
    star.setInteractive(new Phaser.Geom.Circle(150, 150, 150), Phaser.Geom.Circle.Contains);
    scene.tweens.add({ targets: star, scale: 1.08, duration: 700, yoyo: true, repeat: -1 });

    const promptId = params.prompt_audio ?? null;
    engine.setPrompt(promptId); // the engine speaks it after the intro

    star.on('pointerdown', () => {
      if (engine.locked) return;
      star.disableInteractive();
      sparkle(scene, 512, 400);
      complete();
    });
  }
};
