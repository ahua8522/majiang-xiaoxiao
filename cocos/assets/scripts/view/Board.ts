/**
 * 牌桌：节点池 + 拖动预览 + 消除动画。
 *
 * 「发挥引擎作用」最直观的地方：
 *   - 一张牌 = 1 个 Sprite 四边形（4 顶点），整桌共用 1 张牌图集 → 1 个 draw call。
 *     对比旧实现（每张牌 1404+ 顶点、整桌 28 个 Graphics 层 / 7MB 顶点缓冲）差两个数量级。
 *   - 拖动只改被拖行/列节点的 `position`，不重建任何网格。
 *   - 消除用 `tween` 缩放淡出，动画跑引擎自己的时钟，不再逐帧生成命令。
 */
import {Mask, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween} from 'cc';
import {TileAtlas, UiAtlas} from './assets';
import {iceLayers} from './art';
import {clearChildren, hex, makeHighlight, makeLabel, makeNode, makeSprite} from './widgets';

/** 与 core/Rules 结构兼容，避免视图层 import core。 */
export type Cell = string[] | null | '#';
export interface Pos {r: number; c: number}
/** `locked`：core 正在并行落地的新字段——runs 定长且顺序稳定，被锁的轨道也在数组里只是 locked:true。 */
export interface Run {axis: 'row' | 'col'; index: number; cells: Pos[]; locked?: boolean}
/**
 * 一对被消掉的牌。`face` 是 a 位的牌面，`other` 是 b 位的牌面
 * （百搭 / 冰面配对时两侧不同）。core 那边可能还没带上 `other`，所以按可选字段读。
 */
export interface Pair {a: Pos; b: Pos; face: string; other?: string}

/** 一帧要画的牌桌内容，全部由 GameRoot 从 Session 解析好。 */
export interface BoardModel {
  grid: Cell[][];
  runs: Run[];
  selected: Pos | null;
  /** 提示要高亮的格子 */
  hintCells: Pos[];
  /**
   * 机制引导的“看这里”金框：冰面 / 百搭 / 鞭炮 / 目标牌等。
   * 与 hintCells（蓝轨 / 动作）分工：蓝框告诉你动哪条，金框告诉你这条规则落在哪些牌上。
   */
  focusCells?: Pos[];
  /**
   * 提示的**分步动作**（B1 提示改造）。只标蓝整条轨是不够的——
   * 玩家看得出「推哪一条」，看不出「往哪边推、推几格」。
   *   match = 点这两张牌（画金框 + 一次脉冲）
   *   slide = 往 step 方向推这条轨（沿轨画一串流向箭头）
   */
  hintAction: {kind: 'match'; a: Pos; b: Pos} | {kind: 'slide'; run: number; step: number} | null;
  /** 当前拖动的 run 与偏移（格） */
  drag: {run: number; offset: number} | null;
  /** 空格是否画「空洞/木桩」槽位。挑战模式的空格是可滑过的空间，缺省 true 留给主线。 */
  showSlots?: boolean;
  /** 锁定行 / 列（有牌位的轨；常驻画木条 + 锁标，让玩家拖之前就知道推不动） */
  lockedRows: number[];
  lockedCols: number[];
  /** 单向轨：轨端画箭头，只能朝 dir 推 */
  oneWay: {axis: 'row' | 'col'; index: number; dir: 1 | -1}[];
  /** 仍处于锁定状态的连锁解锁轨：锁标 + 数字徽标（消够 after 对解锁） */
  pendingUnlock: {axis: 'row' | 'col'; index: number; after: number}[];
}

interface TileNode {
  node: Node;
  sprite: Sprite;
  /** 冰层霜面叠加层（冰牌才显示；1 层/2 层用不同帧） */
  frost: Sprite;
  opacity: UIOpacity;
  r: number;
  c: number;
  depth: number;
  /** 该节点当前是否属于被拖动的 run（拖动时只动这些） */
  dragging: boolean;
}

/** 一次性消除动画用的「幽灵牌」：独立于节点池，绝不参与复用改派。 */
interface GhostNode {
  node: Node;
  sprite: Sprite;
  opacity: UIOpacity;
}

export class Board {
  readonly node: Node;
  private bgRoot: Node;
  /** 锁轨标识层：木条 + 锁标，挂在槽位之上、牌之下（每次 build 清空重建） */
  private railRoot: Node;
  /** 矩形遮罩节点：拖动时牌会沿滑轨循环移动，端头的牌会短暂探出棋盘，靠它裁掉 */
  private clipRoot: Node;
  private tilesRoot: Node;
  private hlRoot: Node;
  /** 消除动画幽灵层：挂在最上（hlRoot 之后），位置直接用 Board 本地坐标，不用补偿遮罩偏移 */
  private ghostRoot: Node;
  private ghosts: GhostNode[] = [];
  /** 最近一次 build 用的牌图集——幽灵牌要用它取牌面（消除发生在两次 build 之间） */
  private lastAtlas: TileAtlas | null = null;
  private pool: TileNode[] = [];
  private live: TileNode[] = [];
  private slotPool: Node[] = [];
  private frameNode: Node | null = null;
  private runs: Run[] = [];
  private drag: {run: number; offset: number} | null = null;
  private dragRun: Run | null = null;
  private dragLen = 0;
  private cellWid = 0;
  private cellHei = 0;
  private originX = 0;
  private originY = 0;
  private rows = 0;
  private cols = 0;

  constructor(parent: Node, private ui: UiAtlas) {
    this.node = makeNode(parent, {name: 'board'});
    this.bgRoot = makeNode(this.node, {name: 'board-bg'});
    this.railRoot = makeNode(this.bgRoot, {name: 'board-rails'});
    this.clipRoot = makeNode(this.node, {name: 'board-clip'});
    const mask = this.clipRoot.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    // tilesRoot 挂在遮罩下、并反向偏移，这样牌仍然用 Board 本地坐标摆放，却会被裁到木框范围内
    this.tilesRoot = makeNode(this.clipRoot, {name: 'board-tiles'});
    this.hlRoot = makeNode(this.node, {name: 'board-hl'});
    this.ghostRoot = makeNode(this.node, {name: 'board-ghosts'});
  }

  get gridRows(): number { return this.rows; }
  get gridCols(): number { return this.cols; }
  get cellW(): number { return this.cellWid; }
  get cellH(): number { return this.cellHei; }
  /** 牌区左上角的本地坐标（调试 / 自动化用）。 */
  get origin(): {x: number; y: number} { return {x: this.originX, y: this.originY}; }

  /** 该格子中心的本地坐标。 */
  cellCenter(p: Pos): {x: number; y: number} {
    return {x: this.originX + (p.c + .5) * this.cellWid, y: this.originY - (p.r + .5) * this.cellHei};
  }

  /** 本地坐标 → 格子（越界返回 null）。 */
  cellAt(x: number, y: number): Pos | null {
    if (!this.rows || !this.cols) return null;
    const w = this.cols * this.cellWid, h = this.rows * this.cellHei;
    if (x < this.originX || x >= this.originX + w || y > this.originY || y <= this.originY - h) return null;
    const c = Math.floor((x - this.originX) / this.cellWid);
    const r = Math.floor((this.originY - y) / this.cellHei);
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols ? {r, c} : null;
  }

  /**
   * 按棋盘重建。`x/y` 是牌区左上角（设计单位，+y 向上），`cellW/cellH` 是**这一屏的显示尺寸**。
   * 木框、槽位、牌、高亮全部按模型重排；节点池复用，不销毁重建。
   *
   * 显示尺寸为什么由调用方给：牌图集只烘一张固定基准格（见 assets.ts 的 `TILE_BASE_W`），
   * 换关格子变大变小只改 Sprite 的 contentSize，纹理不动 —— 之前是「尺寸变→重烘一张 2720×2580」，
   * 显存直接爆。宽高比仍必须是 1:1.24，`GameRoot.renderBoard` 里按 `cellW * 1.24` 算。
   */
  build(model: BoardModel, atlas: TileAtlas, x: number, y: number, cellW: number, cellH: number): void {
    this.lastAtlas = atlas;
    this.rows = model.grid.length;
    this.cols = this.rows ? model.grid[0].length : 0;
    this.cellWid = cellW;
    this.cellHei = cellH;
    this.originX = x;
    this.originY = y;
    this.runs = model.runs;
    this.drag = model.drag;
    this.dragRun = model.drag ? model.runs[model.drag.run] || null : null;
    this.dragLen = this.dragRun ? this.dragRun.cells.length : 0;

    const w = this.cols * this.cellWid, h = this.rows * this.cellHei;
    this.drawFrame(x, y, w, h);
    this.placeSlots(model.grid, atlas, model.showSlots !== false);
    this.placeRails(model, w, h);

    // 收集要显示的牌（按 深度→行→列 顺序，保证后画的在上面）
    const wanted: {r: number; c: number; depth: number; face: string}[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = model.grid[r][c];
        if (!Array.isArray(cell) || !cell.length) continue;
        const visible = Math.min(cell.length, 3);
        for (let k = 0; k < visible; k++) wanted.push({r, c, depth: visible - 1 - k, face: cell[k]});
      }
    }
    while (this.pool.length < wanted.length) this.pool.push(this.makeTile());
    this.live.length = 0;
    for (let i = 0; i < wanted.length; i++) {
      const t = this.pool[i], w = wanted[i];
      t.r = w.r; t.c = w.c; t.depth = w.depth;
      t.sprite.spriteFrame = atlas.face(w.face);   // 冰层/百搭后缀由 face() 兜底剥掉，视觉走叠加层
      // 冰层霜面：按层数换帧（1 层单圈 / 2 层双圈）
      const layers = iceLayers(w.face);
      t.frost.spriteFrame = layers > 0 ? this.ui.frame(layers >= 2 ? 'frost2' : 'frost1') : null;
      t.frost.node.active = layers > 0;
      const fui = t.frost.node.getComponent(UITransform);
      if (fui) fui.setContentSize(this.cellWid * .94, this.cellHei * .94);
      // 保险：复用前掐断该节点上任何残留 tween。池节点的一切表现必须只由本次 build 决定，
      // 否则上一张牌的缩放/透明度会「继承」给这一张（历史上「牌变小 / 消失又出现」的根因之一）。
      Tween.stopAllByTarget(t.node);
      Tween.stopAllByTarget(t.opacity);
      // 换关时显示格子尺寸会变（纹理不变，只有 contentSize 跟着布局走），池里的旧节点要跟着改尺寸
      const ui = t.node.getComponent(UITransform);
      if (ui) ui.setContentSize(this.cellWid, this.cellHei);
      t.node.active = true;
      t.node.setScale(1, 1, 1);
      t.opacity.opacity = 255;
      t.dragging = !!this.dragRun && this.dragRun.cells.some((p) => p.r === w.r && p.c === w.c);
      this.live.push(t);
    }
    for (let i = wanted.length; i < this.pool.length; i++) this.pool[i].node.active = false;

    this.applyPositions();
    this.drawHighlights(model);
  }

  /** 拖动预览：只改被拖行/列的牌，其它节点不碰。 */
  setDrag(drag: {run: number; offset: number} | null): void {
    this.drag = drag;
    this.dragRun = drag ? this.runs[drag.run] || null : null;
    this.dragLen = this.dragRun ? this.dragRun.cells.length : 0;
    for (const t of this.live) t.dragging = !!this.dragRun && this.dragRun.cells.some((p) => p.r === t.r && p.c === t.c);
    this.applyPositions();
  }

  /**
   * 消除动画：在被消位置生成一次性「幽灵牌」播放缩放淡出，播完即回收。
   *
   * 为什么绝不动节点池里的牌（旧实现的真实事故）：
   *   playErase 之后下一帧 build() 会按新盘面重排池节点——被消格子的节点要么被
   *   改派给别的牌、要么被停用，而 tween 还挂在节点上继续写 scale/opacity：
   *   ① 旧实现按 r,c 匹配，同格未消的**下层牌**也被一起淡出/缩小，tween 定格后
   *      牌消失，直到下一次 build 重置才「过一会又显示」；
   *   ② 池节点被改派后，无关的牌继承了残留 tween（「移动会影响别的牌」「牌变小」）。
   *   幽灵牌不属于池：位置用新盘面的格子中心（被消的是栈顶牌，depth 恒为 0），
   *   牌面取自 lastAtlas（Pair 里本来就带 face）；池节点永远只由 build() 全量重置。
   */
  playErase(erased: Pair[]): void {
    if (!erased.length || !this.lastAtlas) return;
    for (const pr of erased) {
      // a 位画 pr.face、b 位画 pr.other：百搭 / 冰面配对时两侧牌面不同，
      // 两张都按 face 画会把 b 位的幽灵画成 a 的花色（core 的 Pair 现在就带两侧牌面）。
      const sides: {p: Pos; face: string}[] = [{p: pr.a, face: pr.face}, {p: pr.b, face: pr.other || pr.face}];
      for (const s of sides) {
        const g = this.takeGhost();
        const c = this.cellCenter(s.p);
        g.node.setPosition(c.x, c.y, 0);
        g.sprite.spriteFrame = this.lastAtlas.face(s.face);   // 同上：幽灵牌也要能拿到基础面
        tween(g.node)
          .to(0.2, {scale: new Vec3(1.26, 1.26, 1)})
          .to(0.12, {scale: new Vec3(0.55, 0.55, 1)})
          .call(() => { g.node.active = false; })
          .start();
        tween(g.opacity).to(0.32, {opacity: 0}).start();
      }
    }
  }

  /**
   * 取一个空闲幽灵（active=false 即可复用），不够再建。
   *
   * ⚠️ 复用时必须**先把上一张牌的动画全部掐掉再重置表现**：缩放 tween 只跑 0.32s，
   * 而透明度 tween 跑 0.32s 之后还会有一小段，`active=false` 只是把它藏起来、tween 仍在飞。
   * 320ms 内连续消除（连消很常见）时，残余透明度会直接作用到新一张幽灵上
   * ——现象就是「消除时闪一下 / 幽灵牌缺一张」，只在快速连消时出现，特别难复现。
   * 这和 `build()` 里对真牌池做的 `Tween.stopAllByTarget` 是同一条纪律。
   */
  private takeGhost(): GhostNode {
    let g: GhostNode | null = null;
    for (const cand of this.ghosts) if (!cand.node.active) { g = cand; break; }
    if (!g) {
      // 必须给真实尺寸：Sprite 是 CUSTOM 模式，渲染尺寸就是 contentSize（见 makeTile 的注释）
      const node = makeNode(this.ghostRoot, {name: 'ghost', w: this.cellWid, h: this.cellHei});
      const sp = node.addComponent(Sprite);
      sp.type = Sprite.Type.SIMPLE;
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      g = {node, sprite: sp, opacity: node.addComponent(UIOpacity)};
      this.ghosts.push(g);
    }
    Tween.stopAllByTarget(g.node);
    Tween.stopAllByTarget(g.opacity);
    // 幽灵层的坐标已经是 Board 本地坐标，只需要按**当前**显示格子重设尺寸：
    // 两次 build 之间消除的话尺寸没变；换关后第一次消除如果沿用上一次的尺寸就是错的。
    const fui = g.node.getComponent(UITransform);
    if (fui) fui.setContentSize(this.cellWid, this.cellHei);
    g.node.active = true;
    g.node.setScale(1, 1, 1);
    g.sprite.color = hex('#FFFFFF');
    g.opacity.opacity = 255;
    return g;
  }

  private applyPositions(): void {
    const lift = this.cellHei * .05;
    for (const t of this.live) {
      const base = this.cellCenter({r: t.r, c: t.c});
      let dx = 0, dy = 0;
      if (t.dragging && this.drag && this.dragRun && this.dragLen) {
        const i = this.dragRun.cells.findIndex((p) => p.r === t.r && p.c === t.c);
        const step = this.dragRun.axis === 'row' ? this.cellWid : this.cellHei;
        let off = i + this.drag.offset;
        while (off > this.dragLen - .5) off -= this.dragLen;
        while (off < -.5) off += this.dragLen;
        const delta = (off - i) * step;
        // ⚠️ cc 的 +y 向上，而滑轨 cells 按高索引=屏幕向下排列（rotate 约定 +k = 向下推）：
        // 行方向 +x 恰好是右；列方向必须把 delta 取负，否则拖动预览与松手后的实际排列**相反**，
        // 松手瞬间整段牌会跳到拖动的反方向（「移动影响其他牌」观感的来源之一）。
        if (this.dragRun.axis === 'row') dx = delta; else dy = -delta;
      }
      t.node.setPosition(base.x + dx, base.y + dy + t.depth * lift, 0);
    }
  }

  private drawFrame(x: number, y: number, w: number, h: number): void {
    const pad = Math.max(22, this.cellHei * .2);
    const fw = w + pad * 2, fh = h + pad * 2;
    const cx = x + w / 2, cy = y - h / 2;
    // 遮罩跟着木框走；tilesRoot 反向偏移，抵消掉遮罩节点的位移
    const clipUI = this.clipRoot.getComponent(UITransform);
    if (clipUI) clipUI.setContentSize(fw, fh);
    this.clipRoot.setPosition(cx, cy, 0);
    this.tilesRoot.setPosition(-cx, -cy, 0);
    if (!this.frameNode) {
      const sp = makeSprite(this.bgRoot, this.ui.frame('wood'), fw, fh, cx, cy, true, this.ui.inset('wood'));
      sp.node.name = 'wood';
      this.frameNode = sp.node;
      this.frameNode.setSiblingIndex(0);
    } else {
      this.frameNode.setPosition(cx, cy, 0);
      const ui = this.frameNode.getComponent(UITransform);
      if (ui) ui.setContentSize(fw, fh);
    }
  }

  private placeSlots(grid: Cell[][], atlas: TileAtlas, show = true): void {
    if (!show) {
      // 挑战模式：空格不是障碍，不画 X 槽位，避免被读成「这里推不进去」。
      for (const s of this.slotPool) s.active = false;
      return;
    }
    const n = this.rows * this.cols;
    while (this.slotPool.length < n) {
      const s = makeSprite(this.bgRoot, this.ui.frame('slot'), 10, 10, 0, 0, true, this.ui.inset('slot'));
      s.name = 'slot';
      this.slotPool.push(s.node);
    }
    let i = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const slot = this.slotPool[i++];
        const cell = grid[r][c];
        // 木桩与空洞玩家感知完全一样，统一成同一种暗格（数据模型仍保留 '#' / null 区分）
        if (cell !== '#' && cell !== null) { slot.active = false; continue; }
        const p = this.cellCenter({r, c});
        slot.active = true;
        slot.setPosition(p.x, p.y, 0);
        const sp = slot.getComponent(Sprite);
        if (sp) sp.spriteFrame = this.ui.frame('slot');
        const ui = slot.getComponent(UITransform);
        if (ui) ui.setContentSize(this.cellWid * .86, this.cellHei * .86);
      }
    }
    for (let k = n; k < this.slotPool.length; k++) this.slotPool[k].active = false;
  }

  /**
   * 锁轨标识：被锁的行 / 列常驻画一条木条（槽位之上、牌之下，牌间缝隙里能看见），
   * 并在木框边带里放一枚锁标——拖之前就知道这条轨推不动，不用等提示。
   * 单向轨画箭头（方向 = 允许的推动方向）；连锁解锁轨画锁 + 数字徽标。
   */
  private placeRails(model: BoardModel, w: number, h: number): void {
    clearChildren(this.railRoot);
    const pad = Math.max(22, this.cellHei * .2);
    /**
     * 牌区在 Board 本地坐标里的**真实矩形**（`cellCenter` 就是按 originX/originY 往下排的）。
     *
     * ⚠️ 这里绝不能假设「牌区中心 = 本地 (0,0)」：那是 `drawFrame` 里 `cx/cy` 的算法。
     * 牌区中心其实是 `(originX + w/2, originY - h/2)`，而小棋盘是贴着横幅往下排的，
     * 两者能差上百个单位 —— 之前竖锁条与锁标就是踩了这个坑：第 101-120 关的锁标整个
     * 顶到木框上方外面（实测 +25.4 设计单位），第 40/75 关的竖木条反而从框底穿出去 +82~+93。
     * 行锁当年"看起来是对的"纯属巧合：originX 恒等于 -w/2，所以横向的 0 刚好等于牌区中心。
     */
    const midX = this.originX + w / 2, midY = this.originY - h / 2;
    const left = this.originX, right = this.originX + w, top = this.originY, bottom = this.originY - h;
    const bar = (x: number, y: number, bw: number, bh: number): void => {
      const n = makeSprite(this.railRoot, this.ui.frame('rail'), bw, bh, x, y, true, this.ui.inset('rail'));
      n.node.name = 'rail';
    };
    const lockAt = (x: number, y: number, size: number): void => {
      const n = makeSprite(this.railRoot, this.ui.frame('lock'), size, size * 1.15, x, y);
      n.color = hex('#5A3F14');
      n.node.name = 'rail-lock';
    };
    const arrowAt = (x: number, y: number, size: number, dir: 1 | -1, axis: 'row' | 'col'): void => {
      const n = makeSprite(this.railRoot, this.ui.frame('chevron'), size, size, x, y);
      // chevron 素材默认指向右。cc 的 angle 正值是**逆时针**，所以列方向要反过来：
      // -90 才是向下（`dir=1` = 向高索引 = 屏幕下方），+90 是向上。
      n.node.angle = axis === 'row' ? (dir === 1 ? 0 : 180) : (dir === 1 ? -90 : 90);
      n.color = hex('#E8C56B');
      n.node.name = 'rail-arrow';
    };
    const badgeAt = (x: number, y: number, size: number, num: number): void => {
      const b = makeSprite(this.railRoot, this.ui.frame('badge'), size, size, x, y);
      makeLabel(b.node, String(num), {x: 0, y: size * .3, size: Math.max(12, size * .42), color: '#FFFFFF', align: 'center', bold: true});
      b.node.name = 'rail-badge';
    };
    /**
     * 锁标尺寸。以前是 `pad*.78`（约 17~31 设计单位），真机反馈"根本看不出这一行被锁了"：
     * 锁是这一关的核心约束，小到要凑近看就等于没有。放大到 pad*1.4，
     * 同时把圆心往外挪一点点，避免放大的锁压住第一列牌面。
     */
    const LOCK = pad * 1.4;
    for (const r of model.lockedRows) {
      if (r < 0 || r >= this.rows) continue;
      const cy = this.cellCenter({r, c: 0}).y;
      bar(midX, cy, w, this.cellHei * .92);
      lockAt(left - pad * .55, cy, LOCK);
    }
    for (const c of model.lockedCols) {
      if (c < 0 || c >= this.cols) continue;
      const cx = this.cellCenter({r: 0, c}).x;
      bar(cx, midY, this.cellWid * .92, h);
      lockAt(cx, top + pad * .55, LOCK);
    }
    for (const u of model.pendingUnlock) {
      if (u.axis === 'row') {
        if (u.index < 0 || u.index >= this.rows) continue;
        const cy = this.cellCenter({r: u.index, c: 0}).y;
        bar(midX, cy, w, this.cellHei * .92);
        lockAt(left - pad * .55, cy, pad * 1.25);
        badgeAt(left - pad * 1.55, cy, pad * .8, u.after);
      } else {
        if (u.index < 0 || u.index >= this.cols) continue;
        const cx = this.cellCenter({r: 0, c: u.index}).x;
        bar(cx, midY, this.cellWid * .92, h);
        lockAt(cx, top + pad * .45, pad * .7);
        badgeAt(cx, top + pad * 1.2, pad * .72, u.after);
      }
    }
    for (const o of model.oneWay) {
      if (o.axis === 'row') {
        if (o.index < 0 || o.index >= this.rows) continue;
        const cy = this.cellCenter({r: o.index, c: 0}).y;
        bar(midX, cy, w, this.cellHei * .92);
        arrowAt(left - pad * .45, cy, pad * .8, o.dir, 'row');
        arrowAt(right + pad * .45, cy, pad * .8, o.dir, 'row');
      } else {
        if (o.index < 0 || o.index >= this.cols) continue;
        const cx = this.cellCenter({r: 0, c: o.index}).x;
        bar(cx, midY, this.cellWid * .92, h);
        arrowAt(cx, top + pad * .45, pad * .8, o.dir, 'col');
        arrowAt(cx, bottom - pad * .45, pad * .8, o.dir, 'col');
      }
    }
  }

  private drawHighlights(model: BoardModel): void {
    // 高亮框每次 build 全量重建 → 必须销毁旧的（removeAllChildren() 只是摘下来，节点和组件会一直堆着）。
    // 销毁前先停掉挂在它们身上的 tween：提示箭头的淡入是分帧跑的，
    // 直接 destroy 会让 tween 继续写一个已经销毁的 UIOpacity。
    for (const c of this.hlRoot.children.slice()) {
      const op = c.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(c);
    }
    clearChildren(this.hlRoot);
    // 只保留 选中（橙）与 提示（蓝）——进关后不再自动亮出成对提示
    const add = (p: Pos, kind: 'gold' | 'select' | 'hint'): Node => {
      const c = this.cellCenter(p);
      // 高亮框占格子的 92%（与 H5 的 hl() 一致），边框本身画在素材边缘
      return makeHighlight(this.hlRoot, this.ui, this.cellWid * .92, this.cellHei * .92, c.x, c.y, kind);
    };
    if (model.selected) add(model.selected, 'select');
    for (const p of model.focusCells || []) add(p, 'gold');
    for (const p of model.hintCells) add(p, 'hint');

    const ha = model.hintAction;
    if (!ha) return;
    if (ha.kind === 'match') {
      // 点消：两张牌各画一个金框，并一起脉冲一次——「点这里」比「这里标蓝了」明确得多
      for (const p of [ha.a, ha.b]) {
        const node = add(p, 'gold');
        tween(node)
          .to(0.16, {scale: new Vec3(1.14, 1.14, 1)})
          .to(0.22, {scale: new Vec3(1, 1, 1)})
          .start();
      }
      return;
    }
    const run = this.runs[ha.run];
    if (!run) return;
    this.drawHintFlow(run, ha.step);
  }

  /**
   * 沿轨画一串**流向箭头**：方向 = 推动方向，数量按轨长铺满。
   *
   * 为什么不是只画一个箭头：一个箭头在长轨上指不出「整段都在动」，
   * 玩家会以为是"推一格"。一串箭头 + 依次淡入，视觉上就是「这一整排往那边滑」。
   *
   * 圆底改成**奶油底 + 深色箭头 + 一圈很淡的深色描边**：
   * 旧版深色圆底会把牌面盖掉，浅蓝箭头在浅色牌上又看不清（真机反馈截图）。
   * 奶油底在浅色牌上靠深色箭头保证对比，深色描边让它在深色木框上也站得住。
   */
  private drawHintFlow(run: Run, step: number): void {
    const dir: 1 | -1 = step > 0 ? 1 : -1;
    // 从「推力的上游」开始亮：step>0 时牌往高索引走，所以箭头从低索引端依次亮起
    const cells = dir > 0 ? run.cells : run.cells.slice().reverse();
    const rad = Math.min(this.cellWid, this.cellHei) * .24;
    cells.forEach((p, i) => {
      const c = this.cellCenter(p);
      const holder = makeNode(this.hlRoot, {w: rad * 2, h: rad * 2, x: c.x, y: c.y, name: 'hint-arrow'});
      const hop = holder.addComponent(UIOpacity);
      hop.opacity = 0;
      // 淡淡的深色描边只在奶油底外露一圈，不盖牌面；真正的对比交给深色箭头。
      const halo = makeSprite(holder, this.ui.frame('dot'), rad * 2.15, rad * 2.15, 0, 0);
      halo.color = hex('#0E2A20');
      halo.node.addComponent(UIOpacity).opacity = 110;
      const dot = makeSprite(holder, this.ui.frame('dot'), rad * 2, rad * 2, 0, 0);
      dot.color = hex('#FFFDF6');
      dot.node.addComponent(UIOpacity).opacity = 240;
      const s = makeSprite(holder, this.ui.frame('chevron'), rad * 1.3, rad * 1.3, 0, 0);
      // 与 Board.arrowAt 同一套角度：cc 正值逆时针，列方向 -90 才是向下。
      s.node.angle = run.axis === 'row' ? (dir > 0 ? 0 : 180) : (dir > 0 ? -90 : 90);
      s.color = hex('#0E2A20');
      tween(hop).delay(i * 0.06).to(0.18, {opacity: 255}).start();
    });
  }

  private makeTile(): TileNode {
    // 必须给 UITransform 一个真实尺寸：Sprite 是 CUSTOM 模式，渲染尺寸就是 contentSize，
    // 而 makeNode 默认给 0×0 —— 那样牌会「建出来了但一个像素都不画」。
    const node = makeNode(this.tilesRoot, {name: 'tile', w: this.cellWid, h: this.cellHei});
    const sp = node.addComponent(Sprite);
    sp.type = Sprite.Type.SIMPLE;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    // 冰层霜面叠加层：默认隐藏，build() 按牌面的冰层数启用（frost1 / frost2）
    const frostNode = makeNode(node, {name: 'frost', w: this.cellWid, h: this.cellHei});
    const frost = frostNode.addComponent(Sprite);
    frost.type = Sprite.Type.SIMPLE;
    frost.sizeMode = Sprite.SizeMode.CUSTOM;
    frostNode.active = false;
    const op = node.addComponent(UIOpacity);
    return {node, sprite: sp, frost, opacity: op, r: 0, c: 0, depth: 0, dragging: false};
  }
}