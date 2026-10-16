/* 关卡数据的可玩性门：目标一定够得着、限步一定走得完、视图牌面不许自己抄一份。
 *
 * 这三条以前没有任何自动化在管，全都实测翻过车：
 *  · author 工具算错目标口径（每种牌整局最多 4 张 = 2 对，它却写出 5/8/12），
 *    而且从不保证目标牌面进牌池 —— 15 个目标关 HUD 常年 0/N，「不必清空也能过」失效；
 *  · 限步上限只按 3 个固定种子定，而玩家种子来自 Date.now()，同一关参考解长度实测
 *    22..197 之间跳 —— 约 5% 的开局照游戏自己的提示走完也会步数用尽判负；
 *  · view 自己抄了一份 42 个的牌面清单，漏掉鞭炮 b1 —— 第 70 关起 `face('b1')`
 *    抛异常（查不到不是返回 null），整个 render 炸掉、牌桌一张都不画。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const core = (n) => require(path.join(__dirname, '..', '.test', 'core', n + '.js'));
const G = core('Generator');
const LEVELS = G.LEVELS;
assert.ok(Array.isArray(LEVELS) && LEVELS.length, '缺少编译后的关卡表（先跑 npm run build:core）');

// 玩家实际拿到的种子是 Date.now() 派生的，这里用一组同量级的数当抽样
const SEEDS = [2026101503, 2026101607, 2026101729, 2026101853, 2026101999].map((n) => n >>> 0);
/** 牌面去掉冰层 `~` 与百搭 `*` 后缀，取基础面。 */
const base = (f) => String(f).replace(/[~*]+$/, '');

test('目标关：目标牌面必须上盘，且本关实际给得出的量 ≥ 1', () => {
  const bad = [];
  LEVELS.forEach((def, i) => {
    if (!def.goal || def.goal.kind !== 'face') return;
    for (const s of SEEDS) {
      const deal = G.generate(i, s);
      const want = base(def.goal.face);
      const on = deal.grid.flat().some((c) => Array.isArray(c) && c.some((f) => base(f) === want));
      if (!on) { bad.push(`第 ${i + 1} 关 种子 ${s}：目标牌面 ${want} 根本没上盘`); continue; }
      if (G.goalPairs(def, deal.grid) < 1) bad.push(`第 ${i + 1} 关 种子 ${s}：目标可完成量算出 0（count=${def.goal.count}）`);
    }
  });
  assert.deepEqual(bad, [], '这些目标关玩家够不着目标：\n' + bad.join('\n'));
});

test('限步关：抽样种子的参考解都必须走得进步数上限', () => {
  const bad = [];
  LEVELS.forEach((def, i) => {
    if (!def.moveLimit) return;
    if (def.dialect) return;    // 方言关没有洗牌（Session.shuffleBlocked），抽样种子不构成玩家的体验路径
    for (const s of SEEDS) {
      const deal = G.generate(i, s);
      if (deal.solution.length > def.moveLimit)
        bad.push(`第 ${i + 1} 关 种子 ${s}：参考解 ${deal.solution.length} 步 > 上限 ${def.moveLimit} 步`);
    }
  });
  assert.deepEqual(bad, [], '照游戏自己的提示走完也会判负：\n' + bad.join('\n'));
});

test('牌面清单只留 core 一份：view 必须 import，不许再抄一份', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'scripts', 'view', 'assets.ts'), 'utf8');
  assert.ok(/from '\.\.\/core\/Generator'/.test(src), "view/assets.ts 必须从 core 取牌池（FACES）");
  assert.ok(!/for \(let i = 1; i <= 9; i\+\+\)/.test(src), 'view/assets.ts 里不该再出现自己抄的牌面循环');
  assert.ok(G.FACES.includes('b1'), 'core 牌池要含鞭炮 b1');
});

/* ---------------- 章节表落地后的曲线门禁（2026-10-16，224 关） ----------------
 * 这些条不是装饰：难度退坡那次就是因为"花色被牌位数绑死"，而当时**没有任何自动化**
 * 能看出 101-120 关比 81-90 关更简单。下面每一条都直接对应一个已经发生过的事故。 */

const CHAPTER_LEN = 16;
const chaptersOf = () => {
  const by = new Map();
  LEVELS.forEach((d, i) => {
    assert.ok(Number.isInteger(d.chapter), `第 ${i + 1} 关没有 chapter 字段`);
    if (!by.has(d.chapter)) by.set(d.chapter, []);
    by.get(d.chapter).push({d, i});
  });
  return by;
};

test('章节结构：14 章、每章 16 关、关号连续', () => {
  const by = chaptersOf();
  assert.equal(by.size, 14, `章数 ${by.size}，应为 14`);
  by.forEach((list, ci) => {
    assert.equal(list.length, CHAPTER_LEN, `第 ${ci + 1} 章 ${list.length} 关`);
    assert.deepEqual(list.map((x) => x.i), list.map((_, k) => ci * CHAPTER_LEN + k),
      `第 ${ci + 1} 章关号不连续`);
  });
});

test('难度曲线：每章花色上沿不低于上一章，牌位不再当难度用', () => {
  const by = chaptersOf();
  const order = [...by.keys()].sort((a, b) => a - b);
  let prevMax = -1, prevMinSlots = 1e9;
  const bad = [];
  order.forEach((ci) => {
    const list = by.get(ci);
    const max = Math.max(...list.map((x) => x.d.faces));
    const min = Math.min(...list.map((x) => x.d.faces));
    // 方言章天生要收窄有效面（白名单外的不算），所以只跟"上一章的下沿"比，容 2 档
    if (list.some((x) => x.d.dialect)) { prevMax = Math.max(prevMax, max); return; }
    if (max < prevMax - 2) bad.push(`第 ${ci + 1} 章花色上沿 ${max} 比上一章 ${prevMax} 退坡超过 2`);
    if (min < prevMax - 6) bad.push(`第 ${ci + 1} 章花色下沿 ${min} 相对上一章上沿 ${prevMax} 塌得太狠`);
    prevMax = Math.max(prevMax, max);
  });
  assert.deepEqual(bad, [], bad.join(String.fromCharCode(10)));
});

test('方言配额：每张方言章至少 12 关真带方言，且哑弹不过半、有效面 ≥3', () => {
  const by = chaptersOf();
  const R = core('Rules');
  const bad = [];
  const MIXED = new Set([12, 13]);   // 双方言 / 终章：按设计只有一半关带方言，另一半靠花色压难度
  by.forEach((list, ci) => {
    const named = list.filter((x) => x.d.dialect);
    if (!named.length) return;                      // 非方言章
    const want = MIXED.has(ci) ? 8 : 12;
    if (named.length < want) bad.push(`第 ${ci + 1} 章只有 ${named.length}/16 关带方言（应 ≥${want}）`);
    named.forEach(({d, i}) => {
      const deal = G.generate(i, d.seed);
      const live = R.liveCount(deal.grid, d.dialect);
      const all = R.count(deal.grid);
      const kinds = new Set(deal.grid.flat().filter(Array.isArray)
        .flatMap((c) => c).map(base).filter((f) => R.pairable(f, d.dialect))).size;
      if (all - live > all * 0.55) bad.push(`第 ${i + 1} 关哑弹 ${((all - live) / all * 100).toFixed(0)}% > 55%`);
      if (kinds < 3) bad.push(`第 ${i + 1} 关有效面只有 ${kinds} 种，方言形同虚设`);
    });
  });
  assert.deepEqual(bad, [], bad.join(String.fromCharCode(10)));
});

test('限时由参考解推出来：每步秒数必须落在 1.8-3.6，不许手填好看的数字', () => {
  const bad = [];
  LEVELS.forEach((def, i) => {
    if (!def.timeLimit) return;
    const deal = G.generate(i, def.seed);
    const per = def.timeLimit / deal.solution.length;
    if (!(per >= 1.8 && per <= 3.6))
      bad.push(`第 ${i + 1} 关 限时 ${def.timeLimit}s / 参考解 ${deal.solution.length} 步 = 每步 ${per.toFixed(2)}s`);
  });
  assert.deepEqual(bad, [], bad.join(String.fromCharCode(10)));
});

test('集组目标在钉死的那一盘真能凑齐（不能只在某个随机种子里成立）', () => {
  const bad = [];
  LEVELS.forEach((def, i) => {
    if (!def.goal || def.goal.kind !== 'collect') return;
    const deal = G.generate(i, def.seed);
    const need = G.goalPairs(def, deal.grid);
    if (need < 1) bad.push(`第 ${i + 1} 关：盘面上一种都凑不齐（目标 ${def.goal.count} 种）`);
    if (def.wild) bad.push(`第 ${i + 1} 关：集组 + 百搭同时开，等于白送目标`);
  });
  assert.deepEqual(bad, [], bad.join(String.fromCharCode(10)));
});

// 每章参考解上限，与 author 工具里 CHAPTERS.parMax 一一对应（改一边就要改另一边）。
const PAR_MAX = [10, 20, 30, 40, 50, 60, 60, 60, 65, 70, 75, 80, 90, 105];
test('单关时长守线：参考解不许超本章上限（4-7 分钟那条硬线的代码化）', () => {
  const over = [];
  LEVELS.forEach((def, i) => {
    const ci = def.chapter ?? Math.floor(i / 16);
    const deal = G.generate(i, def.seed);
    if (deal.solution.length > (PAR_MAX[ci] ?? 105))
      over.push(`第 ${i + 1} 关（第${ci + 1}章）参考解 ${deal.solution.length} 步 > 上限 ${PAR_MAX[ci] ?? 105}`);
  });
  assert.deepEqual(over, [], over.join(String.fromCharCode(10)));
});
