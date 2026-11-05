/**
 * 图集内容：把牌面与 UI 素材画进 `Atlas`，并登记每块子区域。
 *
 * 两张图集就够了：
 *   - 牌图集：**只烘一次**，用固定基准格（见 `TILE_BASE_W`）。所有界面按目标显示尺寸缩放 Sprite 的
 *     contentSize（SpriteFrame 的 rect 不变，缩放是免费的）。以前按格子尺寸重建，首页/牌桌/失败页
 *     各烘一张大图、旧的一张都不释放，显存直接爆（微信小游戏实测黑屏 / 只画出部分牌）。
 *   - UI 图集：卡片 / 按钮 / 匾额 / 开关 / 星 / 锁 / 箭头 / 齿轮 / 高亮框 / 槽位，全部 9 宫格，
 *     一次性烘焙，之后所有界面共用。
 */
import {SpriteFrame} from 'cc';
import {Atlas, Region, fitScale} from './atlas';
import {
  Ctx2D, IconName, SERIF, drawButton, drawChevron, drawChip, drawFrostFrame, drawGear, drawIcon, drawLock, drawPanel, drawPill, drawStar, drawToggle, drawTile, fillCircle, fillRR, linear, rr, strokeRR
} from './art';
import {FACES as CORE_FACES} from '../core/Generator';
import {drawGarden, drawTable} from './garden';
import {palette} from './theme';

/**
 * 玩法牌面**直接取 core 的牌池**（34 数牌 + 7 字 + 8 花 + 鞭炮 b1 = 43）。
 *
 * 以前这里自己抄了一份 42 个的清单，把鞭炮漏了：第 70 关起 `atlas.face('b1')`
 * 查不到就抛异常（`Atlas.frame` 不返回 null），整个 render 炸掉、牌桌一张都不画。
 * 清单只留一份真相，以后 core 加牌面会自动进图集。
 */
export const FACES: string[] = CORE_FACES.slice();

/** 装饰字牌（萬/乐/筒），只用于大厅与加载页，不入玩法牌池。 */
export const DECO_FACES: string[] = ['x1', 'x2', 'x3'];

/**
 * 货架打包：**先按高度降序排**再按行摆放。
 * 不排序的话，一个 400px 高的元素可能落在只剩 100px 的行里，白白多开一行（图集高度翻倍）。
 */
class Packer {
  private x = 0;
  private y = 0;
  private rowH = 0;
  private queue: {name: string; w: number; h: number}[] = [];
  constructor(private pad: number, readonly maxW: number) {}

  /** 登记一个待摆放元素；`placeAll` 会按高度降序摆。 */
  push(name: string, w: number, h: number): void { this.queue.push({name, w, h}); }

  /** 摆放全部元素，返回每块区域。 */
  placeAll(): Map<string, Region> {
    this.queue.sort((a, b) => b.h - a.h);
    const out = new Map<string, Region>();
    for (const it of this.queue) {
      if (this.x + it.w > this.maxW && this.x > 0) { this.x = 0; this.y += this.rowH + this.pad; this.rowH = 0; }
      out.set(it.name, {x: this.x, y: this.y, w: it.w, h: it.h});
      this.x += it.w + this.pad;
      this.rowH = Math.max(this.rowH, it.h);
    }
    return out;
  }
  get usedHeight(): number { return this.y + this.rowH; }
}

/**
 * 牌图集的固定基准格（设计单位）与烘焙倍率。数字是倒推出来的，三条必须同时成立：
 *   1. **宽高比严格 1:1.24**（牌形不能被拉变形）→ 基准格 125×155，倍率 2 → 每格 250×310 像素
 *      （310 / 250 = 1.24 整，比 132×164 那种「四舍五入出来的 1.2424」更干净）；
 *   2. 46 个牌面按 8 列排 → 6 行 → 整张 **8×250 = 2000 宽、6×310 = 1860 高**，两条边都在 2048 以内
 *      （低配安卓机的纹理上限）；3.72 MPixel ≈ 15MB 显存；
 *   3. 牌桌最大格 116×144（`GameRoot.renderBoard` 的 116 上限）→ 250/116 ≈ 2.16 倍超采样，
 *      不比原来的 2 倍糊；首页装饰牌 170 宽 ≈ 1.47 倍，肉眼不出变化。
 *
 * 对比以前：按格子尺寸烘 → 首页 `ensureTileAtlas(170,215)` + scale 2 = 单格 340×430，
 * 8 列 6 行 = **2720×2580**（7.0 MPixel ≈ 28MB），而且每次换关、每次失败页都再烘一张新的、
 * 旧的一张都不释放 → 显存吃紧时黑屏 / 只画出部分牌。现在纹理恒定只有一张。
 */
export const TILE_BASE_W = 125;
export const TILE_BASE_H = 155;
/**
 * 牌图集倍率。以前固定 2（46 张牌烘成 2000x1860 ≈ 15MB 显存），
 * 鸿蒙真机上"牌桌整屏只剩文字"最可疑的就是这块 + 场景图集把显存吃穿、WebGL 上下文被回收。
 * 降到 1.6：牌面显示宽约 125 设计单位，1.6 倍 = 200 像素源，在 1260 宽的手机屏幕上仍≈1:1，
 * 肉眼看不出差别，但显存少 4.5MB。真正的兜底是下面的 fitScale 会再按设备上限压一次。
 */
export const TILE_BASE_SCALE = 1.6;

/**
 * 牌图集：玩法牌面（含鞭炮）+ 装饰字牌，**一次烘完、全程复用**。
 *
 * 冰面**不**烘变体：霜层作为独立叠加帧（UI 图集的 frost1/frost2）由 Board 叠在冰牌上——
 * 若每个牌面都烘「普通/单冰/厚冰」三份，120 关的图集会突破 4096 纹理上限。
 * 区域尺寸与显示尺寸**解耦**：一张牌 = 一个 SpriteFrame（rect 固定 250×310）+ 调用方给的 contentSize，
 * 所以牌桌换关改格子大小时**不需要**重烘纹理。投影画在格子内部，比例恒定（84% 牌身 + 8% 脚厚）。
 */
export class TileAtlas {
  readonly atlas: Atlas;
  /** 基准格（设计单位）。**不是显示尺寸** —— 显示尺寸由调用方按布局给 contentSize。 */
  readonly cellW = TILE_BASE_W;
  readonly cellH = TILE_BASE_H;
  /** 兜底牌面：白板（z7，画面上最中性的一张）。未登记的牌面画成它，而不是抛异常炸掉整帧。 */
  private static readonly FALLBACK = 'z7';
  /** 已警告过的牌面：只在第一次查不到时刷一条，避免每帧刷屏把日志埋掉。 */
  private warned = new Set<string>();

  constructor() {
    // 烘焙名单 = core 牌池（43，已含鞭炮 b1）+ 3 装饰牌 = 46。
    // 8 列排布自动进位到 6 行；再加牌面只要 core 那边加，这里跟着一起烘。
    const baked = FACES.concat(DECO_FACES);
    const cols = 8;
    const rows = Math.ceil(baked.length / cols);
    // 倍率还要再过一道设备上限：单边超 2048 的纹理在部分 GPU 上是**静默画不出来**。
    const S = fitScale(this.cellW * cols, this.cellH * rows, TILE_BASE_SCALE);
    const cw = Math.max(2, Math.round(this.cellW * S));
    const ch = Math.max(2, Math.round(this.cellH * S));
    // 牌身占格子的 84%、花色脚厚 h*.08 —— 与 H5 的 drawBoard() 一致
    const w = cw * .84, h = ch * .84;
    const lift = Math.max(2, h * .08);
    const atlas = new Atlas(cols * cw, rows * ch);
    const ctx = atlas.context;
    baked.forEach((face, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      drawTile(ctx, face, cx + (cw - w) / 2, cy + (ch - h) / 2, {w, h, lift});
      atlas.region(face, {x: cx, y: cy, w: cw, h: ch});
    });
    atlas.bake();
    this.atlas = atlas;
  }

  /**
   * 取牌面帧。**必须先剥后缀**：冰面（`5s~`/`5s~~`）与百搭（`f3*`）的视觉都是叠加层，
   * 图集只烘基础面；而 `Atlas.frame()` 查不到是**抛异常**（不是返回 null）——
   * 带后缀直查会炸掉整个渲染 pass，牌桌一张牌都不画（体验版实测）。
   * 查不到的名字（新加牌面忘了烘）走 `fallback()`：画错一张牌远好过整桌不显示。
   */
  face(name: string) { const base = name.replace(/[~*]+$/, ''); return this.atlas.has(base) ? this.atlas.frame(base) : this.fallback(base); }

  private fallback(base: string): SpriteFrame {
    if (!this.warned.has(base)) {
      this.warned.add(base);
      console.warn(`[atlas] 牌面「${base}」没进烘焙名单，先画成兜底牌面 ${TileAtlas.FALLBACK}；加牌面要同步 TileAtlas 的 baked 清单`);
    }
    return this.atlas.frame(TileAtlas.FALLBACK);
  }
}

/** UI 图集里的素材名。 */
export type UiName =
  | 'panel' | 'plate'
  | 'btn-jade' | 'btn-cream' | 'btn-gold' | 'btn-dark' | 'btn-disabled'
  | 'toggle-on' | 'toggle-off'
  | 'star-on' | 'star-off'
  | 'lock' | 'chevron' | 'chevron-back' | 'gear'
  | 'hl-gold' | 'hl-select' | 'hl-hint'
  | 'slot' | 'rail' | 'wood'
  | 'chip-light' | 'chip-dark' | 'badge' | 'dot' | 'avatar' | 'tile-tray'
  | 'banner' | 'banner-win' | 'banner-lose' | 'card-on' | 'card-off'
  | 'frost1' | 'frost2'
  | IconFrameName;

/** 图集里的图标帧名。 */
export type IconFrameName = `icon-${IconName}`;

/** 需要烘焙进 UI 图集的图标（白色底，用时给 Sprite 染色）。 */
export const ICON_FRAMES: IconFrameName[] =
  ['sound', 'music', 'vibrate', 'book', 'hint', 'shuffle', 'undo', 'restart', 'play', 'home', 'progress']
    .map((n) => ('icon-' + n) as IconFrameName);

/**
 * UI 图集：一次性烘焙，全部 9 宫格 / 定尺素材。
 *
 * ⚠️ **必须按 1 倍烘焙（scale = 1）**。九宫格的 inset 有两个身份：
 *   - UV 切分：`_calculateSlicedUV()` 里用 `rect.x + insetLeft` 按**纹理像素**切；
 *   - 顶点位置：`assembler/sprite/sliced.ts` 里 `leftWidth * xScale` 按**节点单位**算（而且 xScale 只缩不放）。
 * 只有当「纹理像素 : 设计单位 = 1:1」时这两者才一致。按 2 倍烘焙 + inset 乘 2 的话，
 * UV 是对的，但**渲染出来的边框和圆角会变成设计值的 2 倍** —— 这正是之前 Cocos 与 H5 稿「看着不一样」的根因。
 */
export class UiAtlas {
  readonly atlas: Atlas;
  private insets = new Map<string, [number, number, number, number]>();
  private scale: number;

  constructor(scale = 1) {
    this.scale = scale;
    const S = scale;
    const packer = new Packer(4, 1024);
    // 先把所有素材登记成「名字 + 尺寸 + 画法」，排完版再开画布、才知道该开多大。
    const items: {name: string; w: number; h: number; draw: (c: Ctx2D, x: number, y: number, w: number, h: number) => void; inset?: [number, number, number, number]}[] = [];
    const put = (name: string, w: number, h: number, draw: (c: Ctx2D, x: number, y: number, w: number, h: number) => void, inset?: [number, number, number, number]) => {
      items.push({name, w, h, draw, inset});
      packer.push(name, Math.round(w * S), Math.round(h * S));
    };

    // 卡片 / 匾额（9 宫格）——几何一律照 H5 的 ui.ts：面板 r=min(w,h)*.09（取常用面板的典型值 48），
    // 匾额是 h/2 的胶囊 → 直接复用 art.ts 的 drawPill（原来这里手抄了一份胶囊几何，改一处忘另一处）
    put('panel', 240, 240, (c, x, y, w, h) => drawPanel(c, x, y, w, h, 48), [56, 56, 56, 56]);
    put('plate', 300, 76, (c, x, y, w, h) => drawPill(c, x, y, w, h, '#2E6B3A'), [38, 38, 38, 38]);

    // 按钮（9 宫格）——r = h*.34 与 H5 的 button() 一致。
    // 开始 / 继续 / 知道了 / 关卡选择这一族走 flat：单色面、无渐变、无高光、无铆钉。
    // 奖励色（gold）仍保留原来的立体质感，不跟这族混在一起。
    const btn = (name: string, top: string, bottom: string, edge: string, stud: string, flat = false) =>
      put(name, 200, 100, (c, x, y, w, h) => drawButton(c, x, y, w, h, top, bottom, edge, h * .34,
        flat ? {flat: true, stroke: edge} : {studs: true, stud}), [40, 34, 40, 34]);
    btn('btn-jade', palette.jade, palette.jade, palette.jadeDeep, palette.goldLight, true);
    btn('btn-cream', '#FFFDF6', '#FFFDF6', '#D8B872', palette.gold, true);
    btn('btn-gold', '#F5D27A', palette.gold, palette.goldDeep, palette.gold);
    // 工具条按钮走的是 H5 的 toolButton()：无高光、无铆钉、描边是半透明金
    put('btn-dark', 200, 116, (c, x, y, w, h) => drawButton(c, x, y, w, h, '#3E7A48', '#245530', '#1B3A22', 20, {gloss: false, stroke: 'rgba(216,169,78,.55)'}), [40, 34, 40, 34]);
    btn('btn-disabled', '#EFE8D6', '#EFE8D6', '#CBBE9E', '#CBBE9E', true);

    // 牌桌提示横幅：H5 的 msg 条 —— 奶油渐变胶囊（提示统一走这里，底部不再有第二条 toast）
    put('banner', 300, 62, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, h / 2, linear(c, x, y, x, y + h, [[0, '#FFF9E6'], [1, '#F6EBCB']]));
      strokeRR(c, x, y, w, h, h / 2, palette.creamEdge, 2);
    }, [31, 31, 31, 31]);

    // 选关卡片：H5 的 drawLevels() —— r=18、绿渐变 + 深绿投影；未解锁是米色平卡
    const card = (name: string, top: string, bottom: string, shadow: string, edge: string) =>
      put(name, 120, 92, (c, x, y, w, h) => {
        fillRR(c, x, y + 4, w, h - 4, 18, shadow);
        rr(c, x, y, w, h, 18);
        c.fillStyle = linear(c, x, y, x, y + h, [[0, top], [1, bottom]]);
        c.fill();
        strokeRR(c, x, y, w, h, 18, edge, 2);
      }, [24, 24, 24, 24]);
    card('card-on', '#6FC46F', '#2E7D4F', '#1C5B37', 'rgba(255,255,255,.35)');
    card('card-off', '#E6DCC2', '#E6DCC2', '#CFC3A4', '#CBBE9E');

    // 弹窗横幅：H5 里「恭喜通关」是深木牌、「很遗憾」是红绸，都不是按钮
    put('banner-win', 464, 100, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, 26, linear(c, x, y, x, y + h, [[0, '#B4763C'], [1, '#7C4A1E']]));
      strokeRR(c, x, y, w, h, 26, '#5A3714', 5);
    }, [26, 26, 26, 26]);
    put('banner-lose', 428, 96, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, 24, linear(c, x, y, x, y + h, [[0, '#A83B32'], [1, '#6E211B']]));
      strokeRR(c, x, y, w, h, 24, '#5A1913', 5);
    }, [24, 24, 24, 24]);

    // 冰层霜面（1 层 / 2 层厚冰）：作为冰牌的叠加帧，Board 按层数取用
    put('frost1', 80, 80, (c, x, y, w, h) => drawFrostFrame(c, x, y, w, h, 1));
    put('frost2', 80, 80, (c, x, y, w, h) => drawFrostFrame(c, x, y, w, h, 2));

    // 定尺素材
    put('toggle-on', 100, 58, (c, x, y, w, h) => drawToggle(c, x, y, w, true));
    put('toggle-off', 100, 58, (c, x, y, w, h) => drawToggle(c, x, y, w, false));
    put('star-on', 96, 96, (c, x, y, w, h) => drawStar(c, w / 2, h / 2, w * .48, true));
    put('star-off', 96, 96, (c, x, y, w, h) => drawStar(c, w / 2, h / 2, w * .48, false));
    put('lock', 56, 64, (c, x, y, w, h) => drawLock(c, w / 2, h * .58, w * .34, '#A79B7E'));
    put('chevron', 44, 44, (c, x, y, w, h) => drawChevron(c, w / 2, h / 2, w * .5, palette.inkFaint, 3));
    put('chevron-back', 44, 44, (c, x, y, w, h) => drawChevron(c, w / 2, h / 2, w * .5, '#F3EAD2', 5, true));
    put('gear', 84, 84, (c, x, y, w, h) => {
      c.beginPath(); c.arc(w / 2, h / 2, w * .48, 0, Math.PI * 2);
      c.fillStyle = '#1F4F2C'; c.fill();
      c.lineWidth = 3; c.strokeStyle = palette.gold; c.stroke();
      drawGear(c, w / 2, h / 2, w * .42, '#F3EAD2');
    });
    /**
     * 头像 = 一枚茶馆印章（不是脸）。
     *
     * 前两版都翻在"脸"上：圆底 + 一个圆 + 两个墨点，读图暗示全在脸上，真机反馈「像个骷髅」；
     * 换成整张麻将牌又太省事，头像位应该是有设计的品牌标记。
     * 所以这里画的是印：玉色外环 → 细金印边 → 米色印面 → 一圈淡玉内框（双层印框是印章的语言）
     * → 中央「乐」字（与首页标题同一套宋体与品牌玉色）→ 底部一道朱砂落款（呼应首页那枚红色
     * 「对对消」印章）→ 顶部一条极淡高光让徽章有一点厚度。
     * 全程没有任何"两个点 + 一道弧"的组合，不会再被读成脸。
     */
    put('avatar', 96, 96, (c, x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      fillCircle(c, cx, cy, w * .5, palette.jadeDeep);
      fillCircle(c, cx, cy, w * .455, palette.gold);
      fillCircle(c, cx, cy, w * .43, palette.creamDeep);
      // 高光：沿印面内侧描一道粗弧光（不用 clip —— 全项目没人用过 clip，
      // 为装饰效果引入新的画布 API 不划算）。半径取「内框 .35w」与「印面 .43w」的中间，
      // 加半个线宽也不会越出印面，且不与内框线叠在一起糊成一条。
      c.beginPath(); c.arc(cx, cy, w * .39, Math.PI * 1.16, Math.PI * 1.80);
      c.lineWidth = w * .05; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.26)'; c.stroke();
      c.lineCap = 'butt';
      c.beginPath(); c.arc(cx, cy, w * .35, 0, Math.PI * 2);
      c.lineWidth = Math.max(1, w * .012); c.strokeStyle = 'rgba(28,91,55,.30)'; c.stroke();
      // 「乐」：与装饰字牌同一套宋体（art.ts 的 SERIF）。基线用 top + 手算居中——
      // 这是 DECO 已验证过的画法，不依赖 textBaseline:middle 在不同实现上的差异。
      // 字整体上移一点，给底部那道朱砂落款让出 ≥5 的空隙，否则「乐」的末笔会压在红条上。
      const size = Math.round(w * .5);
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.font = `700 ${size}px ${SERIF}`;
      c.fillStyle = palette.jadeDeep;
      c.fillText('乐', cx, cy - size * .58);
      // 朱砂落款：扁横条，读作"印泥"。放在印面下半部，与字分开，不构成任何"脸"的暗示。
      fillRR(c, cx - w * .11, h * .78, w * .22, h * .055, w * .028, palette.red);
    });

    // 高亮框（9 宫格，用细边框拉伸）—— 几何照 H5 的 hl()：整框就是高亮范围，边框贴边、线宽 5
    const hl = (name: string, col: string) => put(name, 80, 80, (c, x, y, w, h) => {
      rr(c, x, y, w, h, 14);
      c.lineWidth = 5; c.strokeStyle = col; c.stroke();
    }, [18, 18, 18, 18]);
    hl('hl-gold', '#FFD84D');
    hl('hl-select', '#FF8A3D');
    hl('hl-hint', '#7EE3FF');

    // 槽位 / 木框 / 锁轨木条（9 宫格）。木桩与空洞统一用同一种暗格（slot）。
    // 槽位（9 宫格）：木栓底 + 深描边 + 斜十字——木桩与空洞统一同一种暗格，一眼读出「此格不通」
    put('slot', 80, 80, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, 12, 'rgba(96,64,28,.42)');
      strokeRR(c, x, y, w, h, 12, 'rgba(60,38,14,.55)', 2.5);
      c.lineWidth = Math.max(2, w * .06); c.strokeStyle = 'rgba(60,38,14,.4)'; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x + w * .3, y + h * .3); c.lineTo(x + w * .7, y + h * .7);
      c.moveTo(x + w * .7, y + h * .3); c.lineTo(x + w * .3, y + h * .7);
      c.stroke();
    }, [16, 16, 16, 16]);
    // 锁轨木条：方角（端头圆头与木作风格不符），直通到边
    put('rail', 160, 40, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, 5, 'rgba(96,64,28,.30)');
      strokeRR(c, x + 1, y + 1, w - 2, h - 2, 5, 'rgba(60,38,14,.35)', 2);
    }, [22, 22, 12, 12]);
    put('wood', 200, 200, (c, x, y, w, h) => {
      rr(c, x, y, w, h, 26);
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, palette.woodLight); g.addColorStop(.5, palette.wood); g.addColorStop(1, palette.woodDeep);
      c.fillStyle = g; c.fill();
      strokeRR(c, x, y, w, h, 26, '#4A2C10', 5);
      // 内圈绿毡 = 棋盘真正的台面（H5 稿 woodFrame 同款）。
      // 只描边不填充的话整块木框就是一整片棕色板子，牌和槽位都读不出来。
      fillRR(c, x + 12, y + 12, w - 24, h - 24, 18, '#4E6B33');
      strokeRR(c, x + 12, y + 12, w - 24, h - 24, 18, 'rgba(30,50,20,.5)', 3);
    }, [44, 44, 44, 44]);
    put('tile-tray', 120, 120, (c, x, y, w, h) => {
      fillRR(c, x, y, w, h, 14, palette.woodInner);
      strokeRR(c, x, y, w, h, 14, 'rgba(30,50,20,.55)', 3);
    }, [22, 22, 22, 22]);

    // 1x1 白点：做纯色遮罩 / 底色用（配合 Sprite.color 染色，省一张贴图）
    put('white', 4, 4, (c, x, y, w, h) => fillRR(c, x, y, w, h, 0, '#FFFFFF'));

    // 线描图标：一律按白色烘焙，用时给 Sprite 染色 → 一枚图标能适配所有配色
    for (const frame of ICON_FRAMES) {
      const name = frame.slice(5) as IconName;
      put(frame, 64, 64, (c, x, y, w, h) => drawIcon(c, name, x, y, w, h, '#FFFFFF'));
    }

    // 红色印章（首页「消除」角标）
    put('seal', 96, 200, (c, x, y, w, h) => {
      rr(c, x, y, w, h, 14);
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#D0453A'); g.addColorStop(1, '#A82E24');
      c.fillStyle = g; c.fill();
      strokeRR(c, x, y, w, h, 14, '#8C2318', 3);
    }, [14, 14, 14, 14]);

    // 圆形玉色按钮底（返回 / 关闭用；齿轮素材自带底）
    put('circle-jade', 96, 96, (c, x, y, w, h) => {
      c.beginPath(); c.arc(w / 2, h / 2, w * .5, 0, Math.PI * 2);
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#3E7A48'); g.addColorStop(1, '#1F4F2C');
      c.fillStyle = g; c.fill();
      c.lineWidth = 3; c.strokeStyle = palette.gold; c.stroke();
    });

    // 小件（定尺，可拉伸/缩放）——胶囊几何同样只有 drawChip 一份
    put('chip-light', 64, 32, (c, x, y, w, h) => drawChip(c, x, y, w, h, 'rgba(60,90,50,.28)'), [14, 14, 14, 14]);
    put('chip-dark', 64, 32, (c, x, y, w, h) => drawChip(c, x, y, w, h, '#4FA46A'), [14, 14, 14, 14]);
    put('badge', 64, 64, (c, x, y, w, h) => {
      c.beginPath(); c.arc(w / 2, h / 2, w * .46, 0, Math.PI * 2);
      c.fillStyle = '#E8873B'; c.fill();
      c.lineWidth = 3; c.strokeStyle = '#FFFFFF'; c.stroke();
    });
    put('dot', 32, 32, (c, x, y, w, h) => {
      c.beginPath(); c.arc(w / 2, h / 2, w * .4, 0, Math.PI * 2); c.fillStyle = palette.jade; c.fill();
    });

    // 排版 → 按实际用量开画布（高度向上取整到 64，减少浪费又留点余量）
    const regions = packer.placeAll();
    const height = Math.max(64, Math.ceil((packer.usedHeight + 8) / 64) * 64);
    const atlas = new Atlas(1024, height);
    const ctx = atlas.context;
    for (const it of items) {
      const r = regions.get(it.name);
      if (!r) continue;
      // art.ts 的绘制函数以左上角为原点，而 Sprite 是居中的：
      // 这里把原点平移到区域中心，烘焙出来的图才会在节点里正中对齐。
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(S, S);
      ctx.translate(-it.w / 2, -it.h / 2);
      it.draw(ctx, 0, 0, it.w, it.h);
      ctx.restore();
      atlas.region(it.name, r);
      // inset 直接就是「渲染出来的设计单位数」（见类注释）：1 倍烘焙下同时也是纹理像素数，不能再乘倍率
      if (it.inset) this.insets.set(it.name, [it.inset[0], it.inset[1], it.inset[2], it.inset[3]]);
    }
    atlas.bake();
    this.atlas = atlas;
  }

  frame(name: UiName | string) { return this.atlas.frame(name); }
  inset(name: UiName | string): [number, number, number, number] { return this.insets.get(name) || [0, 0, 0, 0]; }
}

/**
 * 场景图集倍率。以前 1.5（20:9 屏烘成 1128x3276 ≈ 15MB 显存，只为一张柔焦渐变背景），
 * 现在 0.9：garden 全是软渐变与叶片剪影，放大到全屏肉眼看不出差别，显存省 2/3。
 * 真机反馈"牌桌只剩文字"最可疑的就是它和牌图集一起把显存吃穿。
 */
export const SCENE_SCALE = 0.9;

/**
 * 场景图集：整屏庭院背景 + 首页木桌。
 *
 * 与 UI 图集不同，它的尺寸跟着屏幕走，所以**按需重建**（屏幕尺寸变化时才重来一次），
 * 而不是启动时一次性烘焙。烘焙之后整屏背景只占 1 个 Sprite、1 次 draw call。
 *
 * ⚠️ 重建会换纹理：调用方**必须先 `atlas.dispose()` 再 new**（见 `GameRoot.ensureScene`），
 * 否则一次屏幕尺寸变化就多挂一张全屏显存，微信小游戏上是直接黑屏而不是变慢。
 */
export class SceneAtlas {
  readonly atlas: Atlas;
  /** 木桌顶边（设计单位，从屏幕顶部往下量）。 */
  readonly tableTop: number;

  constructor(readonly w: number, readonly h: number, scale = SCENE_SCALE) {
    this.tableTop = h * .655;
    const tableH = Math.max(1, h - this.tableTop);
    // 纹理边长有上限：超了不是变糊，而是**整张贴图静默画不出来**（鸿蒙真机就是这样只剩文字）。
    // garden 与木桌共用一张画布纵向叠放，所以按"两块合计高"反推能用的倍率，宁可糊一点。
    const S = fitScale(w, h + tableH, scale);
    const aw = Math.max(2, Math.round(w * S));
    const ah = Math.max(2, Math.round(h * S));
    const th = Math.max(1, Math.round(tableH * S));
    // 木桌单独占画布下方的一条，**绝不能和 garden 区域重叠**：
    // 之前两者共用一块画布、而 garden 又登记成整块画布，结果木桌被一起烘进了背景，
    // 于是选关 / 牌桌 / 设置这些不用木桌的屏幕下面都多出一大块棕色桌面。
    const atlas = new Atlas(aw, ah + th);
    const ctx = atlas.context;

    ctx.save();
    ctx.scale(S, S);
    drawGarden(ctx, w, h);
    ctx.restore();
    atlas.region('garden', {x: 0, y: 0, w: aw, h: ah});

    ctx.save();
    ctx.translate(0, ah);
    ctx.scale(S, S);
    drawTable(ctx, w, 0, tableH);
    ctx.restore();
    atlas.region('table', {x: 0, y: ah, w: aw, h: th});

    atlas.bake();
    this.atlas = atlas;
  }

  frame(name: 'garden' | 'table') { return this.atlas.frame(name); }
}