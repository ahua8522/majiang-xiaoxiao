/**
 * 方言规则的门禁。
 *
 * 方言只改一件事：哪些牌**能配对**。滑轨、放置、证书重放全都不动——
 * 所以这里要守的是三条容易做错的地方：
 *  1. 白名单外的牌必须既不能点消也不能滑消（哑弹），但它照样占位、照样能当滑块；
 *  2. 「清台」的定义变成 `liveCount===0`，只剩哑弹也必须算通关；
 *  3. 断门（noSlideSuit）不一样：它能点消，只是不能靠滑动顺手带走。
 * 另有一条向后兼容：不传方言时行为必须和改造前一模一样（既有 60+ 处测试调用点依赖它）。
 */
const {test} = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const R = core('Rules.js');
const G = core('Generator.js');

const WILL = {ranks: [2, 5, 8]};                 // 将将胡
const YAO = {ranks: [1, 9]};                     // 幺九
const PURE = {suit: 's'};                        // 清一色
const DROP = {noSlideSuit: 'p'};                 // 断门：缺筒

const row = (...cells) => [cells.map(c => (typeof c === 'string' ? [c] : c))];

test('牌面代号的解析：数牌、字牌、花牌、冰与百搭后缀都要认', () => {
  assert.equal(R.suitOf('3p'), 'p');
  assert.equal(R.suitOf('z5'), 'z');
  assert.equal(R.suitOf('f3'), 'f');
  assert.equal(R.suitOf('b1'), 'b');
  assert.equal(R.suitOf('5s~~'), 's');           // 厚冰剥两层才看得穿
  assert.equal(R.suitOf('f3*'), 'f');
  assert.equal(R.rankOf('2p'), 2);
  assert.equal(R.rankOf('2p~~'), 2);
  assert.equal(R.rankOf('z1'), 0);
});

test('将将胡：3p 与 3p 相邻也配不掉，2p 与 2p 能配', () => {
  const g = row('2p', '3p', '2p');
  assert.equal(R.pairable('3p', WILL), false);
  assert.equal(R.pairable('2p', WILL), true);
  assert.equal(R.pairs(g, WILL).filter(p => p.face === '3p').length, 0, '哑弹不该进连消');
  // 相邻的两个 3p（下标 1、2 换成同面）即便贴着也不算对
  const dud = row('3p', '3p');
  assert.equal(R.pairs(dud, WILL).length, 0);
  assert.equal(R.partners(dud, {r: 0, c: 0}, WILL).length, 0, '哑弹不该有搭子（点消也不许）');
});

test('幺九：中间的牌全当滑块，1 和 9 才能配对', () => {
  assert.equal(R.pairable('1m', YAO), true);
  assert.equal(R.pairable('9m', YAO), true);
  assert.equal(R.pairable('5m', YAO), false);
  assert.equal(R.pairable('z3', YAO), false, '白名单关里字牌也是哑弹');
});

test('清一色：只有指定一门能配，另外两门只能推', () => {
  assert.equal(R.pairable('4s', PURE), true);
  assert.equal(R.pairable('4p', PURE), false);
  assert.equal(R.pairable('z1', PURE), false);
});

test('百搭在方言关里配白名单内的牌，但**不吃哑弹**', () => {
  assert.equal(R.pairable('f3*', WILL), true);
  assert.equal(R.partners(row('f3*', '2p'), {r: 0, c: 0}, WILL).length, 1, '财神配不上白名单牌才是错的');
  // 哑弹如果能被财神吃掉，"只剩哑弹即清台"（liveCount===0）这套定义就崩了：
  // 玩家会以为还能消，证书也会按另一种规则算。所以财神只加宽"能配"，不撤销"哑弹"。
  assert.equal(R.partners(row('f3*', '7p'), {r: 0, c: 0}, WILL).length, 0, '哑弹不许被财神带走');
});

test('断门：缺门的牌能点消，但不能被滑消顺手带走', () => {
  const g = row('2p', '2p');
  assert.equal(R.pairable('2p', DROP), true, '断门的牌仍然"能配对"，不算哑弹');
  assert.equal(R.pairs(g, DROP).length, 0, '滑动连消里不许出现缺门');
  assert.equal(R.partners(g, {r: 0, c: 0}, DROP).length, 1, '点消必须还开得着');
});

test('liveCount：只剩哑弹就等于清台', () => {
  const g = row('3p', '3p');
  assert.equal(R.count(g), 2);
  assert.equal(R.liveCount(g, WILL), 0, '哑弹不该算还能消');
  assert.equal(R.liveCount(g), 2, '没有方言时等于 count');
});

test('不传方言时行为与改造前完全一致（向后兼容）', () => {
  const g = row('3p', '3p', '2p');
  assert.equal(R.pairs(g).length, 1);
  assert.equal(R.partners(g, {r: 0, c: 0}).length, 1);
  assert.deepEqual(R.pairs(g), R.pairs(g, undefined));
});

test('transition 认方言：滑到一起的哑弹不会自动消除，白名单内的照样消', () => {
  // 一条 4 格横轨：滑一步之后 3p 与 3p 相邻（哑弹，必须留下）、2p 与 2p 相邻（该消掉）。
  const g = [[['3p'], ['2p'], ['2p'], ['3p']]];
  const runs = R.runsFor(g, [], []);
  const slid = R.transition(g, runs, {kind: 'slide', run: 0, step: 1}, WILL);
  assert.equal(slid.changed, true, '滑动本身要生效');
  assert.equal(R.count(slid.grid), 2, '应当只剩两张 3p 哑弹');
  assert.equal(R.liveCount(slid.grid, WILL), 0, '剩下的必须是再也配不动的牌');
  // 对照：没有方言时同样的滑动会把两对全收走
  const plain = R.transition(g, runs, {kind: 'slide', run: 0, step: 1});
  assert.equal(R.count(plain.grid), 0, '无方言时连消应生效');
});

test('方言关的证书：走完路线 liveCount 归零，且确实留下哑弹', () => {
  const idx = G.LEVELS.findIndex(d => d.dialect && d.dialect.ranks);
  assert.ok(idx >= 0, '关卡表还没有方言关（Task 8 章节表接上后才会有）');
  const def = G.LEVELS[idx];
  const deal = G.generate(idx, def.seed);
  let g = deal.grid, runs = deal.runs;
  for (const a of deal.solution) {
    const out = R.transition(g, runs, a, def.dialect);
    assert.equal(out.changed, true, `第 ${idx + 1} 关证书某步失效`);
    g = out.grid;
    runs = R.runsFor(g, def.lockR, def.lockC, def.oneWay);
  }
  assert.equal(R.liveCount(g, def.dialect), 0, '证书走完还剩能配的牌');
  assert.ok(R.count(g) > 0, '一张哑弹都没留下 = 白名单没真正生效');
});
