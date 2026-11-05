/**
 * 把编译出来的关卡表导出成人能审的 Markdown（docs/关卡全量表.md）。
 *
 * 为什么用脚本导出而不是手写：`docs/关卡最终设计.md` 是关卡的真源说明，但逐关的 224 行
 * 一旦手抄，就和 `levels.ts` 分家——以前"文档说 15 个目标关、实际目标够不着"就是这么来的。
 * 现在文档里的每一行都能由 `npm run export:table` 重生成，跑批改了什么，表就跟着变什么。
 *
 * 用法：cd cocos && npm run export:table        （需要已经 build:core）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const G = require(path.join(root, '.test/core/Generator.js'));
const R = require(path.join(root, '.test/core/Rules.js'));
const LEVELS = G.LEVELS;

const NAMES = (() => {try {return require(path.join(root, '.test/core/levels.js')).CHAPTER_NAMES || [];} catch {return [];}})();
const CN = '一二三四五六七八九十';
/** 1-99 的中文序数：十一章要写成「十一」，不能退回阿拉伯数字（早期草案在这里漏过两位数）。 */
const cnNum = (n) => {
  if (n <= 10) return CN[n - 1];
  if (n < 20) return '十' + CN[n - 11];
  return CN[Math.floor(n / 10) - 1] + '十' + (n % 10 ? CN[n % 10 - 1] : '');
};
const chapterName = (ci) => NAMES[ci] || `第 ${ci + 1} 章`;
const slotsOf = (map) => map.reduce((n, row) => n + [...row].reduce((m, ch) => m + ('123'.includes(ch) ? Number(ch) : 0), 0), 0);
const base = (f) => String(f).replace(/[~*]+$/, '');

/** 方言的白话描述：文档和玩家看到的必须是同一句话。 */
function dialectText(d) {
  if (!d) return '';
  if (d.ranks && d.ranks.join() === '2,5,8') return '只有 2、5、8 能配' + (d.honors ? '+字牌' : '');
  if (d.ranks && d.ranks.join() === '1,9') return '只有 1、9 能配+字牌';
  if (d.suit) return `只有 ${d.suit === 'p' ? '筒' : d.suit === 's' ? '条' : '万'} 能配`;
  if (d.noSlideSuit) return `${d.noSlideSuit === 'p' ? '筒' : d.noSlideSuit === 's' ? '条' : '万'}门只能点消`;
  return JSON.stringify(d);
}

const rows = LEVELS.map((def, i) => {
  const k = i % 16;                                     // 章内序号：0 首见 / 8 招牌 / 13 变体 / 15 章末
  const deal = G.generate(i, def.seed);
  const par = deal.solution.length;
  const live = R.liveCount(deal.grid, def.dialect);
  const duds = R.count(deal.grid) - live;
  const extra = [];
  if (def.ice) extra.push(`${def.ice} 对冰${def.ice2 ? `(厚 ${def.ice2})` : ''}`);
  if (def.bombs) extra.push(`${def.bombs} 鞭炮`);
  if (def.oneWay && def.oneWay.length) extra.push('单向轨');
  if (def.unlock && def.unlock.length) extra.push(`连锁(消${def.unlock[0].after}对)`);
  if (def.wild) extra.push('财神');
  if (def.flowers) extra.push('花牌');
  const goal = def.goal ? (def.goal.kind === 'collect' ? `集组 ${def.goal.faces.map((f) => S(f)).join('')}`
    : def.goal.kind === 'ice' ? `碎冰×${def.goal.count}` : `${S(def.goal.face)}×${def.goal.count}`) : '';
  const budget = [def.moveLimit ? `步${def.moveLimit}` : '', def.timeLimit ? `时${def.timeLimit}s` : ''].filter(Boolean).join(' ') || '—';
  return {i, ci: def.chapter ?? Math.floor(i / 16), k: i % 16,
    size: `${def.map.length}x${def.map[0].length}`, slots: slotsOf(def.map), faces: def.faces, dialect: !!def.dialect, timed: !!def.timeLimit, limited: !!def.moveLimit, collect: !!(def.goal && def.goal.kind === 'collect'),
    tags: extra.join('·') || '—', goal, budget, par, duds, seed: def.seed, hash: def.hash,
    role: k === 0 ? '首见' : k === 8 ? '招牌' : k === 13 ? '变体' : k === 15 ? '章末' : ''};
});

/** 牌面代号 → 一个能看的字。 */
function S(f) {
  const m = /^(\d)([psm])$/.exec(f); if (!m) return {z1: '東', z2: '南', z3: '西', z4: '北', z5: '中', z6: '發', z7: '白', b1: '鞭'}[f] || f;
  return m[1] + {p: '筒', s: '条', m: '万'}[m[2]];
}

const out = [];
out.push('# 关卡全量表（自动生成）');
out.push('');
out.push('> 由 `cd cocos && npm run export:table` 从 `core/levels.ts` 导出，**不要手工编辑**。');
out.push('> 每一行的「参考解」是 `generate(i, seed).solution.length`，也就是玩家照游戏自己的提示走完需要的移动数；');
out.push('> 「哑弹」是钉死那一盘上配不掉的牌（方言关专有）。设计口径与验收线见 `docs/关卡最终设计.md`。');
out.push('');
const byCh = new Map();
rows.forEach((r) => {if (!byCh.has(r.ci)) byCh.set(r.ci, []);byCh.get(r.ci).push(r);});
[...byCh.keys()].sort((a, b) => a - b).forEach((ci) => {
  const list = byCh.get(ci);
  // 章号一律 1 基：星图页脚、README、设计文档都写「第 1 章 推与点」，这里不能单独叫「序」
  out.push(`## 第 ${cnNum(ci + 1)} 章 · ${chapterName(ci)}（第 ${list[0].i + 1}-${list[list.length - 1].i + 1} 关）`);
  out.push('');
  out.push('| 关 | 盘面 | 牌位 | 花色 | 叠加 | 目标 | 预算 | 参考解 | 哑弹 | 审阅 | seed |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  list.forEach((r) => out.push(`| ${r.i + 1} | ${r.size} | ${r.slots} | ${r.faces} | ${r.tags}${r.goal ? ' +' + r.goal : ''} | ${r.goal || '清台'} | ${r.budget} | ${r.par} | ${r.duds || ''} | ${r.role === '首见' || r.role === '招牌' || r.role === '变体' || r.role === '章末' ? '**钉审**' : '抽审'} | ${r.seed} |`));
  out.push('');
  const cnt = (f) => list.filter(f).length;
  const rng = (f) => `${Math.min(...list.map(f))}~${Math.max(...list.map(f))}`;
  out.push(`实测：牌位 ${rng((r) => r.slots)} · 花色 ${rng((r) => r.faces)} · 参考解 ${rng((r) => r.par)} 步 · ` +
    `限步 ${cnt((r) => r.limited)} 关 · 限时 ${cnt((r) => r.timed)} 关 · 方言 ${cnt((r) => r.dialect)} 关 · ` +
    `集组 ${cnt((r) => r.collect)} 关 · 哑弹合计 ${list.reduce((a, r) => a + r.duds, 0)} 张`);
  out.push('');
});
const n = (f) => rows.filter(f).length;
out.push(`共 ${rows.length} 关 / ${byCh.size} 章 · 参考解 ${Math.min(...rows.map((r) => r.par))}~${Math.max(...rows.map((r) => r.par))} 步 · ` +
  `钉审 ${n((r) => r.role)} 关 · 方言 ${n((r) => r.dialect)} 关 · 集组 ${n((r) => r.collect)} 关 · ` +
  `限步 ${n((r) => r.limited)} 关 · 限时 ${n((r) => r.timed)} 关 · 最长参考解 ${Math.max(...rows.map((r) => r.par))} 步（约 ${Math.round(Math.max(...rows.map((r) => r.par)) * 3.2 / 60 * 10) / 10} 分钟）`);
out.push('');

const dest = path.join(root, '..', 'docs', '关卡全量表.md');
fs.writeFileSync(dest, out.join('\n'));
console.log(`已导出 ${rows.length} 关到 docs/关卡全量表.md（${byCh.size} 章）`);
