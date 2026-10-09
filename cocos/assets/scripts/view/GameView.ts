import {Command, Drawing, colors, clamp, finite} from './Drawing';

/* The view is deliberately self-contained (no core imports) so it can be compiled and tested alone.
 * Structural types below are compatible with core/Rules + core/Session. */
export interface Pos {r: number; c: number}
export type Cell = string[] | null | '#';
export interface Run {axis: 'row' | 'col'; index: number; cells: Pos[]}
export type Action = {kind: 'slide'; run: number; step: number} | {kind: 'match'; a: Pos; b: Pos};
export interface Drag {run: number; offset: number}
export interface Effect {cells: Pos[]; progress: number}
export interface ViewModel {
  grid: Cell[][]; runs: Run[]; levelIndex: number; maxLevel: number; total: number; moves: number;
  selected: Pos | null; hint: Action[]; message: string; modal: string;
  reducedMotion: boolean; vibration: boolean; lastChain: number;
  drag?: Drag | null; effect?: Effect | null; levelNames?: string[]; levelCount?: number;
  levelName?: string; chapter?: string; difficulty?: number; par?: number; hintsLeft?: number; shufflesLeft?: number;
  canUndo?: boolean; rating?: number; stars?: Record<string, number>; levelPage?: number;
}
export interface Hit {id: string; x: number; y: number; w: number; h: number}
export interface Board {x: number; y: number; cols: number; rows: number; cellW: number; cellH: number}
export interface Frame {width: number; height: number; modal: string; commands: Command[]; hits: Hit[]; board: Board}

export const palette = {
  ...colors,
  felt: '#235B48', slot: '#1D503F', slotEdge: '#174535', hole: '#183F34', holeEdge: '#30664F',
  ivorySide: '#F2DFB8', grassEdge: '#5E8C4C', grassDark: '#6C9A57', shadow: '#1E4A3F44',
  gold: '#FFC94A', goldEdge: '#E0A526', navy: '#1F3A5F', brass: '#D99A4E', brassEdge: '#9C6430',
  plum: '#8C5A9E', sky: '#4F8FB0', inkSoft: '#24594ECC', backdrop: '#24594EB8', glow: '#FFE7A8'
};

const DESIGN_W = 750;
const SIDE = 36;
const TILE_ASPECT = 1.28;
const MAX_CELL_W = 112;

const isStack = (c: Cell | undefined): c is string[] => Array.isArray(c);
const topOf = (g: Cell[][], p: Pos): string | null => {
  const c = g[p.r]?.[p.c];
  return isStack(c) && c.length ? c[c.length - 1] : null;
};
const same = (a: Pos | null | undefined, b: Pos | null | undefined): boolean => !!a && !!b && a.r === b.r && a.c === b.c;
const tileTotal = (g: Cell[][]): number => g.reduce((n, row) => n + row.reduce((m, c) => m + (isStack(c) ? c.length : 0), 0), 0);
/** Hex colour with an alpha channel; `a` in [0, 1]. */
export function alpha(hex: string, a: number): string {
  const v = Math.round(clamp(a, 0, 1) * 255);
  return hex.slice(0, 7) + (v < 16 ? '0' : '') + v.toString(16).toUpperCase();
}
function rotateGrid(g: Cell[][], run: Run, step: number): Cell[][] {
  const out = g.map(row => row.slice());
  const len = run.cells.length, k = ((step % len) + len) % len;
  if (!len || !k) return out;
  for (let i = 0; i < len; i++) {
    const to = run.cells[i], from = run.cells[(i - k + len) % len];
    out[to.r][to.c] = g[from.r]?.[from.c] ?? null;
  }
  return out;
}
/** Cells that would be erased by the first wave after a slide of `run` (same rule as core transition). */
function wouldClear(g: Cell[][], run: Run): Set<string> {
  const touched = new Set(run.cells.map(p => p.r + ',' + p.c)), out = new Set<string>(), used = new Set<string>();
  g.forEach((row, r) => row.forEach((_, c) => {
    const a = {r, c}, face = topOf(g, a);
    if (!face) return;
    for (const b of [{r, c: c + 1}, {r: r + 1, c}]) {
      const ka = r + ',' + c, kb = b.r + ',' + b.c;
      if (topOf(g, b) !== face || !(touched.has(ka) || touched.has(kb)) || used.has(ka) || used.has(kb)) continue;
      used.add(ka); used.add(kb); out.add(ka); out.add(kb);
    }
  }));
  return out;
}
/** Maximal row/column segments of ≥2 playable cells that have no slide run, i.e. locked rails. */
function lockedSegments(g: Cell[][], runs: Run[]): Run[] {
  const out: Run[] = [], rows = g.length, cols = rows ? g[0].length : 0;
  for (const axis of ['row', 'col'] as const) {
    const n = axis === 'row' ? rows : cols, len = axis === 'row' ? cols : rows;
    for (let i = 0; i < n; i++) {
      let cells: Pos[] = [];
      const flush = () => {
        if (cells.length > 1 && !runs.some(r => r.axis === axis && r.index === i && r.cells.some(p => same(p, cells[0])))) out.push({axis, index: i, cells});
        cells = [];
      };
      for (let j = 0; j < len; j++) {
        const p = axis === 'row' ? {r: i, c: j} : {r: j, c: i};
        if (isStack(g[p.r]?.[p.c])) cells.push(p); else flush();
      }
      flush();
    }
  }
  return out;
}

interface Layout {s: number; H: number; top: number; msgY: number; toolY: number; bx: number; by: number; cw: number; ch: number; rows: number; cols: number}
function layout(m: ViewModel, w: number, h: number): Layout {
  const s = w > 0 && Number.isFinite(w) ? w / DESIGN_W : 1;
  const H = h > 0 && Number.isFinite(h) ? h / s : 1334;
  const top = 60 / s + 14;
  const msgY = top + 142;
  const boardTop = Math.max(200, msgY + 66 + 32);
  const toolY = H - Math.max(24, 34 / s) - 118;
  const rows = m.grid.length, cols = rows ? m.grid[0].length : 0;
  const availW = DESIGN_W - SIDE * 2, availH = Math.max(0, toolY - 20 - boardTop);
  let cw = 0, ch = 0;
  if (rows && cols) {
    cw = Math.min(availW / cols, availH / rows / TILE_ASPECT, MAX_CELL_W);
    ch = cw * TILE_ASPECT;
  }
  const bx = (DESIGN_W - cw * cols) / 2, by = boardTop + Math.max(0, (availH - ch * rows) / 2);
  return {s, H, top, msgY, toolY, bx, by, cw, ch, rows, cols};
}

/* ── Tile art: ivory face over a green back, like a real tile seen slightly from above ── */
const DOTS: Record<number, number[][]> = {
  1: [[.5, .5, .3]],
  2: [[.5, .27, .17], [.5, .73, .17]],
  3: [[.25, .22, .15], [.5, .5, .15], [.75, .78, .15]],
  4: [[.29, .28, .15], [.71, .28, .15], [.29, .72, .15], [.71, .72, .15]],
  5: [[.27, .25, .14], [.73, .25, .14], [.5, .5, .14], [.27, .75, .14], [.73, .75, .14]],
  6: [[.29, .2, .13], [.71, .2, .13], [.29, .5, .13], [.71, .5, .13], [.29, .8, .13], [.71, .8, .13]],
  7: [[.24, .15, .11], [.5, .25, .11], [.76, .35, .11], [.29, .6, .11], [.71, .6, .11], [.29, .85, .11], [.71, .85, .11]],
  8: [[.3, .14, .11], [.7, .14, .11], [.3, .38, .11], [.7, .38, .11], [.3, .62, .11], [.7, .62, .11], [.3, .86, .11], [.7, .86, .11]],
  9: [[.22, .17, .11], [.5, .17, .11], [.78, .17, .11], [.22, .5, .11], [.5, .5, .11], [.78, .5, .11], [.22, .83, .11], [.5, .83, .11], [.78, .83, .11]]
};
const DOT_COLORS = [palette.blue, palette.green, palette.red];
const NUMERALS = '一二三四五六七八九';
const HONORS = ['東', '南', '西', '北', '中', '發', '白'];

export function parseFace(face: string): {suit: string; n: number} {
  const lead = /[a-z]/i.test(face[0] || '');
  return {suit: lead ? face[0] : face[1] || '', n: Number(lead ? face.slice(1) : face[0])};
}

function pip(d: Drawing, x: number, y: number, r: number, color: string): void {
  d.circle(x, y, r, color);
  d.circle(x, y, r * .62, palette.paper);
  d.circle(x, y, r * .34, color);
}
function stick(d: Drawing, x: number, y: number, len: number, w: number, color: string): void {
  d.line([[x, y - len / 2], [x, y + len / 2]], color, w);
  d.line([[x - w * .32, y], [x + w * .32, y]], palette.paper, Math.max(1, w * .22));
}
function bird(d: Drawing, x: number, y: number, w: number, h: number): void {
  const cx = x + w * .5, cy = y + h * .55;
  d.circle(cx - w * .04, cy + h * .06, w * .2, palette.green);
  d.circle(cx + w * .14, cy - h * .16, w * .12, palette.green);
  d.circle(cx + w * .17, cy - h * .18, w * .03, palette.ink);
  d.line([[cx + w * .25, cy - h * .2], [cx + w * .38, cy - h * .14], [cx + w * .25, cy - h * .1]], palette.red, Math.max(1, w * .05));
  d.line([[cx - w * .2, cy + h * .14], [cx - w * .38, cy + h * .34], [cx - w * .08, cy + h * .26]], palette.red, Math.max(1, w * .06));
  d.line([[cx - w * .16, cy], [cx - w * .3, cy - h * .16], [cx - w * .04, cy - h * .1]], palette.blue, Math.max(1, w * .05));
}
function faceArt(d: Drawing, face: string, x: number, y: number, w: number, h: number): void {
  const {suit, n} = parseFace(face);
  if (suit === 'p' && DOTS[n]) {
    if (n === 1) {
      const cx = x + w / 2, cy = y + h / 2, r = w * .38;
      d.circle(cx, cy, r, palette.green);
      d.circle(cx, cy, r * .8, palette.paper);
      d.circle(cx, cy, r * .62, palette.red);
      d.circle(cx, cy, r * .36, palette.paper);
      d.circle(cx, cy, r * .2, palette.blue);
      return;
    }
    DOTS[n].forEach(([px, py, pr], i) => pip(d, x + px * w, y + py * h, pr * w, n === 2 || n === 4 ? (i % 2 ? palette.green : palette.blue) : DOT_COLORS[i % 3]));
    return;
  }
  if (suit === 's' && DOTS[n]) {
    if (n === 1) { bird(d, x, y, w, h); return; }
    const len = h * (n > 6 ? .2 : .3), sw = w * .13;
    DOTS[n].forEach(([px, py], i) => {
      const red = (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1);
      stick(d, x + px * w, y + py * h, len, sw, red ? palette.red : palette.green);
    });
    return;
  }
  if (suit === 'm' && n >= 1 && n <= 9) {
    const a = Math.min(h * .36, w * .78), b = Math.min(h * .4, w * .82);
    d.text(NUMERALS[n - 1], x + w / 2, y + h * .06, a, palette.navy, 'center', true, w, 'serif');
    d.text('萬', x + w / 2, y + h * .5, b, palette.red, 'center', true, w, 'serif');
    return;
  }
  if (suit === 'z' && n >= 1 && n <= 7) {
    if (n === 7) {
      d.rect(x + w * .16, y + h * .18, w * .68, h * .64, w * .08, palette.clear, palette.sky, Math.max(2, w * .07));
      return;
    }
    const size = Math.min(h * .52, w * .86);
    d.text(HONORS[n - 1], x + w / 2, y + (h - size) / 2, size, n === 5 ? palette.red : n === 6 ? palette.green : palette.navy, 'center', true, w, 'serif');
    return;
  }
  const size = Math.min(h * .4, w * .6);
  d.text('?', x + w / 2, y + (h - size) / 2, size, palette.muted, 'center', true, w);
}

interface TileBox {x: number; y: number; w: number; h: number}
/** Draws a cell's stack inside its cell box and returns the top tile body. */
function drawStack(d: Drawing, stack: string[], x0: number, y0: number, cw: number, ch: number): TileBox {
  const mx = cw * .07, my = ch * .05, lift = ch * .055, visible = Math.min(stack.length, 3) - 1;
  const w = cw - mx * 2, th = ch - my * 2 - lift * 2, thick = th * .12, r = w * .16;
  const baseY = y0 + my + lift * 2;
  d.rect(x0 + mx + 2, baseY + 3, w - 2, th - 3, r, palette.shadow);
  for (let i = 0; i < visible; i++) {
    const y = baseY - i * lift;
    d.rect(x0 + mx, y, w, th, r, palette.grass, palette.grassEdge, 1.5);
  }
  const y = baseY - visible * lift;
  d.rect(x0 + mx, y, w, th, r, palette.grass, palette.grassEdge, 1.5);
  d.rect(x0 + mx, y, w, th - thick, r, palette.ivorySide);
  d.rect(x0 + mx + 1.5, y, w - 3, th - thick - 4, r * .9, palette.paper);
  d.line([[x0 + mx + r, y + 3], [x0 + mx + w - r, y + 3]], alpha(palette.white, .9), 2);
  const face = {x: x0 + mx + w * .1, y: y + th * .07, w: w * .8, h: th - thick - 4 - th * .12};
  faceArt(d, stack[stack.length - 1], face.x, face.y, face.w, face.h);
  if (stack.length > 1) {
    const bs = Math.max(18, Math.min(30, cw * .34));
    const bx = x0 + mx + w - bs * .85, by = Math.max(y0 + 1, y - bs * .25);
    d.rect(bx, by, bs * .85, bs, bs * .3, palette.orange, palette.orangeEdge, 1.5);
    d.text(String(stack.length), bx + bs * .425, by + bs * .14, bs * .72, palette.white, 'center', true, bs * .85);
  }
  return {x: x0 + mx, y, w, h: th};
}
function drawWood(d: Drawing, x0: number, y0: number, cw: number, ch: number): void {
  const m = cw * .08, x = x0 + m, y = y0 + ch * .08, w = cw - m * 2, h = ch - ch * .16;
  d.rect(x + 2, y + 4, w - 2, h - 4, w * .14, palette.shadow);
  d.rect(x, y, w, h, w * .14, palette.wood, palette.woodEdge, 2.5);
  d.line([[x + w * .18, y + h * .16], [x + w * .82, y + h * .84]], palette.woodEdge, 3.5);
  d.line([[x + w * .82, y + h * .16], [x + w * .18, y + h * .84]], palette.woodEdge, 3.5);
  for (const [px, py] of [[.18, .12], [.82, .12], [.18, .88], [.82, .88]]) d.circle(x + w * px, y + h * py, Math.max(2, w * .05), palette.woodEdge);
}

/* ── Chrome: buttons, header, message, toolbar ── */
type Tone = 'orange' | 'green' | 'blue' | 'red' | 'wood' | 'paper';
const TONES: Record<Tone, [string, string, string]> = {
  orange: [palette.orange, palette.orangeEdge, palette.white], green: [palette.green, '#24594E', palette.white],
  blue: [palette.blue, '#24475A', palette.white], red: [palette.red, '#8E3329', palette.white],
  wood: [palette.wood, palette.woodEdge, palette.ink], paper: [palette.cream, palette.wood, palette.ink]
};
class Painter {
  readonly d: Drawing; readonly hits: Hit[] = [];
  constructor(readonly s: number) { this.d = new Drawing(s); }
  button(id: string | null, x: number, y: number, w: number, h: number, label: string, tone: Tone, size = 30, sub = ''): void {
    const [face, edge, ink] = TONES[tone], depth = 7;
    this.d.rect(x, y + depth, w, h - depth, 22, edge);
    this.d.rect(x, y, w, h - depth, 22, face, edge, 2);
    this.d.line([[x + 20, y + 8], [x + w - 20, y + 8]], alpha(palette.white, .45), 3);
    const body = h - depth, ty = sub ? y + (body - size - 22) / 2 : y + (body - size) / 2;
    this.d.text(label, x + w / 2, ty, size, ink, 'center', true, w - 16);
    if (sub) this.d.text(sub, x + w / 2, ty + size + 2, 18, alpha(ink, .8), 'center', false, w - 16);
    if (id) this.hits.push({id, x: x * this.s, y: y * this.s, w: w * this.s, h: h * this.s});
  }
}
function gear(d: Drawing, cx: number, cy: number, r: number, color: string): void {
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    d.line([[cx + Math.cos(a) * r * .55, cy + Math.sin(a) * r * .55], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], color, r * .38);
  }
  d.circle(cx, cy, r * .72, color);
  d.circle(cx, cy, r * .3, palette.wood);
}
function background(d: Drawing, H: number): void {
  d.rect(0, 0, DESIGN_W, H, 0, palette.table);
  for (let y = 24; y < H; y += 32) d.line([[24, y], [726, y]], alpha(palette.woodEdge, .04), 1);
  d.line([[24, H - 16], [726, H - 16]], alpha(palette.woodEdge, .2), 1);
}
function header(p: Painter, m: ViewModel, L: Layout): void {
  const d = p.d, y = L.top;
  p.button('home', 24, y, 90, 88, '‹', 'paper', 40);
  p.button('levels', 120, y, 136, 88, `第${m.levelIndex + 1}关`, 'green', 26, '章节地图');
  p.button('help', 634, y, 92, 88, '?', 'paper', 34);
  const name = m.chapter ?? m.levelNames?.[m.levelIndex] ?? '麻将小茶馆';
  d.text(name, 442, y + 8, 33, palette.ink, 'center', true, 354, 'serif');
  d.text(`难度 ${'●'.repeat(clamp(m.difficulty ?? 1, 1, 6))}`, 442, y + 50, 20, palette.muted, 'center', false, 340);
  const left = tileTotal(m.grid);
  d.text(`剩余 ${left} / ${finite(m.total)} 张`, 30, y + 102, 23, palette.ink, 'left', true, 230);
  d.text(`${finite(m.moves)} 步  ·  三星 ≤ ${finite(m.par ?? 30)} 步`, 720, y + 102, 23, palette.ink, 'right', false, 380);
  d.rect(30, y + 133, 690, 5, 2, alpha(palette.green, .15));
  if (m.total > left) d.rect(30, y + 133, 690 * clamp(1 - left / m.total, 0, 1), 5, 2, palette.green);
}
function message(d: Drawing, m: ViewModel, L: Layout): void {
  const y = L.msgY;
  d.rect(24, y, 702, 66, 16, palette.cream);
  d.rect(24, y + 12, 4, 42, 2, palette.orange);
  const run = m.drag ? m.runs[m.drag.run] : null, step = m.drag ? Math.round(m.drag.offset) : 0;
  const preview = run && step ? `正在向${run.axis === 'row' ? step > 0 ? '右' : '左' : step > 0 ? '下' : '上'}推 ${Math.abs(step)} 格 · 松手消除亮起的对子` : m.message;
  d.paragraph(String(preview ?? ''), 44, y + 8, 662, 22, 2, palette.ink, 27);
}
function toolbar(p: Painter, m: ViewModel, L: Layout): void {
  const w = (702 - 3 * 14) / 4;
  const tools: [string, string, string, boolean][] = [
    ['hint', '提示', `免费 ${m.hintsLeft ?? 3} 次`, (m.hintsLeft ?? 3) > 0 || !!m.hint.length],
    ['shuffle', '洗牌', `免费 ${m.shufflesLeft ?? 2} 次`, (m.shufflesLeft ?? 2) > 0],
    ['undo', '撤销', '退回整步', m.canUndo !== false], ['restart', '重开', '重新发牌', true]
  ];
  p.d.text('轻点配对  /  横竖拖动整段  /  辅助最多两星', 375, L.toolY - 33, 20, palette.muted, 'center', false, 690);
  tools.forEach(([id, label, sub, enabled], i) => {
    p.button(enabled ? id : null, 24 + i * (w + 14), L.toolY, w, 100, label, enabled && i === 0 ? 'green' : 'paper', 28, enabled ? sub : '已用完');
  });
}

/* ── Board ── */
function chevron(d: Drawing, x: number, y: number, dir: 'left' | 'right' | 'up' | 'down', size: number, color: string): void {
  const a = size / 2;
  const pts = dir === 'right' ? [[x - a / 2, y - a], [x + a / 2, y], [x - a / 2, y + a]]
    : dir === 'left' ? [[x + a / 2, y - a], [x - a / 2, y], [x + a / 2, y + a]]
    : dir === 'down' ? [[x - a, y - a / 2], [x, y + a / 2], [x + a, y - a / 2]]
    : [[x - a, y + a / 2], [x, y - a / 2], [x + a, y + a / 2]];
  d.line(pts, color, 5);
}
function lockIcon(d: Drawing, x: number, y: number): void {
  d.line([[x + 5, y], [x + 12, y - 11], [x + 19, y]], palette.brassEdge, 4);
  d.rect(x, y, 24, 20, 5, palette.brass, palette.brassEdge, 2);
  d.circle(x + 12, y + 9, 3, palette.brassEdge);
}
function board(p: Painter, m: ViewModel, L: Layout): void {
  const d = p.d, {bx, by, cw, ch, rows, cols} = L;
  if (!rows || !cols) return;
  const runs = Array.isArray(m.runs) ? m.runs : [];
  const drag = m.drag && runs[m.drag.run] && Number.isFinite(m.drag.offset) ? {run: runs[m.drag.run], step: Math.round(m.drag.offset)} : null;
  const grid = drag ? rotateGrid(m.grid, drag.run, drag.step) : m.grid;
  const dragCells = new Set(drag ? drag.run.cells.map(q => q.r + ',' + q.c) : []);
  const glow = drag && drag.step % drag.run.cells.length ? wouldClear(grid, drag.run) : new Set<string>();
  const hint = m.modal === 'none' && !drag ? m.hint?.[0] : undefined;
  const hintRun = hint?.kind === 'slide' ? runs[hint.run] : undefined;
  const hintCells = new Set<string>(hint?.kind === 'match' ? [hint.a, hint.b].map(q => q.r + ',' + q.c) : hintRun ? hintRun.cells.map(q => q.r + ',' + q.c) : []);
  const selected = m.modal === 'none' && !drag ? m.selected : null;
  const selFace = selected ? topOf(grid, selected) : null;

  d.rect(bx - 17, by - 8, cw * cols + 34, ch * rows + 34, 28, alpha(palette.ink, .2));
  d.rect(bx - 16, by - 16, cw * cols + 32, ch * rows + 32, 28, '#BA9263', palette.woodEdge, 3);
  d.rect(bx - 6, by - 6, cw * cols + 12, ch * rows + 12, 20, palette.felt);
  for (const seg of lockedSegments(m.grid, runs)) {
    const a = seg.cells[0], b = seg.cells[seg.cells.length - 1];
    if (seg.axis === 'row') {
      const cy = by + (a.r + .5) * ch, x1 = bx + a.c * cw, x2 = bx + (b.c + 1) * cw;
      d.line([[x1 - 10, cy - ch * .3], [x2 + 4, cy - ch * .3]], palette.brassEdge, 3);
      d.line([[x1 - 10, cy + ch * .3], [x2 + 4, cy + ch * .3]], palette.brassEdge, 3);
      if (a.c === 0) lockIcon(d, bx - 34, cy - 6); else lockIcon(d, x1 - 26, cy - 6);
    } else {
      const cx = bx + (a.c + .5) * cw, y1 = by + a.r * ch, y2 = by + (b.r + 1) * ch;
      d.line([[cx - cw * .3, y1 - 10], [cx - cw * .3, y2 + 4]], palette.brassEdge, 3);
      d.line([[cx + cw * .3, y1 - 10], [cx + cw * .3, y2 + 4]], palette.brassEdge, 3);
      lockIcon(d, cx - 12, a.r === 0 ? by - 30 : y1 - 24);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = grid[r]?.[c], x = bx + c * cw, y = by + r * ch, k = r + ',' + c;
    if (cell === null || cell === undefined) { d.rect(x + 4, y + 4, cw - 8, ch - 8, cw * .16, palette.hole, palette.holeEdge, 2); continue; }
    if (cell === '#') { drawWood(d, x, y, cw, ch); continue; }
    d.rect(x + 3, y + 3, cw - 6, ch - 6, cw * .14, palette.slot, palette.slotEdge, 1.5);
    if (dragCells.has(k)) d.rect(x + 3, y + 3, cw - 6, ch - 6, cw * .14, alpha(palette.white, .18));
    if (hintRun && hintCells.has(k)) d.rect(x + 3, y + 3, cw - 6, ch - 6, cw * .14, alpha(palette.glow, .5));
    if (!cell.length) { d.circle(x + cw / 2, y + ch / 2, Math.max(2, cw * .05), palette.slotEdge); continue; }
    const t = drawStack(d, cell, x, y, cw, ch);
    const ring = (color: string, width: number) => d.rect(t.x - 1, t.y - 1, t.w + 2, t.h + 2, t.w * .18, palette.clear, color, width);
    if (glow.has(k)) ring(palette.gold, 5);
    if (hint?.kind === 'match' && hintCells.has(k)) ring(palette.gold, 5);
    if (selected && same(selected, {r, c})) ring(palette.orange, 6);
    else if (selFace && cell[cell.length - 1] === selFace) {
      const adjacent = Math.abs(selected!.r - r) + Math.abs(selected!.c - c) === 1;
      if (adjacent) ring(palette.goldEdge, 4);
      d.rect(t.x + t.w * .3, t.y + t.h - 9, t.w * .4, 6, 3, palette.orange);
    }
  }
  const arrowRun = hintRun ?? drag?.run;
  if (arrowRun) {
    const first = arrowRun.cells[0], last = arrowRun.cells[arrowRun.cells.length - 1], step = hint?.kind === 'slide' ? hint.step : drag?.step ?? 0;
    if (arrowRun.axis === 'row') {
      const cy = by + (first.r + .5) * ch, dir = step > 0 ? 'right' : 'left';
      chevron(d, bx + first.c * cw - 22, cy, dir, 26, palette.orange);
      chevron(d, bx + (last.c + 1) * cw + 22, cy, dir, 26, palette.orange);
    } else {
      const cx = bx + (first.c + .5) * cw, dir = step > 0 ? 'down' : 'up';
      chevron(d, cx, by + first.r * ch - 22, dir, 26, palette.orange);
      chevron(d, cx, by + (last.r + 1) * ch + 22, dir, 26, palette.orange);
    }
  }
  const fx = m.effect;
  if (fx && Array.isArray(fx.cells)) {
    const t = m.reducedMotion ? 1 : clamp(fx.progress, 0, 1);
    for (const q of fx.cells) {
      if (!Number.isInteger(q?.r) || !Number.isInteger(q?.c) || q.r < 0 || q.c < 0 || q.r >= rows || q.c >= cols) continue;
      const cx = bx + (q.c + .5) * cw, cy = by + (q.r + .5) * ch, max = Math.min(cw, ch) / 2 - 3;
      if (m.reducedMotion) { d.circle(cx, cy, max * .7, palette.clear, palette.gold, 4); continue; }
      d.circle(cx, cy, max * (.45 + .55 * t), palette.clear, alpha(palette.gold, 1 - t), 3 + 4 * (1 - t));
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + .4, r1 = max * (.3 + .4 * t), r2 = max * (.45 + .55 * t);
        d.line([[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], alpha(palette.orange, 1 - t), 4);
      }
    }
  }
}

/* ── Modals ── */
function card(p: Painter, L: Layout, height: number, title: string): number {
  const d = p.d, h = Math.min(height, L.H - 60 / L.s - 40), y = Math.max(60 / L.s + 20, (L.H - h) / 2);
  d.rect(0, 0, DESIGN_W, L.H, 0, palette.backdrop);
  d.rect(56, y + 10, 638, h, 36, alpha(palette.ink, .3));
  d.rect(56, y, 638, h, 36, palette.cream, palette.wood, 4);
  d.rect(56, y, 638, 96, 36, palette.wood);
  d.rect(56, y + 60, 638, 36, 0, palette.wood);
  d.text(title, 375, y + 26, 40, palette.white, 'center', true, 560, 'serif');
  return y + 120;
}
const CHAPTER_NAMES = ['茶馆初学', '庭院进阶', '掌柜试炼'];
function star(d: Drawing, x: number, y: number, radius: number, earned: boolean): void {
  const color = earned ? palette.goldEdge : '#B6B7A7';
  const points = Array.from({length: 11}, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .45 : radius;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  d.line(points, color, earned ? 6 : 3);
}
function home(p: Painter, m: ViewModel, L: Layout): void {
  const d = p.d, y = Math.max(L.top, (L.H - 920) / 2);
  d.text('一 方 牌 桌  ·  一 盏 清 茶', 375, y + 24, 22, palette.muted, 'center');
  d.text('麻将小茶馆', 375, y + 78, 64, palette.ink, 'center', true, 660, 'serif');
  d.text('推 一 推 ， 碰 个 对', 375, y + 164, 28, palette.muted, 'center');
  d.rect(116, y + 230, 518, 238, 44, '#BA9263', palette.woodEdge, 3);
  d.rect(128, y + 242, 494, 212, 32, palette.felt);
  drawStack(d, ['1s'], 181, y + 270, 126, 161);
  drawStack(d, ['5p'], 311, y + 260, 126, 161);
  drawStack(d, ['z5'], 441, y + 270, 126, 161);
  const cleared = Object.keys(m.stars ?? {}).length, collected = Object.values(m.stars ?? {}).reduce((a, b) => a + b, 0);
  d.text(`${cleared} 关已清台    /    ${collected} 颗茶星`, 375, y + 500, 25, palette.ink, 'center');
  p.button('continue', 96, y + 562, 558, 106, `继续 · 第 ${m.levelIndex + 1} 关`, 'green', 32, m.chapter ?? '从第一盏茶开始');
  p.button('levels', 96, y + 694, 558, 94, '三章闯关 · 18 局层层进阶', 'paper', 27);
  p.button('help', 96, y + 814, 264, 88, '玩法说明', 'paper', 26);
  p.button('settings', 390, y + 814, 264, 88, '设置', 'paper', 26);
}
function modal(p: Painter, m: ViewModel, L: Layout): void {
  const d = p.d, levels = Math.max(1, Math.floor(finite(m.levelCount ?? 18, 18)));
  switch (m.modal) {
    case 'help': {
      const y = card(p, L, 730, '推一推，碰个对');
      const lines = ['01  同牌上下左右相邻，轻点即可消除。', '02  横拖一行、竖拖一列；整段首尾循环。', '03  松手消掉发光对子，叠牌只消最上层。', '04  木桩和空洞截断轨道；金色锁轨不能推。', '05  点消 / 推动各算一步；连消只算一步。', '06  每关免费提示 3 次、洗牌 2 次，撤销不限。', '07  目标步数内、无提示洗牌清台可获三星。', '08  没有倒计时，超出目标仍可继续清台。'];
      lines.forEach((t, i) => d.text(t, 92, y + i * 52, 24, palette.ink, 'left', false, 566));
      p.button('close', 225, y + 446, 300, 100, '来一局', 'green', 32);
      return;
    }
    case 'settings': {
      const y = card(p, L, 520, '设置');
      p.button('toggle-motion', 96, y, 558, 100, `减少动态：${m.reducedMotion ? '开' : '关'}`, m.reducedMotion ? 'green' : 'paper', 30);
      p.button('toggle-vibration', 96, y + 124, 558, 100, `震动反馈：${m.vibration ? '开' : '关'}`, m.vibration ? 'green' : 'paper', 30);
      p.button('close', 225, y + 258, 300, 100, '完成', 'orange', 32);
      return;
    }
    case 'restart': {
      const y = card(p, L, 420, '重开本关？');
      d.text('这一盘会重新发牌，当前进度不保留。', 375, y + 10, 26, palette.ink, 'center', false, 560);
      p.button('close', 96, y + 90, 264, 100, '再想想', 'paper', 30);
      p.button('confirm-restart', 390, y + 90, 264, 100, '重开', 'red', 30);
      return;
    }
    case 'win': {
      const y = card(p, L, 660, '这一盏，清台了');
      const rating = m.rating ?? 3;
      for (let i = 0; i < 3; i++) star(d, 275 + i * 100, y + 46, 36, i < rating);
      d.text(`第 ${m.levelIndex + 1} 关  ·  ${finite(m.moves)} 步清台`, 375, y + 116, 30, palette.ink, 'center', true, 560);
      d.text(rating === 3 ? '不借助辅助，好一手漂亮的牌！' : `三星目标 ≤ ${m.par ?? 30} 步，且不使用提示或洗牌`, 375, y + 164, 24, palette.muted, 'center', false, 560);
      const last = m.levelIndex >= levels - 1;
      d.text(last ? '三章通关！重玩关卡，挑战全三星。' : '下一盏茶，藏着新的挑战。', 375, y + 206, 24, palette.muted, 'center', false, 560);
      p.button(last ? 'home' : 'next', 96, y + 270, 558, 100, last ? '回茶馆' : '下一关', 'green', 32);
      p.button('replay', 96, y + 400, 264, 100, '再冲三星', 'paper', 28);
      p.button('levels', 390, y + 400, 264, 100, '章节地图', 'paper', 28);
      return;
    }
    case 'levels': {
      const page = clamp(m.levelPage ?? Math.floor(m.levelIndex / 6), 0, Math.ceil(levels / 6) - 1);
      const start = page * 6, name = CHAPTER_NAMES[page] ?? '章节地图';
      const y = card(p, L, 700, name);
      d.text(`第 ${start + 1}–${Math.min(start + 6, levels)} 关  ·  逐关解锁，重玩收集茶星`, 375, y, 22, palette.muted, 'center', false, 560);
      for (let i = start; i < Math.min(start + 6, levels); i++) {
        const slot = i - start, x = 96 + slot % 2 * 294, by = y + 50 + Math.floor(slot / 2) * 130;
        const unlocked = i <= m.maxLevel, earned = m.stars?.[i] ?? 0;
        p.button(unlocked ? `level:${i}` : null, x, by, 264, 110, `${i + 1}`, unlocked ? i === m.levelIndex ? 'green' : 'paper' : 'wood', 29,
          unlocked ? earned ? `${earned} 星清台` : '待挑战' : '尚未解锁');
      }
      if (page > 0) p.button('page-prev', 96, y + 468, 170, 92, '上一章', 'paper', 24);
      p.button('close', 290, y + 468, 170, 92, '返回', 'paper', 26);
      if (page < Math.ceil(levels / 6) - 1) p.button('page-next', 484, y + 468, 170, 92, '下一章', 'paper', 24);
      return;
    }
  }
}

/** -0 survives JSON as 0, so normalise it to keep frames serialisation-stable. */
function tidy<T>(v: T): T {
  if (typeof v === 'number') return (v === 0 ? 0 : v) as unknown as T;
  if (Array.isArray(v)) return v.map(tidy) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = tidy(x);
    return out as T;
  }
  return v;
}
export function render(m: ViewModel, w: number, h: number): Frame {
  const L = layout(m, w, h), p = new Painter(L.s), open = m.modal && m.modal !== 'none' ? m.modal : 'none';
  background(p.d, L.H);
  if (open === 'home') {
    home(p, m, L);
    return tidy({width: finite(w), height: finite(h), modal: open, commands: p.d.commands, hits: p.hits,
      board: {x: 0, y: 0, cols: 0, rows: 0, cellW: 0, cellH: 0}});
  }
  const blocked = open !== 'none';
  const base = new Painter(L.s);
  header(blocked ? base : p, m, L);
  if (blocked) p.d.commands.push(...base.d.commands);
  message(p.d, m, L);
  board(p, m, L);
  if (blocked) { const t = new Painter(L.s); toolbar(t, m, L); p.d.commands.push(...t.d.commands); modal(p, m, L); }
  else toolbar(p, m, L);
  const board_: Board = {x: L.bx * L.s, y: L.by * L.s, cols: L.cols, rows: L.rows, cellW: L.cw * L.s, cellH: L.ch * L.s};
  return tidy({width: finite(w), height: finite(h), modal: open, commands: p.d.commands, hits: p.hits, board: board_});
}
export function hitTest(f: Frame, x: number, y: number): string | null {
  if (!f || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (let i = f.hits.length - 1; i >= 0; i--) {
    const h = f.hits[i];
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h.id;
  }
  return null;
}
export function cellAt(f: Frame, x: number, y: number): Pos | null {
  if (!f || f.modal !== 'none' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const b = f.board;
  if (!b.rows || !b.cols || !(b.cellW > 0) || !(b.cellH > 0)) return null;
  if (x < b.x || y < b.y || x >= b.x + b.cols * b.cellW || y >= b.y + b.rows * b.cellH) return null;
  const c = Math.min(b.cols - 1, Math.floor((x - b.x) / b.cellW)), r = Math.min(b.rows - 1, Math.floor((y - b.y) / b.cellH));
  return {r, c};
}
