/* 逻辑审查压力测试：生成器鲁棒性 / searchHint 误报 / redeal 安全性
 *
 * ⚠️ 这份文件 2026-10 的初版是按「任意种子都能出关、清台 = count 0」写的，那套口径
 * 在方言 / 百搭 / 钉死种子之后已经不成立，四条用例全部误报：
 *   ① 关卡是固定谜题，运行时只用 `def.seed`；`generate(level, 随机种子)` 允许失败
 *      （`Session.deal` 的兜底就是为此存在的），拿它当断言等于测一个不存在的契约。
 *   ② 方言关的终点是 `liveCount === 0`（哑弹留在盘上），不是 `count === 0`。
 *   ③ 百搭一次收走两张不同面的牌，牌面计数必然出现奇数；"每种牌偶数张"不再是不变量。
 *   ④ 断门（noSlideSuit）的牌点得掉、滑不消，`transition` 必须带方言。
 *
 * 现在的用例只钉**真实契约**：每关用钉死种子出关、证书带方言重放后 liveCount 归零；
 * 提示在已证明可解的中途盘面绝不报 dead；洗牌守恒；消除过程中牌数只减不增。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const R = core('Rules.js');
const G = core('Generator.js');

/** 证书重放：与 `certify()` 同一套口径——滑轨用开局几何，配对判定带方言。 */
function replay(deal, def, label) {
  let g = deal.grid;
  for (const a of deal.solution) {
    const nx = R.transition(g, deal.runs, a, def.dialect);
    assert.equal(nx.changed, true, `${label} 的证书里有一手无效动作`);
    g = nx.grid;
  }
  return g;
}

test('A. 每关用钉死种子出关，证书带方言重放后 liveCount 归零', () => {
  const fails = [];
  for (let i = 0; i < G.LEVELS.length; i++) {
    const def = G.LEVELS[i];
    assert.ok(Number.isInteger(def.seed), `第 ${i + 1} 关没有钉死种子`);
    let d;
    try { d = G.generate(i, def.seed); }
    catch (e) { fails.push(`L${i + 1}: ${e.message}`); continue; }
    const g = replay(d, def, `L${i + 1}`);
    // 方言关允许剩哑弹：判据是「还能配的牌」清空，不是牌位清空
    if (R.liveCount(g, def.dialect) !== 0) fails.push(`L${i + 1}: liveCount=${R.liveCount(g, def.dialect)}`);
    if (fails.length > 5) break;
  }
  assert.equal(fails.length, 0, fails.join(' | '));
});

test('B. 已证明可解的中途盘面，searchHint 绝不返回 dead（可 unknown）', () => {
  let checked = 0, unknown = 0, dead = [];
  for (let level = 0; level < G.LEVELS.length; level += 7) { // 抽样 32 关
    const def = G.LEVELS[level];
    const d = G.generate(level, def.seed);
    for (const frac of [0, 0.25, 0.5, 0.75, 0.9]) {
      let g = d.grid, cleared = 0;
      const k = Math.floor(d.solution.length * frac);
      for (let i = 0; i < k; i++) {
        const nx = R.transition(g, d.runs, d.solution[i], def.dialect);
        if (!nx.changed) break;
        // 连锁解锁按「真正消掉的对数」推进：碎冰不算（与 Session.apply 同口径）
        cleared += nx.erased.filter((p) => !R.hasIce(p.face) && !R.hasIce(p.other)).length;
        g = nx.grid;
      }
      if (R.liveCount(g, def.dialect) === 0) continue;
      checked++;
      // 锁轨/连锁锁要按当前进度重算；滑轨的**数组形状**在消除前后不变（空位仍是数组），
      // 但 locked 标记会随进度变化，用开局的 runs 会把已解锁的轨当成推不动。
      const locks = G.activeLocks(def, cleared);
      const runs = R.runsFor(g, locks.lockR, locks.lockC, def.oneWay);
      const h = R.searchHint(g, runs, { budget: 2400, maxDepth: 3 }, def.dialect);
      if (h.status === 'dead') dead.push(`L${level + 1} k=${k}/${d.solution.length} left=${R.liveCount(g, def.dialect)}`);
      if (h.status === 'unknown') unknown++;
    }
  }
  assert.equal(dead.length, 0, dead.slice(0, 3).join(' | '));
  console.log(`  B: checked=${checked} unknown=${unknown}`);
});

test('C. 随机中途盘面 redeal：保留牌种，成功时证书带方言可清台，失败只返回 null', () => {
  let ok = 0, reject = 0;
  for (let level = 0; level < G.LEVELS.length; level += 11) {
    const def = G.LEVELS[level];
    const d = G.generate(level, def.seed);
    for (let s = 0; s < 20; s++) {
      let g = d.grid;
      const k = Math.floor((s / 20) * d.solution.length);
      for (let i = 0; i < k; i++) g = R.transition(g, d.runs, d.solution[i], def.dialect).grid;
      if (!R.count(g)) continue;
      let out;
      try { out = G.redeal(level, g, (def.seed ^ (s * 0x5bf03635)) >>> 0); }
      catch (e) { assert.fail(`L${level + 1} s=${s}: redeal threw ${e.message}`); }
      if (!out) { reject++; continue; }
      // 洗牌只重排：牌面清单必须一字不差（含冰层/百搭后缀与叠层张数）
      const before = g.flat().filter(Array.isArray).flat().sort();
      const after = out.grid.flat().filter(Array.isArray).flat().sort();
      assert.deepEqual(after, before, `L${level + 1} 洗牌改了牌种`);
      const h = replay(out, def, `L${level + 1} redeal s=${s}`);
      assert.equal(R.liveCount(h, def.dialect), 0, `L${level + 1} 洗牌证书不可清台`);
      ok++;
    }
  }
  console.log(`  C: redeal ok=${ok} reject=${reject}`);
});

test('D. 消除过程中牌数只减不增，且每一手证书动作都真的生效', () => {
  for (let level = 0; level < G.LEVELS.length; level += 9) {
    const def = G.LEVELS[level];
    const d = G.generate(level, def.seed);
    let g = d.grid;
    let live = R.liveCount(g, def.dialect);
    for (const a of d.solution) {
      const nx = R.transition(g, d.runs, a, def.dialect);
      assert.equal(nx.changed, true, `L${level + 1} 证书动作无效`);
      assert.ok(R.count(nx.grid) <= R.count(g), `L${level + 1} 牌数变多了`);
      const nextLive = R.liveCount(nx.grid, def.dialect);
      assert.ok(nextLive <= live, `L${level + 1} liveCount 变多了`);
      live = nextLive;
      g = nx.grid;
    }
    assert.equal(live, 0);
  }
});
