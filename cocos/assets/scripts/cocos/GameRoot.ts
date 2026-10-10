import {_decorator, Camera, Color, Component, EventTouch, Graphics, Input, Label, Node, UITransform, Vec3, input, sys, view} from 'cc';
import {Session, Platform} from '../core/Session';
import {Command} from '../view/Drawing';
import {Frame, render} from '../view/GameView';
import {Controller} from '../view/Input';

const {ccclass, property} = _decorator;
const STORAGE_KEY = 'majiang-xiaoxiao:v1';
const SHARE_TITLE = '麻将小茶馆：推一推，碰个对';

/** WeChat mini-game globals; absent in the editor preview and on web builds. */
const wx: any = (globalThis as any).wx;
function vibrate(type: 'light' | 'medium'): void { try { wx?.vibrateShort?.({type}); } catch { /* Haptics are optional. */ } }

/** 把进度写进 __mjBoot.stages，让 game.js 的失败弹窗能显示停在游戏侧的哪一步（真机读不到 console）。定位后删除。 */
function mark(step: string): void {
  (globalThis as any).__mjStage = step;
  const boot: any = (globalThis as any).__mjBoot;
  if (boot?.stages) boot.stages.push('game:' + step);
  console.log('[game]', step);
}

const storage: Platform = {
  load: () => sys.localStorage.getItem(STORAGE_KEY),
  save: data => sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
  feedback: () => vibrate('medium')
};

interface Layer {graphics: Graphics; texts: {x: number; y: number; w: number; h: number}[]}

/**
 * Mount on a full-screen node under the Canvas. Paints the platform-independent Frame
 * with pooled Graphics + Label nodes and forwards touches to the Controller.
 */
@ccclass('GameRoot')
export class GameRoot extends Component {
  @property({tooltip: '固定随机种子便于复现；0 表示每次随机'})
  seed = 0;

  private session!: Session;
  private controller!: Controller;
  private frame: Frame | null = null;
  private dirty = true;
  private frames = 0;
  private firstPainted = false;
  private revision = -1;
  private size = {w: 0, h: 0};
  private graphicsPool: Graphics[] = [];
  private labelPool: Label[] = [];
  private color = new Color();
  private touchId: number | null = null;

  onLoad(): void {
    try {
      mark('A-onLoad');
      let raw: string | null = null;
      mark('B-before-getItem');
      raw = sys.localStorage.getItem(STORAGE_KEY);
      mark(`C-after-getItem ${raw === null ? 'null' : raw.length + 'B'}`);
      // 存档是外部输入：异常膨胀的旧数据会把启动卡在同步解析上，直接丢弃比带着它启动好
      if (raw && raw.length > 262144) {
        mark(`D-oversized dropped`);
        try { sys.localStorage.removeItem(STORAGE_KEY); } catch { /* 清不掉也只能继续 */ }
        raw = null;
      }
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
        mark(`E-parsed ok maxLevel=${parsed?.maxLevel} run=${parsed?.run ? 'y' : 'n'} grid=${parsed?.run?.grid?.length}x${parsed?.run?.grid?.[0]?.length}`);
      } catch (e) {
        mark(`E-parse FAIL ${String((e as Error)?.message || e).slice(0, 60)}`);
        try { sys.localStorage.removeItem(STORAGE_KEY); mark('F-corrupt save cleared'); } catch { /* 清不掉也只能继续 */ }
        raw = null;
      }
      this.session = new Session(this.seed || (Date.now() >>> 0), {load: () => raw, save: storage.save, feedback: storage.feedback});
      mark(`G-session ${this.session.grid.length}x${(this.session.grid[0] || []).length} level=${this.session.levelIndex}`);
      this.controller = new Controller(this.session, {tick: () => vibrate('light')});
      mark('H-controller');
    } catch (e) {
      const msg = `onLoad THREW ${String((e as Error)?.message || e).slice(0, 160)}`;
      mark(msg);
      const boot: any = (globalThis as any).__mjBoot;
      if (boot) boot.error = msg;
      console.error('[game]', msg, (e as Error)?.stack);
      try { wx?.showModal?.({title: 'onLoad 异常', content: msg, showCancel: false}); } catch { /* 弹窗起不来就算了 */ }
    }
    (globalThis as any).__mj = () => ({size: this.size, model: this.controller.model()});
    input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouch, this);
    input.on(Input.EventType.TOUCH_END, this.onTouch, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouch, this);
    try {
      wx?.showShareMenu?.({withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline']});
      wx?.onShareAppMessage?.(() => ({title: SHARE_TITLE}));
      wx?.onShareTimeline?.(() => ({title: SHARE_TITLE}));
    } catch { /* Sharing is optional. */ }
    mark('Z-onLoad done');
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouch, this);
    input.off(Input.EventType.TOUCH_END, this.onTouch, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouch, this);
  }

  update(dt: number): void {
    const hb = this.frames++ < 5;
    const visible = view.getVisibleSize();
    if (visible.width !== this.size.w || visible.height !== this.size.h) {
      this.size = {w: visible.width, h: visible.height};
      this.node.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
      this.dirty = true;
    }
    if (hb) mark(`update#${this.frames} view=${visible.width | 0}x${visible.height | 0}`);
    if (this.controller.update(dt)) this.dirty = true;
    if (this.session.revision !== this.revision) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.revision = this.session.revision;
    this.frame = render(this.controller.model(), this.size.w, this.size.h);
    if (hb) mark(`render cmds=${this.frame.commands.length}`);
    this.paint(this.frame.commands);
    this.paintDebug();
    if (hb) mark('paint ok');
    if (!this.firstPainted) {
        this.firstPainted = true;
        (globalThis as any).__mjFirstFrame = true;
    }
  }

  /* ── 临时诊断浮层：真机读不到 console，靠一张截图定位尺寸/列数问题。查清后整段删除。 ── */
  private debugLabel: Label | null = null;

  private debugText(): string {
    const boot: any = (globalThis as any).__mjBoot || {};
    const grid = this.controller.model().grid;
    const frame = view.getFrameSize();
    const cam: any = (Camera as any).main;
    const rect = cam ? cam.rect : null;
    const pos = this.node.worldPosition;
    return [
      `${boot.env || 'dev'} | view ${this.size.w | 0}x${this.size.h | 0} | frame ${frame.width | 0}x${frame.height | 0}`,
      `grid ${grid.length}x${(grid[0] || []).length} | cmds ${this.frame ? this.frame.commands.length : 0} | node ${pos.x | 0},${pos.y | 0}` +
        (rect ? ` | cam ${rect.x | 0},${rect.y | 0} ${rect.width | 0}x${rect.height | 0}` : ' | NO-CAMERA'),
      boot.geo || '',
      (boot.stages || []).slice(-3).join(' '),
      boot.error || '',
    ].filter(Boolean).join('\n');
  }

  private paintDebug(): void {
    if (!this.debugLabel) {
      const node = new Node('debug');
      node.layer = this.node.layer;
      node.addComponent(UITransform);
      node.parent = this.node;
      const label = node.addComponent(Label);
      label.useSystemFont = true;
      label.overflow = Label.Overflow.NONE;
      label.fontSize = 17;
      label.lineHeight = 21;
      label.cacheMode = Label.CacheMode.BITMAP;
      label.color = new Color(24, 32, 28, 255);
      label.horizontalAlign = Label.HorizontalAlign.LEFT;
      label.verticalAlign = Label.VerticalAlign.TOP;
      this.debugLabel = label;
    }
    const label = this.debugLabel;
    const text = this.debugText();
    if (label.string !== text) label.string = text;
    label.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
    label.node.setPosition(this.px(6), this.py(6));
    label.node.setSiblingIndex(this.node.children.length - 1);
  }

  private onTouch(event: EventTouch): void {
    if (!this.frame) return;
    const id = event.getID();
    if (event.type === Input.EventType.TOUCH_START) {
      if (this.touchId !== null) return;
      this.touchId = id;
    } else if (id !== this.touchId) return;
    const ui = event.getUILocation();
    const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    const x = local.x + this.size.w / 2, y = this.size.h / 2 - local.y;
    switch (event.type) {
      case Input.EventType.TOUCH_START: this.controller.down(this.frame, x, y); break;
      case Input.EventType.TOUCH_MOVE: this.controller.move(this.frame, x, y); break;
      case Input.EventType.TOUCH_END: this.controller.up(this.frame, x, y); break;
      default: this.controller.cancel();
    }
    if (event.type === Input.EventType.TOUCH_END || event.type === Input.EventType.TOUCH_CANCEL) this.touchId = null;
    this.dirty = true;
  }

  /* ── Frame painter ── */
  private px(x: number): number { return x - this.size.w / 2; }
  private py(y: number): number { return this.size.h / 2 - y; }
  private hex(value: string): Color { return this.color.fromHEX(value).clone(); }

  private paint(commands: Command[]): void {
    let order = 0, g = 0, l = 0;
    const layers: Layer[] = [];
    const nextLayer = (): Layer => {
      const graphics = this.graphicsPool[g] ?? this.makeGraphics();
      if (!this.graphicsPool[g]) this.graphicsPool.push(graphics);
      g++;
      graphics.clear();
      graphics.node.active = true;
      graphics.node.setSiblingIndex(order++);
      const layer = {graphics, texts: []};
      layers.push(layer);
      return layer;
    };
    let layer = nextLayer();
    for (const c of commands) {
      if (c.type === 'text') {
        const label = this.labelPool[l] ?? this.makeLabel();
        if (!this.labelPool[l]) this.labelPool.push(label);
        l++;
        this.paintText(label, c);
        label.node.setSiblingIndex(order++);
        const w = c.text.length * c.size, x = c.align === 'left' ? c.x : c.align === 'center' ? c.x - w / 2 : c.x - w;
        layer.texts.push({x, y: c.y, w, h: c.size * 1.25});
        continue;
      }
      // Labels sit above their Graphics, so a shape painted over a label needs a fresh layer.
      const box = bounds(c);
      if (layer.texts.some(t => box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y)) layer = nextLayer();
      this.paintShape(layer.graphics, c);
    }
    for (let i = g; i < this.graphicsPool.length; i++) { this.graphicsPool[i].clear(); this.graphicsPool[i].node.active = false; }
    for (let i = l; i < this.labelPool.length; i++) this.labelPool[i].node.active = false;
  }

  private paintShape(gr: Graphics, c: Exclude<Command, {type: 'text'}>): void {
    if (c.type === 'line') {
      if (c.points.length < 2) return;
      gr.lineWidth = c.lineWidth;
      gr.lineJoin = Graphics.LineJoin.ROUND;
      gr.lineCap = Graphics.LineCap.ROUND;
      gr.strokeColor = this.hex(c.color);
      gr.moveTo(this.px(c.points[0].x), this.py(c.points[0].y));
      for (const p of c.points.slice(1)) gr.lineTo(this.px(p.x), this.py(p.y));
      gr.stroke();
      return;
    }
    if (c.type === 'rect') gr.roundRect(this.px(c.x), this.py(c.y + c.h), c.w, c.h, c.r);
    else gr.circle(this.px(c.x), this.py(c.y), c.r);
    if (!c.color.endsWith('00') || c.color.length === 7) { gr.fillColor = this.hex(c.color); gr.fill(); }
    if (c.stroke) { gr.lineWidth = c.lineWidth ?? 1; gr.strokeColor = this.hex(c.stroke); gr.stroke(); }
  }

  private paintText(label: Label, c: Extract<Command, {type: 'text'}>): void {
    label.node.active = true;
    label.string = c.text;
    label.fontSize = c.size;
    label.lineHeight = c.size * 1.25;
    label.isBold = !!c.bold;
    label.fontFamily = c.font === 'serif' ? 'serif' : 'sans-serif';
    label.color = this.hex(c.color);
    label.horizontalAlign = c.align === 'left' ? Label.HorizontalAlign.LEFT : c.align === 'center' ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.RIGHT;
    const anchorX = c.align === 'left' ? 0 : c.align === 'center' ? 0.5 : 1;
    label.node.getComponent(UITransform)!.setAnchorPoint(anchorX, 1);
    label.node.setPosition(this.px(c.x), this.py(c.y - c.size * 0.12));
  }

  private makeGraphics(): Graphics {
    const node = new Node('frame-shapes');
    node.layer = this.node.layer;
    node.addComponent(UITransform);
    node.parent = this.node;
    return node.addComponent(Graphics);
  }

  private makeLabel(): Label {
    const node = new Node('frame-text');
    node.layer = this.node.layer;
    node.addComponent(UITransform);
    node.parent = this.node;
    const label = node.addComponent(Label);
    label.useSystemFont = true;
    label.overflow = Label.Overflow.NONE;
    label.verticalAlign = Label.VerticalAlign.TOP;
    label.cacheMode = Label.CacheMode.BITMAP;
    return label;
  }
}

function bounds(c: Exclude<Command, {type: 'text'}>): {x: number; y: number; w: number; h: number} {
  if (c.type === 'rect') return {x: c.x, y: c.y, w: c.w, h: c.h};
  if (c.type === 'circle') return {x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2};
  const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
  return {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
}
