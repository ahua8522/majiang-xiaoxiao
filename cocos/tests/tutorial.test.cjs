/**
 * 教学脚本的门禁。
 *
 * 教学盘是手写的，所以它必须**当场跑真 Rules 跑得出脚本宣称的效果**——
 * 「教一个盘上不存在的东西比不教更糟」这条教训（wild:true 实测 8 关有 4 关一张百搭都没发出来）
 * 在手写盘上的对应物就是：expect 写错了、规则改了、格子挪了让下标指错轨，全都得在这里红。
 *
 * 运行时视图也是拿 expect 当「这一步走没走对、要不要前进」的判据（core/Tutorial.ts 的 advance），
 * 所以这条门禁同时是行为测试：门禁绿 = 玩家看到的效果 = 脚本文案说的事。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const R = core('Rules.js');
const G = core('Generator.js');
const T = core('tutorials.js');

test('盘面字面量：空格、木桩、叠层、冰、百搭都解析成 core 的形状', () => {
  const g = T.parseBoard(['2p . #', '5m|5m 6s~ f3*']);
  assert.equal(g[0][0].length, 1);
  assert.deepEqual(g[0][0], ['2p']);
  assert.equal(g[0][1], null);                       // '.' → 空洞
  assert.equal(g[0][2], '#');                        // '#' → 木桩（不是数组）
  assert.deepEqual(g[1][0], ['5m', '5m']);           // 叠两层，数组末尾是顶面
  assert.equal(R.top(g, {r: 1, c: 0}), '5m');
  assert.equal(R.top(g, {r: 1, c: 1}), '6s~');       // 一层冰
  assert.equal(R.hasIce(R.top(g, {r: 1, c: 1})), true);
  assert.equal(R.isWild(R.top(g, {r: 1, c: 2})), true);
});

test('章 6 将将胡：两步都跑出脚本宣称的效果（含「推得动但消不掉」）', () => {
  const t = T.tutorialFor(5);
  assert.equal(t.title, '将将胡');
  const grid = T.parseBoard(t.board);
  assert.equal(G.stateLegal(grid), true, '教学盘必须满足牌池不变量');
  const runs = T.tutorialRuns(t, grid);
  // 开局必须「不推就什么都消不掉」，否则第一步没有教学价值
  assert.equal(R.pairs(grid, t.dialect).length, 0);
  assert.equal(R.tapPairs(grid, t.dialect).length, 0);

  const s1 = t.steps[0], s2 = t.steps[1];
  const ri = T.findRun(t, s1.on, runs);
  assert.ok(ri >= 0, '第一条滑轨意图必须解析得到');
  const a1 = R.transition(grid, runs, {kind: 'slide', run: ri, step: s1.step}, t.dialect);
  assert.equal(T.stepOk(s1, a1), true, '第一步必须消掉一对 2 筒');
  assert.equal(a1.erased.length, 1);
  assert.equal(a1.erased[0].face, '2p');

  const runs2 = T.tutorialRuns(t, a1.grid);
  const ri2 = T.findRun(t, s2.on, runs2);
  const a2 = R.transition(a1.grid, runs2, {kind: 'slide', run: ri2, step: s2.step}, t.dialect);
  assert.equal(T.stepOk(s2, a2), true, '第二步必须「推得动、消 0 对」——这是整段教学的意义');
  assert.equal(a2.changed, true);
  assert.equal(a2.erased.length, 0);
  assert.ok(R.liveCount(a2.grid, t.dialect) > 0, '哑弹必须留在盘上，正好用来讲「剩下的不用管」');
});

test('意图用 axis+index，不用 runs 下标：改小盘形状不许把动作指到别的轨', () => {
  const t = T.tutorialFor(5);
  const wide = T.parseBoard(['2p 6s 2p .', '8m 5m 8m .']);   // 右边多一列空洞
  const runs = T.tutorialRuns(t, wide);
  const ri = T.findRun(t, {slide: {axis: 'row', index: 0}}, runs);
  assert.equal(ri, runs.findIndex((r) => r.axis === 'row' && r.index === 0));
  const picked = runs[ri];
  assert.equal(picked.axis, 'row');
  assert.equal(picked.index, 0);
});

test('expect 写错必须红：把「消 1 对」改成「消 5 对」，门禁就要拒（防的是门禁自己失效）', () => {
  const t = T.tutorialFor(5);
  const bad = {...t.steps[0], expect: {changed: true, pairs: 5}};
  const grid = T.parseBoard(t.board), runs = T.tutorialRuns(t, grid);
  const out = R.transition(grid, runs, {kind: 'slide', run: T.findRun(t, bad.on, runs), step: bad.step}, t.dialect);
  assert.equal(T.stepOk(bad, out), false);
});

test('每条教学脚本都自洽：动手步骤 ≤2 个、意图可解析、逐步重放不卡住', () => {
  for (const t of T.CHAPTER_TUTORIALS) {
    assert.equal(t.steps.filter((s) => s.need).length <= 2, true, `${t.title}: 动手步骤不超过 2 个`);
    let grid = T.parseBoard(t.board);
    assert.equal(G.stateLegal(grid), true, `${t.title}: 盘面不合法`);
    for (const s of t.steps) {
      const runs = T.tutorialRuns(t, grid);
      const ri = T.findRun(t, s.on, runs);
      assert.ok(ri >= 0, `${t.title}: 意图解析不到轨`);
      const action = s.on.slide
        ? {kind: 'slide', run: ri, step: s.step ?? 1}
        : {kind: 'match', a: s.on.tap[0], b: s.on.tap[1]};
      const out = R.transition(grid, runs, action, t.dialect);
      assert.equal(T.stepOk(s, out), true, `${t.title}: 步骤「${s.say}」的 expect 与真实结果不符`);
      grid = out.grid;
    }
  }
});
