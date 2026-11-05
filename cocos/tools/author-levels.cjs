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
const {count, pairs, boardHash, isWild, pairable, sameFacePairs, liveCount} = require(path.join(root, '.test/core/Rules.js'));
const {stateLegal} = require(path.join(root, '.test/core/Generator.js'));

const TOTAL = 224;   // 14 章 × 16 关，见下面 CHAPTERS
/** 调试用：`--limit=40` 只生成前 40 关，且绝不写 levels.ts（试错从十几分钟降到十几秒）。 */
const LIMIT = (() => {const a = process.argv.find((v) => /^--limit=[0-9]+$/.test(v));return a ? Math.min(TOTAL, Number(a.split('=')[1])) : TOTAL;})();
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
const DEBUG_WHY = process.argv.includes('--why');
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
function certifyDef(def, slots, seedSet, freeTarget = 0) {
  let best = null, staleHead = false;
  for (const seed of seedSet) {
    const d = construct(def, seed);
    // 首颗是"上表钉过的种子"：它证不出解**不代表形状不可信**，只代表参数变过
    // （章节表一改，faces/ice/scramble 全跟着变，旧种子自然发不出可证的盘）。
    // 这种情况跳过它、继续往下探；以前这里有"退回固定种子"的兜底，重构成
    // certifyDef 时被删掉了，结果 224 关跑到第 194 关 120 次全灭在 noDeal 上。
    if (!d || count(d.grid) !== slots) {
      if (seed === seedSet[0] && seed === def.__frozen) { staleHead = true; continue; }
      return {bad: d ? 'shortFill' : 'noDeal'};
    }
    const conflicts = railConflicts(def, d.grid);
    // 字典序：锁轨 0 冲突 → 开局白送对子尽量小 → 参考解尽量短。
    // 以前只按冲突排，白送压根没进评分：16 颗种子里明明有更干净的盘，却挑了脏的那颗
    // （实测第 58 关因此 108/120 次栽在 free 上）。
    const freePairs = sameFacePairs(d.grid, def.dialect).length;
    const better = !best || conflicts < best.conflicts
      || (conflicts === best.conflicts && freePairs < best.freePairs)
      || (conflicts === best.conflicts && freePairs === best.freePairs && d.solution.length < best.deal.solution.length);
    if (better) best = {bad: null, seed, deal: d, conflicts, freePairs};
    if (conflicts === 0 && best.freePairs <= freeTarget) break;   // 两项都达标就收工
  }
  return best ? Object.assign(best, {staleHead}) : {bad: 'noSeed'};
}

/** 种子尝试顺序：上表钉过的排第一（保住继承），再固定探针，最后按关号派生补足扫描数。 */
function seedOrder(i, frozen) {
  const list = [frozen, 1, 7, 20261013];
  for (let k = 0; list.length < 24; k++) list.push((0x9E3779B1 ^ Math.imul(i + 1 + k * 7919, 0x85EBCA6B)) >>> 0);
  const seen = new Set();
  return list.filter((s) => Number.isInteger(s) && s >= 0 && !seen.has(s) && seen.add(s));
}

/**
 * 14 章 × 16 关的参数表。取代以前散在各处的 `i >= 常量` 门控——那些门控就是难度退坡的温床：
 * 改一个阈值就会连带把别的轴的取值一起挪走，而没人能一眼看出挪了什么。
 *
 * 字段：
 *  name   章名（只给星图与汇总用；关卡内文案一律白话）
 *  size   [起始rows, 起始cols, 结束rows, 结束cols]，章内按 k 内插
 *  slots  牌位区间（**只决定玩多久，不用于调难度**）
 *  faces  花色/有效面区间（**这才是难度旋钮**，与 slots 解耦）
 *  free   开局白送对子上限
 *  moveK  限步系数（par × moveK）；null = 该章大部分关不限步，只有 k>=8 的紧局限
 *  timeK  每步秒数（timeLimit = par × timeK）；null = 该章不限时
 *  mech   本章允许出现的旧机制（配额与首见都按它来）
 *  dialect/collect/flowers/wild 方言与牌面策略
 *  parMax 本章参考解上限（步）。验收线第 2 条"单关 4-7 分钟"的代码化：超线就丢掉这盘
 *          重新找，而不是放宽阈值。按每步 4 秒粗算，105 步约 7 分钟。
 *  k      章内位序约定：0 首见、8 招牌、13 变体、15 章末（这 4 关是"钉审"位）
 */
const CHAPTERS = [
  {name:'推与点',     size:[3,4,5,6],  slots:[8,22],  faces:[4,6],   free:3, moveK:null, timeK:null, mech:['hole','wood','stack'], parMax:10},
  {name:'钉住',       size:[5,6,6,7],  slots:[22,32], faces:[6,9],   free:3, moveK:1.8,  timeK:null, mech:['hole','wood','stack','stack3','lockR','lockC'], parMax:20},
  {name:'方向与链条', size:[6,7,6,7],  slots:[32,40], faces:[9,12],  free:2, moveK:1.7,  timeK:null, mech:['wood','stack','stack3','lockR','lockC','oneWay','unlock','move'], parMax:30},
  {name:'冰封',       size:[6,7,7,8],  slots:[40,48], faces:[12,15], free:2, moveK:1.6,  timeK:null, mech:['wood','stack','lockR','lockC','oneWay','ice','ice2','bomb'], parMax:40},
  {name:'订单',       size:[7,8,7,8],  slots:[48,54], faces:[15,18], free:1, moveK:1.55, timeK:3.0,  mech:['stack','lockR','lockC','unlock','ice','goal','flower','wild','move'], parMax:50},
  {name:'将将胡',     size:[7,8,8,9],  slots:[54,60], faces:[8,9],   free:1, moveK:1.5,  timeK:null, mech:['stack','lockR','lockC','oneWay','ice'], dialect:{ranks:[2,5,8]}, parMax:60},
  {name:'断门',       size:[8,9,8,9],  slots:[56,62], faces:[18,22], free:1, moveK:1.5,  timeK:null, mech:['stack','lockC','unlock','ice','goal'], dialect:{noSlideSuit:'auto'}, parMax:60},
  {name:'幺九',       size:[8,9,8,9],  slots:[58,64], faces:[13,13], free:1, moveK:1.45, timeK:2.8,  mech:['stack3','lockR','oneWay','unlock'], dialect:{ranks:[1,9],honors:true}, parMax:60},
  {name:'清一色',     size:[8,9,8,9],  slots:[60,66], faces:[9,9],   free:1, moveK:1.45, timeK:null, mech:['stack','lockC','ice','ice2'], dialect:{suit:'auto'}, parMax:65},
  {name:'八花齐',     size:[8,9,9,9],  slots:[62,68], faces:[22,28], free:1, moveK:1.4,  timeK:2.6,  mech:['lockR','oneWay','stack','flower'], collect:['f1','f2','f3','f4','f5','f6','f7','f8'], parMax:70},
  {name:'三元齐',     size:[9,9,9,9],  slots:[64,70], faces:[24,30], free:0, moveK:1.35, timeK:null, mech:['unlock','ice','lockC','stack3'], collect:['z5','z6','z7'], parMax:75},
  {name:'清龙',       size:[9,9,9,9],  slots:[66,72], faces:[26,32], free:0, moveK:1.35, timeK:2.4,  mech:['stack3','move','lockR','oneWay'], collectBySuit:true, parMax:80},
  {name:'双方言',     size:[9,9,10,9], slots:[66,72], faces:[24,32], free:0, moveK:1.3,  timeK:2.3,  mech:['ice','lockC','unlock','stack','goal'], mixDialect:true, parMax:90},
  {name:'终章',       size:[10,9,10,9],slots:[68,74], faces:[28,38], free:0, moveK:1.25, timeK:2.1,  mech:['all'], mixDialect:true, parMax:105},
];
const CHAPTER_LEN = 16;
/** 关号 → {章, 章号, 章内位序 k}。 */
function chapterOf(i) {
  const ci = Math.min(Math.floor(i / CHAPTER_LEN), CHAPTERS.length - 1);
  return {ch: CHAPTERS[ci], ci, k: i % CHAPTER_LEN};
}
/** 章内线性内插：k=0 取区间下沿，k=15 取上沿。 */
function lerp(range, k) { return Math.round(range[0] + (range[1] - range[0]) * (k / (CHAPTER_LEN - 1))); }
const hasMech = (ch, m) => ch.mech.includes('all') || ch.mech.includes(m);

/**
 * 本章在这关该用哪种方言。`auto` 的门/花色由 rand 挑，保证同一 (i, attempt) 可复现。
 * 每章至少 12 关带方言，由 levels-meta 的配额测试守住（"名义上有、实际没用上"是红线）。
 */
/** 本章在这档 faces 下真正能给出的有效面种类数（方言会砍掉一部分）。 */
function candidatePoolSize(ch, f, dialect) {
  // 必须用**这一关真正拿到的方言**算，不能拿章节的方言配置猜：混合章奇数关压根没方言，
  // 按方言算会把 faces 从 25 压到 9，9 种面填不了 33 对 → construct 全灭（实测第 194 关）。
  const d = dialect === undefined ? undefined : dialect;
  const all = 34 + (ch.mech.includes('flower') || ch.collect || ch.collectBySuit ? 8 : 0);
  if (!d) return all;
  const suits = ['p', 's', 'm'];
  let live = 0;
  if (d.ranks) live = d.ranks.length * 3 + (d.honors ? 7 : 0);
  else if (d.suit && d.suit !== 'auto') live = 9;
  else if (d.noSlideSuit) live = all - 9;          // 缺一门：那门还能点消，仍算能配
  else live = all;
  return Math.max(3, Math.min(all, live));
}

function chapterDialect(ch, k, rand) {
  let base = null;
  if (ch.dialect) base = ch.dialect;
  else if (ch.mixDialect) {
    // 混合章只有一半的关绑方言：白名单天然把有效面砍到 6-13 种，章章都砍等于把
    // "花色数"这个主难度旋钮拧回去——那正是 101-120 退坡的成因（实测终章塌到 9 种）。
    // 奇数关走"纯高压清台"（花色按表走高），偶数关走方言。
    if (k % 2 !== 0) return undefined;
    const menu = [{ranks: [2, 5, 8]}, {ranks: [1, 9], honors: true}, {suit: 'auto'}, {noSlideSuit: 'auto'}];
    base = menu[Math.floor(rand() * menu.length)];
  }
  if (!base) return undefined;
  const d = Object.assign({}, base);
  const suits = ['p', 's', 'm'];
  if (d.suit === 'auto') d.suit = suits[Math.floor(rand() * 3)]; else delete d.suit;
  if (d.noSlideSuit === 'auto') d.noSlideSuit = suits[Math.floor(rand() * 3)]; else delete d.noSlideSuit;
  return d;
}

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * 棋盘尺寸。前 100 关是「接近方形」的台阶式推进；101 关起换成**窄高盘**（行多列少）——
 * 屏幕约束下 行 ≤ 10、列 ≤ 9，所以窄高只能靠加行（8x5 / 9x5 / 10x6）。
 */
function sizeFor(i) {
  const {ch, k} = chapterOf(i);
  const [r0, c0, r1, c1] = ch.size;
  // 屏幕约束：行 ≤ 10、列 ≤ 9（再大就超出牌桌可用高度）
  return {rows: clamp(lerp([r0, r1], k), 3, 10), cols: clamp(lerp([c0, c1], k), 4, 9)};
}

/** 按难度曲线铺一张地图。扰动 attempt 进随机种子，保证重试能出不同的图。 */
function buildMap(i, attempt) {
  const {rows, cols} = sizeFor(i);
  const {ch, k} = chapterOf(i);
  const rand = mulberry32(0x5EED + i * 7919 + attempt * 104729);
  const t = k / (CHAPTER_LEN - 1);
  // 叠层由章节决定要不要出现（三层是第四章之后的弹药）
  const p3 = hasMech(ch, 'stack3') ? 0.06 + t * 0.20 : 0;
  const p2 = hasMech(ch, 'stack') ? 0.14 + t * 0.34 : 0;
  // 空洞与木桩反过来：全程都撒。它们是"背景词汇"而不是考点（现表覆盖率 99% / 78%），
  // 一旦按章开关，后半程的盘面会集体变成没有缺口的矩形，滑轨手感一眼就雷同。
  const wood = i >= 2 ? Math.min(9, 1 + Math.floor(i / 16)) : 0;
  const holes = i >= 1 ? Math.min(6, 1 + Math.floor(i / 22)) : 0;

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
  const {ch} = chapterOf(i);
  const need2 = hasMech(ch, 'stack') || hasMech(ch, 'stack3'), need3 = hasMech(ch, 'stack3');
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
/**
 * 把牌位削到目标附近：先三→二，再二→一，从棋盘下半部分开始动（上半盘留给机制位）。
 * 以前只削到全局上限 136，等于牌位完全由形状随机决定——而牌位决定"这一关玩多久"，
 * 没有目标值就没法把每章的单关时长压进 4-7 分钟那条硬线。
 */
function trim(g, targetSlots) {
  const cap = Math.min(targetSlots || MAX_SLOTS, MAX_SLOTS);
  const rows = g.length, cols = g[0].length;
  const holds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && '123'.includes(g[r][c]);
  let n = slotsOf(g);
  // 1) 先削层数（3→2、2→1）。必须**两侧轮流削**：`balance()` 比的是"偶色层数和 === 奇色层数和"，
  //    从右下角一路削会让加权差单边累积，之后 balance() 只能靠删格子找平——
  //    实测目标 27 的盘被删到 22，整关白拒 120 次。轮流削把差值锁在原地。
  for (let pass = 0; pass < 2 && n > cap; pass++) {
    let turn = 0, stuck = 0;
    while (n > cap && stuck < 2) {                  // 连续两侧都动不了才算削完
      let moved = false;
      for (let r = rows - 1; r >= 0 && !moved; r--) for (let c = cols - 1; c >= 0 && !moved; c--) {
        if ((r + c) % 2 !== turn) continue;
        const v = g[r][c];
        if (pass === 0 && v === '3') { g[r][c] = '2'; n--; moved = true; }
        else if (pass === 1 && v === '2') { g[r][c] = '1'; n--; moved = true; }
      }
      stuck = moved ? 0 : stuck + 1;
      turn ^= 1;
    }
  }
  /** 打这个洞之后，会不会让某个邻居变成"四边全堵"的孤立牌位（孤立=匹配不上=填不满）。 */
  const isolates = (r, c) => {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (!holds(nr, nc)) continue;
      const free = [[nr + 1, nc], [nr - 1, nc], [nr, nc + 1], [nr, nc - 1]]
        .filter(([ar, ac]) => (ar === r && ac === c) || holds(ar, ac)).length;
      if (free <= 1) return true;                 // 打完洞后它只剩一条出路（含被洞堵住的情况）
    }
    return false;
  };
  // 2) 层数削到底仍然超标 → 打洞。但必须**成对**打（偶色一格 + 奇色一格）：
  //    单侧删格子会破坏"偶色格数 === 奇色格数"，紧接着 makeFillable 只能继续删格子来找平，
  //    实测就是它把牌位从目标 33 拖到 28（连续打洞、奇偶失衡），整关 120 次全拒在 slots。
  const cand = (wantOdd) => {
    const out = [];
    for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
      if (g[r][c] !== '1') continue;
      if (((r + c) % 2 === 1) !== wantOdd) continue;
      out.push([r, c]);
    }
    // 优先打"本来就贴着障碍"的格子：它少一个邻居，最不容易把别人孤立掉
    return out.sort((a2, b2) => (nearObstacle(b2) - nearObstacle(a2)));
  };
  const nearObstacle = ([r, c]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dr, dc]) => r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols
      && !holds(r + dr, c + dc)).length;
  const budget = Math.floor(rows * cols * 0.28);            // 空洞最多占 28%，再多盘面就成筛子
  let punched = 0, even = cand(false), odd = cand(true), ie = 0, io2 = 0;
  while (n > cap && punched + 1 < budget) {
    while (ie < even.length && isolates(even[ie][0], even[ie][1])) ie++;
    while (io2 < odd.length && isolates(odd[io2][0], odd[io2][1])) io2++;
    if (ie >= even.length || io2 >= odd.length) break;      // 凑不出成对的一偶一奇就不打了
    const [er, ec] = even[ie++], [or, oc] = odd[io2++];
    g[er][ec] = '.'; g[or][oc] = '.'; n -= 2; punched += 2;
  }
  // 3) 牌位必须成双：发牌是成对放的。前面每次成对打洞扣 2，层数每削一次扣 1，
  //    所以这里可能剩一个奇数尾巴——再削一层抹平。
  if (n % 2) {
    outer: for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
      if (g[r][c] === '3') { g[r][c] = '2'; n--; break outer; }
      if (g[r][c] === '2') { g[r][c] = '1'; n--; break outer; }
    }
  }
  return n;
}

/** 锁轨：第 25 关起锁一行，第 51 关加第二条锁行，第 40 关起锁列，第 87 关加第二条锁列。 */
function locksFor(i, rows, cols) {
  const {ch, ci, k} = chapterOf(i);
  const lockR = [], lockC = [];
  if (hasMech(ch, 'lockR') && rows >= 4) lockR.push(Math.floor(rows / 2) - 1);
  if (hasMech(ch, 'lockR') && (k >= 8 || ci >= 6) && rows >= 6) lockR.push(rows - 3);
  if (hasMech(ch, 'lockC') && cols >= 5) lockC.push(2);
  if (hasMech(ch, 'lockC') && (k >= 10 || ci >= 8) && cols >= 7) lockC.push(cols - 3);
  return {lockR, lockC};
}

/** 冰面对子数：第 51 关起引入，随段落爬升；冰牌要消两次，等价于难度翻倍的机制。 */
function iceFor(i) {
  const {ch, ci, k} = chapterOf(i);
  if (!hasMech(ch, 'ice')) return 0;
  // 冰的对数按章号往后爬，不再用关号分段——分段计数正是上次退坡的写法。
  const base = Math.min(6, 1 + Math.max(0, ci - 3) + (k % 2));
  return k === 0 ? Math.max(1, base - 1) : base;
}

/** 厚冰（两层冰）对子数：第 66 关起，每 5 关来一次。 */
function ice2For(i, ice) {
  const {ch, k} = chapterOf(i);
  if (!hasMech(ch, 'ice2') || k % 5 !== 0 || ice <= 0) return 0;
  return Math.min(ice, 1 + (k % 2));
}

/** 鞭炮对子数：第 70 关起，每 5 关来一次（只在有冰的关，鞭炮是用来破冰的）。 */
function bombsFor(i, ice) {
  const {ch, k} = chapterOf(i);
  if (!hasMech(ch, 'bomb') || k % 5 !== 4 || ice <= 0) return 0;
  return Math.min(2, 1 + (k % 2));
}

/** 限步关：第 30 关起，每 3 关一次。步数上限按参考解步数 × 系数（前松后紧）。 */
function moveLimitFor(i, par) {
  const {ch, k} = chapterOf(i);
  // 第一章不设限步：新玩家在学语法时不该被步数催。之后每章从 k>=4 起收紧，章末最紧。
  // 限步是"关卡属性"，不是模式——所以它跟着章节走，而不是跟着关号同余。
  if (!ch.moveK || k < 4) return 0;
  const factor = ch.moveK * (k >= 13 ? 0.94 : 1);
  return Math.max(par, Math.ceil(par * factor));
}

/** 单向轨：第 35 关起，每 4 关一次；不能与锁轨重叠（工具里断言）。 */
function oneWayFor(i, rows, cols, lockR, lockC, rand) {
  const {ch, k} = chapterOf(i);
  if (!hasMech(ch, 'oneWay') || k % 4 !== 1) return [];
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
  const {ch, k} = chapterOf(i);
  if (!hasMech(ch, 'unlock') || k % 6 !== 2) return [];
  const useRow = rand() < 0.5 && rows >= 5;
  if (useRow) {
    const cand = [];
    for (let r = 1; r < rows - 1; r++) if (!lockR.includes(r)) cand.push(r);
    if (!cand.length) return [];
    return [{axis: 'row', index: cand[Math.floor(rand() * cand.length)], after: 3 + (k % 4)}];
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
  ['unlock', (d) => !!(d.unlock && d.unlock.length)],
  // 方言首见弹卡：键名与 view/TIP_CONTENT 对齐，白话文案写在卡片里，章名只用于星图标题
  ['only258', (d) => !!(d.dialect && d.dialect.ranks && d.dialect.ranks.join() === '2,5,8')],
  ['only19', (d) => !!(d.dialect && d.dialect.ranks && d.dialect.ranks.join() === '1,9')],
  ['oneSuit', (d) => !!(d.dialect && d.dialect.suit)],
  ['noSuit', (d) => !!(d.dialect && d.dialect.noSlideSuit)],
  ['collect', (d) => !!(d.goal && d.goal.kind === 'collect')]
];

const built = [];
const seen = new Map();
/** `--probe=193` 只跑这一关，并把每次尝试的关键量打出来（noDeal 这种"所有种子都证不出解"
 *  靠全量跑批诊断一次要十几分钟，必须能单关复现）。 */
const PROBE = (() => {const a = process.argv.find((v) => /^--probe=\d+$/.test(v));return a ? Number(a.split('=')[1]) : -1;})();
if (PROBE >= 0) {
  const i = PROBE;
  const {rows, cols} = sizeFor(i);
  const chap = chapterOf(i);
  console.log(`probe 第 ${i + 1} 关 ${rows}x${cols} 章 ${chap.ch.name} k=${chap.k} slots目标 ${lerp(chap.ch.slots, chap.k)} faces ${lerp(chap.ch.faces, chap.k)}`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const g = buildMap(i, attempt);
    const rand = mulberry32(0xFACE + i * 7919 + attempt * 104729);
    // 与主循环**完全相同**的顺序：fillable → fillable → 机制 → trim → 再 fillable
    const okA = makeFillable(g, rand);
    const okB = makeFillable(g, rand);
    const okC = ensureMechanism(g, i, rand);
    trim(g, lerp(chap.ch.slots, chap.k));
    const okD = makeFillable(g, rand);
    const slots = slotsOf(g);
    const {lockR, lockC} = locksFor(i, rows, cols);
    const ice = iceFor(i);
    const oneWay = oneWayFor(i, rows, cols, lockR, lockC, rand);
    const unlock = unlockFor(i, rows, cols, lockR, lockC, rand);
    const base = {map: g.map((r) => r.join('')), lockR, lockC, faces: lerp(chap.ch.faces, chap.k),
      scramble: clamp(4 + Math.floor(i * 0.16), 4, 34), ice, ice2: ice2For(i, ice), bombs: bombsFor(i, ice),
      flowers: false, wild: false, chapter: chap.ci};
    const withOw = Object.assign({}, base, {oneWay, unlock});
    const d1 = construct(withOw, 1);
    const d0 = construct(Object.assign({}, base, {oneWay: [], unlock: []}), 1);
    console.log(`  attempt ${attempt}: fill=${okA}/${okB}/${okD} mech=${okC} 牌位=${slots} 锁=${lockR}/${lockC} 单向=${JSON.stringify(oneWay)} 连锁=${JSON.stringify(unlock)} 冰=${ice}` +
      ` | 全配=${d1 ? d1.solution.length + '步' : 'null'} 去单向=${d0 ? d0.solution.length + '步' : 'null'}`);
    if (d1) break;
  }
  process.exit(0);
}
for (let i = 0; i < LIMIT; i++) {
  const {rows, cols} = sizeFor(i);
  const chap = chapterOf(i);
  let def = null, par = 0, seedInherited = false;
  const why = {isolated: 0, unbalance: 0, slots: 0, duplicate: 0, noDeal: 0, shortFill: 0, mechanism: 0, unsolvable: 0, drift: 0, frozenBroken: 0, legal: 0, overLimit: 0, conflict: 0, noWild: 0, free: 0, dud: 0, par: 0};
  for (let attempt = 0; attempt < 120 && !def; attempt++) {
    const g = buildMap(i, attempt);
    const rand = mulberry32(0xFACE + i * 7919 + attempt * 104729);
    if (!makeFillable(g, rand)) { why.isolated++; continue; }
    if (!makeFillable(g, rand)) { why.unbalance++; continue; }
    if (!ensureMechanism(g, i, rand)) { why.mechanism++; continue; }
    // 削牌位必须放在 makeFillable 与 ensureMechanism **之后**：前者把障碍还原成牌位、
    // 后者把 1 升成 2/3，两件事都会把牌位加回来。放在它们前面削过等于没削
    // （实测第 19 关 89 次全是牌位出界）。
    const slotTarget = lerp(chap.ch.slots, chap.k);
    trim(g, slotTarget);
    // trim 可能新开了空洞，牌位的奇偶色跟着变 → 必须再修一次，否则后面会成批 shortFill
    if (!makeFillable(g, rand)) { why.unbalance++; continue; }
    const slots = slotsOf(g);
    // 牌位带 ±10，**不是** ±4：真正守"单关 4-7 分钟"的是下面的 parMax（参考解步数），
    // 牌位只是估时长的中间量。试过把带收紧到 ±4 并为此改 balance()（往轻侧补格子而不是删），
    // 结果是二分匹配被搞崩、unbalance 69/120——为精度牺牲可行性不划算。
    if (slots < MIN_SLOTS || slots > MAX_SLOTS || slots % 2 || Math.abs(slots - slotTarget) > 10) {
      why.slots++;
      if (DEBUG_WHY && why.slots <= 6) console.log(`  [slots] 第 ${i + 1} 关 ${rows}x${cols} 目标 ${slotTarget} 实得 ${slots} 层分布 ${g.map((r) => r.join('')).join('|')}`);
      continue;
    }
    const map = g.map((row) => row.join(''));
    const key = map.join('|');
    if (seen.has(key)) { why.duplicate++; continue; }
    const {lockR, lockC} = locksFor(i, rows, cols);
    const ice = iceFor(i);
    const oneWay = oneWayFor(i, rows, cols, lockR, lockC, rand);
    const unlock = unlockFor(i, rows, cols, lockR, lockC, rand);
    const {ch, ci, k} = chapterOf(i);
    const candidate = {
      map, lockR, lockC,
      // 难度旋钮来自章节，**不再由牌位反推**。以前这行是
      // `clamp(Math.ceil(slots/4), 4, 40)`，等于把"牌多"当成"更难"：
      // 盘面一收窄花色就跟着掉到 10，同面相邻概率暴涨、开局成把白送——101-120 的退坡就是这么来的。
      // faces 是"有效面种类数"。方言章里它不能超过白名单实际给得起的种类数，
      // 否则下面的牌池会被 slice 静默截断、哑弹份额被迫超线（实测幺九写 faces:6 时 118 次全灭）。
      faces: (() => {
        const f = lerp(ch.faces, k);
        const liveKinds = candidatePoolSize(ch, f, chapterDialect(ch, k, rand));
        if (f > liveKinds) { console.warn(`⚠ 第 ${i + 1} 关：faces=${f} 超过本章有效面 ${liveKinds}，按 ${liveKinds} 收`); return liveKinds; }
        return f;
      })(),
      // 打乱步数别按关号线性堆：它就是证书路线里的滑动步数，i=190 时 51 步打乱
      // 会把参考解直接顶到 100 步以上（超单关 7 分钟那条线）。天花板压到 34。
      scramble: clamp(4 + Math.floor(i * 0.16), 4, 34),
      ice,
      ice2: ice2For(i, ice),
      bombs: bombsFor(i, ice),
      flowers: hasMech(ch, 'flower') || !!ch.collect || !!ch.collectBySuit,
      // 百搭（财神）是降难度开关：方言关不给（它会吃掉"哑弹消不掉"这条规则），
      // 集组关也不给（集齐一组 + 万能配对 = 白送目标）。
      wild: hasMech(ch, 'wild') && k % 4 === 1 && !ch.dialect && !ch.collect && !ch.collectBySuit && !ch.mixDialect,
      oneWay, unlock,
      chapter: ci,
      dialect: chapterDialect(ch, k, rand)
    };
    // 单向轨不能与锁轨/连锁锁重叠（同一条轨不能既锁又单向）
    if (oneWay.some((w) => (w.axis === 'row' ? lockR : lockC).includes(w.index) ||
      unlock.some((u) => u.axis === w.axis && u.index === w.index))) { why.mechanism++; continue; }
    // 阶段 1：认证「还没填 moveLimit / goal 的候选」——这两样都得先看盘面才能定，所以必须先跑一轮。
    // 但**不能**用这一轮的盘面去钉指纹：`goal` 会反灌进生成器的牌池、`moveLimit` 会改变候选排序，
    // 最终定义发出来的其实是另一盘（实测 120 关里 15 个目标关指纹全对不上）。见阶段 2。
    const frozen = frozenSeedOf(i, map);
    if (frozen !== null) candidate.__frozen = frozen;
    const first = certifyDef(candidate, slots, seedOrder(i, frozen), ch.free);
    if (first.bad) {
      why.unsolvable++;
      if (first.bad === 'noDeal') why.noDeal++; else why.shortFill++;
      if (DEBUG_WHY && i === LIMIT - 1 && why.unsolvable <= 2) {
        console.log(`  [noDeal@194] 牌位=${slots} 种子=${seedOrder(i, frozen).slice(0, 3).join(',')} candidate=${JSON.stringify(Object.assign({}, candidate, {map: candidate.map.join('|')}))}`);
        console.log(`     construct(1)=${JSON.stringify(construct(candidate, 1) ? 'ok' : null)} construct(7)=${construct(candidate, 7) ? 'ok' : 'null'} 同盘再证一次=${construct(JSON.parse(JSON.stringify(Object.assign({}, candidate, {map: candidate.map})), 1)) ? 'ok' : 'null'}`);
      }
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
    // 限时与限步二选一（章末考试除外）：以前写成"有 moveLimit 就不给 timeLimit"，
    // 而限步从 k=4 起全程占位，结果限时每章只剩 1 关——设计要的是每章 2-4 关。
    const timeOn = !!ch.timeK && (k === 5 || k === 9 || k === 14);
    const moveLimit = timeOn ? 0 : moveLimitFor(i, limitPar);
    // 限时由 par 推（par × 每步秒数），绝不手填好看的数字——限步那边踩过"同档差三倍"
    // （L106 宽松 3.4 倍 vs L103 只留 1.16 倍），同一个坑不踩第二次。
    // 除章末考试（k=15）外，限时与限步不同时压：两条预算一起收紧，玩家分不清在赶哪个。
    // 限时按**钉死那一盘**的参考解算：时间是绝对量，洗牌换不了它，
    // 所以不像限步那样要留抽样余量。按 limitPar 算会把每步秒数顶到 3.83（超 3.6 的线）。
    const timeFor = (par) => ((timeOn || k === 15) && ch.timeK) ? Math.round(par * ch.timeK) : 0;
    const timeLimit = 0;
    // 目标关：目标数取「这一关实际给得出的量」——每种牌整局最多 4 张 = 2 对。
    //
    // ⚠️ 这里以前是遍历证书路线、对 `next.erased` 按牌面计数，但**每次都拿初始
    // deal.grid 调 transition、从不推进盘面**，同一个对子被反复计数，于是算出
    // 17 这种数字、再乘 0.7 写成 12，把 15 个目标关的目标全都写成够不着的值
    // （HUD 永远显示 0/N，「不必清空也能过」等于没生效）。
    // 现在直接从盘面按牌面统计可用对数；生成端（Generator.constructOnce）会把这个
    // 牌面强制放进牌池，所以它一定在盘上。
    let goal = null;
    if (ch.collect) goal = {kind: 'collect', faces: ch.collect, count: ch.collect.length};
    else if (ch.collectBySuit && k % 2 === 0) {
      const suit = ['p', 's', 'm'][Math.floor(rand() * 3)];
      goal = {kind: 'collect', faces: '123456789'.split('').map((n) => n + suit), count: 9};
    }
    else if (hasMech(ch, 'goal') && k % 5 === 2) {
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
      const pick = [...tiles.entries()].filter(([f]) => pairable(f, candidate.dialect))
        .sort((a, b) => b[1] - a[1])[0];
      const pairs = pick ? Math.floor(pick[1] / 2) : 0;
      // 目标至少要有 2 对才像目标；否则这一关不设目标（改走清台）
      if (pairs >= 2) goal = {kind: 'face', face: pick[0], count: Math.min(pairs, 2)};
      else if (iceLayers >= 3) goal = {kind: 'ice', count: Math.min(2, Math.max(1, Math.floor(iceLayers / 2)))};
    }
    // 阶段 2：对**最终定义**重新认证。表里那对 (seed, hash) 必须描述游戏真正会发的那一盘，
    // 否则 levels-seed 门禁拿 generate(i, seed) 重算时指纹对不上（改造前就是 15 个目标关全错）。
    const preDef = {...candidate, moveLimit, timeLimit, goal};
    if (frozen !== null) preDef.__frozen = frozen;
    if (first.staleHead) why.frozenBroken++;
    const second = certifyDef(preDef, slots, seedOrder(i, first.seed), ch.free);
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
    const finalDef = {...preDef, seed: second.seed, hash, timeLimit: timeFor(second.deal.solution.length)};
    // 验收线第 3 条：开局白送对子不许超上限。白送是"不用推就白给的进度"，
    // 它一超标，花色数和限步都白搭——所以当场拒掉，不等事后统计。
    // 白送额度必须随盘面大小给：章节表里写死"≤1"时，第 65 关（7x8、54 牌位、15 花色）
    // 120 次尝试有 114 次栽在这条上——随机摆放的相邻同面对子压不到 1，不是搜索不给力，
    // 是目标本身不可达。改成 `章内下限 与 每 24 个可消牌 1 对` 取大，两档都是可算的量。
    const live = liveCount(second.deal.grid, finalDef.dialect);
    const freeCap = Math.max(ch.free, 1 + Math.floor(live / 24));
    if (second.freePairs > freeCap) { why.free++; continue; }
    // 存档不变量必须在这就守住：某面 >4 张的盘面 `stateLegal` 判脏，玩家重进会被丢档
    if (!stateLegal(second.deal.grid)) { why.legal++; continue; }
    // 验收线第 2 条：参考解超本章上限就丢掉这盘重找（"超过 7 分钟直接丢弃"是设计写死的）
    if (second.deal.solution.length > (ch.parMax || 105)) { why.par++; continue; }
    if (finalDef.dialect) {
      const all = count(second.deal.grid);
      const liveKinds = new Set(second.deal.grid.flat().filter(Array.isArray)
        .flatMap((c) => c).map((f) => String(f).replace(/[~*]+$/, '')).filter((f) => pairable(f, finalDef.dialect))).size;
      // 哑弹过半会让玩家以为棋盘卡住；一种能配的都没有，方言就成了装饰。
      if (all - live > all * 0.55 || liveKinds < 3) { why.dud++; continue; }
    }
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
  /** 目标关：不必清空，先达成目标即通关。「collect」= 集齐一组（八花齐 / 三元齐 / 清龙），
   *  faces 是那一组的牌面代号，进度按「集齐了几种」算。 */
  goal?: {kind: 'face' | 'ice' | 'collect'; face?: string; faces?: string[]; count: number};
  /**
   * 方言：只约束「哪些牌能配对」。白名单外的牌是哑弹——占位、能当滑块，但永远配不上，
   * 通关判定因此看 \`Rules.liveCount\` 而不是 \`count\`（只剩哑弹也算清台）。
   * 与 \`wild\` 互斥：财神不吃哑弹，两者同时开会让玩家以为还能消。
   */
  dialect?: {ranks?: number[]; suit?: 'p' | 's' | 'm'; noSlideSuit?: 'p' | 's' | 'm'; honors?: boolean};
  /** 限时（秒）。必须由 \`par × 每步秒数\` 推出来，不许手填一个好看的数字。 */
  timeLimit?: number;
  /** 所属章节（0 基）。工具对每一关都会发射；星图分组与难度档读它，缺省时按 index/16 推。 */
  chapter?: number;
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
  bits.push(`chapter: ${def.chapter}`);
  if (def.dialect) bits.push(`dialect: ${JSON.stringify(def.dialect)}`);
  if (def.moveLimit) bits.push(`moveLimit: ${def.moveLimit}`);
  if (def.timeLimit) bits.push(`timeLimit: ${def.timeLimit}`);
  if (def.goal) {
    const gb = [`kind: '${def.goal.kind}'`];
    if (def.goal.face) gb.push(`face: '${def.goal.face}'`);
    if (def.goal.faces) gb.push(`faces: [${def.goal.faces.map((x) => `'${x}'`).join(', ')}]`);
    gb.push(`count: ${def.goal.count}`);
    bits.push(`goal: {${gb.join(', ')}}`);
  }
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

/** 章名（星图标题用）。由作者工具的章节表导出，避免视图里再抄一份曲线。 */
export const CHAPTER_NAMES: string[] = ${JSON.stringify(CHAPTERS.map((c) => c.name))};

export function levelAt(index: number): LevelDef {
  const i = Number.isFinite(index) ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(index))) : 0;
  return LEVELS[i];
}
`;

if (LIMIT !== TOTAL) console.log(`（--limit=${LIMIT} 调试模式：已跳过写入 levels.ts）`);
else fs.writeFileSync(path.join(root, 'assets/scripts/core/levels.ts'), header + body + footer);

const sizes = {};
for (const b of built) { const k = `${b.rows}x${b.cols}`; sizes[k] = (sizes[k] || 0) + 1; }
console.log(`已生成 ${built.length} 关${LIMIT === TOTAL ? '，写入 assets/scripts/core/levels.ts' : '（--limit 调试，未写文件）'}`);
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
const byCh = {};
built.forEach((b) => { const c = b.def.chapter; (byCh[c] = byCh[c] || []).push(b); });
Object.entries(byCh).forEach(([c, list]) => {
  const ch = CHAPTERS[Number(c)];
  const slots = list.map((b) => b.slots), faces = list.map((b) => b.def.faces), pars = list.map((b) => b.par);
  console.log(`  ${list.length}关 ${(Number(c) + 1).toString().padStart(2, ' ')} ${ch.name}：牌位 ${Math.min(...slots)}~${Math.max(...slots)} 花色 ${Math.min(...faces)}~${Math.max(...faces)} 参考解 ${Math.min(...pars)}~${Math.max(...pars)} 限步 ${list.filter((b) => b.def.moveLimit).length} 限时 ${list.filter((b) => b.def.timeLimit).length} 方言 ${list.filter((b) => b.def.dialect).length} 集组 ${list.filter((b) => b.def.goal && b.def.goal.kind === 'collect').length}`);
});
console.log(`内容：与上表逐盘面相同 ${sameContent}/${built.length} 关${DRIFT.count ? ` · 引擎变化导致换盘 ${DRIFT.count} 关` : ''}`);
if (DRIFT.count) console.log('  ↑ 换盘说明生成器实现与上表不匹配：这批关的切图与试玩要重做，别当无事发生。');
// 发布盘面的锁轨冲突由"挑种子"保证（运行时不为它多花 2.3 倍进关时间），这里是它的账。
console.log(`锁轨冲突：因挑不出 0 冲突而换掉形状 ${CONFLICT.rejected} 次 · 带冲突发布 ${CONFLICT.count} 关${CONFLICT.count ? `（最脏 ${CONFLICT.worst} 处）` : ''}`);
console.log(`说明卡真实性：因「标了 wild 却发不出百搭」否决 ${WILD.rejected} 次`);
console.log(`冰面关：${built.filter((b) => (b.def.ice || 0) > 0).length} 关（首现第 ${built.find((b) => (b.def.ice || 0) > 0)?.i + 1 ?? '-'} 关）`);
console.log(`棋盘唯一性：${seen.size}/${TOTAL} 关各不相同`);
