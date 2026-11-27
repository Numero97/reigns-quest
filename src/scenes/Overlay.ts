import Phaser from 'phaser';
import { engine } from '../engine/engine';
import { sceneOrder } from '../engine/content';
import { resetProgress } from '../engine/save';

/** Always on top: the ear button, the hidden parent menu, and debug captions. */
export class Overlay extends Phaser.Scene {
  private ear!: Phaser.GameObjects.Container;
  private caption!: Phaser.GameObjects.Text;
  private captionTimer?: Phaser.Time.TimerEvent;
  private menu?: Phaser.GameObjects.Container;
  private holdTimer?: Phaser.Time.TimerEvent;

  constructor() { super('Overlay'); }

  create() {
    this.buildEar();
    this.buildCaption();
    this.buildHotCorner();
    engine.events.on('caption', (t: string) => this.showCaption(t));
  }

  update() {
    this.ear.setVisible(this.scene.isActive('Stage') && !this.menu);
  }

  // ---- ear button (bottom-right, drawn from shapes so it needs no art) ----
  private buildEar() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18).fillCircle(0, 6, 62);
    g.fillStyle(0xffd54a, 1).fillCircle(0, 0, 62).lineStyle(6, 0xe0a800).strokeCircle(0, 0, 62);
    // a side-view ear: pink outer shape, inner curl, little lobe
    g.fillStyle(0xf4b896, 1).fillEllipse(2, -2, 60, 84).lineStyle(6, 0x7a4a24).strokeEllipse(2, -2, 60, 84);
    g.lineStyle(6, 0x7a4a24);
    g.beginPath().arc(2, -14, 17, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false).strokePath();   // rim
    g.beginPath().arc(4, 6, 12, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(540), false).strokePath();    // inner curl
    g.fillStyle(0xe58f6b, 1).fillCircle(-4, 40, 10).lineStyle(4, 0x7a4a24).strokeCircle(-4, 40, 10);          // lobe
    this.ear = this.add.container(1024 - 90, 768 - 90, [g]).setSize(124, 124).setDepth(100);
    this.ear.setInteractive({ useHandCursor: true });
    this.ear.on('pointerdown', () => {
      this.tweens.add({ targets: this.ear, scale: 0.9, duration: 80, yoyo: true });
      engine.sfx('sfx_mouse_click');
      engine.replayPrompt();
    });
  }

  // ---- debug caption (shows the text of a line that has no recording yet) ----
  private buildCaption() {
    this.caption = this.add.text(512, 40, '', {
      fontSize: '30px', color: '#ffffff', backgroundColor: '#000000cc', padding: { x: 18, y: 10 },
      align: 'center', wordWrap: { width: 900 }
    }).setOrigin(0.5, 0).setDepth(200).setVisible(false);
  }
  private showCaption(text: string) {
    this.caption.setText(text).setVisible(true);
    this.captionTimer?.remove();
    this.captionTimer = this.time.delayedCall(3000, () => this.caption.setVisible(false));
  }

  // ---- hidden parent menu: hold the top-left corner for 3 seconds ----
  private buildHotCorner() {
    const zone = this.add.zone(0, 0, 150, 150).setOrigin(0).setInteractive().setDepth(100);
    zone.on('pointerdown', () => { this.holdTimer?.remove(); this.holdTimer = this.time.delayedCall(3000, () => this.openMenu()); });
    const cancel = () => this.holdTimer?.remove();
    zone.on('pointerup', cancel);
    zone.on('pointerout', cancel);
  }

  private button(x: number, y: number, w: number, h: number, label: string, onTap: () => void, color = 0xffffff) {
    const bg = this.add.rectangle(0, 0, w, h, color).setStrokeStyle(4, 0x2d4a7a);
    const t = this.add.text(0, 0, label, { fontSize: '28px', color: '#1c2a3a', align: 'center' }).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, t]).setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', onTap);
    return { c, t };
  }

  private openMenu() {
    if (this.menu) return;
    const items: Phaser.GameObjects.GameObject[] = [];
    const block = this.add.rectangle(512, 384, 1024, 768, 0x1c2a3a, 0.92).setInteractive();
    items.push(block, this.add.text(512, 50, 'Grown-ups menu', { fontSize: '44px', color: '#fff' }).setOrigin(0.5));

    // scene select
    items.push(this.add.text(512, 105, 'Jump to a scene:', { fontSize: '26px', color: '#cfe' }).setOrigin(0.5));
    sceneOrder.forEach((id, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const b = this.button(150 + col * 240, 170 + row * 70, 220, 56, id, () => { this.closeMenu(); engine.startScene(id); }, 0xdff0ff);
      b.t.setFontSize(22);
      items.push(b.c);
    });

    const set = (t: Phaser.GameObjects.Text, name: string, on: boolean) => t.setText(`${name}: ${on ? 'ON' : 'off'}`);
    const mute = this.button(260, 560, 400, 70, '', () => { engine.setMuted(!engine.muted); set(mute.t, 'Sound muted', engine.muted); });
    set(mute.t, 'Sound muted', engine.muted);
    const dbg = this.button(764, 560, 400, 70, '', () => { engine.setDebug(!engine.debug); set(dbg.t, 'Debug captions', engine.debug); });
    set(dbg.t, 'Debug captions', engine.debug);

    let armed = false;
    const reset = this.button(260, 660, 400, 70, 'Reset progress', () => {
      if (!armed) { armed = true; reset.t.setText('Tap again to erase'); reset.c.list[0] && (reset.c.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(0xffc2c2); return; }
      resetProgress(); this.closeMenu(); engine.goToTitle();
    });
    const close = this.button(764, 660, 400, 70, 'Close', () => this.closeMenu(), 0xc8f0c8);
    items.push(mute.c, dbg.c, reset.c, close.c);

    this.menu = this.add.container(0, 0, items).setDepth(300);
  }

  private closeMenu() { this.menu?.destroy(); this.menu = undefined; }
}

