/* 逻辑审查压力测试：生成器鲁棒性 / searchHint 误报 / redeal 安全性 */
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../.test/core/Rules.js');
const G = require('../.test/core/Generator.js');

test('A. 100 关 × 200 种子 generate 全部成功且证书可清台', () => {
  const SEEDS = 200;
  const fails = [];
  for (let level = 0; level < G.LEVELS.length; level++) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = (s * 2654435761) >>> 0 || 42;
      let d;
      try { d = G.generate(level, seed); }
      catch (e) { fails.push(`L${level + 1} seed=${seed}: ${e.message}`); continue; }
      let g = d.grid;
      for (const a of d.solution) { const nx = R.transition(g, d.runs, a); assert.ok(nx.changed); g = nx.grid; }
      if (R.count(g) !== 0) fails.push(`L${level + 1} seed=${seed}: 证书未清台`);
    }
    if (fails.length > 5) break;
  }
  assert.equal(fails.length, 0, fails.slice(0, 5).join(' | '));
});

test('B. 已证明可解的中途盘面，searchHint 绝不返回 dead（可 unknown）', () => {
  let checked = 0, unknown = 0, dead = [];
  for (let level = 0; level < G.LEVELS.length; level += 7) { // 抽样 15 关
    for (let s = 0; s < 12; s++) {
      const seed = (s * 97 + 13) >>> 0;
      const d = G.generate(level, seed);
      // 沿参考解随机前进 k 步（k=0..solution.length），每一步都保证剩余盘面仍可清台
      for (const frac of [0, 0.25, 0.5, 0.75, 0.9]) {
        let g = d.grid;
        const k = Math.floor(d.solution.length * frac);
        for (let i = 0; i < k; i++) g = R.transition(g, d.runs, d.solution[i]).grid;
        if (!R.count(g)) continue;
        checked++;
        const h = R.searchHint(g, d.runs, { budget: 2400, maxDepth: 3 });
        if (h.status === 'dead') dead.push(`L${level + 1} seed=${seed} k=${k}/${d.solution.length} left=${R.count(g)}`);
        if (h.status === 'unknown') unknown++;
      }
    }
  }
  assert.equal(dead.length, 0, dead.slice(0, 3).join(' | '));
  console.log(`  B: checked=${checked} unknown=${unknown}`);
});

test('C. 随机中途盘面 redeal：要么成功且保留牌种、证书可清台，要么返回 null，绝不抛错', () => {
  let ok = 0, reject = 0;
  for (let level = 0; level < G.LEVELS.length; level += 11) {
    for (let s = 0; s < 20; s++) {
      const seed = (s * 7919 + 3) >>> 0;
      const d = G.generate(level, seed);
      let g = d.grid;
      const k = Math.floor((s / 20) * d.solution.length);
      for (let i = 0; i < k; i++) g = R.transition(g, d.runs, d.solution[i]).grid;
      if (!R.count(g)) continue;
      let out;
      try { out = G.redeal(level, g, seed ^ 0x5bf03635); }
      catch (e) { assert.fail(`L${level + 1} seed=${seed}: redeal threw ${e.message}`); }
      if (!out) { reject++; continue; }
      const before = g.flat().filter(Array.isArray).flat().sort();
      const after = out.grid.flat().filter(Array.isArray).flat().sort();
      assert.deepEqual(after, before, `L${level + 1} 洗牌改了牌种`);
      let h = out.grid;
      for (const a of out.solution) h = R.transition(h, out.runs, a).grid;
      assert.equal(R.count(h), 0, `L${level + 1} 洗牌证书不可清台`);
      ok++;
    }
  }
  console.log(`  C: redeal ok=${ok} reject=${reject}`);
});

test('D. transition 链式消除的不变量：消除后各花色计数保持偶数且不增', () => {
  for (let level = 0; level < G.LEVELS.length; level += 9) {
    const d = G.generate(level, (level * 31 + 7) >>> 0);
    let g = d.grid;
    for (const a of d.solution) {
      const nx = R.transition(g, d.runs, a);
      const tally = {};
      nx.grid.flat().filter(Array.isArray).flat().forEach(f => tally[f] = (tally[f] || 0) + 1);
      assert.ok(Object.values(tally).every(n => n % 2 === 0), `L${level + 1} 消除后出现奇数张`);
      g = nx.grid;
    }
  }
});
