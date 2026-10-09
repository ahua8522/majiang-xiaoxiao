const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const R=require('../.test/core/Rules.js');
const mod=fs.existsSync(__dirname+'/../.test/core/Session.js')?require('../.test/core/Session.js'):{};
const create=()=>{assert.equal(typeof mod.Session,'function','缺少事务会话');const s=new mod.Session(18);s.command('continue');return s;};
function install(s,g,locksR=[],locksC=[]){s.grid=g;s.runs=R.runsFor(g,locksR,locksC);s.total=R.count(g);s.modal='none';s.solution=[];s.selected=null;s.moves=0;}
test('唯一邻居单点清台且撤销恢复棋盘、步数、清台弹框',()=>{
  const s=create();install(s,[[['1p'],['1p']]]);s.tap({r:0,c:0});
  assert.equal(R.count(s.grid),0);assert.equal(s.modal,'win');assert.equal(s.undo(),true);
  assert.equal(R.count(s.grid),2);assert.equal(s.modal,'none');assert.equal(s.moves,0);
});
test('多邻居先选择再配对，不能第一次点击擅自决定',()=>{
  const s=create();install(s,[[['1p'],['1p'],['1p'],['1p']]]);
  s.tap({r:0,c:1});assert.equal(R.count(s.grid),4);s.tap({r:0,c:2});assert.equal(R.count(s.grid),2);
});
test('一次撤销恢复滑动与全部连消；空撤销不动状态',()=>{
  const s=create();install(s,[[['2p','1p'],[],['2p','1p']]]);const before=JSON.stringify(s.grid);
  s.slide(0,1);assert.equal(R.count(s.grid),0);assert.equal(s.moves,1);assert.equal(s.lastChain,2);
  assert.equal(s.undo(),true);assert.equal(JSON.stringify(s.grid),before);assert.equal(s.moves,0);assert.equal(s.lastChain,0);
  assert.equal(s.undo(),false);assert.equal(JSON.stringify(s.grid),before);
});
test('洗牌也可整体撤回，不在旧坐标逐张塞回导致污染',()=>{
  const s=create();s.modal='none';const before=JSON.stringify(s.grid);
  assert.equal(s.shuffle(),true);assert.equal(s.undo(),true);assert.equal(JSON.stringify(s.grid),before);
});
test('关闭设置回到同一盘；重开先确认，重开后丢弃旧拖拽与提示',()=>{
  const s=create();s.modal='none';const before=JSON.stringify(s.grid);
  s.command('settings');s.tap({r:0,c:0});assert.equal(JSON.stringify(s.grid),before);
  s.command('close');assert.equal(s.modal,'none');s.command('restart');assert.equal(JSON.stringify(s.grid),before);
  s.command('confirm-restart');assert.equal(s.modal,'none');assert.equal(s.moves,0);assert.equal(s.hint.length,0);assert.equal(s.selected,null);
});
test('无路搜索不弹失败页，预算未知不等于死局；提示持续直到操作',()=>{
  const s=create();install(s,[[['1p'],[],['1p'],[]]]);s.requestHint();assert.equal(s.modal,'none');assert.match(s.message,/洗牌|重开|撤销/);
  install(s,[[['1p'],[],[]],[[],[],['1p']],[[],[],[]]],[0],[0]);s.requestHint();assert.ok(s.hint.length);assert.equal(s.modal,'none');
});
test('存档损坏/写入失败不阻塞游戏，设置与最高关卡可持久化',()=>{
  assert.equal(typeof mod.Session,'function');
  const bad={load:()=>'{bad',save:()=>{throw new Error('quota');},feedback:()=>{}};
  const s=new mod.Session(18,bad);s.command('settings');s.command('toggle-motion');assert.equal(s.reducedMotion,true);
  const memory={value:null,load(){return this.value;},save(v){this.value=v;},feedback(){}};
  const first=new mod.Session(1,memory);first.command('settings');first.command('toggle-vibration');
  const second=new mod.Session(1,memory);assert.equal(second.vibration,false);
});
test('点消和滑动均计步；目标内无辅助三星，辅助最多两星',()=>{
  const s=create();install(s,[[['1p'],['1p']]]);s.par=1;s.tap({r:0,c:0});
  assert.equal(s.moves,1);assert.equal(s.rating,3);assert.equal(s.stars[0],3);
  s.reset(1);install(s,[[['1p'],['1p']]]);s.par=1;s.requestHint();s.tap({r:0,c:0});
  assert.equal(s.hintsUsed,1);assert.equal(s.rating,2);assert.equal(s.stars[1],2);
  s.reset(1);install(s,[[['1p'],['1p']]]);s.par=1;s.moves=3;s.tap({r:0,c:0});
  assert.equal(s.rating,1);assert.equal(s.stars[1],2,'历史最佳星级不能被低星覆盖');
});
test('提示重复查看不扣次数，洗牌限额不能用撤销回补',()=>{
  const s=create();install(s,[[['1p'],['1p'],['2p'],['2p']]]);
  for(let i=0;i<10;i++)s.requestHint();assert.equal(s.hintsUsed,1);
  for(let i=0;i<2;i++){assert.equal(s.shuffle(),true);assert.equal(s.undo(),true);}
  const before=JSON.stringify(s.grid);assert.equal(s.shuffle(),false);assert.equal(s.shufflesLeft,0);assert.equal(JSON.stringify(s.grid),before);
  s.hint=[];s.hintsUsed=3;s.requestHint();assert.equal(s.hint.length,0);assert.match(s.message,/已用完/);
});
test('章节分页、锁定关卡与终关不循环回第一关',()=>{
  const s=create();s.command('levels');s.command('page-next');assert.equal(s.levelPage,1);
  s.command('level:6');assert.equal(s.levelIndex,0);s.command('close');
  s.reset(17);install(s,[[['1p'],['1p']]]);s.par=1;s.tap({r:0,c:0});
  assert.equal(s.maxLevel,17);s.command('next');assert.equal(s.levelIndex,17);assert.equal(s.modal,'win');
  s.command('home');assert.equal(s.modal,'home');s.command('settings');s.command('close');assert.equal(s.modal,'home');
});
test('保存当前棋盘与辅助次数，重新进入可以继续；旧存档升级与非法存档安全回退',()=>{
  const store={value:null,load(){return this.value;},save(v){this.value=JSON.parse(JSON.stringify(v));},feedback(){}};
  const s=new mod.Session(7,store);assert.equal(s.modal,'home');s.command('continue');
  s.slide(0,1);s.requestHint();const board=JSON.stringify(s.grid);
  const again=new mod.Session(8,store);assert.equal(again.modal,'home');assert.equal(JSON.stringify(again.grid),board);assert.equal(again.moves,s.moves);assert.equal(again.hintsUsed,s.hintsUsed);
  again.command('continue');assert.equal(again.modal,'none');
  store.value.run.grid=[[['hacked']]];assert.doesNotThrow(()=>new mod.Session(7,store));
  store.value={version:1,maxLevel:4,vibration:false};const legacy=new mod.Session(7,store);assert.equal(legacy.maxLevel,4);assert.equal(legacy.vibration,false);
});
