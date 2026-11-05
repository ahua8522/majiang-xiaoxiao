/**
 * A 批（稀缺性）/ B 批（分数、星级、章节门槛、提示分步）的验收。
 *
 * 设计口径见 `docs/玩法深度与变现设计.md`。这里只测**可断言的行为**：
 * 撤销不退步数、道具账本跨重开、复活预算、星级线边界、章节门槛、提示分步前进。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const R = require('../.test/core/Rules.js');
const S = fs.existsSync(__dirname + '/../.test/core/Session.js') ? require('../.test/core/Session.js') : {};

const create = () => {
  assert.equal(typeof S.Session, 'function', '缺少事务会话');
  const s = new S.Session(18);
  s.command('continue');
  s.tip = null;
  s.coach = null;
  return s;
};
function install(s, g, locksR = [], locksC = []) {
  s.grid = g; s.runs = R.runsFor(g, locksR, locksC); s.total = R.count(g);
  s.modal = 'none'; s.solution = []; s.selected = null; s.moves = 0; s.tip = null; s.coach = null;
  s.clearedPairs = 0; s.goalDone = 0; s.score = 0; s.hint = []; s.hintTotal = 0;
}
/** 一块内存存储，用来验证「换进程重进」时的账本行为。 */
const store = (value = null) => ({ value, load() { return this.value; }, save(v) { this.value = v; }, feedback() {} });

/* ── A2 道具账本 ─────────────────────────────────────── */

test('重开恢复免费提示；同一局仍保存已用次数', () => {
  const s = create();
  install(s, [[['1p'], ['1p']]]);
  s.requestHint();
  assert.equal(s.hintsUsed, 1, '点一次提示消耗一次');
  const lv = s.levelIndex;
  assert.deepEqual(s.used[lv], { h: 1, s: 0 }, '账本要记账');
  s.reset(lv);
  assert.equal(s.hintsUsed, 0, '重开恢复免费额度');
  assert.equal(s.hintsLeft, 3);
});

test('A2 通关即结清本关账本：下一关是新的三次提示', () => {
  const s = create();
  install(s, [[['1p'], ['1p']]]);
  s.par = 1;
  s.requestHint();
  const lv = s.levelIndex;
  assert.ok(s.used[lv], '先确认账本存在');
  // 提示给的就是这一对，点掉它直接通关
  s.tap({ r: 0, c: 0 });
  assert.equal(s.modal, 'win');
  assert.equal(s.used[lv], undefined, '通关要删除该关记录');
});

test('A2 跨天整表清空：兜住「提示用完又打不过」的永久卡死', () => {
  const p = store();
  const a = new S.Session(1, p);
  a.command('continue'); a.tip = null; a.coach = null;
  a.requestHint();
  assert.equal(a.hintsUsed, 1);
  const raw = p.load();                       // platform.save 存的是对象，不是字符串
  raw.usedDay = '2000-01-01';                 // 假装账本是上个世纪的
  p.save(raw);
  const b = new S.Session(2, p);
  assert.equal(b.hintsUsed, 0, '跨天必须重置');
});

/* ── A3 复活 ─────────────────────────────────────────── */

test('A3 复活上限两次且预算递减：第一次 +3 步、第二次 +1 步', () => {
  const s = create();
  install(s, [[['1p'], ['2p'], [], []]]);
  s.def = { ...s.def, moveLimit: 2 };
  s.slide(0, 1); s.slide(0, 1);
  assert.equal(s.modal, 'lose'); assert.equal(s.failReason, 'step');
  assert.equal(s.revive(), true);
  assert.equal(s.moveLimit, 5);
  assert.equal(s.moves, 2);
  // 再走完这 3 步，第二次失败
  s.moves = 5; s.modal = 'lose'; s.finished = true; s.failReason = 'step';
  assert.equal(s.revive(), true);
  assert.equal(s.moveLimit, 6, '第二次只 +1 步');
  assert.equal(s.revivesUsed, 2);
  s.moves = 6; s.modal = 'lose'; s.finished = true; s.failReason = 'step';
  assert.equal(s.canRevive, false, '每关最多两次，不做上限就是无限续命');
  assert.equal(s.revive(), false);
});

test('A3 死局不给复活，走免费洗牌且不消耗本关洗牌额度', () => {
  const s = create();
  install(s, [[['1p'], ['2p'], [], []]]);
  s.finishDead();
  assert.equal(s.failReason, 'dead');
  assert.equal(s.canRevive, false, '死局卖广告是敲诈，不给复活');
  const before = s.shufflesUsed;
  const ok = s.rescueShuffle();
  // 盘面可能重排不开（方言关），但只要能重排就必须不扣额度
  if (ok) {
    assert.equal(s.modal, 'none');
    assert.equal(s.shufflesUsed, before, '救援洗牌不占额度');
  }
});

/* ── B1 分数与星级 ───────────────────────────────────── */

test('B1 分数公式：对数 × 10 × 连击倍率', () => {
  const s = create();
  install(s, [[['1p'], ['1p'], ['2p'], ['2p']]]);
  s.tap({ r: 0, c: 0 });
  assert.equal(s.score, 10, '1 对 1 波 = 10');
});

test('B1 星级线边界：par=20 时 22/27 两条线', () => {
  assert.equal(S.ratingFor(22, 20), 3);
  assert.equal(S.ratingFor(23, 20), 2);
  assert.equal(S.ratingFor(27, 20), 2);
  assert.equal(S.ratingFor(28, 20), 1);
  // 小 par 不许被固定缓冲白送：par=4 的 3 星线是 5，不是 8
  assert.deepEqual(S.starLines(4), { three: 5, two: 6 });
  assert.deepEqual(S.starLines(50), { three: 54, two: 68 });
});

test('B1 最高分与最少步数只往好的方向写', () => {
  const s = create();
  install(s, [[['1p'], ['1p']]]);
  s.par = 1; s.tap({ r: 0, c: 0 });
  const lv = s.levelIndex;
  assert.equal(s.modal, 'win');
  assert.equal(s.best[lv], 10);
  assert.equal(s.bestMoves[lv], 1);
  assert.equal(s.stars[lv], 3);
  // 再打一次打砸了
  s.reset(lv); install(s, [[['1p'], ['1p']]]); s.par = 1; s.moves = 5;
  s.tap({ r: 0, c: 0 });
  assert.equal(s.best[lv], 10, '最高分不被低分覆盖');
  assert.equal(s.bestMoves[lv], 1, '最少步数只降不升');
  assert.equal(s.stars[lv], 3, '历史最佳星级不被低星覆盖');
});

/* ── B2 章节门槛 ─────────────────────────────────────── */

test('B2 章节星数按章统计，未通关的关不贡献', () => {
  const s = create();
  s.stars = { 0: 3, 1: 2, 15: 1 };
  assert.equal(s.chapterStars(0), 6);
  assert.equal(s.chapterStars(1), 0, '没通关的章是 0 星');
});

test('完成前章即可解锁下一章，不需要刷星',()=>{
  const s=create();s.maxLevel=19;s.stars={};
  assert.equal(s.canEnter(20),false);assert.equal(s.gateGap(0),0);
  s.maxLevel=20;assert.equal(s.canEnter(20),true);assert.equal(s.canEnter(21),false);
});

test('B2 本章内部不设卡：章 1 的任意已解锁关都进得去', () => {
  const s = create();
  s.maxLevel = 10;
  assert.equal(s.canEnter(0), true);
  assert.equal(s.canEnter(10), true);
  assert.equal(s.canEnter(11), false, '超过 maxLevel 还是进不去');
});

test('B2 unlockAll 必须绕过门槛，否则内部测试被自己挡住', () => {
  const s = create();
  s.maxLevel = 0;
  s.unlockAll = true;
  assert.equal(s.canEnter(200), true);
});

/* ── B1 提示分步 ─────────────────────────────────────── */

test('提示沿证书路线给一段（K 步），不是只给下一步', () => {
  const s = create();
  install(s, [[['1p'], ['1p'], ['2p'], ['2p']]]);
  s.par = 30;                                     // K = clamp(3,8,5) = 5
  s.solution = [
    { kind: 'match', a: { r: 0, c: 0 }, b: { r: 0, c: 1 } },
    { kind: 'match', a: { r: 0, c: 2 }, b: { r: 0, c: 3 } }
  ];
  s.requestHint();
  assert.equal(s.hintTotal, 2, 'solution 只有两步就只给两步');
  assert.equal(s.hint.length, 2);
  assert.match(s.message, /第 1\/2 步/, '横幅要告诉玩家这是计划里的第几步');
  // 走对第一步 → 计划自动前进，不用再点一次提示
  s.tap({ r: 0, c: 0 });
  assert.equal(s.hint.length, 1, '推对一步后自动显示下一步');
  assert.equal(s.hintTotal, 2, 'hintTotal 是计划总步数，不随前进缩短（视图用它算「第 2/2 步」）');
  assert.equal(s.hintsUsed, 1, '一整段只消耗一次额度');
});

test('提示走偏即作废：留在屏上的指引必须和盘面对得上', () => {
  const s = create();
  install(s, [[['1p'], ['1p'], ['3p'], ['4p']]]);
  s.par = 30;
  s.solution = [{ kind: 'match', a: { r: 0, c: 0 }, b: { r: 0, c: 1 } }];
  s.requestHint();
  assert.equal(s.hint.length, 1);
  s.slide(0, 1);                                   // 推别的轨，没按计划走
  assert.equal(s.hint.length, 0, '计划作废，不许留错的指引');
  assert.equal(s.hintTotal, 0);
});

test('提示用完仍能免费重开', () => {
  const s = create();
  install(s, [[['1p'], ['1p']]]);
  s.hintsUsed = 3;
  s.requestHint();
  assert.match(s.message, /免费重开/);
  assert.equal(s.hint.length, 0);
});

test('体验版章节准入：unlockAll 全开，正式版按通关进度解锁', () => {
  const s = create();
  assert.equal(s.canEnterChapter(0), true, '第 1 章永远可进');
  assert.equal(s.canEnterChapter(1), false, '正式版默认第 2 章锁着');
  s.unlockAll = true;
  assert.equal(s.canEnterChapter(13), true, '体验版第 14 章也放行');
  assert.equal(s.canEnter(223), true, '体验版任意关都能进');
  assert.equal(s.maxLevel, 0, '跳关不推进解锁进度');
  s.unlockAll = false;
  assert.equal(s.canEnterChapter(13), false);
  assert.equal(s.canEnter(223), false);
});
