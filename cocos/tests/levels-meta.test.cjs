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
