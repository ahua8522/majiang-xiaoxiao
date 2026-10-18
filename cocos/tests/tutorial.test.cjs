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

test('状态机：只接受与脚本一致的动作，其余一律回弹且不改盘面', () => {
  const Tu = core('Tutorial.js');
  const t = T.tutorialFor(5);
  const run = new Tu.TutorialRun(t);
  assert.equal(run.index, 0);
  assert.equal(run.done, false);
  assert.equal(run.step.say, t.steps[0].say);

  // 推错轨（拖了一列）：真 Rules 会改盘，但对不上 expect → 必须不提交
  const col = run.runs.findIndex((r) => r.axis === 'col' && !r.locked);
  const before = JSON.stringify(run.grid);
  const bad = run.advance({kind: 'slide', run: col, step: 1});
  assert.equal(bad.advanced, false);
  assert.equal(JSON.stringify(run.grid), before, '回弹不许偷偷改掉盘面：后面每一步都按脚本那盘算');
  assert.equal(run.index, 0);
  assert.ok(bad.message.length, '回弹要说话，不能默默不动');
  assert.match(bad.message, /一行|一列/);

  const ok = run.advance(run.canonical());
  assert.equal(ok.advanced, true);
  assert.equal(ok.erased.length, 1);
  assert.equal(run.index, 1);

  run.advance(run.canonical());
  assert.equal(run.done, true, '两步走完就该结束');
  assert.equal(run.step, null);
});

test('状态机：判据是"效果对不对得上"，不是"方向对不对"', () => {
  const Tu = core('Tutorial.js');
  const t = T.tutorialFor(5);
  const run = new Tu.TutorialRun(t);
  // 三格轨 ['2p','6s','2p'] 朝哪个方向转都能让两张二筒碰头，所以两个方向都该被接受。
  // 这不是放松判据：expect 记的是玩家要看到的事（消掉一对 2 筒），不是某一次具体位移。
  const ri = T.findRun(t, t.steps[0].on, run.runs);
  const back = run.advance({kind: 'slide', run: ri, step: -1});
  assert.equal(back.advanced, true);
  assert.equal(back.erased[0].face, '2p');
  assert.equal(run.index, 1);
});

test('状态机：意图解析不到轨时置 failed，视图据此降级', () => {
  const Tu = core('Tutorial.js');
  const t = {...T.tutorialFor(5), lockR: [0], lockC: []};   // 把要推的那一行锁死
  const run = new Tu.TutorialRun(t);
  assert.equal(run.canonical(), null, '锁轨不许当教学目标：演一次"牌推歪了又弹回去"比不教更糟');
  run.advance(run.canonical());
  assert.equal(run.failed, true);
  assert.equal(run.done, false);
});

test('watch 模式（玩法说明里的重放）：不做强制，逐步自动演到底', () => {
  const Tu = core('Tutorial.js');
  const run = new Tu.TutorialRun(T.tutorialFor(5), true);
  assert.equal(run.watchMode, true);
  assert.deepEqual(run.targetCells(), [], '重放不指路：高亮是给"必须动手"那一步用的');
  let guard = 0;
  while (!run.done && !run.failed && guard++ < 10) run.advance(run.canonical());
  assert.equal(run.done, true);
  assert.equal(run.failed, false);
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
