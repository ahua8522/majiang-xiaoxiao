const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = fs.existsSync(path.join(__dirname, '../.test/core/Challenge.js'))
  ? require('../.test/core/Challenge.js') : {};
const M = fs.existsSync(path.join(__dirname, '../.test/core/ChallengeSession.js'))
  ? require('../.test/core/ChallengeSession.js') : {};

const board = (rows) => rows.map((row) => row.split('').map((ch) => (ch === '.' ? null : [ch])));
const show = (g) => g.map((row) => row.map((c) => (Array.isArray(c) ? c[0] : '.')).join('')).join('|');
const faceCounts = (g) => {
  const out = {};
  for (const row of g) for (const cell of row) if (Array.isArray(cell) && cell.length) out[cell[0]] = (out[cell[0]] || 0) + 1;
  return out;
};
const replay = (deal, rows, cols) => {
  let g = deal.grid;
  for (const a of deal.solution) {
    const res = C.applyRotate(g, a);
    if (!res.changed) return {ok: false, at: show(g)};
    g = res.grid;
  }
  return {ok: C.tileCount(g) === 0, left: C.tileCount(g)};
};

test('挑战规则：同线同牌隔着空格算一对，中间有别的牌就挡住', () => {
  assert.equal(typeof C.visiblePairs, 'function', '缺少挑战配对函数');
  assert.equal(C.visiblePairs(board(['A.A.B', 'C.C..'])).length, 2, '两行各一对，没有多余的列对');
  assert.equal(C.visiblePairs(board(['A.B.A', '.....'])).length, 0, '中间夹一张 B 就不成对');
  assert.equal(C.visiblePairs(board(['A..', '.B.', 'A..'])).length, 1, '同一列隔空格也算一对');
});

test('挑战规则：整行/整列循环滑动，牌和空格一起走', () => {
  assert.equal(typeof C.rotateLine, 'function');
  assert.equal(show(C.rotateLine(board(['AB..']), 'row', 0, 1)), '.AB.');
  assert.equal(show(C.rotateLine(board(['AB..']), 'row', 0, -1)), 'B..A');
  assert.equal(show(C.rotateLine(board(['AB..']), 'row', 0, 4)), 'AB..', '整圈等于没动');
  assert.equal(show(C.rotateLine(board(['A..', 'B..', 'C..']), 'col', 0, 1)), 'C..|A..|B..', '整列循环：向下滑一格，最后一格绕到最上面');
});

test('挑战规则：没有消掉任何牌的滑动整步无效，盘面不变', () => {
  const g = board(['AB..', '....']);
  const before = show(g);
  const res = C.applyRotate(g, {axis: 'row', index: 0, step: 1});
  assert.equal(res.changed, false);
  assert.equal(show(g), before, '输入盘面不得被修改');
  assert.equal(C.applyRotate(g, {axis: 'row', index: 0, step: 4}).changed, false, '整圈滑动不算一步');
});

test('挑战规则：滑动让牌在**垂直方向**对上，自动消除并能跨空格连锁', () => {
  // (1,1) 的 A 向右滑 2 格落到 (1,0)，与 (0,0) 的 A 在同一列对上。
  const g = board(['A.B', '.A.', 'B..']);
  const res = C.applyRotate(g, {axis: 'row', index: 1, step: 2});
  assert.equal(res.changed, true);
  assert.equal(res.erased.length, 1);
  assert.equal(C.tileCount(res.grid), 2);
  // 一次滑动同时打开两条线：横向把 B 绕到最右列与另一张 B 对上，同时让开中间的空格，
  // 让第 0 列的两张 A 也隔空成对——一波收两对。
  const two = board(['A..B', 'B...', 'A...']);
  const r2 = C.applyRotate(two, {axis: 'row', index: 1, step: 3});
  assert.equal(r2.changed, true, '滑动后应出现可消对子');
  assert.equal(r2.erased.length, 2);
  assert.equal(C.tileCount(r2.grid), 0);
});

test('挑战生成：50 盘都有可重放的证书，开局没有白送对子，第 2 盘起就是 14×10 大盘', () => {
  assert.equal(typeof C.generateChallenge, 'function');
  const started = Date.now();
  for (let level = 1; level <= 50; level++) {
    const deal = C.generateChallenge(level, 0x51ed + level * 97);
    assert.ok(deal.solution.length > 0, `第 ${level} 盘没有证书`);
    assert.equal(C.visiblePairs(deal.grid).length, 0, `第 ${level} 盘开局就有可消对子`);
    const r = replay(deal);
    assert.equal(r.ok, true, `第 ${level} 盘证书重放失败，剩 ${r.left}`);
    assert.equal(C.tileCount(deal.grid), deal.pairs * 2, `第 ${level} 盘牌数与证书对数不符`);
    if (level === 1) {
      assert.equal(deal.rows, 5, '第 1 盘是上手小盘');
      assert.equal(deal.cols, 5, '第 1 盘是上手小盘');
    } else {
      assert.equal(deal.rows, 14, `第 ${level} 盘应当直接是 14 行大盘`);
      assert.equal(deal.cols, 10, `第 ${level} 盘应当直接是 10 列大盘`);
      assert.ok(deal.pairs >= 40, `第 ${level} 盘牌对太少：${deal.pairs}`);
    }
    if (level >= 12) {
      assert.ok(deal.pairs >= 50, `后期牌对太少：${deal.pairs}`);
      assert.ok(deal.pairs * 2 >= 0.75 * deal.rows * deal.cols, '后期盘面要接近满盘');
    }
  }
  const ms = Date.now() - started;
  assert.ok(ms < 5000, `50 盘生成耗时 ${ms}ms，超出运行时预算`);
});

test('挑战出盘：同一关重复进入会换一副牌（每盘随机生成）', () => {
  let mem = null;
  const platform = {load: () => mem, save: (d) => { mem = JSON.stringify(d); }, feedback: () => {}};
  const a = new M.ChallengeSession(0x7777, platform);
  a.startAt(2);
  const first = C.boardKey(a.grid);
  a.startAt(2);
  const second = C.boardKey(a.grid);
  assert.notEqual(second, first, '同一个种子重进第 2 盘也必须重出一盘');
  assert.equal(C.visiblePairs(a.grid).length, 0);
  assert.equal(replay({grid: a.grid, solution: a.solution}).ok, true);
});

test('挑战洗牌：牌种与张数守恒，洗出来的盘仍然可解（含后期大盘）', () => {
  for (const level of [8, 20, 50]) {
    const deal = C.generateChallenge(level, 424242 + level);
    let g = deal.grid;
    for (let i = 0; i < 3 && i < deal.solution.length; i++) {
      const res = C.applyRotate(g, deal.solution[i]);
      if (!res.changed) break;
      g = res.grid;
    }
    const before = faceCounts(g);
    const re = C.reshuffleChallenge(g, 777 + level);
    assert.ok(re, `第 ${level} 盘中盘洗牌失败`);
    assert.deepEqual(faceCounts(re.grid), before, `第 ${level} 盘洗牌不许改牌种/张数`);
    assert.equal(C.visiblePairs(re.grid).length, 0, `第 ${level} 盘洗牌后不许直接白送对子`);
    assert.equal(replay(re).ok, true, `第 ${level} 盘洗牌后的盘必须可解`);
  }
});

test('挑战会话：按证书走完升级，下一盘重新计数；存档可恢复', () => {
  assert.equal(typeof M.ChallengeSession, 'function');
  let mem = null;
  const platform = {load: () => mem, save: (d) => { mem = JSON.stringify(d); }, feedback: () => {}};
  const s = new M.ChallengeSession(0x1234, platform);
  assert.equal(s.level, 1);
  assert.ok(s.runs.length === s.rows + s.cols, '挑战模式的轨道是整行 + 整列');
  let guard = 0;
  while (!s.won && guard++ < 200) {
    const a = s.solution[0];
    assert.ok(a, '证书中途断了');
    assert.ok(s.rotate(a.axis, a.index, a.step), '证书里的滑动被拒绝');
  }
  assert.equal(s.won, true);
  assert.equal(s.cleared, 1);
  assert.equal(s.remaining, 0);
  assert.equal(s.next(), true);
  assert.equal(s.level, 2);
  assert.equal(s.moves, 0);
  const before = {level: s.level, tiles: s.remaining, rows: s.rows, cols: s.cols, moves: s.moves};
  const s2 = new M.ChallengeSession(1, platform);
  assert.deepEqual({level: s2.level, tiles: s2.remaining, rows: s2.rows, cols: s2.cols, moves: s2.moves}, before, '存档恢复后盘面必须一致');
  assert.ok(s2.solution.length > 0, '恢复后提示证书要还在');
});

test('挑战会话：提示扣次数、洗牌守恒、重开回到本盘开局', () => {
  let mem = null;
  const platform = {load: () => mem, save: (d) => { mem = JSON.stringify(d); }, feedback: () => {}};
  const s = new M.ChallengeSession(0x99, platform);
  const startKey = C.boardKey(s.grid);
  assert.equal(s.requestHint(), true);
  assert.ok(s.hint, '提示必须给一个滑动动作');
  assert.equal(s.hintsLeft, 2);
  assert.match(s.describe(s.hint), /滑 \d+ 格/);
  assert.equal(s.shuffle(), true);
  assert.equal(s.shufflesLeft, 1);
  assert.equal(C.visiblePairs(s.grid).length, 0);
  assert.equal(replay({grid: s.grid, solution: s.solution}).ok, true);
  s.restart();
  assert.equal(C.boardKey(s.grid), startKey, '重开必须回到本盘开局');
  assert.equal(s.hintsLeft, 3);
  assert.equal(s.shufflesLeft, 2);
  assert.equal(s.moves, 0);
});

test('挑战会话：消不掉牌的滑动不提交、不刷步数', () => {
  const s = new M.ChallengeSession(0xabc, {load: () => null, save: () => {}, feedback: () => {}});
  let act = null;
  for (let r = 0; r < s.rows && !act; r++) {
    for (let step = 1; step < s.cols; step++) {
      if (!C.applyRotate(s.grid, {axis: 'row', index: r, step}).changed) { act = {axis: 'row', index: r, step}; break; }
    }
  }
  assert.ok(act, '找不到一个消不掉牌的滑动');
  const before = s.moves, key = C.boardKey(s.grid);
  assert.equal(s.rotate(act.axis, act.index, act.step), null);
  assert.equal(s.moves, before);
  assert.equal(C.boardKey(s.grid), key);
  assert.match(s.message, /消不掉|只允许/);
});
