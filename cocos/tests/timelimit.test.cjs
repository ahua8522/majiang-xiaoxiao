/**
 * 限时关卡的门禁。
 *
 * 限时最容易做错的四件事，这个文件一一对着测：
 *  1. 掉帧/切后台造成的一帧大 dt 把倒计时吃掉（所以单帧要钳制）；
 *  2. 暂停中还在走表（弹窗、说明卡、切后台都必须停）；
 *  3. 剩余时间没进存档 —— 杀进程重进等于白送一次重来的机会，是可刷漏洞；
 *  4. 判负理由写成"步数用尽"，玩家不知道自己是超时还是走错。
 *
 * 注：这些用例是**注入 def** 而不是在关卡表里找限时关——现在表里还没有
 * （章节表在 Task 8 才接上），找表的写法会让整份文件静默空转、看起来全绿。
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const S = core('Session.js');
const R = core('Rules.js');

/** 一个能记住存档的假平台，用来验"杀进程重进"。 */
const store = () => {const data = {current: null}; return {load: () => data.current, save: (v) => {data.current = typeof v === 'string' ? v : JSON.stringify(v);}, feedback() {}};};

/**
 * 造一个带限时的会话。
 *
 * 必须改**关卡表本身**（`levelAt(i)` 返回的就是那个对象），不能只改 `session.def` 的副本：
 * 存档恢复那条路是按 `levelAt(run.index).timeLimit` 收界的，改副本等于绕过被测代码，
 * "杀进程重进倒计时不清零"就变成一条永远为真的空测试。
 * `node --test` 每个文件独占一个进程，所以这里的临时改动不会泄漏到别的测试文件，
 * 但同一个文件里仍然要用 `untimed()` 还原。
 */
const L = S.LEVELS || core('Generator.js').LEVELS;
const IDX = 0;
let saved = null;
function timed(platform, seconds = 30) {
  if (saved === null) saved = L[IDX].timeLimit;
  L[IDX].timeLimit = seconds;
  const s = new S.Session(20261016, platform);
  s.command('continue');
  s.tip = null;
  return s;
}
function untimed() { L[IDX].timeLimit = saved; }
/**
 * 按"帧"推进 N 秒。
 *
 * 不能直接 `tick(25)`：单帧钳制 0.25 秒正是设计的一部分（下一条用例就在测它），
 * 一次喂 25 秒只该扣掉 0.25。用 0.2 秒步长模拟正常帧，才是在测走表本身。
 */
function run(s, sec) { for (let i = 0; i < Math.ceil(sec / 0.2); i++) s.tick(0.2); return s; }

test('限时关有 timeLeft，非限时关为 0', () => {
  const s = timed(store(), 30);
  assert.equal(s.timeLeft, 30);
  assert.ok(typeof s.tick === 'function', 'Session.tick 还不存在');
});

test('未暂停时按 dt 递减，暂停中一律不走表', () => {
  const s = timed(store(), 30);
  s.setPaused(true);
  s.tick(1); s.tick(1);
  assert.equal(s.timeLeft, 30, '暂停中却扣了时间');
  assert.equal(s.modal, 'none');
  s.setPaused(false);
  run(s, 1);
  // 0.2 秒步长累加必然带浮点尾巴（30-0.2*5=28.999999999999996）。视图只取 Math.ceil 显示，
  // 所以按容差判——不假装浮点是精确的。
  assert.ok(Math.abs(s.timeLeft - 29) < 1e-6, s.timeLeft);
});

test('一帧卡住 30 秒也只算 0.25 秒（掉帧不许吃掉倒计时）', () => {
  const s = timed(store(), 30);
  s.tick(30);
  assert.ok(s.timeLeft >= 29.75, `一次掉帧扣掉了 ${30 - s.timeLeft} 秒`);
  assert.equal(s.modal, 'none', '掉一下帧就判负是事故');
});

test('弹窗或说明卡挡着时不许走表', () => {
  const s = timed(store(), 30);
  s.tip = 'basic'; s.tick(5);
  assert.equal(s.timeLeft, 30, '教学卡弹出时还在计时');
  s.tip = null; s.modal = 'pause'; s.tick(5);
  assert.equal(s.timeLeft, 30, '暂停面板开着还在计时');
  s.modal = 'none';
});

test('时间到就判负，理由是"时间到"', () => {
  const p = store();
  const s = timed(p, 8);
  assert.equal(s.grid.length > 0, true);
  run(s, 8.5);
  assert.equal(s.modal, 'lose');
  assert.match(s.message, /时间到/);
  assert.ok(!/步数/.test(s.message), `判负理由写错了：${s.message}`);
});

test('剩余时间进存档：换新进程重进，倒计时不清零', () => {
  const p = store();
  const a = timed(p, 60);
  run(a, 25);
  assert.ok(a.timeLeft < 60);
  const left = a.timeLeft;
  // 模拟杀进程重进：新的 Session、同样的存储、完全不同的进程种子
  const b = new S.Session(777001, p);
  assert.equal(b.levelIndex, a.levelIndex, '没恢复到同一关');
  assert.ok(b.timeLeft <= left + 0.001 && b.timeLeft > 0, `读档后倒计时是 ${b.timeLeft}，应接近 ${left}`);
});

test('非限时关调 tick 是安全的空操作', () => {
  untimed();                                     // 还原第 1 关：这一条要测的就是"表里没这个字段"
  const s = new S.Session(5, store());
  s.command('continue'); s.tip = null;
  assert.equal(s.timeLeft, 0);
  assert.equal(s.tick(5), false);
  assert.equal(s.modal, 'none');
});
