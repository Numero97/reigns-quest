// The "never fail, always help" rules, shared by every mechanic.
import Phaser from 'phaser';
import { engine } from './engine';

/**
 * Wrong-tap ladder for one step:
 *   2 misses -> say the first hint and pulse the right answer
 *   4 misses -> say the second hint and finish the step for her
 * Call miss() on each wrong tap and reset() when the step is done.
 */
export class HintLadder {
  private misses = 0;
  constructor(private opts: {
    hintAudio?: string[];
    pulse: () => void;
    autoComplete: () => void;
  }) {}

  miss() {
    this.misses++;
    if (this.misses === 2) {
      this.opts.pulse();
      engine.play(this.opts.hintAudio?.[0]);
    } else if (this.misses === 4) {
      this.opts.pulse();
      engine.play(this.opts.hintAudio?.[1] ?? this.opts.hintAudio?.[0]).then(() => {});
      this.opts.autoComplete();
    }
  }

  reset() { this.misses = 0; }
}

/** Replays the prompt after 8 quiet seconds, then every 15 seconds. Any tap restarts the wait. */
export class IdleReplay {
  private timer?: Phaser.Time.TimerEvent;
  private first = true;
  private running = false;
  constructor(private scene: Phaser.Scene) {}

  start() {
    this.running = true;
    this.first = true;
    this.arm();
    this.scene.input.on('pointerdown', this.touched, this);
  }

  stop() {
    this.running = false;
    this.timer?.remove();
    this.scene.input.off('pointerdown', this.touched, this);
  }

  /** Call after any spoken line or step, so we don't talk over it. */
  touched() {
    if (!this.running) return;
    this.first = true;
    this.arm();
  }

  private arm() {
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(this.first ? 8000 : 15000, () => {
      if (!engine.locked) engine.replayPrompt();
      this.first = false;
      this.arm();
    });
  }
}

/** A soft ring where she tapped empty floor: gentle "not there", never scolding. */
export function softRipple(scene: Phaser.Scene, x: number, y: number) {
  const ring = scene.add.circle(x, y, 14, 0xffffff, 0).setStrokeStyle(5, 0xffffff, 0.8).setDepth(40);
  scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
}
