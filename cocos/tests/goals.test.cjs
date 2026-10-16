/**
 * 集组目标（八花齐 / 三元齐 / 清龙）的门禁。
 *
 * 集组和"清台"是两种通关方式：集组不要求把牌消光，只要求**这一组里凑齐几种**。
 * 最容易写错的两处都在这里：
 *  1. 分母必须是"这一盘实际给得出的种数"，不能照抄关卡表里的 count——抄了就会出现
 *     HUD 永远显示 0/3、"不必清空也能过"等于没生效（目标关踩过这个坑，见 author 工具注释）。
 *  2. 一步连消里同一种可能不止一对（冰面要消两次），按对数加会重复计数，凑齐 3 种却显示 4。
 */
const {test} = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const R = core('Rules.js');
const G = core('Generator.js');
const S = core('Session.js');

const DRAGONS = ['z5', 'z6', 'z7'];   // 中 發 白
const stub = () => ({load: () => null, save: () => {}, feedback: () => {}});

const collectDef = (extra) => Object.assign({
  map: ['11111', '11111', '11111', '11111'], lockR: [], lockC: [],
  faces: 8, scramble: 6, flowers: false,
  goal: {kind: 'collect', faces: DRAGONS, count: 3}}, extra || {});

/** 把会话装成"正在玩这一盘"：合成定义不在关卡表里，只能显式装配。 */
function install(s, def, deal) {
  s.def = def; s.grid = R.clone(deal.grid); s.runs = deal.runs;
  s.total = R.count(deal.grid); s.liveTotal = R.liveCount(deal.grid);
  s.par = deal.solution.length; s.moves = 0; s.modal = 'none'; s.tip = null;
  s.selected = null; s.clearedPairs = 0; s.goalDone = 0; s.goalTarget = 0;
  s.solution = [];
}

/** 用玩家的操作回放证书：点消走 tap、滑动走 slide（不碰私有的 apply）。 */
function replay(s, actions) {
  for (const a of actions) {
    if (a.kind === 'match') { s.tap(a.a); s.tap(a.b); }
    else s.slide(a.run, a.step);
  }
}

test('集组目标：分母收敛到盘面真能凑齐的种数', () => {
  const def = collectDef();
  const deal = G.construct(def, 20261016);
  assert.ok(deal, '集组关出不了证书');
  const need = G.goalPairs(def, deal.grid);
  assert.ok(need >= 1, `这一盘一种都凑不齐（need=${need}），目标形同虚设`);
  assert.ok(need <= DRAGONS.length, `分母 ${need} 比整组种类数还大`);
});

test('集组目标：凑齐就通关，剩下的牌不用清光', () => {
  const def = collectDef();
  const deal = G.construct(def, 20261016);
  assert.ok(deal);
  const s = new S.Session(20261016, stub());
  install(s, def, deal);
  const need = s.goalNeed;
  assert.ok(need >= 1);
  replay(s, deal.solution);
  assert.equal(s.goalDone, need, `集齐数应与分母一致，实际 ${s.goalDone}/${need}`);
  assert.equal(s.modal, 'win', '集齐了却没通关：goalReached 没参与判定');
});

test('同一步连消里同一组牌种只加一次', () => {
  const def = collectDef();
  const s = new S.Session(1, stub());
  // 一格叠四张 z5：一次滑动把它们连消两对，集组进度只该 +1（"中"这一种到手）
  const grid = [[['z5', 'z5', 'z5', 'z5'], ['z6', 'z6'], ['3p', '3p'], ['7s', '7s']]];
  const deal = {grid, runs: R.runsFor(grid, [], []), solution: []};
  install(s, def, deal);
  s.goalTarget = 3;
  const before = s.goalDone;
  s.slide(0, 1);
  const gained = s.goalDone - before;
  const erased = s.lastErased.length;
  assert.ok(gained <= Math.ceil(erased / 2) && gained <= 2,
    `一步消 ${erased} 对却记了 ${gained} 种，同种被重复计数`);
});

test('集组关不许同时开百搭（宽规则必须有补偿）', () => {
  G.LEVELS.forEach((d, i) => {
    if (d.goal && d.goal.kind === 'collect') {
      assert.ok(!d.wild, `第 ${i + 1} 关：集齐一组 + 百搭同时开，等于白送目标`);
    }
  });
});
