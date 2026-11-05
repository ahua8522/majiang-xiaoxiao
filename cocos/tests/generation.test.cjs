const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const R=require('../.test/core/Rules.js');
const G=fs.existsSync(__dirname+'/../.test/core/Generator.js')?require('../.test/core/Generator.js'):{};
test('全部关卡证书都由真实转换走完，绝不返回未证明兜底',()=>{
  assert.equal(typeof G.generate,'function','缺少可证生成器');
  assert.equal(G.LEVELS.length,520,`关数 ${G.LEVELS.length}`);
  // 钉死那颗种子**必须**能发能证（发布内容可证的定义）；抽样种子是"洗牌能不能用"的代理指标，
  // 方言关牌池窄，个别种子发不出满盘解是允许的，但不能成批失败（下面按 2/3 兜）。
  // 只对**提供洗牌**的关要求"抽样种子也能发牌"：方言关按产品决定不提供洗牌
  // （Session.shuffleBlocked），那里的窄牌池发不出可证满盘解是预期行为，不该记成失败。
  const shuffleFail=[];
  for(let level=0;level<G.LEVELS.length;level++){const def=G.LEVELS[level];
    if(def.dialect)continue;
    let ok=0;for(const seed of [1,7,20261013]){try{G.generate(level,seed);ok++;}catch{}}
    if(ok<2)shuffleFail.push(`第 ${level+1} 关只有 ${ok}/3 颗种子能发牌（洗牌几乎必失败）`);
  }
  assert.deepEqual(shuffleFail,[],shuffleFail.join(String.fromCharCode(10)));
  for(let level=0;level<G.LEVELS.length;level++){const def=G.LEVELS[level];
    for(const seed of [def.seed]){
    const d=G.generate(level,seed);let g=d.grid;const n=R.count(g);
    assert.ok(n>=8&&n%2===0);
    for(const action of d.solution){const next=R.transition(g,d.runs,action,def.dialect);assert.ok(next.changed);g=next.grid;}
    assert.equal(R.liveCount(g,def.dialect),0,`level ${level} seed ${seed}`);
    const tally={};d.grid.flat().filter(Array.isArray).flat().forEach(f=>tally[f]=(tally[f]||0)+1);
    assert.ok(Object.entries(tally).every(([f,n])=>n===2||n===4||(f==='b1'&&n<=8)),'每种牌为一对或两对（鞭炮最多四对）');
    assert.ok(d.solution.length>0);
    }
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

// 花牌从第五章（第 65 关）起才允许入池：前四章是"不认识字牌之前先别认识花牌"。
test('花牌按章节门槛入池：前四章不出现，第五章起才允许',()=>{
  assert.ok(Array.isArray(G.BASE_FACES)&&G.BASE_FACES.length===34,'基础池应为 34 种');
  assert.ok(Array.isArray(G.FLOWER_FACES)&&G.FLOWER_FACES.length===8);
  const flowerFaces=(level,seed)=>{
    const d=G.generate(level,seed);
    return d.grid.flat().filter(Array.isArray).flat().some(f=>String(f)[0]==='f');
  };
  for(const level of [0,20,40,63])for(const seed of [1,7,20261015]){
    // 前四章（0-63）的 def 一律不许开 flowers，盘上也就不该有花牌
    assert.ok(!G.LEVELS[level].flowers,`第 ${level+1} 关不该标 flowers`);
    assert.ok(!flowerFaces(level,seed),`第 ${level+1} 关不该出现花牌`);
  }
  // 标了 flowers 的关必须"大量真的出现"——否则玩家收到花牌说明卡却一张花牌都见不到
  let hit=0,flagged=0;
  for(let level=0;level<G.LEVELS.length;level++){
    if(!G.LEVELS[level].flowers)continue;
    flagged++;
    const d=G.generate(level,G.LEVELS[level].seed);
    if(d.grid.flat().filter(Array.isArray).flat().some(f=>String(f)[0]==='f'))hit++;
  }
  assert.ok(flagged>0,'该有花牌章了');
  assert.ok(hit/flagged>=0.9,`标了 flowers 的关只有 ${hit}/${flagged} 真出现花牌，说明卡会教空的东西`);
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
    if(L.dialect)continue;                      // 方言关不提供洗牌，抽样种子不是它的验收面
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
test('后期完整打乱失败时逐步构造，不退回铺满现成对子的简单牌局',()=>{  // 挑三关"提供洗牌"的关（方言关牌池窄、抽样种子可能发不出牌，语义上不该进这条）
  const probes=[20,70,140].map((hint)=>{
    for(let i=hint;i<G.LEVELS.length;i++)if(!G.LEVELS[i].dialect)return i;
    return -1;
  }).filter((i)=>i>=0);
  for(const level of probes)for(const seed of [1,7,20261013]){
    const d=G.generate(level,seed);
    assert.equal(d.fallback,false,`level ${level} seed ${seed}`);
    assert.ok(R.sameFacePairs(d.grid).length<=Math.floor(R.count(d.grid)/5),'初始直接对子保持少量，不退回整盘即消（统计用同面对；wild/冰面关实测最多 ~count/5.5）');
    let g=d.grid;
    for(const action of d.solution){const next=R.transition(g,d.runs,action);assert.ok(next.changed);g=next.grid;}
    assert.equal(R.count(g),0);
  }
});
test('520 个固定牌局各不相同，牌桌大小交替、机制按学习顺序进入',()=>{
  const seen=new Set(),sizes=new Set();let reductions=0;
  for(let i=0;i<G.LEVELS.length;i++){
    const L=G.LEVELS[i],d=G.generate(i,L.seed),hash=R.boardHash(d.grid);
    assert.ok(!seen.has(hash),`重复牌局 ${i+1}`);seen.add(hash);
    const rows=L.map.length,cols=L.map[0].length;sizes.add(`${cols}x${rows}`);
    assert.ok(cols<=8&&rows<=10&&R.count(d.grid)<=136);
    if(i&&rows*cols<G.LEVELS[i-1].map.length*G.LEVELS[i-1].map[0].length)reductions++;
    if(i<20)assert.ok(!L.ice&&!L.floors&&!L.oneWay&&!L.moveLimit);
    if(i<40)assert.ok(!L.ice);
    assert.ok(!L.dialect&&!L.timeLimit);
  }
  assert.ok(sizes.has('8x10')&&sizes.size>=10);assert.ok(reductions>60,'穿插小盘休息关');
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
      assert.ok(L.goal.count>=1&&L.goal.count<=20,`第 ${i+1} 关目标数异常`);
      // collect 目标带的是 faces 数组（八花齐/三元齐/清龙），以前只认 face/ice 两种
      assert.ok(L.goal.kind==='face'?!!L.goal.face
        :L.goal.kind==='collect'?!!(L.goal.faces&&L.goal.faces.length)
        :L.goal.kind==='garden'?!!L.floors?.length:L.goal.kind==='ice',`第 ${i+1} 关目标定义不完整`);
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
  assert.ok(bombs>=3,`鞭炮关太少：${bombs}`);        // 鞭炮只在有冰的关、每章 k%5===4
  assert.ok(wild>=4,`百搭关太少：${wild}`);          // 设计是每章 2-4 关，第五章给 4 关
  assert.ok(ice2>=6,`厚冰关太少：${ice2}`);
  for(const k of Array.from({length:26},(_,i)=>'ctip:'+i))
    assert.ok(intros.has(k),`缺少机制说明键 ${k}`);
});
