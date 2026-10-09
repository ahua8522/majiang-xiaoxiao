const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const R=require('../.test/core/Rules.js');
const G=fs.existsSync(__dirname+'/../.test/core/Generator.js')?require('../.test/core/Generator.js'):{};
test('五关每个随机开局证书都由真实转换完整清台，绝不返回未证明兜底',()=>{
  assert.equal(typeof G.generate,'function','缺少可证生成器');
  for(let level=0;level<18;level++)for(let seed=1;seed<=12;seed++){
    const d=G.generate(level,seed);let g=d.grid;const n=R.count(g);
    assert.ok(n>=12&&n%2===0);
    for(const action of d.solution){const next=R.transition(g,d.runs,action);assert.ok(next.changed);g=next.grid;}
    assert.equal(R.count(g),0,`level ${level} seed ${seed}`);
    const tally={};d.grid.flat().filter(Array.isArray).flat().forEach(f=>tally[f]=(tally[f]||0)+1);
    assert.ok(Object.values(tally).every(n=>n===2||n===4),'每种牌为一对或两对，最多四张');
    assert.ok(d.solution.length>0);
  }
});
test('同种子可复现；洗牌保留剩余牌种和数量，返回真实清台证书',()=>{
  assert.equal(typeof G.redeal,'function');
  const d=G.generate(3,37);assert.deepEqual(d,G.generate(3,37));
  let g=d.grid;for(const a of d.solution.slice(0,10))g=R.transition(g,d.runs,a).grid;
  const before=g.flat().filter(Array.isArray).flat().sort();
  const shuffled=G.redeal(3,g,92);assert.ok(shuffled);
  assert.deepEqual(shuffled.grid.flat().filter(Array.isArray).flat().sort(),before);
  let out=shuffled.grid;for(const a of shuffled.solution)out=R.transition(out,shuffled.runs,a).grid;
  assert.equal(R.count(out),0);
});
test('洗牌收到奇数同牌时拒绝，不破坏原棋盘',()=>{
  assert.equal(typeof G.redeal,'function');const g=[[['1p']]],before=JSON.stringify(g);
  assert.equal(G.redeal(0,g,1),null);assert.equal(JSON.stringify(g),before);
});
test('18关棋盘逐步扩大、牌量与机制分阶段提高，而非五关循环',()=>{
  assert.equal(G.LEVELS.length,18);
  let area=0;
  for(let i=0;i<18;i++){
    const level=G.LEVELS[i],nextArea=level.map.length*level.map[0].length;
    assert.ok(nextArea>=area);area=nextArea;
    const d=G.generate(i,7);
    assert.ok(R.count(d.grid)>=(i<3?12:20));
    if(i>=6)assert.ok(d.grid.flat().some(c=>Array.isArray(c)&&c.length>=2));
    if(i>=15)assert.ok(d.grid.flat().some(c=>Array.isArray(c)&&c.length===3));
  }
  assert.deepEqual([G.LEVELS[0].map[0].length,G.LEVELS[0].map.length],[4,3]);
  assert.deepEqual([G.LEVELS[17].map[0].length,G.LEVELS[17].map.length],[8,7]);
  assert.ok(G.LEVELS[17].lockR.length>1&&G.LEVELS[17].lockC.length>1);
  assert.throws(()=>G.generate(18,7));
});
