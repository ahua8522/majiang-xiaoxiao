/**
 * 关卡编排工具：生成 120 关独立棋盘并逐关验证，然后把结果写回 assets/scripts/core/levels.ts。
 *
 * 用法：npm run author:levels   （会先编译核心层，再运行本脚本）
 *
 * 设计约束（改动前请先读懂）：
 *  1. 每关的牌必须落在棋盘格相反色上（Generator.locations 用二分匹配配对），
 *     所以要求「偶色格位总数 === 奇色格位总数」，否则会有牌位填不满。
 *  2. 花色种类数 faces 必须 >= 牌位数 / 4，否则 places 多于 2*faces，同样填不满。
 *  3. 总牌位上限 136，与 Session.restore 的存档校验保持一致。
 *  4. 生成后逐关跑 construct() 确认「存在已认证的清台路线」，且多组种子都成立。
 *  5. 任何两关的棋盘必须不同，重复即换扰动重试。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const {construct} = require(path.join(root, '.test/core/Generator.js'));
const {count, pairs, boardHash, isWild} = require(path.join(root, '.test/core/Rules.js'));

const TOTAL = 120;
const MAX_SLOTS = 136;
const MIN_SLOTS = 8;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ---------------------------------------------------------------------------
 * 种子冻结。
 *
 * 本工具**从不读回 levels.ts**，全靠 `i >= 常量` 的门控从关号重新推导一切。
 * 而关卡内容 = map（形状）+ seed（发牌种子）的纯函数，所以只要有人动一处门控，
 * 整张表就会静默重摇——玩家打过的第 50 关下次进去换了一副牌，切图审阅也全部作废。
 *
 * 修法不是在门控上小心翼翼地加约束，而是让种子成为**真源**：
 * `npm run author:levels` = `build:core && node tools/author-levels.cjs && build:core`，
 * 于是脚本运行时 `.test/core/levels.js` 编译自**上一次**的关卡表——它就是已钉种子的唯一出处。
 * 只有形状一模一样的关才继承旧种子（形状一变，旧种子证出来的就是另一盘）。
 * ------------------------------------------------------------------------- */
let PREV = [];
try { PREV = require(path.join(root, '.test/core/levels.js')).LEVELS; } catch { PREV = []; }

/** `--reseed` 全表重钉；`--reseed=81-96` 只重钉这个 1 基闭区间。 */
const RESEED = (() => {
  const arg = process.argv.find((v) => v === '--reseed' || v.startsWith('--reseed='));
  if (!arg) return null;
  if (arg === '--reseed') return [0, Infinity];
  const m = /^--reseed=(\d+)?(?:-(\d+))?$/.exec(arg);
  if (!m) throw new Error(`--reseed 用法：--reseed 或 --reseed=81-96（收到 ${arg}）`);
  return [m[1] ? Number(m[1]) - 1 : 0, m[2] ? Number(m[2]) : Infinity];
})();

/** 旧表里这一关钉过的种子；形状变了、或被 `--reseed` 点名了，就返回 null 让它重钉。 */
const frozenSeedOf = (i, map) => {
  const prev = PREV[i];
  if (!prev || !Number.isInteger(prev.seed)) return null;
  if (RESEED && i >= RESEED[0] && i < RESEED[1]) return null;
  return prev.map.join('|') === map.join('|') ? prev.seed : null;
};

/** 跨关累计的"引擎变化导致换盘"计数（`why` 是每关局部的，汇总要的是全局数）。 */
const DRIFT = {count: 0};
/** 扫完所有种子仍带锁轨冲突就发出去的关数（应为 0；非 0 就是离线质检没兜住）。 */
const CONFLICT = {count: 0, worst: 0, rejected: 0};
/** 因为「标了 wild 却发不出百搭」而被否掉的候选次数（说明卡的真实性质检）。 */
const WILD = {rejected: 0};

/**
 * 锁轨上的"白送对子"：两张同面牌都落在锁轨上，玩家不推也能点掉，等于开局白送进度。
 *
 * 运行时为了进关速度（实测 113ms）在"满足步数上限"时就提前返回，**不保证**把冲突搜到 0
 * ——要保它就得每次进关多花 2.3 倍时间（实测 113→261ms，真机 0.8-1.3 秒），不划算。
 * 内容既然已经预生成钉死，质量就改由**离线选种子**保证：这里多扫几颗种子，挑出
 * 发出来那盘 0 冲突的种子钉进表。运行时拿同一颗种子走同一条快路径必然复现
 * （已实测跨进程逐字节相同），所以玩家拿到的就是离线挑中的那一盘。
 */
function railConflicts(def, grid) {
  const inLock = (p) => def.lockR.includes(p.r) || def.lockC.includes(p.c);
  return pairs(grid).filter((pr) => inLock(pr.a) && inLock(pr.b)).length;
}

/**
 * 认证某个定义，返回「游戏将来真的会发的那一盘」。
 *
 * ⚠️ 必须对**最终定义**调用，不能对推导中的半成品调用：`goal` 会反灌进生成器的牌池
 * （constructOnce 把目标牌面强制排进去），`moveLimit` 会改变候选排序（rankOf 的第一键就是
 * "有没有超步数上限"）。所以拿 candidate 认证出来的盘面去钉 hash，游戏用 finalDef 一发牌
 * 就是另一盘——实测 120 关里有 15 关指纹对不上，且**全部**是带 goal 的关。
 */
function certifyDef(def, slots, seedSet) {
  let best = null;
  for (const seed of seedSet) {
    const d = construct(def, seed);
    // 任何一颗证不出满盘解 = 这个形状不可信，换下一个候选形状，不许挑着报喜
    if (!d) return {bad: 'noDeal'};
    if (count(d.grid) !== slots) return {bad: 'shortFill'};
    const conflicts = railConflicts(def, d.grid);
    if (!best || conflicts < best.conflicts || (conflicts === best.conflicts && d.solution.length < best.deal.solution.length)) {
      best = {bad: null, seed, deal: d, conflicts};
    }
    if (conflicts === 0) break;                          // 够干净就收工
    if (seed === seedSet[0]) best.cleanHead = false;     // 首选（=上表钉过的那颗）不干净
  }
  return best || {bad: 'noSeed'};
}

/** 种子尝试顺序：上表钉过的排第一（保住继承），再固定探针，最后按关号派生补足扫描数。 */
function seedOrder(i, frozen) {
  const list = [frozen, 1, 7, 20261013];
  for (let k = 0; list.length < 16; k++) list.push((0x9E3779B1 ^ Math.imul(i + 1 + k * 7919, 0x85EBCA6B)) >>> 0);
  const seen = new Set();
  return list.filter((s) => Number.isInteger(s) && s >= 0 && !seen.has(s) && seen.add(s));
}

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * 棋盘尺寸。前 100 关是「接近方形」的台阶式推进；101 关起换成**窄高盘**（行多列少）——
 * 屏幕约束下 行 ≤ 10、列 ≤ 9，所以窄高只能靠加行（8x5 / 9x5 / 10x6）。
 */
function sizeFor(i) {
  if (i >= 110) return {rows: i >= 115 ? 10 : 9, cols: i >= 115 ? 6 : 5};   // 111-120：窄高极限
  if (i >= 100) return {rows: 8, cols: 5};                                   // 101-110：窄高
  return {
    rows: clamp(3 + (i >= 9 ? 1 : 0) + (i >= 21 ? 1 : 0) + (i >= 36 ? 1 : 0) + (i >= 51 ? 1 : 0) + (i >= 66 ? 1 : 0) + (i >= 83 ? 1 : 0), 3, 8),
    cols: clamp(4 + (i >= 12 ? 1 : 0) + (i >= 21 ? 1 : 0) + (i >= 36 ? 1 : 0) + (i >= 51 ? 1 : 0) + (i >= 66 ? 1 : 0) + (i >= 83 ? 1 : 0), 4, 9)
  };
}

/** 按难度曲线铺一张地图。扰动 attempt 进随机种子，保证重试能出不同的图。 */
function buildMap(i, attempt) {
  const {rows, cols} = sizeFor(i);
  const rand = mulberry32(0x5EED + i * 7919 + attempt * 104729);
  const t = i / (TOTAL - 1);
  const p3 = i >= 58 ? 0.10 + (i - 58) / 42 * 0.24 : 0;
  const p2 = i >= 14 ? 0.16 + t * 0.44 : 0;
  const wood = i >= 2 ? Math.min(9, 1 + Math.floor(i / 12)) : 0;
  const holes = i >= 1 ? Math.min(6, 1 + Math.floor(i / 16)) : 0;

  const g = Array.from({length: rows}, () => Array.from({length: cols}, () => '1'));
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    const v = rand();
    if (p3 && v < p3) g[r][c] = '3';
    else if (v < p3 + p2) g[r][c] = '2';
  }

  const shuffled = (a) => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
  // 木桩落在靠内位置，空洞落在角与边：两者都真正截断滑轨
  const inner = shuffled(cells.filter(([r, c]) => r > 0 && c > 0 && r < rows - 1 && c < cols - 1));
  const edge = shuffled(cells.filter(([r, c]) => r === 0 || c === 0 || r === rows - 1 || c === cols - 1));
  for (const [r, c] of inner.slice(0, wood)) g[r][c] = '#';
  for (const [r, c] of edge.slice(0, holes)) g[r][c] = '.';

  return g;
}

/**
 * 修掉被障碍孤立的牌位。四邻全是木桩/空洞的牌位没有任何可配对对象，
 * 二分匹配会直接漏掉它，导致牌位填不满——这是高难度关最容易踩的坑。
 * 做法：把孤立格的任意一个障碍邻居恢复成单层牌位。
 */
function deisolate(g) {
  const rows = g.length, cols = g[0].length;
  const occ = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && g[r][c] !== '#' && g[r][c] !== '.';
  for (let pass = 0; pass < 300; pass++) {
    let fixed = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!occ(r, c)) continue;
      const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      if (nb.some(([a, b]) => occ(a, b))) continue;
      for (const [a, b] of nb) {
        if (a < 0 || b < 0 || a >= rows || b >= cols) continue;
        g[a][b] = '1'; fixed = true; break;
      }
    }
    if (!fixed) return true;
  }
  return false;
}

/** 复刻 Generator.locations 的二分匹配，返回实际能配成的对数。g 可以是字符串行或字符数组行。 */
function matchCount(g) {
  const left = [], right = [];
  g.forEach((row, r) => {
    const cells = Array.isArray(row) ? row : row.split('');
    cells.forEach((v, c) => {
      for (let d = 0; d < (Number(v) || 0); d++) ((r + c) % 2 ? right : left).push({r, c});
    });
  });
  const adj = left.map((a) => right.map((b, i) => [b, i])
    .filter(([b]) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1).map(([, i]) => i));
  const owner = new Array(right.length).fill(-1);
  const visit = (li, seen) => {
    for (const ri of adj[li]) {
      if (seen.has(ri)) continue;
      seen.add(ri);
      if (owner[ri] < 0 || visit(owner[ri], seen)) { owner[ri] = li; return true; }
    }
    return false;
  };
  let matched = 0;
  for (let i = 0; i < left.length; i++) if (visit(i, new Set())) matched++;
  return {matched, need: Math.min(left.length, right.length)};
}

/**
 * 保证这张图能「填满」：偶/奇色格位等量，且二分匹配是完美匹配。
 * 两个条件缺一都会有牌位拿不到牌（表现为棋盘上留空点）。
 * 不满足时随机把一个障碍退回单层牌位再试——最坏情况退成整块矩形，必然成立。
 */
function makeFillable(g, rand) {
  for (let tries = 0; tries < 400; tries++) {
    deisolate(g);
    if (!balance(g, rand)) return false;
    const slots = slotsOf(g);
    const {matched, need} = matchCount(g);
    if (matched === need && need * 2 === slots) return true;
    const obstacles = [];
    g.forEach((row, r) => {
      const cells = Array.isArray(row) ? row : row.split('');
      cells.forEach((v, c) => { if (v === '#' || v === '.') obstacles.push([r, c]); });
    });
    if (!obstacles.length) return false;
    const [r, c] = obstacles[Math.floor(rand() * obstacles.length)];
    g[r][c] = '1';
  }
  return false;
}

/**
 * 保证关卡带出应有的机制：第 15 关起至少一处叠牌，第 67 关起至少一处三层。
 * balance() 会在配平时把叠层降级，所以铺完必须回来补。
 * 升级必须成对做——同一轮里挑一个偶色格和一个奇色格一起升，偶奇等量才不会被打破；
 * 升完还要复验完美匹配，破了就回退换一对。
 */
function ensureMechanism(g, i, rand) {
  const need2 = i >= 14, need3 = i >= 66;
  if (!need2 && !need3) return true;
  for (let tries = 0; tries < 300; tries++) {
    const has2 = g.some((row) => row.some((v) => v === '2' || v === '3'));
    const has3 = g.some((row) => row.some((v) => v === '3'));
    if ((!need2 || has2) && (!need3 || has3)) return true;
    const even = [], odd = [];
    g.forEach((row, r) => row.forEach((v, c) => { if (v === '1') ((r + c) % 2 ? odd : even).push([r, c]); }));
    if (!even.length || !odd.length) return false;
    const a = even[Math.floor(rand() * even.length)], b = odd[Math.floor(rand() * odd.length)];
    const depth = (need3 && !has3) ? '3' : '2';
    g[a[0]][a[1]] = depth; g[b[0]][b[1]] = depth;
    const {matched, need} = matchCount(g);
    if (matched !== need) { g[a[0]][a[1]] = '1'; g[b[0]][b[1]] = '1'; }
  }
  return false;
}

/** 偶色/奇色格位必须等量，否则二分匹配会留下填不满的牌位。
 *  注意必须随机挑格子降级——固定取第一个会把损害全堆在同一行（曾经出现整行空洞）。 */
function balance(g, rand) {
  const tally = () => {
    let even = 0, odd = 0;
    g.forEach((row, r) => row.forEach((v, c) => { const n = Number(v) || 0; if ((r + c) % 2) odd += n; else even += n; }));
    return {even, odd};
  };
  for (let guard = 0; guard < 400; guard++) {
    const {even, odd} = tally();
    if (even === odd) return true;
    const heavy = even > odd ? 0 : 1;
    const cands = [];
    g.forEach((row, r) => row.forEach((v, c) => {
      if ((r + c) % 2 === heavy && (v === '3' || v === '2' || v === '1')) cands.push([r, c]);
    }));
    if (!cands.length) return false;
    const [r, c] = cands[Math.floor(rand() * cands.length)];
    const v = g[r][c];
    g[r][c] = v === '3' ? '2' : v === '2' ? '1' : '.';
  }
  return false;
}

function slotsOf(g) {
  let n = 0;
  for (const row of g) for (const v of row) n += Number(v) || 0;
  return n;
}

/** 牌位总数压到上限以内（把多余的三层降成两层）。 */
function trim(g) {
  let n = slotsOf(g);
  for (let r = 0; r < g.length && n > MAX_SLOTS; r++) for (let c = 0; c < g[r].length && n > MAX_SLOTS; c++) {
    if (g[r][c] === '3') { g[r][c] = '2'; n--; }
  }
}

/** 锁轨：第 25 关起锁一行，第 51 关加第二条锁行，第 40 关起锁列，第 87 关加第二条锁列。 */
function locksFor(i, rows, cols) {
  const lockR = [], lockC = [];
  if (i >= 24 && rows >= 4) lockR.push(Math.floor(rows / 2) - 1);
  if (i >= 50 && rows >= 6) lockR.push(rows - 3);
  if (i >= 39 && cols >= 5) lockC.push(2);
  if (i >= 86 && cols >= 7) lockC.push(cols - 3);
  return {lockR, lockC};
}

/** 冰面对子数：第 51 关起引入，随段落爬升；冰牌要消两次，等价于难度翻倍的机制。 */
function iceFor(i) {
  if (i < 50) return 0;
  if (i < 65) return 1 + (i % 2);   // 1~2 对
  if (i < 82) return 2 + (i % 3);   // 2~4 对
  if (i < 100) return 4 + (i % 3);  // 4~6 对
  return 5 + (i % 4);               // 窄高盘 5~8 对
}

/** 厚冰（两层冰）对子数：第 66 关起，每 5 关来一次。 */
function ice2For(i, ice) {
  if (i < 65 || i % 5 !== 0 || ice <= 0) return 0;
  return Math.min(ice, 1 + (i % 2));
}

/** 鞭炮对子数：第 70 关起，每 5 关来一次（只在有冰的关，鞭炮是用来破冰的）。 */
function bombsFor(i, ice) {
  if (i < 69 || i % 5 !== 4 || ice <= 0) return 0;
  return Math.min(2, 1 + (i % 2));
}

/** 限步关：第 30 关起，每 3 关一次。步数上限按参考解步数 × 系数（前松后紧）。 */
function moveLimitFor(i, par) {
  if (i < 29 || i % 3 !== 0) return 0;
  const factor = i >= 100 ? 1.2 : i >= 60 ? 1.35 : 1.5;
  return Math.max(par, Math.ceil(par * factor));
}

/** 单向轨：第 35 关起，每 4 关一次；不能与锁轨重叠（工具里断言）。 */
function oneWayFor(i, rows, cols, lockR, lockC, rand) {
  if (i < 34 || i % 4 !== 1) return [];
  const useRow = rand() < 0.5 && rows >= 4;
  if (useRow) {
    const cand = [];
    for (let r = 1; r < rows - 1; r++) if (!lockR.includes(r)) cand.push(r);
    if (!cand.length) return [];
    return [{axis: 'row', index: cand[Math.floor(rand() * cand.length)], dir: rand() < 0.5 ? 1 : -1}];
  }
  const cand = [];
  for (let c = 1; c < cols - 1; c++) if (!lockC.includes(c)) cand.push(c);
  if (!cand.length) return [];
  return [{axis: 'col', index: cand[Math.floor(rand() * cand.length)], dir: rand() < 0.5 ? 1 : -1}];
}

/** 连锁解锁：第 75 关起，每 6 关一次；挑一条不在永久锁里的轨，消掉 after 对后解锁。 */
function unlockFor(i, rows, cols, lockR, lockC, rand) {
  if (i < 74 || i % 6 !== 2) return [];
  const useRow = rand() < 0.5 && rows >= 5;
  if (useRow) {
    const cand = [];
    for (let r = 1; r < rows - 1; r++) if (!lockR.includes(r)) cand.push(r);
    if (!cand.length) return [];
    return [{axis: 'row', index: cand[Math.floor(rand() * cand.length)], after: 3 + (i % 4)}];
  }
  const cand = [];
  for (let c = 1; c < cols - 1; c++) if (!lockC.includes(c)) cand.push(c);
  if (!cand.length) return [];
  return [{axis: 'col', index: cand[Math.floor(rand() * cand.length)], after: 3 + (i % 4)}];
}

/**
 * 机制说明键：**按实际首现关卡动态标注**（写死关卡号会与配额条件错位——
 * 比如单向轨要求 i%4===1，第一个落在第 38 关而不是第 35 关）。
 */
const INTRO_RULES = [
  ['stack', (d) => d.map.some((row) => row.includes('2') || row.includes('3'))],
  ['lockRow', (d) => d.lockR.length > 0],
  ['moveLimit', (d) => !!d.moveLimit],
  ['oneWay', (d) => !!(d.oneWay && d.oneWay.length)],
  ['lockCol', (d) => d.lockC.length > 0],
  ['goal', (d) => !!d.goal],
  ['ice', (d) => !!d.ice],
  ['flower', (d) => !!d.flowers],
  ['wild', (d) => !!d.wild],
  ['stack3', (d) => d.map.some((row) => row.includes('3'))],
  ['ice2', (d) => !!d.ice2],
  ['bomb', (d) => !!d.bombs],
  ['unlock', (d) => !!(d.unlock && d.unlock.length)]
];

const built = [];
const seen = new Map();
for (let i = 0; i < TOTAL; i++) {
  const {rows, cols} = sizeFor(i);
  let def = null, par = 0, seedInherited = false;
  const why = {isolated: 0, unbalance: 0, slots: 0, duplicate: 0, noDeal: 0, shortFill: 0, mechanism: 0, unsolvable: 0, drift: 0, overLimit: 0, conflict: 0, noWild: 0};
  for (let attempt = 0; attempt < 120 && !def; attempt++) {
    const g = buildMap(i, attempt);
    const rand = mulberry32(0xFACE + i * 7919 + attempt * 104729);
    if (!makeFillable(g, rand)) { why.isolated++; continue; }
    trim(g);
    if (!makeFillable(g, rand)) { why.unbalance++; continue; }
    if (!ensureMechanism(g, i, rand)) { why.mechanism++; continue; }
    const slots = slotsOf(g);
    if (slots < MIN_SLOTS || slots > MAX_SLOTS || slots % 2) { why.slots++; continue; }
    const map = g.map((row) => row.join(''));
    const key = map.join('|');
    if (seen.has(key)) { why.duplicate++; continue; }
    const {lockR, lockC} = locksFor(i, rows, cols);
    const ice = iceFor(i);
    const oneWay = oneWayFor(i, rows, cols, lockR, lockC, rand);
    const unlock = unlockFor(i, rows, cols, lockR, lockC, rand);
    const candidate = {
      map, lockR, lockC,
      faces: clamp(Math.ceil(slots / 4), 4, 40),
      scramble: clamp(2 + Math.floor(i * 0.55), 2, 62),
      ice,
      ice2: ice2For(i, ice),
      bombs: bombsFor(i, ice),
      flowers: i >= 54,
      wild: i >= 57 && i % 8 === 3,
      oneWay, unlock
    };
    // 单向轨不能与锁轨/连锁锁重叠（同一条轨不能既锁又单向）
    if (oneWay.some((w) => (w.axis === 'row' ? lockR : lockC).includes(w.index) ||
      unlock.some((u) => u.axis === w.axis && u.index === w.index))) { why.mechanism++; continue; }
    // 阶段 1：认证「还没填 moveLimit / goal 的候选」——这两样都得先看盘面才能定，所以必须先跑一轮。
    // 但**不能**用这一轮的盘面去钉指纹：`goal` 会反灌进生成器的牌池、`moveLimit` 会改变候选排序，
    // 最终定义发出来的其实是另一盘（实测 120 关里 15 个目标关指纹全对不上）。见阶段 2。
    const frozen = frozenSeedOf(i, map);
    const first = certifyDef(candidate, slots, seedOrder(i, frozen));
    if (first.bad) {
      why.unsolvable++;
      if (first.bad === 'noDeal') why.noDeal++; else why.shortFill++;
      continue;
    }
    const deal = first.deal;
    // 限步上限的基数必须按「洗牌之后可能拿到的那些盘」取最坏，不能只看钉死的那一盘：
    // 洗牌道具走 `redeal(index, grid, seed + revision*7919)`，用的是**别的种子**、发出的是别的盘。
    // 实测教训：改成只看钉死盘之后，第 91 关上限 33 而抽样盘参考解 57——洗一次牌
    // 这关就变成"照游戏自己的提示走完也会步数用尽"，属于必输开局。
    let limitPar = deal.solution.length;
    for (let k = 0; k < 8; k++) {
      const d = construct(candidate, (20261015 + k * 7919) >>> 0);
      if (d) limitPar = Math.max(limitPar, d.solution.length);
    }
    const moveLimit = moveLimitFor(i, limitPar);
    // 目标关：目标数取「这一关实际给得出的量」——每种牌整局最多 4 张 = 2 对。
    //
    // ⚠️ 这里以前是遍历证书路线、对 `next.erased` 按牌面计数，但**每次都拿初始
    // deal.grid 调 transition、从不推进盘面**，同一个对子被反复计数，于是算出
    // 17 这种数字、再乘 0.7 写成 12，把 15 个目标关的目标全都写成够不着的值
    // （HUD 永远显示 0/N，「不必清空也能过」等于没生效）。
    // 现在直接从盘面按牌面统计可用对数；生成端（Generator.constructOnce）会把这个
    // 牌面强制放进牌池，所以它一定在盘上。
    let goal = null;
    if (i >= 44 && i % 5 === 2) {
      const tiles = new Map();
      let iceLayers = 0;
      for (const cell of deal.grid.flat()) {
        if (!Array.isArray(cell)) continue;
        for (const f of cell) {
          const base = String(f).replace(/[~*]+$/, '');
          tiles.set(base, (tiles.get(base) || 0) + 1);
          let n = 0, s = String(f);
          while (s.endsWith('~')) { s = s.slice(0, -1); n++; }
          iceLayers += n;
        }
      }
      const pick = [...tiles.entries()].sort((a, b) => b[1] - a[1])[0];
      const pairs = pick ? Math.floor(pick[1] / 2) : 0;
      // 目标至少要有 2 对才像目标；否则这一关不设目标（改走清台）
      if (pairs >= 2) goal = {kind: 'face', face: pick[0], count: Math.min(pairs, 2)};
      else if (iceLayers >= 3) goal = {kind: 'ice', count: Math.min(2, Math.max(1, Math.floor(iceLayers / 2)))};
    }
    // 阶段 2：对**最终定义**重新认证。表里那对 (seed, hash) 必须描述游戏真正会发的那一盘，
    // 否则 levels-seed 门禁拿 generate(i, seed) 重算时指纹对不上（改造前就是 15 个目标关全错）。
    const preDef = {...candidate, moveLimit, goal};
    const second = certifyDef(preDef, slots, seedOrder(i, first.seed));
    if (second.bad) {
      why.unsolvable++;
      if (second.bad === 'noDeal') why.noDeal++; else why.shortFill++;
      continue;
    }
    if (second.conflicts) {
      // 扫完 16 颗种子还挑不出 0 冲突 = 这个形状本身不适合发布（锁轨把同面牌焊在一起），
      // 换形状重来。不能退而求其次发"最不脏"的那盘：那样 0 冲突就只是一句口号，
      // 而玩家一眼就能看出"这两张锁在一起不用推就能消"。
      why.conflict++;
      CONFLICT.rejected++;
      continue;
    }
    const faceList = second.deal.grid.flat().filter(Array.isArray).flatMap((c) => c);
    if (candidate.wild && !faceList.some(isWild)) {
      // `wild: true` 原本只把百搭放进**牌池**，不保证这一盘真的发出百搭——实测 8 个百搭关里
      // 有 4 个（第 60/76/84/108 关）盘上一张都没有，可玩家照样会收到「百搭」说明卡。
      // 说明卡教一个盘上不存在的东西，比没有说明卡更糟，所以这里当不合格处理。
      why.mechanism++;
      why.noWild++; WILD.rejected++;
      continue;
    }
    const hash = boardHash(second.deal.grid);
    const finalDef = {...preDef, seed: second.seed, hash};
    if (second.conflicts) { CONFLICT.count++; CONFLICT.worst = Math.max(CONFLICT.worst, second.conflicts); }
    // 冻结的判据是指纹而不是种子号：生成器实现改一行，同一颗种子就发出另一盘。
    // 指纹不匹配 = 引擎动过 = 这些关重钉，而且必须喊出来，不许假装"沿用成功"。
    const prev = PREV[i];
    if (prev && Number.isInteger(prev.seed) && prev.hash && prev.hash !== hash) {
      why.drift++; DRIFT.count++;
      if (why.drift <= 5) console.warn(`⚠ 第 ${i + 1} 关：旧种子 ${prev.seed} 在当前引擎下发出的是另一盘（${prev.hash} → ${hash}）——这一关重钉`);
    }
    // 限步关只有一条硬要求：钉死那一盘的参考解不许超过上限。
    // 以前这里是"抽 8 颗别的种子看会不会超"——那是玩家拿 Date.now() 发牌时代的质检。
    // 内容冻结之后别的种子永远不会被用到，按它们报警只会淹没真问题（实测全是噪音）。
    if (moveLimit && second.deal.solution.length > moveLimit) {
      why.overLimit++;
      console.error(`✗ 第 ${i + 1} 关：钉死的那盘参考解 ${second.deal.solution.length} 步 > 上限 ${moveLimit}，这一盘照自己的路线都过不去`);
      continue;
    }
    def = finalDef; par = second.deal.solution.length;   // par 取最终定义那一盘：玩家实际看到的就是它
    seedInherited = frozen !== null && def.seed === frozen;
  }
  if (!def) throw new Error(`第 ${i + 1} 关（${rows}x${cols}）在 120 次尝试内没有找到可用布局，失败分布 ${JSON.stringify(why)}`);
  seen.set(def.map.join('|'), i + 1);
  built.push({i, def, rows, cols, slots: slotsOf(def.map.map((r) => r.split(''))), par, seedInherited});
}

// 说明键：第 1 关固定教学，其余按「实际首现」标注
built[0].def.intro = 'basic';
for (const [key, hit] of INTRO_RULES) {
  const first = built.find((b) => !b.def.intro && hit(b.def));
  if (first) first.def.intro = key;
}

const header = `/**
 * 关卡数据。每关一条，与生成算法完全分离——加关卡就是往 LEVELS 里加一条。
 *
 * map 每行一个字符串，字符含义：
 *   '.' 空洞（不可放牌，会截断滑轨）
 *   '#' 木桩（不可放牌，不可滑动，会截断滑轨）
 *   '1' 单层牌位
 *   '2' 双层牌位
 *   '3' 三层牌位
 *
 * lockR / lockC 是禁止滑动的行号 / 列号（0 起），锁轨上的牌只能靠点消或走另一轴。
 * faces 是本关出现的花色种类数（4~40），scramble 是开局打乱步数，越大越难。
 * ice / ice2 是冰面对子数与其中「厚冰（要碎两次）」的对子数。
 * bombs 是鞭炮对子数（配对时震碎相邻冰牌；只出现在有冰的关）。
 * flowers / wild 控制花牌入池与花牌百搭（wild 时花牌能与任意牌配对）。
 * oneWay 是单向轨（只能朝 dir 推，+1=右/下）；unlock 是连锁解锁（消够 after 对后该轨解锁）。
 * moveLimit 是步数上限（用尽未清台即失败）；goal 是目标关（达成即通关，不必清空）。
 * intro 是该机制**首次出现**时的说明键，视图据此弹「新玩法」卡片。
 *
 * 难度曲线：1-8 教学、15 关起叠层、25 关锁行、30 关起限步、35 关单向轨、40 关锁列、
 * 45 关目标关、51 关冰面、55 关花牌、57 关百搭、60 关三层、66 关厚冰、70 关鞭炮、
 * 75 关连锁解锁；101 关起换成窄高盘（8x5 / 9x5 / 10x6）拉高密度。
 *
 * 本文件由 tools/author-levels.cjs 生成，共 ${TOTAL} 关。
 * 每关都已验证：存在可清台路线、偶/奇色牌位数相等、与其它关棋盘不重复。
 * 不要手工改 map——改完必须重跑 npm run author:levels 重新校验。
 */
export interface LevelDef {
  map: string[];
  lockR: number[];
  lockC: number[];
  faces: number;
  scramble: number;
  /** 冰面对子数（冰牌要消两次：第一下碎冰）。0/缺省表示无冰面。 */
  ice?: number;
  /** 其中「厚冰」对子数（要碎两次冰，合计三次消除）。 */
  ice2?: number;
  /** 鞭炮对子数：配对时震碎相邻冰牌（只在有冰的关出现）。 */
  bombs?: number;
  /** 花牌（春夏秋冬/梅兰竹菊）是否入池。 */
  flowers?: boolean;
  /** 花牌当百搭（能与任意牌配对）。 */
  wild?: boolean;
  /** 单向轨：只能朝 dir 方向推（+1=右/下，-1=左/上）。 */
  oneWay?: {axis: 'row' | 'col'; index: number; dir: 1 | -1}[];
  /** 连锁解锁：该轨先锁住，累计消掉 after 对之后自动解锁。 */
  unlock?: {axis: 'row' | 'col'; index: number; after: number}[];
  /** 步数上限：用尽仍未清台即失败。 */
  moveLimit?: number;
  /** 目标关：不必清空，先达成目标即通关。 */
  goal?: {kind: 'face' | 'ice'; face?: string; count: number};
  /** 限时（秒）。必须由 \`par × 每步秒数\` 推出来，不许手填一个好看的数字。 */
  timeLimit?: number;
  /** 本关首次出现某机制时的说明键（视图据此弹「新玩法」卡片）。 */
  intro?: string;
  /**
   * 钉死的发牌种子。**关卡内容 = map + seed 的纯函数**，所以这一行就是这一关的本体。
   * 规矩：改了 \`map\` 必须重钉；\`map\` 没改就不许换。
   * \`npm run author:levels\` 只给没有 seed 的关补，要重钉显式用 \`--reseed[=81-96]\`。
   */
  seed: number;
  /**
   * 盘面内容指纹（\`Rules.boardHash\` 的前 8 位十六进制）。
   * 光钉 seed 挡不住"改引擎"：生成器实现变一行，同一颗种子就发出另一盘。
   * 所以真正的冻结判据是这个指纹——\`tests/levels-seed.test.cjs\` 逐关重算并比对。
   */
  hash: string;
}

/** 关卡表，共 ${TOTAL} 关。 */
export const LEVELS: LevelDef[] = [
`;

const body = built.map(({i, def, rows, cols, slots, par}) => {
  const bits = [];
  if (!Number.isInteger(def.seed)) throw new Error(`第 ${i + 1} 关没有钉种子，冻结链路断了（usedSeed 没赋值）`);
  bits.push(`seed: ${def.seed}`);
  bits.push(`hash: '${def.hash}'`);
  bits.push(`map: [${def.map.map((r) => `'${r}'`).join(', ')}]`);
  bits.push(`lockR: [${def.lockR.join(', ')}]`);
  bits.push(`lockC: [${def.lockC.join(', ')}]`);
  bits.push(`faces: ${def.faces}`);
  bits.push(`scramble: ${def.scramble}`);
  if (def.ice) bits.push(`ice: ${def.ice}`);
  if (def.ice2) bits.push(`ice2: ${def.ice2}`);
  if (def.bombs) bits.push(`bombs: ${def.bombs}`);
  if (def.flowers) bits.push('flowers: true');
  if (def.wild) bits.push('wild: true');
  if (def.oneWay && def.oneWay.length) bits.push(`oneWay: [${def.oneWay.map((w) => `{axis: '${w.axis}', index: ${w.index}, dir: ${w.dir}}`).join(', ')}]`);
  if (def.unlock && def.unlock.length) bits.push(`unlock: [${def.unlock.map((u) => `{axis: '${u.axis}', index: ${u.index}, after: ${u.after}}`).join(', ')}]`);
  if (def.moveLimit) bits.push(`moveLimit: ${def.moveLimit}`);
  if (def.timeLimit) bits.push(`timeLimit: ${def.timeLimit}`);
  if (def.goal) bits.push(`goal: {kind: '${def.goal.kind}', ${def.goal.face ? `face: '${def.goal.face}', ` : ''}count: ${def.goal.count}}`);
  if (def.intro) bits.push(`intro: '${def.intro}'`);
  const tags = [];
  if (def.ice2) tags.push(`${def.ice2} 对厚冰`);
  else if (def.ice) tags.push(`${def.ice} 对冰`);
  if (def.bombs) tags.push(`${def.bombs} 对鞭炮`);
  if (def.wild) tags.push('花牌百搭');
  if (def.oneWay && def.oneWay.length) tags.push('单向轨');
  if (def.unlock && def.unlock.length) tags.push(`连锁解锁(消${def.unlock[0].after}对)`);
  if (def.moveLimit) tags.push(`限 ${def.moveLimit} 步`);
  if (def.goal) tags.push(`目标 ${def.goal.face || '碎冰'}×${def.goal.count}`);
  const tagText = tags.length ? `${tags.join(' · ')} · ` : '';
  return `  // 第 ${i + 1} 关 · ${rows}x${cols} · ${slots} 个牌位 · ${def.faces} 种花色 · ${tagText}参考解 ${par} 步\n` +
    `  {${bits.join(', ')}},`;
}).join('\n');

const footer = `
];

export function levelAt(index: number): LevelDef {
  const i = Number.isFinite(index) ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(index))) : 0;
  return LEVELS[i];
}
`;

fs.writeFileSync(path.join(root, 'assets/scripts/core/levels.ts'), header + body + footer);

const sizes = {};
for (const b of built) { const k = `${b.rows}x${b.cols}`; sizes[k] = (sizes[k] || 0) + 1; }
console.log(`已写入 ${built.length} 关到 assets/scripts/core/levels.ts`);
console.log('尺寸分布：', Object.entries(sizes).map(([k, v]) => `${k}×${v}`).join('  '));
console.log(`牌位范围：${Math.min(...built.map((b) => b.slots))} ~ ${Math.max(...built.map((b) => b.slots))}`);
console.log(`参考解步数：${Math.min(...built.map((b) => b.par))} ~ ${Math.max(...built.map((b) => b.par))}`);
// 两个维度分开报，否则 `--reseed` 的效果看不出来：
//  · 种子继承：这一关是不是直接沿用了上表的种子（`--reseed` 会把它打断）。
//  · 指纹相同：发出来的盘面是不是同一盘。**这才是"内容冻结"的判据**——
//    手动重钉拿到的往往还是同一盘，此时种子继承=0 而指纹相同=120，内容并没有变。
const rePinned = built.filter((b) => !b.seedInherited).length;
const sameContent = built.filter((b) => PREV[b.i] && PREV[b.i].hash === b.def.hash).length;
console.log(`种子：继承 ${built.length - rePinned} 关 · 重钉 ${rePinned} 关${RESEED ? '（--reseed 点名范围内）' : ''}`);
console.log(`内容：与上表逐盘面相同 ${sameContent}/${built.length} 关${DRIFT.count ? ` · 引擎变化导致换盘 ${DRIFT.count} 关` : ''}`);
if (DRIFT.count) console.log('  ↑ 换盘说明生成器实现与上表不匹配：这批关的切图与试玩要重做，别当无事发生。');
// 发布盘面的锁轨冲突由"挑种子"保证（运行时不为它多花 2.3 倍进关时间），这里是它的账。
console.log(`锁轨冲突：因挑不出 0 冲突而换掉形状 ${CONFLICT.rejected} 次 · 带冲突发布 ${CONFLICT.count} 关${CONFLICT.count ? `（最脏 ${CONFLICT.worst} 处）` : ''}`);
console.log(`说明卡真实性：因「标了 wild 却发不出百搭」否决 ${WILD.rejected} 次`);
console.log(`冰面关：${built.filter((b) => (b.def.ice || 0) > 0).length} 关（首现第 ${built.find((b) => (b.def.ice || 0) > 0)?.i + 1 ?? '-'} 关）`);
console.log(`棋盘唯一性：${seen.size}/${TOTAL} 关各不相同`);
