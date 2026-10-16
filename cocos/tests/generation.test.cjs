const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const R=require('../.test/core/Rules.js');
const G=fs.existsSync(__dirname+'/../.test/core/Generator.js')?require('../.test/core/Generator.js'):{};
test('全部关卡每个随机开局证书都由真实转换完整清台，绝不返回未证明兜底',()=>{
  assert.equal(typeof G.generate,'function','缺少可证生成器');
  assert.ok(G.LEVELS.length>=100,`关卡数不足 100（当前 ${G.LEVELS.length}）`);
  for(let level=0;level<G.LEVELS.length;level++)for(const seed of [1,7,20261013]){
    const d=G.generate(level,seed);let g=d.grid;const n=R.count(g);
    assert.ok(n>=8&&n%2===0);
    for(const action of d.solution){const next=R.transition(g,d.runs,action);assert.ok(next.changed);g=next.grid;}
    assert.equal(R.count(g),0,`level ${level} seed ${seed}`);
    const tally={};d.grid.flat().filter(Array.isArray).flat().forEach(f=>tally[f]=(tally[f]||0)+1);
    assert.ok(Object.entries(tally).every(([f,n])=>n===2||n===4||(f==='b1'&&n<=8)),'每种牌为一对或两对（鞭炮最多四对）');
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

/* ── 花牌与冰面（生成器） ── */

test('花牌 f1..f8 入池，牌池 = 34 基础 + 8 花 + 1 鞭炮',()=>{
  assert.equal(typeof G.FACES,'function'?typeof G.FACES:'object');
  for(const f of ['f1','f4','f8'])assert.ok(G.FACES.includes(f),`缺少花牌 ${f}`);
  assert.equal(G.BASE_FACES.length,34);
  assert.equal(G.FLOWER_FACES.length,8);
  assert.ok(G.FACES.includes(G.BOMB_FACE),'鞭炮牌应在全池里（供图集与存档校验）');
  assert.equal(G.FACES.length,43);
  assert.ok(!G.BASE_FACES.includes(G.BOMB_FACE),'鞭炮不该出现在随机基础池里');
});

test('花牌按关卡门槛入池：51 关前不出现，51 关后大量出现',()=>{
  assert.ok(Array.isArray(G.BASE_FACES)&&G.BASE_FACES.length===34,'基础池应为 34 种');
  assert.ok(Array.isArray(G.FLOWER_FACES)&&G.FLOWER_FACES.length===8);
  const flowerFaces=(level,seed)=>{
    const d=G.generate(level,seed);
    return d.grid.flat().filter(Array.isArray).flat().some(f=>String(f)[0]==='f');
  };
  for(const level of [0,5,20,35,49])for(const seed of [1,7,20261015]){
    assert.ok(!flowerFaces(level,seed),`第 ${level+1} 关不该出现花牌`);
  }
  let hit=0;
  for(let level=50;level<G.LEVELS.length;level++)if(flowerFaces(level,7))hit++;
  const late=G.LEVELS.length-50;
  assert.ok(hit>=late*0.8,`51 关后应大量出现花牌（实际 ${hit}/${late}）`);
});

test('construct 支持冰面：恰好包 ice 对冰，重放证书可清台',()=>{
  const def={map:['11','11'],lockR:[],lockC:[],faces:2,scramble:2,ice:1};
  const d=G.construct(def,7);
  assert.ok(d,'应能生成');
  const iced=d.grid.flat().filter(Array.isArray).flat().filter(f=>String(f).endsWith('~'));
  assert.equal(iced.length,2,'恰好一对冰');
  let g=d.grid;
  for(const a of d.solution){const next=R.transition(g,d.runs,a);assert.ok(next.changed);g=next.grid;}
  assert.equal(R.count(g),0,'证书必须清台');
});

test('redeal 保留冰面牌种；面不成对时拒绝',()=>{
  const g=[[['5s~'],['2p'],[],[]],[[],['2p'],['5s~'],[]],[[],[],[],[]]];
  const s=G.redeal(0,g,92);
  assert.ok(s);
  assert.deepEqual(s.grid.flat().filter(Array.isArray).flat().sort(),['2p','2p','5s~','5s~']);
  let out=s.grid;for(const a of s.solution)out=R.transition(out,s.runs,a).grid;
  assert.equal(R.count(out),0,'重排后证书仍可清台');
  const broken=[[['5s~'],['5s'],[],[]],[[],[],[],[]],[[],[],[],[]]];
  assert.equal(G.redeal(0,broken,92),null,'冰面不成对不可重排');
});
test('发布的盘面不带锁轨白送对子：按钉死种子重算，0 冲突 ≥95%、均值 ≤0.15',()=>{
  // 口径变更（2026-10-16，随内容冻结一起做）：以前这条测的是"生成器在 9 颗随机种子下的平均
  // 表现"。现在关卡内容由 (map, seed) 钉死、并且跑批会**扫种子挑 0 冲突那一盘**，
  // 玩家拿到的永远是挑中的那一盘——所以该测的是发布内容，而不是生成器的平均运气。
  // 生成器的整体表现另有一条宽松兜底（见下），它只防"完全不罚冲突"的退化。
  // 实测两个口径的差：发布盘面 0 冲突 100%（挑过），随机 9 种子 70.5%、均值 0.909。
  const inLock=(L,p)=>L.lockR.includes(p.r)||L.lockC.includes(p.c);
  let locked=0,clean=0,total=0,worst=0,noSeed=0;
  for(let i=0;i<G.LEVELS.length;i++){
    const L=G.LEVELS[i];
    if(!L.lockR.length&&!L.lockC.length)continue;
    if(!Number.isInteger(L.seed)){noSeed++;continue;}
    locked++;
    const d=G.generate(i,L.seed);
    const n=R.pairs(d.grid).filter(pr=>inLock(L,pr.a)&&inLock(L,pr.b)).length;
    if(!n)clean++;total+=n;worst=Math.max(worst,n);
  }
  assert.ok(locked>0,'应存在锁轨关');
  assert.equal(noSeed,0,`${noSeed} 关没钉种子，先跑 npm run author:levels`);
  assert.ok(clean/locked>=0.95,`发布盘面 0 冲突占比 ${clean}/${locked}`);
  assert.ok(total/locked<=0.15,`发布盘面冲突均值 ${(total/locked).toFixed(3)}（worst ${worst}）`);
});
test('生成器整体不退化成"完全不罚冲突"（宽松兜底，非发布口径）',()=>{
  // 这条只守一个下限：随机种子的冲突均值不许失控。运行时为了进关速度在"满足步数上限"
  // 时就提前返回（实测省 2.3 倍延迟），所以它天生做不到 0——别拿它当发布质量线，
  // 发布质量看上面那条。阈值来自本轮实测 0.909，留一倍余量只防数量级退化。
  const inLock=(L,p)=>L.lockR.includes(p.r)||L.lockC.includes(p.c);
  let combos=0,total=0,worst=0;
  for(let i=0;i<G.LEVELS.length;i++){
    const L=G.LEVELS[i];
    if(!L.lockR.length&&!L.lockC.length)continue;
    for(const seed of [1,7,20261015,10,4]){
      combos++;
      const d=G.generate(i,seed);
      const n=R.pairs(d.grid).filter(pr=>inLock(L,pr.a)&&inLock(L,pr.b)).length;
      total+=n;worst=Math.max(worst,n);
      assert.ok(n<=20,`第 ${i+1} 关 seed ${seed} 锁轨冲突 ${n} 处，超过上限 20`);
    }
  }
  assert.ok(combos>0,'应存在锁轨关');
  assert.ok(total/combos<=2.0,`随机种子冲突均值 ${total/combos}，生成器可能不再惩罚冲突（worst ${worst}）`);
});
test('后期完整打乱失败时逐步构造，不退回铺满现成对子的简单牌局',()=>{  for(const [level,seeds] of [[40,[1,10,31]],[70,[4,8,26]],[99,[4,13,27]]])for(const seed of seeds){
    const d=G.generate(level,seed);
    assert.equal(d.fallback,false,`level ${level} seed ${seed}`);
    assert.ok(R.sameFacePairs(d.grid).length<=Math.floor(R.count(d.grid)/5),'初始直接对子保持少量，不退回整盘即消（统计用同面对；wild/冰面关实测最多 ~count/5.5）');
    let g=d.grid;
    for(const action of d.solution){const next=R.transition(g,d.runs,action);assert.ok(next.changed);g=next.grid;}
    assert.equal(R.count(g),0);
  }
});
test('120 关棋盘两两不同，尺寸与机制随难度递进',()=>{
  assert.equal(G.LEVELS.length,120);
  const seen=new Set();
  let prevArea=0;
  for(let i=0;i<G.LEVELS.length;i++){
    const L=G.LEVELS[i],key=L.map.join('|');
    assert.ok(!seen.has(key),`第 ${i+1} 关棋盘与前面某关完全相同`);
    seen.add(key);
    const rows=L.map.length,cols=L.map[0].length,area=rows*cols;
    if(i<100){
      // 前 100 关：接近方形、面积单调递增
      assert.ok(area>=prevArea,`第 ${i+1} 关棋盘面积比上一关小`);prevArea=area;
    }else{
      // 101 关起换窄高盘（长方形，行 > 列）：面积允许回落，但必须是「竖着长」的盘
      assert.ok(rows>cols,`第 ${i+1} 关应是窄高盘（rows>cols），实际 ${rows}x${cols}`);
    }
    assert.ok(L.faces>=4&&L.faces<=42,`第 ${i+1} 关花色数越界`);
    const d=G.generate(i,7),slots=R.count(d.grid);
    assert.ok(slots<=136,'牌位上限 136');
    if(i>=14)assert.ok(d.grid.flat().some(c=>Array.isArray(c)&&c.length>=2),`第 ${i+1} 关应出现叠层`);
    if(i>=66)assert.ok(d.grid.flat().some(c=>Array.isArray(c)&&c.length===3),`第 ${i+1} 关应出现三层`);
    if(i>=25)assert.ok(L.lockR.length>0||L.lockC.length>0,`第 ${i+1} 关应出现锁轨`);
    if(i<50)assert.ok(!L.ice,`第 ${i+1} 关不应有冰面`);
    if(i>=51)assert.ok((L.ice||0)>0,`第 ${i+1} 关应有冰面`);
  }
  assert.deepEqual([G.LEVELS[0].map[0].length,G.LEVELS[0].map.length],[4,3]);
  assert.ok(G.LEVELS[99].map.length>=8&&G.LEVELS[99].map[0].length>=9);
  assert.ok(G.LEVELS[119].map.length>G.LEVELS[119].map[0].length,'终关应是窄高盘');
  assert.throws(()=>G.generate(120,7));
  assert.throws(()=>G.generate(-1,7));
});

test('新机制按配额落位，且确实用到了（不生成「名义上有、实际没有」的关）',()=>{
  let moveLimit=0,goal=0,oneWay=0,unlock=0,bombs=0,wild=0,ice2=0;
  const intros=new Set();
  for(let i=0;i<G.LEVELS.length;i++){
    const L=G.LEVELS[i];
    if(L.moveLimit){
      moveLimit++;
      const par=G.generate(i,7).solution.length;
      assert.ok(L.moveLimit>=par,`第 ${i+1} 关限步 ${L.moveLimit} 小于参考解 ${par}，理论上过不了`);
    }
    if(L.goal){
      goal++;
      assert.ok(L.goal.count>=2&&L.goal.count<=20,`第 ${i+1} 关目标数异常`);
      assert.ok(L.goal.kind==='face'?!!L.goal.face:L.goal.kind==='ice',`第 ${i+1} 关目标定义不完整`);
    }
    if(L.oneWay&&L.oneWay.length){
      oneWay++;
      for(const w of L.oneWay){
        const lockedRail = w.axis === 'row' ? L.lockR.includes(w.index) : L.lockC.includes(w.index);
        assert.ok(!lockedRail,`第 ${i+1} 关单向轨与同轴锁轨重叠`);
        assert.ok(!L.unlock||!L.unlock.some((u)=>u.axis===w.axis&&u.index===w.index),`第 ${i+1} 关单向轨与连锁解锁重叠`);
      }
    }
    if(L.unlock&&L.unlock.length)unlock++;
    if(L.bombs){bombs++;assert.ok(L.ice,`第 ${i+1} 关有鞭炮却没有冰面（鞭炮是破冰用的）`);}
    if(L.wild){wild++;assert.ok(L.flowers,`第 ${i+1} 关百搭必须先有花牌入池`);}
    if(L.ice2){ice2++;assert.ok(L.ice2<=L.ice,`第 ${i+1} 关厚冰数超过冰对数`);}
    if(L.intro)intros.add(L.intro);
  }
  assert.ok(moveLimit>=20,`限步关太少：${moveLimit}`);
  assert.ok(goal>=8,`目标关太少：${goal}`);
  assert.ok(oneWay>=8,`单向轨关太少：${oneWay}`);
  assert.ok(unlock>=6,`连锁解锁关太少：${unlock}`);
  assert.ok(bombs>=6,`鞭炮关太少：${bombs}`);
  assert.ok(wild>=5,`百搭关太少：${wild}`);
  assert.ok(ice2>=6,`厚冰关太少：${ice2}`);
  for(const k of ['basic','stack','lockRow','moveLimit','oneWay','lockCol','goal','ice','flower','wild','stack3','ice2','bomb','unlock'])
    assert.ok(intros.has(k),`缺少机制说明键 ${k}`);
});
