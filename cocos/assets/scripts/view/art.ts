/**
 * Canvas2D 绘制：把牌面与 UI 素材画进离屏画布，供 `atlas.ts` 烘焙成纹理。
 *
 * 本文件不依赖 cc，也不依赖 DOM——只要求调用方给一个「长得像 2D context」的对象。
 * 这样同一份画法既能被 cc 的纹理烘焙器调用，也能在 node 里用假 context 单测（见 tests/art.test.cjs）。
 *
 * 为什么要烘焙：Graphics 每个图元都要现算贝塞尔并独占一块 MeshBuffer（一张 9 筒 = 27 个圆 ≈ 6804 顶点）。
 * 把「牌身 + 牌面」一次性画进纹理后，牌桌上一张牌就是一个四边形（4 顶点），整桌共用一张图集 = 1 个 draw call。
 */
import {palette, radius, stroke, suitColor, type} from './theme';

/** 只需要用到的那部分 Canvas2D 接口，方便在 node 里造假对象。 */
export interface Ctx2D {
  fillStyle: any;
  strokeStyle: any;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, anticlockwise?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(t: string, x: number, y: number): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  scale(x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): any;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any;
}

export const SANS = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
export const SERIF = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif CJK SC",serif';

/** 圆角矩形路径。 */
export function rr(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** 填充圆角矩形。 */
export function fillRR(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, color: any): void {
  rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
}

/** 描边圆角矩形。 */
export function strokeRR(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, color: string, lw: number): void {
  rr(ctx, x, y, w, h, r); ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
}

/** 实心圆（徽章 / 印章 / 牌心这类同心圆要用，省得每处手写 beginPath+arc+fill）。 */
export function fillCircle(ctx: Ctx2D, cx: number, cy: number, r: number, color: any): void {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

/** 写一行字。 */
export function text(ctx: Ctx2D, str: string, x: number, y: number, size: number, color: string,
  align: 'left' | 'center' | 'right' = 'center', bold = false, serif = false): void {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${serif ? SERIF : SANS}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** 渐变辅助（对假 context 也成立）。 */
function linear(ctx: Ctx2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): any {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/* ══════════════════════════════════════════════════════════
   牌面
   ══════════════════════════════════════════════════════════ */

const DOTS: Record<number, number[][]> = {
  1: [[.5, .5, .3]],
  2: [[.5, .28, .18], [.5, .72, .18]],
  3: [[.26, .24, .16], [.5, .5, .16], [.74, .76, .16]],
  4: [[.3, .29, .16], [.7, .29, .16], [.3, .71, .16], [.7, .71, .16]],
  5: [[.28, .26, .15], [.72, .26, .15], [.5, .5, .15], [.28, .74, .15], [.72, .74, .15]],
  6: [[.3, .22, .14], [.7, .22, .14], [.3, .5, .14], [.7, .5, .14], [.3, .78, .14], [.7, .78, .14]],
  7: [[.26, .17, .12], [.5, .27, .12], [.74, .37, .12], [.3, .63, .12], [.7, .63, .12], [.3, .85, .12], [.7, .85, .12]],
  8: [[.3, .15, .12], [.7, .15, .12], [.3, .38, .12], [.7, .38, .12], [.3, .62, .12], [.7, .62, .12], [.3, .85, .12], [.7, .85, .12]],
  9: [[.24, .18, .115], [.5, .18, .115], [.76, .18, .115], [.24, .5, .115], [.5, .5, .115], [.76, .5, .115], [.24, .82, .115], [.5, .82, .115], [.76, .82, .115]]
};
const NUMERALS = '一二三四五六七八九';
const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
const FLOWERS = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];
/** 大厅装饰字牌：萬(红)/乐(绿)/筒(蓝)——不入玩法牌池，只做展示。 */
const DECO: Record<string, [string, string]> = {x1: ['萬', '#C0392B'], x2: ['乐', '#2E8B57'], x3: ['筒', '#2E7FB8']};
/**
 * 鞭炮牌面代号（与 core/Generator 的 BOMB_FACE 一致；art.ts 不 import core，所以这里存一份）。
 * 导出给 `assets.ts` 的烘焙清单用 —— 之前它只写在 faceArt 函数体里，烘焙名单看不到它，
 * 结果第 70 关起牌桌每帧 `图集里没有 b1` 抛异常（牌画一半就停）。
 */
export const BOMB_FACE = 'b1';

/** 筒子的固定配色：每种一张固定方案（红/绿/蓝），废除旧版按索引循环取色——
 *  颜色乱跳是「六筒九筒分不清」的主要原因之一。排列方向与 DOTS 表一致（行优先）。 */
const PIP_RED = '#C0392B', PIP_GREEN = '#2E8B57', PIP_BLUE = '#2E7FB8';
const PIP_PLAN: Record<number, string[]> = {
  2: [PIP_BLUE, PIP_RED],
  3: [PIP_RED, PIP_BLUE, PIP_RED],
  4: [PIP_BLUE, PIP_RED, PIP_RED, PIP_BLUE],
  5: [PIP_GREEN, PIP_GREEN, PIP_RED, PIP_GREEN, PIP_GREEN],
  6: [PIP_RED, PIP_RED, PIP_GREEN, PIP_GREEN, PIP_BLUE, PIP_BLUE],
  7: [PIP_RED, PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_GREEN],
  8: [PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_RED, PIP_RED, PIP_RED, PIP_RED],
  9: [PIP_RED, PIP_RED, PIP_RED, PIP_GREEN, PIP_GREEN, PIP_GREEN, PIP_BLUE, PIP_BLUE, PIP_BLUE]
};

/**
 * 条子的竹节布局（比例坐标，每根竹节独立给 位置/长度/颜色）。关键约定：
 *  - 造型走规整路线：直排竹节 + **大间距**，靠 行列数 + 红节位置 区分（不搞斜倾/异形——上一版的
 *    V 形二条和「双搭」六条被毙了）；
 *  - 剪影：二条=两根通天长竹（全家族最长）、三条=上一下二三角、六条=2×3 中列红、
 *    九条=3×3 密排中列红（行数 2 vs 3 + 密度区分）；
 *  - 红节点缀：5 条中心红、6 条中列红、7 条顶红、9 条中列红。
 */
const STICKS: Record<number, {x: number; y: number; len: number; red?: boolean}[]> = {
  2: [{x: .32, y: .5, len: .6}, {x: .68, y: .5, len: .6}],
  3: [{x: .5, y: .23, len: .28}, {x: .29, y: .72, len: .3}, {x: .71, y: .72, len: .3}],
  4: [{x: .26, y: .26, len: .28}, {x: .74, y: .26, len: .28}, {x: .26, y: .74, len: .28}, {x: .74, y: .74, len: .28}],
  5: [{x: .24, y: .24, len: .26}, {x: .76, y: .24, len: .26}, {x: .5, y: .5, len: .26, red: true}, {x: .24, y: .76, len: .26}, {x: .76, y: .76, len: .26}],
  6: [{x: .24, y: .27, len: .26}, {x: .5, y: .27, len: .26, red: true}, {x: .76, y: .27, len: .26}, {x: .24, y: .73, len: .26}, {x: .5, y: .73, len: .26, red: true}, {x: .76, y: .73, len: .26}],
  7: [{x: .5, y: .14, len: .16, red: true}, {x: .25, y: .44, len: .18}, {x: .5, y: .44, len: .18}, {x: .75, y: .44, len: .18}, {x: .25, y: .78, len: .18}, {x: .5, y: .78, len: .18}, {x: .75, y: .78, len: .18}],
  8: [{x: .28, y: .14, len: .14}, {x: .72, y: .14, len: .14}, {x: .28, y: .38, len: .14}, {x: .72, y: .38, len: .14}, {x: .28, y: .62, len: .14}, {x: .72, y: .62, len: .14}, {x: .28, y: .86, len: .14}, {x: .72, y: .86, len: .14}],
  9: [{x: .22, y: .18, len: .17}, {x: .5, y: .18, len: .17}, {x: .78, y: .18, len: .17}, {x: .22, y: .5, len: .17}, {x: .5, y: .5, len: .17, red: true}, {x: .78, y: .5, len: .17}, {x: .22, y: .82, len: .17}, {x: .5, y: .82, len: .17}, {x: .78, y: .82, len: .17}]
};

/** 解析 `5p` / `p5` / `3z` 这类牌面代号（冰面的 `~` 后缀先剥掉，否则 `z1~` 的序号会变成 NaN）。 */
export function parseFace(face: string): {suit: string; n: number} {
  // 先把所有后缀剥掉再解析：冰层可叠（'5s~~'）、百搭带 '*'，只剥一层会让序号变成 NaN（牌面画成 '?'）
  const f = face.replace(/[~*]+$/, '');
  const lead = /[a-z]/i.test(f[0] || '');
  return {suit: lead ? f[0] : f[1] || '', n: Number(lead ? f.slice(1) : f[0])};
}

function pip(ctx: Ctx2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * .62, 0, Math.PI * 2); ctx.fillStyle = palette.tile; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * .32, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function stick(ctx: Ctx2D, x: number, y: number, len: number, w: number, color: string): void {
  ctx.beginPath(); ctx.moveTo(x, y - len / 2); ctx.lineTo(x, y + len / 2);
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.stroke();
  // 竹节横杠：长节画两道（1/3、2/3 处），短节画一道——让竹节读得出「节」
  const ticks = len > w * 4 ? [-len * .22, len * .22] : [0];
  for (const t of ticks) {
    ctx.beginPath(); ctx.moveTo(x - w * .32, y + t); ctx.lineTo(x + w * .32, y + t);
    ctx.lineWidth = Math.max(1, w * .22); ctx.strokeStyle = palette.tile; ctx.stroke();
  }
}
function bird(ctx: Ctx2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w * .5, cy = y + h * .55;
  const dot = (ax: number, ay: number, r: number, col: string) => {
    ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  };
  const line = (pts: number[][], col: string, lw: number) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.stroke();
  };
  dot(cx - w * .04, cy + h * .06, w * .2, '#2E8B57');
  dot(cx + w * .14, cy - h * .16, w * .12, '#2E8B57');
  dot(cx + w * .17, cy - h * .18, w * .03, palette.ink);
  line([[cx + w * .25, cy - h * .2], [cx + w * .38, cy - h * .14], [cx + w * .25, cy - h * .1]], palette.red, Math.max(1, w * .05));
  line([[cx - w * .2, cy + h * .14], [cx - w * .38, cy + h * .34], [cx - w * .08, cy + h * .26]], palette.red, Math.max(1, w * .06));
  line([[cx - w * .16, cy], [cx - w * .3, cy - h * .16], [cx - w * .04, cy - h * .1]], palette.blue, Math.max(1, w * .05));
}

/** 在 (x, y, w, h) 框内画牌面花纹（不含牌身）。 */
export function faceArt(ctx: Ctx2D, face: string, x: number, y: number, w: number, h: number): void {
  const {suit, n} = parseFace(face);
  if (suit === 'p' && DOTS[n]) {
    if (n === 1) {
      const cx = x + w / 2, cy = y + h / 2, r = w * .37;
      const ring = (rr2: number, col: string) => { ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
      ring(r, '#2E8B57'); ring(r * .78, palette.tile); ring(r * .6, palette.red); ring(r * .36, palette.tile); ring(r * .2, palette.blue);
      return;
    }
    const plan = PIP_PLAN[n] || PIP_PLAN[2];
    DOTS[n].forEach(([px, py, pr], i) => pip(ctx, x + px * w, y + py * h, pr * w, plan[i % plan.length]));
    return;
  }
  if (suit === 's') {
    if (n === 1) { bird(ctx, x, y, w, h); return; }
    if (STICKS[n]) {
      const sw = w * .13;
      for (const {x: px, y: py, len, red} of STICKS[n]) {
        const cx = x + px * w, cy = y + py * h, cl = len * h;
        // 长竹节的竹身略粗：主次分明，剪影更立
        const cwd = cl > h * .34 ? sw * 1.16 : sw;
        stick(ctx, cx, cy, cl, cwd, red ? PIP_RED : PIP_GREEN);
      }
      return;
    }
  }
  if (suit === 'm' && n >= 1 && n <= 9) {
    const a = Math.min(h * .34, w * .74), b = Math.min(h * .38, w * .78);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${a}px ${SERIF}`;
    ctx.fillStyle = palette.navy; ctx.fillText(NUMERALS[n - 1], x + w / 2, y + h * .06);
    ctx.font = `700 ${b}px ${SERIF}`;
    ctx.fillStyle = palette.red; ctx.fillText('萬', x + w / 2, y + h * .48);
    return;
  }
  if (suit === 'z' && n >= 1 && n <= 7) {
    if (n === 7) {
      rr(ctx, x + w * .16, y + h * .18, w * .68, h * .64, w * .09);
      ctx.lineWidth = Math.max(2, w * .07); ctx.strokeStyle = '#4F8FB0'; ctx.stroke();
      return;
    }
    const size = Math.min(h * .5, w * .84);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${size}px ${SERIF}`;
    ctx.fillStyle = n === 5 ? palette.red : n === 6 ? '#2E8B57' : palette.navy;
    ctx.fillText(HONORS[n - 1], x + w / 2, y + (h - size) / 2);
    return;
  }
  if (suit === 'f' && n >= 1 && n <= 8) {
    // 花牌：绿色衬线大字 + 底部一枚五瓣小红花，与字牌（紫脚、纯大字）区分
    const size = Math.min(h * .5, w * .8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${size}px ${SERIF}`;
    ctx.fillStyle = palette.jadeDeep;
    ctx.fillText(FLOWERS[n - 1], x + w / 2, y + h * .04);
    const fx = x + w / 2, fy = y + h * .84, fr = w * .09;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * .62, 0, Math.PI * 2);
      ctx.fillStyle = PIP_RED; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(fx, fy, fr * .5, 0, Math.PI * 2); ctx.fillStyle = '#F6D46B'; ctx.fill();
    return;
  }
  if (DECO[face]) {
    // 装饰字牌（萬/乐/筒）：单一大字居中，颜色随牌
    const [ch, col] = DECO[face];
    const size = Math.min(h * .56, w * .86);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${size}px ${SERIF}`;
    ctx.fillStyle = col;
    ctx.fillText(ch, x + w / 2, y + (h - size) / 2);
    return;
  }
/** 鞭炮牌：见导出的 `BOMB_FACE`（牌面代号与 core/Generator 一致）。 */
  if (suit === 'b' && face === BOMB_FACE) {
    // 鞭炮牌：竖着的红炮仗（红筒 + 金箍）+ 引线火花
    const cx = x + w / 2, bw = w * .3, bh = h * .46, top = y + h * .5 - bh / 2 + h * .06;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.quadraticCurveTo(cx + bw * .8, top - bh * .5, cx + bw * 1.5, top - bh * .3);
    ctx.lineWidth = Math.max(2, w * .045); ctx.strokeStyle = '#8A6A33'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = '#E8873B'; ctx.lineWidth = Math.max(2, w * .038);
    for (const [dx, dy] of [[.55, -.62], [.95, -.34], [.42, -.9]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * bw, top + dy * bh * .5);
      ctx.lineTo(cx + dx * bw + w * .035, top + dy * bh * .5 - h * .05);
      ctx.stroke();
    }
    rr(ctx, cx - bw / 2, top, bw, bh, bw * .3);
    ctx.fillStyle = '#C0392B'; ctx.fill();
    ctx.lineWidth = Math.max(2, w * .04); ctx.strokeStyle = '#8C2318'; ctx.stroke();
    ctx.fillStyle = '#E8C56B';
    rr(ctx, cx - bw / 2, top + bh * .3, bw, bh * .12, 2); ctx.fill();
    rr(ctx, cx - bw / 2, top + bh * .58, bw, bh * .1, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    rr(ctx, cx - bw * .34, top + bh * .1, bw * .16, bh * .52, bw * .08); ctx.fill();
    return;
  }
  const size = Math.min(h * .4, w * .6);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `700 ${size}px ${SANS}`; ctx.fillStyle = palette.inkFaint;
  ctx.fillText('?', x + w / 2, y + (h - size) / 2);
}

export interface TileArtOpts {w: number; h: number; lift?: number}

/** 冰面：覆在牌面上的霜层。画法双端一致（h5 tile.ts 同款）：冰蓝描边 + 淡霜填充 + 两粒冰晶。 */
/**
 * 霜面（冰层的视觉）：独立于牌面绘制，Board 把它作为冰牌的叠加层。
 * 1 层 = 单圈霜框；2 层（厚冰）= 外圈加重 + 内圈，一眼可辨。
 */
export function drawFrostFrame(ctx: Ctx2D, x: number, y: number, w: number, h: number, layers: number): void {
  const rim = (inset: number, lw: number, col: string, fill: string | null): void => {
    rr(ctx, x + w * inset, y + h * inset, w * (1 - inset * 2), h * (1 - inset * 2), Math.min(w, h) * .14);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  };
  if (layers >= 2) rim(.015, Math.max(2, w * .05), 'rgba(120,190,240,.95)', null);
  rim(layers >= 2 ? .075 : .04, Math.max(1.5, w * .05), 'rgba(150,205,245,.95)', 'rgba(205,235,255,.42)');
  // 两粒冰晶
  const crystal = (cx: number, cy: number, s: number): void => {
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = 'rgba(235,248,255,.95)'; ctx.lineWidth = Math.max(1, s * .22); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * s, -Math.sin(a) * s); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.stroke();
    }
    ctx.restore();
  };
  crystal(x + w * .78, y + h * .22, w * .07);
  crystal(x + w * .22, y + h * .76, w * .06);
}

/** 霜面（h5 同款画法）：drawTile 直接绘制路径用；层数 1=单圈、2=厚冰双圈。 */
export function drawFrost(ctx: Ctx2D, x: number, y: number, w: number, h: number, layers = 1): void {
  drawFrostFrame(ctx, x, y, w, h, layers);
}

/**
 * 牌面里的冰层数（`5s~~` = 2 层）。
 * **view/ 里只此一份**：`drawTile`（烘焙）与 `Board`（叠加层选帧）都从这里取，
 * 别再抄第三份（core/Rules 那份是 core 自己的，视图不 import core，两边靠「~ 的个数」这个约定对齐）。
 */
export function iceLayers(face: string): number {
  let n = 0;
  while (face.endsWith("~")) { face = face.slice(0, -1); n++; }
  return n;
}

/**
 * 画一整张牌（花色脚 + 象牙牌身 + 牌面花纹），以左上角 (x, y) 为原点。
 * 画布按需比 w/h 高一点点以容纳向下投影。
 */
export function drawTile(ctx: Ctx2D, face: string, x: number, y: number, o: TileArtOpts): void {
  const {w, h} = o;
  const lift = o.lift ?? Math.max(2, h * .07);
  const r = Math.min(w, h) * .17;
  const foot = suitColor(face);

  // 向下投影
  ctx.save();
  ctx.globalAlpha = .18;
  fillRR(ctx, x + w * .02, y + h * .05, w, h - lift, r, '#1E3A22');
  ctx.restore();
  // 花色脚
  fillRR(ctx, x, y + lift, w, h - lift, r, foot);
  // 象牙牌身
  rr(ctx, x, y, w, h - lift, r);
  ctx.fillStyle = linear(ctx, x, y, x, y + h - lift,
    [[0, '#FFFFFF'], [.55, palette.tile], [1, '#F0E7CC']]);
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * .022); ctx.strokeStyle = palette.tileEdge; ctx.stroke();
  // 顶部高光
  fillRR(ctx, x + w * .08, y + h * .07, w * .84, (h - lift) * .16, r * .6, 'rgba(255,255,255,.75)');
  // 牌面花纹
  faceArt(ctx, face, x + w * .09, y + h * .07, w * .82, (h - lift) * .84);
  // 冰面覆霜（冰面牌 face 以 ~ 结尾）
  const ice = iceLayers(face);
  if (ice > 0) drawFrost(ctx, x + w * .06, y + h * .06, w * .88, (h - lift) * .88, ice);
}

/* ══════════════════════════════════════════════════════════
   UI 素材（画进图集，由 widgets.ts 按帧取用）
   ══════════════════════════════════════════════════════════ */

/** 纸面卡片：金边 + 内细线。 */
export function drawPanel(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number = radius.card): void {
  fillRR(ctx, x, y + h * .012, w, h, r, 'rgba(59,42,18,.22)');
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = linear(ctx, x, y, x, y + h, [[0, '#FFFBF0'], [1, palette.creamDeep]]);
  ctx.fill();
  strokeRR(ctx, x, y, w, h, r, palette.gold, Math.max(2, w * .006));
  strokeRR(ctx, x + w * .022, y + h * .016, w * .956, h * .968, r * .9, 'rgba(216,169,78,.5)', 1.5);
}

export interface ButtonArtOpts {
  /** 顶部高光条：H5 的 button() 有，toolButton() 没有 */
  gloss?: boolean;
  /** 两端金铆钉：同上 */
  studs?: boolean;
  /** 铆钉颜色（H5 按按钮种类给） */
  stud?: string;
  /** 描边色，默认用 edge */
  stroke?: string;
  /** 纯色按钮：单色填充，不画渐变 / 顶部高光 / 铆钉（开始、继续这一族）。 */
  flat?: boolean;
}

/** 厚按钮：深色底 + 亮色面 + 顶部高光 + 两端金铆钉（几何与 H5 的 button()/toolButton() 对齐）。 */
export function drawButton(ctx: Ctx2D, x: number, y: number, w: number, h: number, top: string, bottom: string, edge: string, r = h * .34, o: ButtonArtOpts = {}): void {
  fillRR(ctx, x, y + h * .05, w, h * .95, r, edge);
  rr(ctx, x, y, w, h * .9, r);
  // flat：单色面，不画渐变。保留底部实心厚度与描边，按下仍有「厚按钮」的手感。
  ctx.fillStyle = o.flat ? top : linear(ctx, x, y, x, y + h * .9, [[0, top], [1, bottom]]);
  ctx.fill();
  if (o.flat) {
    strokeRR(ctx, x, y, w, h * .9, r, o.stroke ?? edge, Math.max(1.5, h * .022));
    return;
  }
  if (o.gloss !== false) {
    ctx.save(); ctx.globalAlpha = .35;
    fillRR(ctx, x + w * .06, y + h * .09, w * .88, h * .2, r * .6, '#FFFFFF');
    ctx.restore();
  }
  if (o.studs) {
    ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = o.stud ?? palette.gold;
    for (const sx of [x + w * .07, x + w * .93]) {
      ctx.beginPath(); ctx.arc(sx, y + h * .45, h * .045, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  strokeRR(ctx, x, y, w, h * .9, r, o.stroke ?? edge, Math.max(1.5, h * .022));
}

/** 深玉匾额胶囊。`fill` 必须显式标成 string：palette 是 as const，
 *  省略类型标注时默认值会把参数推成字面量类型 '#1C5B37'，换个色就报 TS2345。 */
export function drawPill(ctx: Ctx2D, x: number, y: number, w: number, h: number, fill: string = palette.jadeDeep): void {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = linear(ctx, x, y, x, y + h, [[0, '#3E7A48'], [1, fill]]);
  ctx.fill();
  strokeRR(ctx, x + 1, y + 1, w - 2, h - 2, h / 2, palette.gold, Math.max(1.5, h * .05));
}

/** 五角星。 */
export function drawStar(ctx: Ctx2D, cx: number, cy: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .47 : r;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx, cy - r, cx, cy + r, filled
    ? [[0, '#FFE27A'], [1, '#E8A526']]
    : [[0, '#DCD3BC'], [1, '#C2B79C']]);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * .1);
  ctx.strokeStyle = filled ? '#B8851A' : '#AFA489';
  ctx.stroke();
}

/** 开关（画两态，供 widgets 取用）。 */
export function drawToggle(ctx: Ctx2D, x: number, y: number, w: number, on: boolean): void {
  const h = w * .58;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = linear(ctx, x, y, x, y + h, on
    ? [[0, palette.jadeLight], [1, palette.jade]]
    : [[0, '#D9D2C0'], [1, '#C3BAA4']]);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(on ? x + w - h / 2 : x + h / 2, y + h / 2, h * .41, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.stroke();
}

/** 锁。 */
export function drawLock(ctx: Ctx2D, cx: number, cy: number, r: number, col: string): void {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r * .22);
  ctx.beginPath(); ctx.arc(cx, cy - r * .35, r * .45, Math.PI, 0); ctx.stroke();
  fillRR(ctx, cx - r * .75, cy - r * .3, r * 1.5, r * 1.15, r * .25, col);
}

/** 箭头（direction: 'right' 用于菜单项，'back' 用于返回）。 */
export function drawChevron(ctx: Ctx2D, cx: number, cy: number, s: number, col: string, lw: number, back = false): void {
  ctx.beginPath();
  if (back) { ctx.moveTo(cx + s * .28, cy - s * .5); ctx.lineTo(cx - s * .3, cy); ctx.lineTo(cx + s * .28, cy + s * .5); }
  else { ctx.moveTo(cx - s * .3, cy - s * .5); ctx.lineTo(cx + s * .3, cy); ctx.lineTo(cx - s * .3, cy + s * .5); }
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.stroke();
}

/** 齿轮。 */
export function drawGear(ctx: Ctx2D, cx: number, cy: number, r: number, col: string): void {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = col;
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-r * .09, -r * .62, r * .18, r * .26); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * .42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * .17, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fill();
  ctx.restore();
}

/** 纯色/渐变圆角小块（进度条、槽位等）。 */
export function drawChip(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: any, r = h / 2): void {
  fillRR(ctx, x, y, w, h, r, color);
}

/* ══════════════════════════════════════════════════════════
   图标（线描，单色）
   ══════════════════════════════════════════════════════════ */

/**
 * 图标名。这些位置以前用的是 emoji（🔊 🎵 📳 💡 🔀 ↩ ⟳ ▶ ⌂）——
 * 彩色 emoji 由系统字体决定字形与配色，在「绿玉庭院」这套界面里是最跳的一处，
 * 也是「一眼 AI 生成」的主要来源。改成同一种墨色画出来的线图标后，粗细、圆角、
 * 留白都能和界面统一，换色只需要给 Sprite 染色。
 */
export type IconName =
  | 'sound' | 'music' | 'vibrate' | 'book'
  | 'hint' | 'shuffle' | 'undo' | 'restart'
  | 'play' | 'home' | 'progress';

/** 实心箭头（画在 (x,y)，指向 `ang` 弧度）。 */
function arrowHead(ctx: Ctx2D, x: number, y: number, ang: number, s: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(-s * .72, s * .64); ctx.lineTo(-s * .72, -s * .64);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * 每个图标的「墨迹」包围盒（比例值，相对边长 s，中心 0.5）——用浏览器实测得到。
 *
 * 为什么需要这张表：直接按同一个 `s` 画，各图标的视觉大小能差近一倍
 * （灯泡带光芒 0.891s，撤销的弧只有 0.508s），垂直中心也差 ±0.06s。
 * 单独看没事，**排成一行就明显高矮不齐**（工具条四个按钮就是这么暴露的）。
 */
const ICON_INK: Record<IconName, {w: number; h: number; cx: number; cy: number}> = {
  sound: {w: .840, h: .859, cx: .078, cy: -.002},
  music: {w: .727, h: .832, cx: -.037, cy: -.035},
  vibrate: {w: 1.000, h: .781, cx: -.002, cy: -.002},
  book: {w: .938, h: .676, cx: -.002, cy: -.031},
  hint: {w: 1.000, h: .891, cx: -.002, cy: -.057},
  shuffle: {w: .949, h: .664, cx: .023, cy: -.002},
  undo: {w: .832, h: .508, cx: -.027, cy: .033},
  restart: {w: .742, h: .738, cx: -.002, cy: 0},
  play: {w: .523, h: .602, cx: .037, cy: -.002},
  home: {w: .938, h: .801, cx: -.002, cy: -.012},
  progress: {w: .880, h: .800, cx: -.002, cy: .002}
};

/** 归一化后的统一墨迹高度（比例值）。 */
const ICON_TARGET_H = .74;
/** 归一化后的最大墨迹宽度，防止宽图标撑出方框被裁。 */
const ICON_MAX_W = .92;

/**
 * 在 (x, y, w, h) 框内画一个图标。画法全部是**描边**（除箭头与播放三角为实心），
 * 所以调用方只要给一个颜色就能得到任意配色的同一枚图标。
 */
export function drawIcon(ctx: Ctx2D, name: IconName, x: number, y: number, w: number, h: number, color: string): void {
  const s = Math.min(w, h);
  const ink = ICON_INK[name];
  // 把墨迹缩放到统一视觉高度并把它的中心对到方框中心；描边宽度除回去，保证各图标线粗一致
  const k = Math.min(ICON_TARGET_H / ink.h, ICON_MAX_W / ink.w);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(k, k);
  ctx.translate(-ink.cx * s, -ink.cy * s);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.6, s * .095) / k;

  switch (name) {
    case 'sound': {
      ctx.beginPath();
      ctx.moveTo(-s * .34, -s * .16); ctx.lineTo(-s * .14, -s * .16); ctx.lineTo(s * .08, -s * .4);
      ctx.lineTo(s * .08, s * .4); ctx.lineTo(-s * .14, s * .16); ctx.lineTo(-s * .34, s * .16);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .1, 0, s * .24, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * .1, 0, s * .44, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      break;
    }
    case 'music': {
      ctx.beginPath(); ctx.ellipse(-s * .24, s * .26, s * .16, s * .115, -.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * .14, s * .16, s * .16, s * .115, -.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * .1, s * .22); ctx.lineTo(-s * .1, -s * .3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .28, s * .12); ctx.lineTo(s * .28, -s * .4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .1, -s * .3); ctx.lineTo(s * .28, -s * .4); ctx.stroke();
      break;
    }
    case 'vibrate': {
      rr(ctx, -s * .21, -s * .34, s * .42, s * .68, s * .1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .34, -s * .12); ctx.lineTo(-s * .34, s * .12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .45, -s * .24); ctx.lineTo(-s * .45, s * .24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .34, -s * .12); ctx.lineTo(s * .34, s * .12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .45, -s * .24); ctx.lineTo(s * .45, s * .24); ctx.stroke();
      break;
    }
    case 'book': {
      ctx.beginPath();
      ctx.moveTo(0, -s * .26);
      ctx.bezierCurveTo(-s * .14, -s * .35, -s * .3, -s * .33, -s * .42, -s * .26);
      ctx.lineTo(-s * .42, s * .24);
      ctx.bezierCurveTo(-s * .3, s * .18, -s * .14, s * .16, 0, s * .26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * .26);
      ctx.bezierCurveTo(s * .14, -s * .35, s * .3, -s * .33, s * .42, -s * .26);
      ctx.lineTo(s * .42, s * .24);
      ctx.bezierCurveTo(s * .3, s * .18, s * .14, s * .16, 0, s * .26);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * .26); ctx.lineTo(0, s * .26); ctx.stroke();
      break;
    }
    case 'hint': {
      // 球体下缘留口再接灯座；不留口会读成「棒棒糖」
      ctx.beginPath(); ctx.arc(0, -s * .12, s * .3, Math.PI * .7, Math.PI * .3, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .14, s * .05); ctx.lineTo(-s * .14, s * .2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .14, s * .05); ctx.lineTo(s * .14, s * .2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .17, s * .22); ctx.lineTo(s * .17, s * .22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .12, s * .34); ctx.lineTo(s * .12, s * .34); ctx.stroke();
      for (const a of [-Math.PI * .8, -Math.PI * .2, Math.PI * 1.2, Math.PI * 1.8]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * .44, -s * .12 + Math.sin(a) * s * .44);
        ctx.lineTo(Math.cos(a) * s * .56, -s * .12 + Math.sin(a) * s * .56);
        ctx.stroke();
      }
      break;
    }
    case 'shuffle': {
      ctx.beginPath();
      ctx.moveTo(-s * .4, s * .26);
      ctx.bezierCurveTo(-s * .12, s * .26, s * .12, -s * .26, s * .3, -s * .26);
      ctx.stroke();
      arrowHead(ctx, s * .42, -s * .26, -Math.PI * .16, s * .17);
      ctx.beginPath();
      ctx.moveTo(-s * .4, -s * .26);
      ctx.bezierCurveTo(-s * .12, -s * .26, s * .12, s * .26, s * .3, s * .26);
      ctx.stroke();
      arrowHead(ctx, s * .42, s * .26, Math.PI * .16, s * .17);
      break;
    }
    case 'undo': {
      ctx.beginPath();
      ctx.moveTo(s * .34, s * .24);
      ctx.bezierCurveTo(s * .34, -s * .26, -s * .2, -s * .28, -s * .26, s * .06);
      ctx.stroke();
      arrowHead(ctx, -s * .3, s * .1, Math.PI * .78, s * .18);
      break;
    }
    case 'restart': {
      const r = s * .32, a0 = -Math.PI * .32, a1 = Math.PI * 1.36;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
      arrowHead(ctx, Math.cos(a1) * r, Math.sin(a1) * r, a1 + Math.PI / 2, s * .18);
      break;
    }
    case 'play': {
      ctx.beginPath();
      ctx.moveTo(-s * .22, -s * .3); ctx.lineTo(s * .3, 0); ctx.lineTo(-s * .22, s * .3);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'home': {
      ctx.beginPath(); ctx.moveTo(-s * .42, s * .02); ctx.lineTo(0, -s * .36); ctx.lineTo(s * .42, s * .02); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * .3, -s * .04); ctx.lineTo(-s * .3, s * .34);
      ctx.lineTo(s * .3, s * .34); ctx.lineTo(s * .3, -s * .04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * .08, s * .34); ctx.lineTo(-s * .08, s * .12);
      ctx.lineTo(s * .08, s * .12); ctx.lineTo(s * .08, s * .34);
      ctx.stroke();
      break;
    }
    case 'progress': {
      // 三根上升的柱 + 顶部一颗星位圆点：进度概览
      const bars: [number, number][] = [[-s * .26, .30], [0, .48], [s * .26, .68]];
      for (const [bx, bh] of bars) {
        ctx.beginPath();
        ctx.moveTo(bx - s * .11, s * .34); ctx.lineTo(bx - s * .11, s * .34 - bh * s);
        ctx.lineTo(bx + s * .11, s * .34 - bh * s); ctx.lineTo(bx + s * .11, s * .34);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(s * .26, s * .34 - .68 * s - s * .12, s * .075, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export {linear};