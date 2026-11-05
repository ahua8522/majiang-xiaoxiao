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
  // 锁轨不再从数组里消失，而是带着 locked 标记**留在原来的下标上**。
  // `Action.slide.run` 是数组下标：锁轨一旦缺席，连锁解锁触发时全部下标集体错位
  // （实测第 75 关解锁后 19→21 条，同一个下标从 row4 变成 row2），
  // 生成时的证书、已经发给玩家的提示、手指按下时记下的拖轨下标就全指向别的轨。
  const locked = R.runsFor(g, [0], []);
  assert.equal(locked.length, runs.length, '锁轨必须仍在数组里，只加 flag');
  assert.ok(locked.every(r => r.locked === true), '被锁的行上的轨要标成 locked');
  assert.equal(R.transition(g, locked, {kind: 'slide', run: 0, step: 1}).changed, false, '锁轨推不动');
  assert.deepEqual(R.slidable(locked), [], '可推下标要过滤掉锁轨');
  assert.deepEqual(R.slidable(runs), [0, 1], '没锁时两条轨都可推');
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

/* ── 冰牌：face 以 ~ 结尾；第一次消除只碎冰露出原牌，第二次才清走 ── */

test('冰对子第一次消除只碎冰露牌，不带走牌', () => {
  const g=[[['5s~'],['5s~'],[],[]]];
  const runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.ok(x.changed);
  assert.equal(R.count(x.grid),2,'碎冰不带走牌');
  assert.deepEqual(x.grid[0][0],['5s']);
  assert.deepEqual(x.grid[0][1],['5s']);
  assert.equal(x.erased[0].face,'5s~','消除记录里是带冰的牌面');
});

test('冰牌第二次消除才真正清走', () => {
  const g=[[['5s~'],['5s~'],[],[]]];
  const runs=R.runsFor(g,[],[]);
  let x=R.transition(g,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  x=R.transition(x.grid,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.equal(R.count(x.grid),0);
});

test('滑动连消里冰对子只碎冰，别处正常对子照常消除', () => {
  const g=[[['5s~'],['2p'],['2p'],['5s~']]];
  const runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'slide',run:0,step:1});
  assert.equal(R.count(x.grid),2,'2p 正常消掉，冰牌只碎冰');
  assert.deepEqual(x.grid[0].map(c=>Array.isArray(c)?c[c.length-1]??null:c),['5s','5s',null,null]);
});

test('露出的冰牌不得在同一事务里被顺手连消', () => {
  // 滑动后冰对子相邻且旁边正是同牌面：冰只碎一次，露出的 5s 留给下一手
  const g=[[['5s~'],['5s'],['5s~'],['2p']]];
  const runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'slide',run:0,step:1});
  // k=1 → [2p,5s~,5s,5s~]：无直接对子也不该有额外消除
  assert.equal(R.count(x.grid),4);
  // k=2 → [5s~,2p,5s~,5s]；冰不对 5s 相配，无消除
  const y=R.transition(g,runs,{kind:'slide',run:0,step:2});
  assert.equal(R.count(y.grid),4);
});

test('冰面只与同牌面的冰面相配', () => {
  assert.equal(R.partners([[['5s~'],['5s~']]],{r:0,c:0}).length,1);
  assert.equal(R.partners([[['5s~'],['5s']]],{r:0,c:0}).length,0);
});

/* ── 多层冰（厚冰）：`5s~~` 要碎两次冰 ── */

test('厚冰要碎两次才露牌：每消一次剥一层', () => {
  assert.equal(R.iceLayers('5s'),0);
  assert.equal(R.iceLayers('5s~'),1);
  assert.equal(R.iceLayers('5s~~'),2);
  const g=[[['5s~~'],['5s~~'],[],[]]], runs=R.runsFor(g,[],[]);
  let x=R.transition(g,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.deepEqual(x.grid[0][0],['5s~'],'第一下剥一层');
  assert.equal(R.count(x.grid),2);
  x=R.transition(x.grid,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.deepEqual(x.grid[0][0],['5s'],'第二下再剥一层');
  x=R.transition(x.grid,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.equal(R.count(x.grid),0,'第三下才收牌');
});

/* ── 单向轨：只能朝一个方向推 ── */

test('单向轨反向推无效、顺向推正常；普通轨不受影响', () => {
  const g=[[['1p'],['2p'],[],[]]];
  const runs=R.runsFor(g,[],[],[{axis:'row',index:0,dir:1}]);
  assert.equal(runs[0].dir,1,'run 应带上单向标记');
  assert.equal(R.transition(g,runs,{kind:'slide',run:0,step:-1}).changed,false,'反向推必须无效');
  assert.equal(R.transition(g,runs,{kind:'slide',run:0,step:1}).changed,true,'顺向推照常');
  const plain=R.runsFor(g,[],[]);
  assert.equal(plain[0].dir,undefined,'普通轨没有方向限制');
});

/* ── 花牌百搭：与任意牌都能配 ── */

test('花牌百搭（`*` 后缀）：能与任意牌配对，也能被任意牌配对；普通牌之间仍需同面', () => {
  assert.equal(R.partners([[['f3*'],['9m']]],{r:0,c:0}).length,1,'花牌能配任意牌');
  assert.equal(R.partners([[['9m'],['f3*']]],{r:0,c:0}).length,1,'任意牌也能配花牌');
  assert.equal(R.partners([[['9m'],['8m']]],{r:0,c:0}).length,0,'普通牌之间仍需同面');
  assert.equal(R.pairs([[['f3*'],['9m']]]).length,1,'百搭对子计入可消对');
  assert.equal(R.sameFacePairs([[['f3*'],['9m']]]).length,0,'质量线统计要排除百搭');
  assert.equal(R.isWild('f3*'),true);
  const g=[[['f3*'],['9m'],['8m']]], runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'match',a:{r:0,c:0},b:{r:0,c:1}});
  assert.equal(R.count(x.grid),1,'花牌吃掉一张后花牌自己也消失');
});

/* ── 鞭炮牌：配对时把四邻的冰层全部震碎 ── */

test('鞭炮配对：自身两格消除，同时震碎相邻冰牌（含同面整组，保证成对）', () => {
  const g=[[['5s~~'],['b1'],['b1'],['6p~']]];
  const runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'match',a:{r:0,c:1},b:{r:0,c:2}});
  assert.equal(R.count(x.grid),2,'只消掉鞭炮两格，邻牌还在');
  assert.deepEqual(x.grid[0][0],['5s~'],'左邻的厚冰被震碎一层');
  assert.deepEqual(x.grid[0][3],['6p'],'右邻的冰被震碎');
});

test('鞭炮震碎同面冰牌必须整组震碎，不能只碎单张（否则那一对永远配不上）', () => {
  // 同一面 '5s~' 有两对（4 张）：鞭炮只挨着其中两张，也必须 4 张一起碎
  const g=[[['5s~'],['b1'],['b1'],['5s~']],
           [['5s~'],[], [], ['5s~']]];
  const runs=R.runsFor(g,[],[]);
  const x=R.transition(g,runs,{kind:'match',a:{r:0,c:1},b:{r:0,c:2}});
  const iced=x.grid.flat().filter(Array.isArray).flat().filter(f=>String(f).endsWith('~')).length;
  assert.equal(iced,0,'同面的冰必须一起碎，不能留下单张');
  assert.equal(R.count(x.grid),4,'只碎冰不消牌');
});

/* ── 死局判定：必须可靠（实测 bug：最后剩一叠孤牌时既不判死也不判胜） ── */

test('孤零零的一叠牌判为死局（无同面邻居、四周空或障碍）', () => {
  const g = [[null, null, null], [null, ['f7','f7'], null], [null, null, null]];
  assert.equal(R.count(g), 2, '叠了两张');
  assert.equal(R.pairs(g).length, 0, '没有可消对子');
  assert.equal(R.isDead(g, (grid) => R.runsFor(grid, [], [])), true, '必须判死');
});

test('还有可消对子 / 还能靠滑动凑出对子时都不判死', () => {
  const pairNow = [[null, ['1p'], ['1p']], [null, null, null], [null, null, null]];
  assert.equal(R.isDead(pairNow, (grid) => R.runsFor(grid, [], [])), false, '有对子不算死');
  // 一张在行首、一张在行尾：转一格就能贴到一起 → 不是死局
  const slideCan = [[['1p'], ['2p'], ['3p'], ['1p']]];
  assert.equal(R.isDead(slideCan, (grid) => R.runsFor(grid, [], [])), false, '滑动能凑对不算死');
  // 隔着两张、环上也永远贴不到 → 死局
  const neverMeet = [[['1p'], ['2p'], ['1p'], ['3p']]];
  assert.equal(R.isDead(neverMeet, (grid) => R.runsFor(grid, [], [])), true, '永远凑不到就是死局');
});

test('死局判定必须按传入盘面重算滑轨', () => {
  // 只剩一张孤牌时，按当前盘面重算滑轨 → 没有任何可动轨道 → 死局
  const one = [[[], ['1p'], [], []], [[], [], [], []]];
  assert.equal(R.isDead(one, (grid) => R.runsFor(grid, [], [])), true, '单张孤牌判死');
});
