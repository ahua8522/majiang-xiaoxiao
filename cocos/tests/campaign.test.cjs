const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../.test/core/Rules'),G=require('../.test/core/Generator'),M=require('../.test/core/Mechanics');
const {Session,PAGE_SIZE}=require('../.test/core/Session');
const {CHAPTERS,CAMPAIGN_VERSION}=require('../.test/core/Campaign');
const memory=()=>({value:null,load(){return this.value;},save(v){this.value=JSON.parse(JSON.stringify(v));},feedback(){}});
const match=(r,c,d=c+1)=>({kind:'match',a:{r,c},b:{r,c:d}});
function fixture(grid,extra={}){
  const s=new Session(1);s.def={map:grid.map(row=>row.map(c=>Array.isArray(c)?Math.max(1,c.length):c===null?'.':'#').join('')),lockR:[],lockC:[],faces:4,scramble:0,...extra};
  s.grid=R.clone(grid);s.total=R.count(grid);s.liveTotal=s.total;s.mechanics=M.freshMechanics(s.def);s.goalTarget=0;
  s.modal='none';s.tip=null;s.coach=null;s.solution=[];s.runs=R.runsFor(s.grid,...Object.values(M.mechanicLocks(s.def,0,s.mechanics)),s.def.oneWay);return s;
}
test('520 关逐一通过 Session 真实目标、动态轨道及限步校验',()=>{
  const s=new Session(1),seen=new Set();let early=0,large=0;
  assert.equal(G.LEVELS.length,520);assert.equal(CHAPTERS.length,26);assert.equal(PAGE_SIZE,20);
  for(let i=0;i<520;i++){
    s.reset(i);s.tip=null;s.coach=null;s.maxLevel=i;
    assert.equal(s.levelIndex,i,`第 ${i+1} 关发生兜底`);
    assert.equal(R.boardHash(s.grid),s.def.hash);assert.ok(!seen.has(s.def.hash));seen.add(s.def.hash);
    if(s.grid.length>7||s.grid[0].length>6)large++;
    const route=s.solution.slice();let steps=0;
    for(const a of route){assert.equal(s.feed(a),true,`第 ${i+1} 关第 ${steps+1} 步`);steps++;if(s.modal==='win')break;assert.notEqual(s.modal,'lose',`第 ${i+1} 关提前判负`);}
    assert.equal(s.modal,'win',`第 ${i+1} 关未达成 ${s.objectiveText}`);
    if(s.goal)assert.equal(s.goalDone,s.goalNeed);
    if(R.count(s.grid))early++;
    assert.ok(s.moves<=90);assert.ok(!s.def.dialect&&!s.def.timeLimit);
    for(const k of s.def.keyLocks||[])if(!s.goal)assert.ok((s.mechanics.collected[k.face]||0)>=k.count);
  }
  assert.ok(large>150,'大布局确实进入主线');assert.ok(early>100,'目标关可以提前过关');
});
test('普通牌和冰牌配对只破冰，两张都留下且不给花圃/收集/能量记账',()=>{
  const s=fixture([[['4s~'],['4s']]],{energy:true,floors:[{r:0,c:0,kind:'flower',need:1}],goal:{kind:'garden',count:1}});
  s.feed(match(0,0));assert.equal(R.count(s.grid),2);assert.deepEqual(s.mechanics,{marks:[0],collected:{},charge:0});assert.equal(s.modal,'none');
  s.feed(match(0,0));assert.equal(s.modal,'win');assert.equal(s.mechanics.collected['4s'],2);assert.equal(s.mechanics.charge,1);
});
test('水滴只由上下左右消牌浇水，自身和斜角不计',()=>{
  const d={floors:[{r:1,c:1,kind:'dew',need:1}]};
  const event=(a,b)=>({erased:[{a,b,face:'4s',other:'4s'}]});
  assert.deepEqual(M.advanceMechanics(d,M.freshMechanics(d),event({r:1,c:1},{r:0,c:0})).marks,[0]);
  assert.deepEqual(M.advanceMechanics(d,M.freshMechanics(d),event({r:1,c:0},{r:0,c:0})).marks,[1]);
});
test('花苞必须在两个动作中消除，多波连消同一格仅浇一次',()=>{
  const d={floors:[{r:0,c:0,kind:'bud',need:2}]};
  const p={a:{r:0,c:0},b:{r:0,c:1},face:'4s',other:'4s'},out={erased:[p,p],chain:2};
  const once=M.advanceMechanics(d,M.freshMechanics(d),out);assert.deepEqual(once.marks,[1]);
  assert.deepEqual(M.advanceMechanics(d,once,out).marks,[2]);
});
test('钥匙收齐后开轨，撤销同时收回钥匙并重新上锁',()=>{
  const s=fixture([[['4s'],['4s'],['6s'],['6s']]],{keyLocks:[{axis:'row',index:0,face:'4s',count:2}]});
  assert.ok(s.runs.find(r=>r.axis==='row').locked);
  s.feed(match(0,0));assert.equal(s.mechanics.collected['4s'],2);assert.ok(!s.runs.find(r=>r.axis==='row').locked);
  s.undo();assert.equal(s.mechanics.collected['4s'],undefined);assert.ok(s.runs.find(r=>r.axis==='row').locked);
});
test('灵感四对充满，提示确实找到才扣能量；撤销不能返还已用能量',()=>{
  const s=fixture([[['1p'],['1p'],['2p'],['2p'],['3p'],['3p'],['4p'],['4p'],['5p'],['5p']]],{energy:true});
  for(const c of [0,2,4,6])s.feed(match(0,c));assert.equal(s.mechanics.charge,4);
  s.requestHint();assert.ok(s.hint.length);assert.equal(s.mechanics.charge,0);assert.equal(s.hintsUsed,0);
  s.undo();assert.equal(s.mechanics.charge,0);s.hint=[];s.feed(match(0,6));assert.equal(s.mechanics.charge,1);
  const no=fixture([[['1p'],['2p']]],{energy:true});no.mechanics.charge=4;no.requestHint();assert.equal(no.hint.length,0);assert.equal(no.mechanics.charge,4);
});
test('牌清空但花苞未完成判负，禁止重排，可从失败页撤销和重开',()=>{
  const s=fixture([[['4s'],['4s']]],{floors:[{r:0,c:0,kind:'bud',need:2}],goal:{kind:'garden',count:1}});
  s.feed(match(0,0));assert.equal(s.goalDone,0);assert.equal(s.modal,'lose');assert.equal(s.failReason,'dead');
  assert.equal(s.rescueShuffle(),false);s.command('undo');assert.equal(s.modal,'none');assert.equal(R.count(s.grid),2);assert.deepEqual(s.mechanics.marks,[0]);
  s.reset();assert.equal(s.hintsLeft,3);
});
test('同版本中盘保存花圃、钥匙、能量、限步及提示额度，重载不重置目标',()=>{
  for(const index of [180,220,460,519]){
    const p=memory(),s=new Session(1,p);s.maxLevel=index;s.reset(index);s.tip=null;
    let n=0;for(const a of s.solution.slice()){s.feed(a);if(s.modal!=='none')break;if(++n>=4)break;}
    assert.equal(s.modal,'none',`存档样本 ${index+1} 太短`);s.requestHint();
    const copy=JSON.parse(JSON.stringify(s.mechanics)),grid=R.signature(s.grid),target=s.goalNeed;
    const restored=new Session(2,p);assert.equal(restored.levelIndex,index);assert.equal(restored.moves,s.moves);assert.equal(R.signature(restored.grid),grid);
    assert.deepEqual(restored.mechanics,copy);assert.equal(restored.goalNeed,target);assert.equal(restored.hintsUsed,s.hintsUsed);assert.equal(restored.movesLeft,s.movesLeft);
    assert.deepEqual(restored.solution,s.solution);assert.deepEqual(restored.hint,s.hint);
    assert.equal(p.value.campaign,CAMPAIGN_VERSION);
  }
});
test('旧版进度归档保留关号，开发跳关通关不会把正式进度推到后期',()=>{
  const p=memory();p.value={version:2,maxLevel:79,stars:{0:3},vibration:false};
  const s=new Session(1,p);assert.equal(s.maxLevel,79);assert.equal(s.vibration,false);assert.deepEqual(s.stars,{});assert.equal(s.legacyProgress.stars[0],3);
  s.unlockAll=true;s.reset(519);s.tip=null;for(const a of s.solution.slice()){s.feed(a);if(s.modal==='win')break;}
  assert.equal(s.modal,'win');assert.equal(s.maxLevel,79);s.command('next');assert.equal(s.levelIndex,519);
});
test('损坏的机关存档被拒绝，不能伪造钥匙或过量能量',()=>{
  const d=G.LEVELS[180];assert.equal(M.restoreMechanics(d,{marks:[],collected:{'bogus':2},charge:0}),null);
  assert.equal(M.restoreMechanics(d,{marks:[],collected:{'4s':5},charge:0}),null);
  assert.equal(M.restoreMechanics(d,{marks:[],collected:{},charge:5}),null);
  assert.deepEqual(M.restoreRoute(d,[[['4s'],['4s']]],M.freshMechanics(d),0,[{kind:'match',a:{r:99,c:0},b:{r:0,c:1}}]),[]);
});
