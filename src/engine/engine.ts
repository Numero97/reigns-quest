// The engine: one shared object that scenes, mechanics and the overlay all talk to.
import Phaser from 'phaser';
import { sceneOrder, scenes, lineText } from './content';
import { save, persist } from './save';

export const W = 1024;
export const H = 768;

class Engine {
  game!: Phaser.Game;
  events = new Phaser.Events.EventEmitter();
  private current: Phaser.Sound.BaseSound | null = null;
  private promptId: string | null = null;
  private inputLocked = true;

  get debug() { return save.debug; }
  get muted() { return save.muted; }

  setDebug(v: boolean) { save.debug = v; persist(); this.events.emit('settings'); }
  setMuted(v: boolean) { save.muted = v; persist(); if (this.game) this.game.sound.mute = v; this.events.emit('settings'); }

  /** Input is off while the narrator talks, on when she can play. */
  get locked() { return this.inputLocked; }
  lockInput(v: boolean) { this.inputLocked = v; }

  /** Speak a line. Resolves when the audio ends. Missing audio: says nothing (caption in debug mode). */
  play(id: string | undefined | null): Promise<void> {
    return new Promise(resolve => {
      if (!id) return resolve();
      this.stopVoice();
      const text = lineText[id] ?? id;
      if (this.game.cache.audio.exists(id)) {
        const s = this.game.sound.add(id);
        this.current = s;
        s.once('complete', () => { if (this.current === s) this.current = null; s.destroy(); resolve(); });
        s.once('stop', () => resolve());
        s.play();
      } else if (this.debug) {
        this.events.emit('caption', text);
        setTimeout(resolve, 3000);
      } else setTimeout(resolve, 300);
    });
  }

  hasAudio(id: string) { return this.game.cache.audio.exists(id); }

  /** A short sound effect that is not a voice line (nothing plays until real files exist). */
  sfx(id: string) { if (this.game.cache.audio.exists(id)) this.game.sound.play(id); }

  stopVoice() { if (this.current) { const s = this.current; this.current = null; s.stop(); s.destroy(); } }

  /** The line the ear button repeats. */
  setPrompt(id: string | null) { this.promptId = id; }
  replayPrompt() { if (this.promptId) this.play(this.promptId); }

  // ---- scene flow ----
  startScene(id: string) {
    if (!scenes[id]) return;
    this.stopVoice();
    this.promptId = null;
    this.inputLocked = true;
    save.lastScene = id; persist();
    if (this.game.scene.isActive('Title')) this.game.scene.stop('Title');
    const stage = this.game.scene.getScene('Stage');
    if (stage.scene.isActive()) stage.scene.restart({ sceneId: id });
    else this.game.scene.start('Stage', { sceneId: id });
  }

  /** Called by a scene when she has finished it. Saves, then goes on to the next scene. */
  finishScene(id: string) {
    if (!save.completed.includes(id)) save.completed.push(id);
    const next = scenes[id].next ?? sceneOrder[sceneOrder.indexOf(id) + 1] ?? null;
    save.lastScene = next; persist();
    if (next && scenes[next]) this.startScene(next);
    else this.goToTitle();
  }

  goToTitle() {
    this.stopVoice();
    this.promptId = null;
    this.game.scene.stop('Stage');
    this.game.scene.start('Title');
  }
}

export const engine = new Engine();
