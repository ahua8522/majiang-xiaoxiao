const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const enginePath = path.join(__dirname, '../.test/core/Rules.js');
const R = fs.existsSync(enginePath) ? require(enginePath) : {};

// These literal boards catch face-wide exclusion, illegal matching and false deadlocks.
test('移动后，同花色在别处已有对子也不能阻止新对子自动消除', () => {
  assert.equal(typeof R.transition, 'function', '缺少统一的规则转换函数');
  const g = [[['1p'], ['1p'], ['1p'], []], [[], [], [], ['1p']]];
  const runs = R.runsFor(g, [], []);
  const result = R.transition(g, runs, {kind:'slide', run:runs.findIndex(r=>r.axis==='col'&&r.index===3), step:1});
  assert.equal(R.count(result.grid), 2);
  assert.deepEqual(g[1][3], ['1p'], '原输入不得被修改');
});
test('唯一邻居一点消除；多个邻居必须保留选择权', () => {
  assert.equal(typeof R.partners, 'function');
  assert.equal(R.partners([[['1p'],['1p'],['1p']]], {r:0,c:1}).length, 2);
  assert.equal(R.partners([[['1p'],['1p'],['2p']]], {r:0,c:0}).length, 1);
});
test('滑动带动整叠；障碍分段、禁止跨越或错向替代', () => {
  assert.equal(typeof R.runsFor, 'function');
  const g = [[['1p','2p'],[], '#', ['3p'], []]];
  const runs = R.runsFor(g, [], []);
  assert.equal(runs.length, 2);
  const x = R.transition(g,runs,{kind:'slide',run:0,step:1});
  assert.deepEqual(x.grid[0], [[],['1p','2p'],'#',['3p'],[]]);
  assert.equal(R.runsFor(g,[0],[]).length,0);
});
test('一滑多次露底连消，一次事务返回完整消除记录', () => {
  assert.equal(typeof R.transition,'function');
  const g = [[['2p','1p'],[],['2p','1p']]];
  const x=R.transition(g,R.runsFor(g,[],[]),{kind:'slide',run:0,step:1});
  assert.equal(R.count(x.grid),0);
  assert.equal(x.erased.length,2);
  assert.equal(x.chain,2);
});
test('不可消除斜角、不等牌、同一格，也不可推空转整圈', () => {
  assert.equal(typeof R.transition,'function');
  const g=[[['1p'],['2p']],[[],['1p']]], runs=R.runsFor(g,[],[]);
  for(const b of [{r:1,c:1},{r:0,c:1},{r:0,c:0}])
    assert.equal(R.transition(g,runs,{kind:'match',a:{r:0,c:0},b}).changed,false);
  assert.equal(R.transition(g,runs,{kind:'slide',run:0,step:2}).changed,false);
});
test('两张同牌需两步接近时提供完整路线而非无路', () => {
  assert.equal(typeof R.searchHint,'function');
  const g=Array.from({length:4},()=>Array.from({length:5},()=>[]));
  g[0][0]=['1p'];g[2][3]=['1p'];const runs=R.runsFor(g,[],[]);
  const h=R.searchHint(g,runs,{budget:12000,maxDepth:3});
  assert.equal(h.status,'found');assert.ok(h.actions.length>=2);
  let current=g;for(const a of h.actions)current=R.transition(current,runs,a).grid;
  assert.equal(R.count(current),0);
});
test('固定格能由别的牌靠近，不能用移动连通分量误判', () => {
  assert.equal(typeof R.searchHint,'function');
  const g=[[['1p'],[],[]],[[],[],['1p']],[[],[],[]]];
  const runs=R.runsFor(g,[0],[0]);
  const h=R.searchHint(g,runs,{budget:3000,maxDepth:3});
  assert.equal(h.status,'found');
});
test('同一环形行内相隔固定的两张牌确实无路；预算耗尽只能未知', () => {
  assert.equal(typeof R.searchHint,'function');
  const g=[[['1p'],[],['1p'],[]]],runs=R.runsFor(g,[],[]);
  assert.equal(R.searchHint(g,runs,{budget:100,maxDepth:12}).status,'dead');
  const large=Array.from({length:4},()=>Array.from({length:5},()=>[]));
  large[0][0]=['1p'];large[2][3]=['1p'];
  assert.equal(R.searchHint(large,R.runsFor(large,[],[]),{budget:1,maxDepth:8}).status,'unknown');
});
