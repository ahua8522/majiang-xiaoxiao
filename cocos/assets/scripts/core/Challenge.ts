/**
 * 挑战模式规则（砖了个砖式）：满盘方向的**整行/整列循环滑动**、
 * 同线同牌且中间没有别的牌即自动消除、**只接受会产生消除的移动**。
 *
 * 与主线的区别只在动作语义与配对几何：
 *  - 主线滑轨是「连续占用段」循环置换，配对要求网格相邻；
 *  - 挑战模式一条线**整行/整列**置换（空格也一起走），配对看「同线上相邻的两张占用牌」，
 *    空格不挡视线。生成器用反向构造保证每盘都有可重放的证书。
 */
import {Cell, Grid, Pos, Run, clone, count} from './Rules';

export type Axis = 'row' | 'col';
export interface Rotate {axis: Axis; index: number; step: number}
export interface CPair {a: Pos; b: Pos; face: string}
export interface RotateChange {grid: Grid; erased: CPair[]; chain: number; changed: boolean}
export interface MoveOption {action: Rotate; grid: Grid; erased: CPair[]; chain: number}

/** 挑战模式的牌池：只用 34 种基础牌面（数牌 + 字牌），每种最多两对。 */
const BASE_FACES: string[] = [];
for (let i = 1; i <= 9; i++) for (const s of ['p', 's', 'm']) BASE_FACES.push(i + s);
for (let i = 1; i <= 7; i++) BASE_FACES.push('z' + i);

export const emptyBoard = (rows: number, cols: number): Grid =>
  Array.from({length: rows}, () => Array.from({length: cols}, () => null as Cell));

export function cellFace(g: Grid, p: Pos): string | null {
  const cell = g[p.r]?.[p.c];
  return Array.isArray(cell) && cell.length ? cell[cell.length - 1] : null;
}

export const tileCount = (g: Grid): number => count(g);

/** 一整行 / 一整列的所有格子（含空格）——挑战模式的轨道就是整行整列。 */
export function lineCells(axis: Axis, index: number, rows: number, cols: number): Pos[] {
  const out: Pos[] = [];
  const n = axis === 'row' ? cols : rows;
  for (let i = 0; i < n; i++) out.push(axis === 'row' ? {r: index, c: i} : {r: i, c: index});
  return out;
}

/** 所有行 + 所有列，顺序固定：先 0..rows-1 行，再 0..cols-1 列。视图按这个下标画高亮。 */
export function linesFor(rows: number, cols: number): Run[] {
  const out: Run[] = [];
  for (let r = 0; r < rows; r++) out.push({axis: 'row', index: r, cells: lineCells('row', r, rows, cols)});
  for (let c = 0; c < cols; c++) out.push({axis: 'col', index: c, cells: lineCells('col', c, rows, cols)});
  return out;
}

/** 整条线循环平移：牌和空格一起走。`step>0` = 向右 / 向下。 */
export function rotateLine(g: Grid, axis: Axis, index: number, step: number): Grid {
  const rows = g.length, cols = g[0]?.length || 0;
  const cells = lineCells(axis, index, rows, cols), n = cells.length;
  const k = ((step % n) + n) % n;
  const out = clone(g);
  if (!k) return out;
  const vals = cells.map((p) => (Array.isArray(g[p.r][p.c]) ? (g[p.r][p.c] as string[]).slice() : g[p.r][p.c]));
  for (let i = 0; i < n; i++) {
    const to = cells[i], from = vals[(i - k + n) % n];
    out[to.r][to.c] = Array.isArray(from) ? (from as string[]).slice() : from;
  }
  return out;
}

/**
 * 同一行/列里**相邻的两张占用牌**。空格不挡视线：`prev` 跨过空格继续保留。
 * 一条线上一次只配「紧邻的占用牌」，所以 [A,.,A] 是一对，[A,.,B,.,A] 不是。
 */
export function visiblePairs(g: Grid): CPair[] {
  const out: CPair[] = [];
  const rows = g.length, cols = g[0]?.length || 0;
  for (let r = 0; r < rows; r++) {
    let prev: Pos | null = null, prevFace: string | null = null;
    for (let c = 0; c < cols; c++) {
      const face = cellFace(g, {r, c});
      if (!face) continue;
      if (prev && prevFace === face) out.push({a: prev, b: {r, c}, face});
      prev = {r, c}; prevFace = face;
    }
  }
  for (let c = 0; c < cols; c++) {
    let prev: Pos | null = null, prevFace: string | null = null;
    for (let r = 0; r < rows; r++) {
      const face = cellFace(g, {r, c});
      if (!face) continue;
      if (prev && prevFace === face) out.push({a: prev, b: {r, c}, face});
      prev = {r, c}; prevFace = face;
    }
  }
  return out;
}

function resolve(g: Grid): {grid: Grid; erased: CPair[]; chain: number} {
  const grid = clone(g), erased: CPair[] = [];
  let chain = 0;
  for (;;) {
    const pairs = visiblePairs(grid);
    if (!pairs.length) break;
    const used = new Set<string>();
    let round = 0;
    for (const p of pairs) {
      const ka = p.a.r + ',' + p.a.c, kb = p.b.r + ',' + p.b.c;
      if (used.has(ka) || used.has(kb)) continue;
      used.add(ka); used.add(kb);
      grid[p.a.r][p.a.c] = null;
      grid[p.b.r][p.b.c] = null;
      erased.push(p);
      round++;
    }
    if (!round) break;
    chain++;
  }
  return {grid, erased, chain};
}

/** 执行一次整线循环滑动。**没消掉任何牌就整步无效**（挑战模式只允许有效移动）。 */
export function applyRotate(g: Grid, action: Rotate): RotateChange {
  const rows = g.length, cols = g[0]?.length || 0;
  const inRange = action.axis === 'row' ? action.index >= 0 && action.index < rows : action.index >= 0 && action.index < cols;
  const len = action.axis === 'row' ? cols : rows;
  if (!inRange || !Number.isInteger(action.step) || action.step % len === 0) return {grid: g, erased: [], chain: 0, changed: false};
  const res = resolve(rotateLine(g, action.axis, action.index, action.step));
  if (!res.erased.length) return {grid: g, erased: [], chain: 0, changed: false};
  return {grid: res.grid, erased: res.erased, chain: res.chain, changed: true};
}

export function boardKey(g: Grid): string {
  const rows: string[] = [];
  for (const row of g) {
    const cells: string[] = [];
    for (const cell of row) cells.push(Array.isArray(cell) && cell.length ? cell[cell.length - 1] : '.');
    rows.push(cells.join(','));
  }
  return rows.join('/');
}

/** 所有会减少牌数的整线滑动；按「消得多」优先，供提示与搜索用。 */
export function legalMoves(g: Grid, cap = 0): MoveOption[] {
  const rows = g.length, cols = g[0]?.length || 0;
  const out: MoveOption[] = [], seen = new Set<string>();
  const lines: {axis: Axis; index: number; len: number}[] = [];
  for (let r = 0; r < rows; r++) lines.push({axis: 'row', index: r, len: cols});
  for (let c = 0; c < cols; c++) lines.push({axis: 'col', index: c, len: rows});
  for (const L of lines) {
    for (let step = 1; step < L.len; step++) {
      const res = applyRotate(g, {axis: L.axis, index: L.index, step});
      if (!res.changed) continue;
      const key = boardKey(res.grid);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({action: {axis: L.axis, index: L.index, step}, grid: res.grid, erased: res.erased, chain: res.chain});
      if (cap && out.length >= cap) return out;
    }
  }
  out.sort((a, b) => b.erased.length - a.erased.length || b.chain - a.chain);
  return out;
}

export interface SolveOptions {maxStates?: number; maxMs?: number}
/** 中盘偏离证书后的兜底搜索；有预算，找不到就返回 null，绝不在对局里卡住。 */
export function solve(g: Grid, options: SolveOptions = {}): Rotate[] | null {
  const maxStates = options.maxStates ?? 3000, maxMs = options.maxMs ?? 80;
  const deadline = Date.now() + maxMs;
  const dead = new Set<string>();
  let states = 0, aborted = false;
  const dfs = (board: Grid): Rotate[] | null => {
    if (!tileCount(board)) return [];
    const key = boardKey(board);
    if (dead.has(key) || aborted) return null;
    if (++states > maxStates || (states & 31) === 0 && Date.now() > deadline) {aborted = true; return null;}
    for (const m of legalMoves(board)) {
      const sub = dfs(m.grid);
      if (sub) return [m.action].concat(sub);
    }
    dead.add(key);
    return null;
  };
  return dfs(g);
}

/* ── 生成 ────────────────────────────────────────────────── */

export interface ChallengeDeal {grid: Grid; solution: Rotate[]; rows: number; cols: number; pairs: number}
export interface BuildInput {rows: number; cols: number; faces: string[]; minPairs?: number; maxTries?: number}
export interface GenOptions {maxAttempts?: number}

function mulberry(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(a: T[], rnd: () => number): T[] => {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
};

/**
 * 反向构造：从空盘开始，一次加一对牌，并保证「把这条线滑回去，正好只消掉这一对」。
 *
 * 关键在于配对发生在**与滑动方向垂直的那条线**上：横着滑一行，只能让这行的牌和别的行的
 * 同牌在同一列里对上。所以每一步固定三件事——滑动线 `L`、步数 `k`、被消的那一对
 * 在滑动**之后**的位置 `T`（在 L 上）与 `U`（在另一条线上、与 T 同列/同行且中间无牌）。
 * 最后用 `boardKey` 强校验：滑完之后除了这一对，别的牌一张没动、也没顺手消掉别人的对子。
 */
export function buildChallenge(input: BuildInput, seed: number): {grid: Grid; solution: Rotate[]; rows: number; cols: number} | null {
  const rnd = mulberry(seed);
  const rows = input.rows, cols = input.cols;
  const grid = emptyBoard(rows, cols);
  const solution: Rotate[] = [];
  const faces = input.faces.slice();
  const minPairs = input.minPairs ?? 0;
  const maxTries = input.maxTries ?? 4000;

  const step = (face: string): Rotate | null => {
    for (let t = 0; t < maxTries; t++) {
      const axis: Axis = rnd() < .5 ? 'row' : 'col';
      if (axis === 'row') {
        const rt = Math.floor(rnd() * rows), ct = Math.floor(rnd() * cols), ru = Math.floor(rnd() * rows);
        if (ru === rt) continue;
        if (cellFace(grid, {r: rt, c: ct}) || cellFace(grid, {r: ru, c: ct})) continue;
        let clear = true;
        for (let r = Math.min(rt, ru) + 1; r < Math.max(rt, ru); r++) if (cellFace(grid, {r, c: ct})) {clear = false; break;}
        if (!clear) continue;
        const k = 1 + Math.floor(rnd() * (cols - 1));
        const cp = ((ct - k) % cols + cols) % cols;
        const R = rotateLine(grid, 'row', rt, -k);
        if (cellFace(R, {r: rt, c: cp})) continue;
        const next = clone(R);
        next[rt][cp] = [face];
        next[ru][ct] = [face];
        if (visiblePairs(next).length) continue;
        const action: Rotate = {axis: 'row', index: rt, step: k};
        const res = applyRotate(next, action);
        if (!res.changed || res.erased.length !== 1) continue;
        const er = res.erased[0];
        const hit = (er.a.r === rt && er.a.c === ct && er.b.r === ru && er.b.c === ct)
          || (er.a.r === ru && er.a.c === ct && er.b.r === rt && er.b.c === ct);
        if (!hit || boardKey(res.grid) !== boardKey(grid)) continue;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = next[r][c];
        return action;
      }
      const ct = Math.floor(rnd() * cols), rt = Math.floor(rnd() * rows), cu = Math.floor(rnd() * cols);
      if (cu === ct) continue;
      if (cellFace(grid, {r: rt, c: ct}) || cellFace(grid, {r: rt, c: cu})) continue;
      let clear = true;
      for (let c = Math.min(ct, cu) + 1; c < Math.max(ct, cu); c++) if (cellFace(grid, {r: rt, c})) {clear = false; break;}
      if (!clear) continue;
      const k = 1 + Math.floor(rnd() * (rows - 1));
      const rp = ((rt - k) % rows + rows) % rows;
      const R = rotateLine(grid, 'col', ct, -k);
      if (cellFace(R, {r: rp, c: ct})) continue;
      const next = clone(R);
      next[rp][ct] = [face];
      next[rt][cu] = [face];
      if (visiblePairs(next).length) continue;
      const action: Rotate = {axis: 'col', index: ct, step: k};
      const res = applyRotate(next, action);
      if (!res.changed || res.erased.length !== 1) continue;
      const er = res.erased[0];
      const hit = (er.a.r === rt && er.a.c === ct && er.b.r === rt && er.b.c === cu)
        || (er.a.r === rt && er.a.c === cu && er.b.r === rt && er.b.c === ct);
      if (!hit || boardKey(res.grid) !== boardKey(grid)) continue;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = next[r][c];
      return action;
    }
    return null;
  };

  let added = 0;
  for (const face of faces) {
    const action = step(face);
    if (!action) break;
    solution.unshift(action);            // 最后加的那一对最先被消掉
    added++;
  }
  if (added < minPairs) return null;
  let g = clone(grid);
  for (const a of solution) {
    const res = applyRotate(g, a);
    if (!res.changed) return null;
    g = res.grid;
  }
  if (tileCount(g) !== 0) return null;
  return {grid, solution, rows, cols};
}

/**
 * 难度曲线：第 1 盘留个 5×5 小盘上手；从第 2 盘起直接就是原版那种 14 行 × 10 列大盘，
 * 盘面尺寸不再随关数变，往后只涨占用率（60% → 83%，84 → 116 张）和牌种。
 *
 * 满到 140 张时反向构造在最后十几对会卡住（实测），所以后期收在 58 对。
 */
export function shapeFor(level: number): {rows: number; cols: number; pairs: number} {
  const lv = Math.max(1, Math.floor(level));
  if (lv === 1) return {rows: 5, cols: 5, pairs: 5};
  const t = Math.min(1, (lv - 2) / 10);
  const occ = 0.6 + 0.23 * t;
  const pairs = Math.max(8, Math.min(58, Math.round(14 * 10 * occ / 2)));
  return {rows: 14, cols: 10, pairs};
}

function faceList(pairs: number, rnd: () => number): string[] {
  const poolSize = Math.min(BASE_FACES.length, Math.max(6, pairs));
  const pool = shuffle(BASE_FACES, rnd).slice(0, poolSize);
  const out: string[] = [];
  // 每种面最多两对（每面 ≤4 张，和主线的牌桌不变量一致）；面种越多越难找对。
  for (let i = 0; i < pairs; i++) out.push(pool[i % pool.length]);
  return out;
}

/** 运行时出盘：纯构造、不搜索。实测 14×10/58 对约 4ms。 */
export function generateChallenge(level: number, seed: number, options: GenOptions = {}): ChallengeDeal {
  const shape = shapeFor(level);
  const attempts = options.maxAttempts ?? 40;
  const rnd = mulberry(seed ^ Math.imul(level, 0x9e3779b9));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const pairs = Math.max(3, shape.pairs - (attempt >= attempts - 8 ? 2 : 0));
    const faces = faceList(pairs, rnd);
    const built = buildChallenge({rows: shape.rows, cols: shape.cols, faces, minPairs: pairs}, (seed + Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
    if (built) return {grid: built.grid, solution: built.solution, rows: shape.rows, cols: shape.cols, pairs: built.solution.length};
  }
  // 兜底：5×5 上一对牌，横滑一行必然对上（保证永远能开局）。
  const grid = emptyBoard(5, 5);
  grid[0][4] = ['1p'];
  grid[1][0] = ['1p'];
  return {grid, solution: [{axis: 'row', index: 0, step: 1}], rows: 5, cols: 5, pairs: 1};
}

/** 从当前盘面取出成对的牌面（洗牌/救援用）。牌面计数必须是偶数。 */
export function facePairs(g: Grid): string[] | null {
  const freq = new Map<string, number>();
  for (const row of g) for (const cell of row) {
    if (!Array.isArray(cell) || !cell.length) continue;
    const f = cell[cell.length - 1];
    freq.set(f, (freq.get(f) || 0) + 1);
  }
  const out: string[] = [];
  for (const [f, n] of freq) {
    if (n % 2) return null;
    for (let i = 0; i < n / 2; i++) out.push(f);
  }
  return out;
}

/**
 * 重排：牌种与张数必须守恒，所以一律走反向构造（`minPairs` 等于全部牌对，
 * 少一对就是偷偷删牌）。不做「原位换牌面 + 现场搜索」——那条路在大盘上要么搜不出来，
 * 要么一次点洗牌卡几百毫秒，玩家是按下去等着的。
 */
export function reshuffleChallenge(g: Grid, seed: number): ChallengeDeal | null {
  const faces = facePairs(g);
  if (!faces) return null;
  const rows = g.length, cols = g[0]?.length || 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const built = buildChallenge({rows, cols, faces, minPairs: faces.length}, (seed + Math.imul(attempt + 1, 0xc2b2ae35)) >>> 0);
    if (built) return {grid: built.grid, solution: built.solution, rows, cols, pairs: faces.length};
  }
  return null;
}

/** 点击看同款：返回同牌面的所有位置。 */
export function sameFaceCells(g: Grid, p: Pos): Pos[] {
  const face = cellFace(g, p);
  if (!face) return [];
  const out: Pos[] = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r]?.length || 0); c++) {
    if (cellFace(g, {r, c}) === face) out.push({r, c});
  }
  return out;
}
