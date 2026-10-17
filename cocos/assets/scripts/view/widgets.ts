/**
 * cc 原生控件装配：面板 / 按钮 / 匾额 / 文字 / 开关 / 星 / 锁 / 箭头 / 高亮框。
 *
 * 坐标约定：**可见区单位**（与 Canvas 的 UITransform / `view.getVisibleSize()` 一致），
 * (0,0) 是父节点中心，+y 向上。宽度优先适配下宽度恒为设计宽 750，高度随屏幕比例变化，
 * 所以纵向位置要相对可见高度算，别写死 1334。
 * 引擎会按设计分辨率自动适配屏幕，所以这里不需要再手算「设计像素 → 实际像素」。
 *
 * 所有可点控件都挂自己的 `Node.EventType.TOUCH_END`，不再维护 hits[] 数组做手工命中测试。
 */
import {Color, Label, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, tween} from 'cc';
import {depth, radius, type} from './theme';
import {UiAtlas, UiName} from './assets';

/** 取颜色的 cc 表示。 */
export function hex(value: string): Color {
  const c = new Color();
  Color.fromHEX(c, value);
  return c;
}

export interface NodeOpts {x?: number; y?: number; w?: number; h?: number; name?: string}

/** 建一个带 UITransform 的节点（锚点 0.5/0.5）。 */
export function makeNode(parent: Node, o: NodeOpts = {}): Node {
  const n = new Node(o.name || 'node');
  n.layer = parent.layer;
  const ui = n.addComponent(UITransform);
  ui.setContentSize(o.w ?? 0, o.h ?? 0);
  ui.setAnchorPoint(0.5, 0.5);
  n.parent = parent;
  n.setPosition(o.x ?? 0, o.y ?? 0, 0);
  return n;
}

/**
 * 九宫格 SpriteFrame 的克隆缓存：`源帧 → (insets → 克隆帧)`。
 *
 * 9 宫格必须用独立帧实例（改 insets 会串到共享同一帧的其它节点），但**绝不能每个节点都 clone**：
 * 以前 `makeSprite` 每建一个九宫格 Sprite 就 clone 一份且从不销毁，重绘几屏就是几百个
 * SpriteFrame 挂在纹理上（每个都要重建 UV、都是一份顶点数据），内存与合批一起变差。
 * `Atlas.frame()` 对同一个名字返回**同一个实例**，所以按「源帧对象 + insets」缓存
 * 等价于「按图集里的名字缓存」，条目数固定在素材数量级（几十个）。
 */
const slicedFrames = new Map<SpriteFrame, Map<string, SpriteFrame>>();

function slicedFrame(frame: SpriteFrame, insets: [number, number, number, number]): SpriteFrame {
  const key = insets.join(',');
  let byInsets = slicedFrames.get(frame);
  if (!byInsets) { byInsets = new Map(); slicedFrames.set(frame, byInsets); }
  const hit = byInsets.get(key);
  if (hit) return hit;
  const f = frame.clone();
  f.insetLeft = insets[0]; f.insetRight = insets[1]; f.insetTop = insets[2]; f.insetBottom = insets[3];
  byInsets.set(key, f);
  return f;
}

/** 用图集素材建一个 Sprite。`sliced` 时按 9 宫格拉伸到 w×h。 */
export function makeSprite(parent: Node, frame: SpriteFrame, w: number, h: number, x = 0, y = 0, sliced = false, insets?: [number, number, number, number]): Sprite {
  const n = makeNode(parent, {w, h, x, y, name: 'sprite'});
  const sp = n.addComponent(Sprite);
  // 必须先设 CUSTOM：默认的 TRIMMED 会按贴图原始尺寸渲染，完全无视 UITransform 的 w/h
  // （表现就是「9 宫格按钮 / 卡片全都撑成贴图大小」）。
  sp.sizeMode = Sprite.SizeMode.CUSTOM;
  sp.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
  sp.spriteFrame = sliced && insets ? slicedFrame(frame, insets) : frame;
  const ui = n.getComponent(UITransform);
  if (ui) ui.setContentSize(w, h);
  return sp;
}

export interface LabelOpts {
  x?: number; y?: number;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  serif?: boolean;
  name?: string;
}

/**
 * 建一个文字节点。y 是文字盒的**顶部**，锚点按对齐方式设为 左/中/右 + 上，
 * 这样多行与换行不会上下漂。
 */
export function makeLabel(parent: Node, str: string, o: LabelOpts = {}): Label {
  const n = new Node(o.name || 'text');
  n.layer = parent.layer;
  n.addComponent(UITransform);
  const l = n.addComponent(Label);
  l.useSystemFont = true;
  l.overflow = Label.Overflow.NONE;
  l.verticalAlign = Label.VerticalAlign.TOP;
  l.cacheMode = Label.CacheMode.NONE;
  n.parent = parent;
  setLabel(l, str, o);
  const ui = n.getComponent(UITransform)!;
  ui.setAnchorPoint(o.align === 'left' ? 0 : o.align === 'center' ? 0.5 : 1, 1);
  n.setPosition(o.x ?? 0, o.y ?? 0, 0);
  return l;
}

/** 改文字内容与样式（先定字号字体再设字符串，否则会按旧字号先排一次）。 */
export function setLabel(l: Label, str: string, o: LabelOpts = {}): void {
  const size = o.size ?? type.body;
  l.fontSize = size;
  l.lineHeight = size * 1.25;
  l.isBold = !!o.bold;
  l.fontFamily = o.serif ? 'serif' : 'sans-serif';
  l.string = str;
  l.color = hex(o.color ?? '#2B3A28');
  l.horizontalAlign = o.align === 'left' ? Label.HorizontalAlign.LEFT
    : o.align === 'center' ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.RIGHT;
  const n = l.node;
  const ui = n.getComponent(UITransform);
  if (ui) ui.setAnchorPoint(o.align === 'left' ? 0 : o.align === 'center' ? 0.5 : 1, 1);
}

/* ══ 复合控件 ══════════════════════════════════════════════ */

export interface BtnKind {frame: string}
export const BTN = {
  jade: 'btn-jade', cream: 'btn-cream', gold: 'btn-gold', dark: 'btn-dark', disabled: 'btn-disabled'
} as const;
export type BtnStyle = keyof typeof BTN;

export interface ButtonOpts {
  x: number; y: number; w: number; h: number;
  text: string;
  style?: BtnStyle;
  size?: number;
  sub?: string;
  /** 图集里的图标帧名（如 'icon-play'）；有图标时图标与文字并排居中 */
  icon?: UiName;
  onTap?: () => void;
}

/**
 * 厚按钮：图集 9 宫格做底，文字用 Label。按下时整体缩小并下沉，松手回调。
 */
export function makeButton(parent: Node, atlas: UiAtlas, o: ButtonOpts): Node {
  const style = o.style ?? 'cream';
  const n = makeNode(parent, {w: o.w, h: o.h, x: o.x, y: o.y, name: 'button:' + o.text});
  makeSprite(n, atlas.frame(BTN[style]), o.w, o.h, 0, 0, true, atlas.inset(BTN[style]));
  const size = o.size ?? type.label;
  const ink = style === 'jade' || style === 'dark' ? '#FFFFFF' : style === 'gold' ? '#5A3F0E' : '#3E5A3A';
  // Label 锚点是「顶部对齐」：要把一行字垂直居中，文字盒顶部应落在 +lineHeight/2 处。
  const textTop = size * 0.62;
  if (o.icon) {
    // 图标是白色烘焙的线描图，这里按按钮墨色染色；与文字并排、一起居中。
    const ic = makeSprite(n, atlas.frame(o.icon), size * 1.15, size * 1.15, -o.w * .28, 0);
    ic.color = hex(ink);
    makeLabel(n, o.text, {x: o.w * .06, y: textTop, size, color: ink, align: 'center', bold: true});
  } else {
    makeLabel(n, o.text, {x: 0, y: o.sub ? textTop + size * .34 : textTop, size, color: ink, align: 'center', bold: true});
  }
  if (o.sub) makeLabel(n, o.sub, {x: 0, y: textTop - size * .42, size: size * .62, color: ink, align: 'center'});
  bindPress(n, o.onTap);
  return n;
}

/** 给节点绑「按下缩放 + 松手回调」，触摸不会穿透到下层。 */
export function bindPress(n: Node, onTap?: () => void): void {
  const home = n.position.clone();
  n.on(Node.EventType.TOUCH_START, () => {
    tween(n).to(0.06, {scale: new Vec3(0.96, 0.96, 1), position: new Vec3(home.x, home.y - 2, 0)}).start();
  }, n);
  const release = (fire: boolean) => () => {
    tween(n).to(0.08, {scale: new Vec3(1, 1, 1), position: home}).start();
    if (fire && onTap) onTap();
  };
  n.on(Node.EventType.TOUCH_END, release(true), n);
  n.on(Node.EventType.TOUCH_CANCEL, release(false), n);
}

/** 纸面卡片。 */
export function makePanel(parent: Node, atlas: UiAtlas, w: number, h: number, x = 0, y = 0, r?: number): Node {
  const n = makeNode(parent, {w, h, x, y, name: 'panel'});
  makeSprite(n, atlas.frame('panel'), w, h, 0, 0, true, atlas.inset('panel'));
  return n;
}

/** 深玉匾额（标题条）。 */
export function makePlate(parent: Node, atlas: UiAtlas, w: number, h: number, x = 0, y = 0): Node {
  const n = makeNode(parent, {w, h, x, y, name: 'plate'});
  makeSprite(n, atlas.frame('plate'), w, h, 0, 0, true, atlas.inset('plate'));
  return n;
}

/** 圆形图标按钮（返回 / 关闭）。 */
export function makeIconButton(parent: Node, atlas: UiAtlas, x: number, y: number, size: number, icon: 'back' | 'gear' | 'close' | 'pause', onTap?: () => void): Node {
  const n = makeNode(parent, {w: size, h: size, x, y, name: 'icon:' + icon});
  if (icon === 'gear') {
    makeSprite(n, atlas.frame('gear'), size, size);
  } else if (icon === 'pause') {
    // 牌桌左上角现在打开的是"对局菜单"（会停表），图标语义就该是暂停而不是返回。
    // 两条竖杠用 white 帧拼，省得为一个小图标再开一块图集区域。
    makeSprite(n, atlas.frame('circle-jade'), size, size);
    for (const dx of [-0.16, 0.16]) {
      const bar = makeSprite(n, atlas.frame('white'), size * .13, size * .46, size * dx, 0);
      bar.color = hex('#F3EAD2');
    }
  } else {
    makeSprite(n, atlas.frame('circle-jade'), size, size);
    if (icon === 'back') makeSprite(n, atlas.frame('chevron-back'), size * .78, size * .78);
    else {
      // 关闭：两条交叉线用一个小 Sprite + 旋转拼出「×」太麻烦，直接用一个旋转 45° 的方块代替
      const x = makeSprite(n, atlas.frame('white'), size * .5, size * .09);
      x.node.angle = 45;
      const y = makeSprite(n, atlas.frame('white'), size * .5, size * .09);
      y.node.angle = -45;
      x.color = hex('#F3EAD2');
      y.color = hex('#F3EAD2');
    }
  }
  bindPress(n, onTap);
  return n;
}

/** 星条：`got` 颗实心，其余空心。 */
export function makeStars(parent: Node, atlas: UiAtlas, cx: number, cy: number, size: number, got: number, total = 3, gap = 0): Node {
  const n = makeNode(parent, {w: 0, h: 0, x: cx, y: cy, name: 'stars'});
  const step = size + gap;
  const x0 = -step * (total - 1) / 2;
  for (let i = 0; i < total; i++) {
    makeSprite(n, atlas.frame(i < got ? 'star-on' : 'star-off'), size, size, x0 + i * step, 0);
  }
  return n;
}

/** 开关；`onTap` 负责翻转状态，调用方重建或换帧。 */
export function makeToggle(parent: Node, atlas: UiAtlas, x: number, y: number, w: number, on: boolean, onTap?: () => void): Node {
  const h = w * .58;
  const n = makeNode(parent, {w, h, x, y, name: 'toggle'});
  const sp = makeSprite(n, atlas.frame(on ? 'toggle-on' : 'toggle-off'), w, h);
  sp.node.name = 'toggle-sprite';
  bindPress(n, onTap);
  return n;
}

/** 高亮框（套在某张牌外面）。 */
export function makeHighlight(parent: Node, atlas: UiAtlas, w: number, h: number, x: number, y: number, kind: 'gold' | 'select' | 'hint'): Node {
  const name = kind === 'gold' ? 'hl-gold' : kind === 'select' ? 'hl-select' : 'hl-hint';
  const n = makeNode(parent, {w, h, x, y, name: 'hl'});
  makeSprite(n, atlas.frame(name), w, h, 0, 0, true, atlas.inset(name));
  return n;
}

/** 淡入（弹窗用）。 */
export function fadeIn(n: Node, dur = 0.18): void {
  const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
  op.opacity = 0;
  n.setScale(0.92, 0.92, 1);
  tween(op).to(dur, {opacity: 255}).start();
  tween(n).to(dur, {scale: new Vec3(1, 1, 1)}).start();
}

/**
 * 清空并**真正销毁**子节点（用于重建某一屏）。
 *
 * 以前用的是 `removeAllChildren()`（默认参数不销毁）：每重绘一屏就把几十个节点连同
 * Sprite/Label/UIOpacity 组件一起从树上摘下来留在内存里 —— 首页每帧不算，但牌桌每次落子、
 * 每次弹窗都要整屏重绘，微信小游戏上就是内存与节点数一路上涨。
 *
 * ⚠️ 只能用在「这里的子节点确实是一次性 UI」的节点上。**牌桌不能用**：
 * `Board` 的牌池（tilesRoot）、槽位池 / 木框（bgRoot）、幽灵层（ghostRoot）都是 Board 长期持有的，
 * 一旦被销毁，下一次 build 的池引用就是野指针。Board 里只有 railRoot（锁轨木条）与 hlRoot（高亮框）
 * 是每次 build 全量重建的，可以清。
 *
 * 销毁前先把这一棵子树上的 tween 掐掉：`bindPress` / `fadeIn` 的缩放淡入可能还在飞，
 * 节点被销毁后 tween 仍会在下一帧写它（偶发「操作后闪一下 / 报错」）。
 */
export function clearChildren(n: Node): void {
  // `children` 是引擎内部数组，摘除时原地变短 → 必须先快照
  const kids = n.children.slice();
  n.removeAllChildren();
  for (const c of kids) {
    stopTweensDeep(c);
    c.destroy();
  }
}

/** 掐掉一个节点及其所有后代上的 tween（含 UIOpacity 上的淡入）。 */
function stopTweensDeep(n: Node): void {
  Tween.stopAllByTarget(n);
  const op = n.getComponent(UIOpacity);
  if (op) Tween.stopAllByTarget(op);
  const kids = n.children;
  for (let i = 0; i < kids.length; i++) stopTweensDeep(kids[i]);
}