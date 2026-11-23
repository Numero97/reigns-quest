import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { engine, W, H } from './engine/engine';
import { Title } from './scenes/Title';
import { Stage } from './scenes/Stage';
import { Overlay } from './scenes/Overlay';
import { save } from './engine/save';

// Keep the iPad from zooming, scrolling, or showing menus
const stop = (e: Event) => e.preventDefault();
['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick'].forEach(n => document.addEventListener(n, stop));
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#bcd7f5',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [Title, Stage, Overlay]
});
engine.game = game;
game.events.once('ready', () => { game.sound.mute = save.muted; game.scene.start('Overlay'); });
(window as any).__game = game;

// Check for a new version of the game each time it opens, and reload by itself when one arrives.
registerSW({ immediate: true });
