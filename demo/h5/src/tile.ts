/** Canvas2D mahjong tile art: ivory face, suit-coloured foot, drawn face glyphs.
 *  画法与 cocos/assets/scripts/view/art.ts 保持同一套（双端同步约定），改这里必须同步改那边。 */
import {T} from './theme';

export type Face = string;

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

export const SUIT_COLOR: Record<string, string> = {p: '#2E7FB8', s: '#2E8B57', m: '#C0392B', z: '#6B4FA0', f: '#C2678F', x: '#2E7FB8', b: '#8C2318'};

/** 筒子的固定配色：每种一张固定方案（红/绿/蓝），与 cocos art.ts 的 PIP_PLAN 一致。 */
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

/** 条子竹节布局（与 cocos art.ts 的 STICKS 一致）：直排竹节 + 大间距，靠行列数与红节位置区分——
 *  二条通天长竹、三条三角、六条 2×3 中列红、九条 3×3 中列红。 */
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

export function parseFace(face: Face): {suit: string; n: number} {
  // 先把所有后缀剥掉再解析：冰层可叠（'5s~~'）、百搭带 '*'，只剥一层会让序号变成 NaN（牌面画成 '?'）
  const f = face.replace(/[~*]+$/, '');
  const lead = /[a-z]/i.test(f[0] || '');
  return {suit: lead ? f[0] : f[1] || '', n: Number(lead ? f.slice(1) : f[0])};
}

/** 花色脚颜色；装饰字牌按牌号给色（萬红/乐绿/筒蓝）。 */
export function footColor(face: Face): string {
  const {suit, n} = parseFace(face);
  if (suit === 'x') return ['#C0392B', '#2E8B57', '#2E7FB8'][n - 1] || T.jade;
  return SUIT_COLOR[suit] || T.jade;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function pip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * .62, 0, Math.PI * 2); ctx.fillStyle = T.tile; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * .32, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function stick(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, color: string): void {
  ctx.beginPath(); ctx.moveTo(x, y - len / 2); ctx.lineTo(x, y + len / 2);
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.stroke();
  // 竹节横杠：长节画两道（1/3、2/3 处），短节画一道——让竹节读得出「节」
  const ticks = len > w * 4 ? [-len * .22, len * .22] : [0];
  for (const t of ticks) {
    ctx.beginPath(); ctx.moveTo(x - w * .32, y + t); ctx.lineTo(x + w * .32, y + t);
    ctx.lineWidth = Math.max(1, w * .22); ctx.strokeStyle = T.tile; ctx.stroke();
  }
}
function bird(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w * .5, cy = y + h * .55;
  const circle = (ax: number, ay: number, r: number, col: string) => {
    ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  };
  const line = (pts: number[][], col: string, lw: number) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.stroke();
  };
  circle(cx - w * .04, cy + h * .06, w * .2, '#2E8B57');
  circle(cx + w * .14, cy - h * .16, w * .12, '#2E8B57');
  circle(cx + w * .17, cy - h * .18, w * .03, '#22301F');
  line([[cx + w * .25, cy - h * .2], [cx + w * .38, cy - h * .14], [cx + w * .25, cy - h * .1]], '#C0392B', Math.max(1, w * .05));
  line([[cx - w * .2, cy + h * .14], [cx - w * .38, cy + h * .34], [cx - w * .08, cy + h * .26]], '#C0392B', Math.max(1, w * .06));
  line([[cx - w * .16, cy], [cx - w * .3, cy - h * .16], [cx - w * .04, cy - h * .1]], '#2E7FB8', Math.max(1, w * .05));
}

/** 冰层霜面（与 cocos art.ts 的 drawFrostFrame 同款）：1 层单圈，2 层（厚冰）外圈加重 + 内圈。 */
function drawFrost(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, layers = 1): void {
  const rim = (inset: number, lw: number, col: string, fill: string | null) => {
    rr(ctx, x + w * inset, y + h * inset, w * (1 - inset * 2), h * (1 - inset * 2), Math.min(w, h) * .14);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  };
  if (layers >= 2) rim(.015, Math.max(2, w * .05), 'rgba(120,190,240,.95)', null);
  rim(layers >= 2 ? .075 : .04, Math.max(1.5, w * .05), 'rgba(150,205,245,.95)', 'rgba(205,235,255,.42)');
  const crystal = (cx: number, cy: number, s: number) => {
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

/** 冰层数（`5s~~` = 2 层）。 */
export function iceLayers(face: string): number {
  let n = 0;
  while (face.endsWith('~')) { face = face.slice(0, -1); n++; }
  return n;
}

/** Draws the glyph art for a face inside the box (x, y, w, h). */
export function drawFaceArt(ctx: CanvasRenderingContext2D, face: Face, x: number, y: number, w: number, h: number): void {
  const {suit, n} = parseFace(face);
  if (suit === 'p' && DOTS[n]) {
    if (n === 1) {
      const cx = x + w / 2, cy = y + h / 2, r = w * .37;
      const ring = (rr2: number, col: string) => { ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
      ring(r, '#2E8B57'); ring(r * .78, T.tile); ring(r * .6, '#C0392B'); ring(r * .36, T.tile); ring(r * .2, '#2E7FB8');
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
    ctx.font = `700 ${a}px ${'"STKaiti","KaiTi","Songti SC",serif'}`;
    ctx.fillStyle = '#2B4A7A'; ctx.fillText(NUMERALS[n - 1], x + w / 2, y + h * .06);
    ctx.font = `700 ${b}px ${'"STKaiti","KaiTi","Songti SC",serif'}`;
    ctx.fillStyle = '#C0392B'; ctx.fillText('萬', x + w / 2, y + h * .48);
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
    ctx.font = `700 ${size}px ${'"STKaiti","KaiTi","Songti SC",serif'}`;
    ctx.fillStyle = n === 5 ? '#C0392B' : n === 6 ? '#2E8B57' : '#2B4A7A';
    ctx.fillText(HONORS[n - 1], x + w / 2, y + (h - size) / 2);
    return;
  }
  if (suit === 'f' && n >= 1 && n <= 8) {
    // 花牌：绿色衬线大字 + 底部一枚五瓣小红花，与字牌（紫脚、纯大字）区分
    const size = Math.min(h * .5, w * .8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${size}px ${'"STKaiti","KaiTi","Songti SC",serif'}`;
    ctx.fillStyle = '#1C5B37';
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
    ctx.font = `700 ${size}px ${'"STKaiti","KaiTi","Songti SC",serif'}`;
    ctx.fillStyle = col;
    ctx.fillText(ch, x + w / 2, y + (h - size) / 2);
    return;
  }
  const size = Math.min(h * .4, w * .6);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `700 ${size}px sans-serif`; ctx.fillStyle = '#8A957E';
  if (suit === 'b') {
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
  ctx.fillText('?', x + w / 2, y + (h - size) / 2);
}

export interface TileOpts {face: Face; w: number; h: number; lift?: number; scale?: number; glow?: boolean}

/** Draws one tile with its foot, centred on (cx, cy). */
export function drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, o: TileOpts): void {
  const {w, h} = o;
  const lift = o.lift ?? Math.max(2, h * .07);
  const x = cx - w / 2, y = cy - h / 2;
  const r = Math.min(w, h) * .17;
  const foot = footColor(o.face);

  ctx.save();
  // drop shadow
  ctx.globalAlpha = .18;
  rr(ctx, x + w * .02, y + h * .05, w, h - lift, r); ctx.fillStyle = '#1E3A22'; ctx.fill();
  ctx.globalAlpha = 1;
  // coloured foot
  rr(ctx, x, y + lift, w, h - lift, r);
  ctx.fillStyle = foot; ctx.fill();
  // ivory body
  rr(ctx, x, y, w, h - lift, r);
  const g = ctx.createLinearGradient(x, y, x, y + h - lift);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(.55, T.tile); g.addColorStop(1, '#F0E7CC');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, w * .022); ctx.strokeStyle = T.tileEdge; ctx.stroke();
  // top highlight
  rr(ctx, x + w * .08, y + h * .07, w * .84, (h - lift) * .16, r * .6);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();

  if (o.glow) {
    rr(ctx, x - w * .04, y - h * .04, w * 1.08, h * 1.02, r * 1.15);
    ctx.lineWidth = Math.max(2, w * .06); ctx.strokeStyle = '#FFD84D'; ctx.stroke();
  }

  ctx.save();
  drawFaceArt(ctx, o.face, x + w * .09, y + h * .07, w * .82, (h - lift) * .84);
  ctx.restore();
  const ice = iceLayers(o.face);
  if (ice > 0) drawFrost(ctx, x + w * .06, y + h * .06, w * .88, (h - lift) * .88, ice);
  ctx.restore();
}
