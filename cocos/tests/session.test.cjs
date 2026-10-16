const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const R=require('../.test/core/Rules.js');
const mod=fs.existsSync(__dirname+'/../.test/core/Session.js')?require('../.test/core/Session.js'):{};
const create=()=>{assert.equal(typeof mod.Session,'function','缺少事务会话');const s=new mod.Session(18);s.command('continue');s.tip=null;return s;};
function install(s,g,locksR=[],locksC=[]){s.grid=g;s.runs=R.runsFor(g,locksR,locksC);s.total=R.count(g);s.modal='none';s.solution=[];s.selected=null;s.moves=0;s.tip=null;s.clearedPairs=0;s.goalDone=0;}
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
test('关卡分页、未解锁关卡点不动与终关不循环回第一关',()=>{
  const s=create();s.command('levels');s.command('page-next');assert.equal(s.levelPage,1);
  s.command('level:6');assert.equal(s.levelIndex,0);s.command('close');
  const last=s.levelCount-1;
  s.reset(last);install(s,[[['1p'],['1p']]]);s.par=1;s.tap({r:0,c:0});
  assert.equal(s.maxLevel,last);s.command('next');assert.equal(s.levelIndex,last);assert.equal(s.modal,'win');
  s.command('home');assert.equal(s.modal,'home');s.command('settings');s.command('close');assert.equal(s.modal,'home');
});

test('unlockAll 打开时体验版可直接选任意关（正式版不受影响）',()=>{
  const s=create();s.command('levels');
  s.command('level:40');assert.equal(s.levelIndex,0,'默认必须按解锁进度选关');
  s.unlockAll=true;s.command('level:40');assert.equal(s.levelIndex,40,'体验版可直接跳关');
  assert.equal(s.maxLevel,0,'跳关不推进解锁进度');
  s.unlockAll=false;s.command('level:60');assert.equal(s.levelIndex,40,'关掉后立即恢复限制');
});
test('弹窗记住是从首页还是牌桌打开的，供视图决定底图画哪一屏',()=>{
  const s=create();                                   // create() 已 command('continue')，处在牌桌
  assert.equal(s.modal,'none');assert.equal(s.openedFrom,'none');
  s.command('settings');assert.equal(s.openedFrom,'none');s.command('close');assert.equal(s.modal,'none');
  s.command('home');assert.equal(s.modal,'home');
  for(const id of ['settings','help','levels']){
    s.command(id);assert.equal(s.modal,id);assert.equal(s.openedFrom,'home',`从首页打开 ${id} 应记住 home`);
    s.command('close');assert.equal(s.modal,'home',`关闭 ${id} 应回到首页`);
  }
  s.command('continue');assert.equal(s.modal,'none');
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

test('存档接受冰面与花牌 face，非法牌面仍拒绝',()=>{
  const store={value:null,load(){return this.value;},save(v){this.value=JSON.parse(JSON.stringify(v));},feedback(){}};
  const s=new mod.Session(7,store);s.command('continue');
  // 用会话**当前这一盘**改脸，不硬编形状：硬编的 3x3 塞进 3x4 的关卡会被 restore
  // 的形状校验挡掉，断言就变成"恢复的盘 != 存档的盘"，测的其实不是牌面兼容性。
  const grid=R.clone(s.grid);
  const cells=[];grid.forEach((row,r)=>row.forEach((c,cc)=>{if(Array.isArray(c)&&c.length)cells.push([r,cc]);}));
  grid[cells[0][0]][cells[0][1]]=['5s~'];
  grid[cells[1][0]][cells[1][1]]=['f1'];
  store.value.run.grid=grid;
  const again=new mod.Session(9,store);
  assert.equal(JSON.stringify(again.grid),JSON.stringify(grid),'冰面与花牌 face 应原样恢复');
  store.value.run.grid=[[[' hacked '],[],[],[]],[[],[],[],[]],[[],[],[],[]]];
  const third=new mod.Session(9,store);
  assert.notEqual(JSON.stringify(third.grid),JSON.stringify(store.value.run.grid),'非法牌面必须回退');
});

/* ── 新机制（会话层） ── */

test('限步关：步数用尽仍未清台 → 明确判负（modal=lose）',()=>{
  const s=create();install(s,[[['1p'],['2p'],[],[]]]);
  s.def={...s.def,moveLimit:2};
  s.slide(0,1);assert.equal(s.modal,'none','第一步不该失败');
  s.slide(0,1);assert.equal(s.modal,'lose','步数用尽必须判负');
  assert.match(s.message,/步数/);
  assert.equal(s.undo(),true,'失败后仍可撤销回退');
  assert.equal(s.modal,'none');
});

test('限步关：在步数内清台仍是通关',()=>{
  const s=create();install(s,[[['1p'],['1p']]]);
  s.def={...s.def,moveLimit:1};
  s.tap({r:0,c:0});assert.equal(s.modal,'win');
});

test('目标关：达成目标即通关，不必清空棋盘',()=>{
  const s=create();install(s,[[['1p'],['1p']],[[],['2p']]]);
  s.def={...s.def,goal:{kind:'face',face:'1p',count:1}};
  s.tap({r:0,c:0});
  assert.equal(s.goalDone,1);
  assert.equal(s.modal,'win','目标达成即胜');
  assert.ok(R.count(s.grid)>0,'棋盘还有牌也照样通关');
});

test('目标关：冰面目标按碎冰次数累计',()=>{
  const s=create();install(s,[[['5s~'],['5s~']]]);
  s.def={...s.def,goal:{kind:'ice',count:1}};
  s.tap({r:0,c:0});
  assert.equal(s.goalDone,1,'碎冰一次算一次');
  assert.equal(s.modal,'win');
});

test('连锁解锁：消够对数后该轨自动解锁（runs 随之变化）',()=>{
  const s=create();
  // 两行：第 0 行锁住（消 1 对后解锁），第 1 行可自由消
  install(s,[[['1p'],['2p'],[],[]],[[],['3p'],['3p'],[]]]);
  s.def={...s.def,unlock:[{axis:'row',index:0,after:1}]};
  s.runs=R.runsFor(s.grid,[0],[],undefined);   // 初始：第 0 行锁住（轨道仍在数组里，只是 locked）
  assert.equal(s.runs.some(r=>r.axis==='row'&&r.index===0&&r.locked),true,'初始该行被锁住：有轨道但推不动');
  assert.deepEqual(R.slidable(s.runs).filter(i=>s.runs[i].axis==='row'&&s.runs[i].index===0),[],'锁轨不在可推下标里');
  const before=s.runs.length;
  s.tap({r:1,c:1});                            // 消掉 3p 一对 → clearedPairs=1
  assert.equal(s.clearedPairs,1);
  assert.equal(s.runs.some(r=>r.axis==='row'&&r.index===0&&!r.locked),true,'消够对数后该行解锁');
  assert.equal(s.runs.length,before,'解锁前后轨道数量不变——证书与提示里的下标才不会漂');
});

/* 防回归：百搭（`f*`）一次收走两张**不同面**的牌，牌面计数必然出现奇数张。
 * 旧的存档/洗牌校验要求「每种牌偶数张」，于是把这种合法中盘状态当脏数据：
 * 重开回到开局、洗牌永久返回「无法安全重排」（实测第 60 关 5 个种子全部复现）。
 */
test('百搭配对之后：奇数张照样存档、读得回来，盘面仍然合法',()=>{
  const G=require('../.test/core/Generator.js');
  assert.ok(G.LEVELS.some((l)=>l.wild),'第五章起要有百搭关');
  const store={value:null,load(){return this.value;},save(v){this.value=JSON.stringify(v);},feedback(){}};
  const s=new mod.Session(7,store);s.command('continue');
  if(s.tip)s.dismissTip();                    // 第 1 关会弹教学卡，tap() 在未关卡时直接吞掉输入
  // 拿会话**自己这一盘**改两张脸，而不是硬编形状：硬编 1x4 塞进 3x4 的第 1 关，
  // restore 的形状校验先把它挡了，断言就变成"没恢复"，测不到百搭那套奇数记账。
  const g=s.grid, rows=g.length, cols=g[0].length;
  let A=null, B=null;
  for(let r=0;r<rows&&!A;r++)for(let c=0;c<cols-1&&!A;c++){
    if(Array.isArray(g[r][c])&&g[r][c].length&&Array.isArray(g[r][c+1])&&g[r][c+1].length){A=[r,c];B=[r,c+1];}
  }
  assert.ok(A,'第 1 关总有横着相邻的两格');
  g[A[0]][A[1]]=['f3*'];                 // 百搭
  g[B[0]][B[1]]=['9p'];                  // 一张别的面：配掉之后 9p 与 f3* 都归零，其他张数不变
  s.runs=R.runsFor(g,[],[]);s.grid=g;s.total=R.count(g);s.goalTarget=0;s.goalDone=0;
  const before=R.count(g);
  s.tap({r:A[0],c:A[1]});s.tap({r:B[0],c:B[1]});
  assert.equal(R.count(s.grid),before-2,'百搭配对要把两张一起收走');
  assert.equal(s.moves,1);
  assert.ok(G.stateLegal(s.grid),'百搭消过之后必须还过存档校验（旧实现在这里判脏丢档）');
  const re=new mod.Session(999,store);
  assert.equal(R.signature(re.grid),R.signature(s.grid),'盘面要原样保留，不能重发一局');
});

test('可靠死局判定：只剩一叠孤牌时 session.dead 为真',()=>{
  const s=create();install(s,[[null,['f7','f7'],null],[null,null,null]]);
  assert.equal(s.dead,true,'孤牌必须判死（之前会卡住：既不判死也不判胜）');
  install(s,[[['1p'],['1p']]]);
  assert.equal(s.dead,false,'有对子不算死');
});

test('说明卡：第 1 关弹教学、机制关弹机制说明、看过之后不再弹；打开时屏蔽牌桌输入',()=>{
  const s=new mod.Session(18);                        // 构造即停在第 1 关
  assert.equal(s.tip,'basic','第 1 关要给教学卡');
  s.command('continue');                              // 进牌桌（说明卡仍在）
  const before=JSON.stringify(s.grid);
  s.tap({r:0,c:0});
  assert.equal(JSON.stringify(s.grid),before,'说明卡打开时点牌无效');
  s.command('tip-ok');
  assert.equal(s.tip,null);
  s.tap({r:0,c:0});
  assert.ok(s.selected||JSON.stringify(s.grid)!==before,'关掉说明卡后输入生效');
  // 机制说明只在首次出现时弹（给关卡表临时挂一个 intro 键）
  const G=require('../.test/core/Generator.js');
  G.LEVELS[1].intro='ice';
  s.reset(1);
  assert.equal(s.tip,'ice');
  s.dismissTip();
  assert.equal(s.tipsSeen['ice'],true);
  s.reset(1);
  assert.equal(s.tip,null,'看过的机制说明不再弹');
  delete G.LEVELS[1].intro;
});

/* ---------------- 关卡是固定谜题：钉了种子的关，重开必须看到同一盘 ---------------- */
// 以前 `reset(index,fresh=true)` 无条件翻种子，"重开这一关"约等于"换一副新牌"。
// 对无尽随机池是对的，对关卡制是错的：玩家背板重来应该面对同一盘，作者试玩的那一盘
// 也必须就是玩家拿到的那一盘（否则切图审阅、招牌关的设计意图全落空）。
const GEN=require('../.test/core/Generator.js');
test('重开同一关牌面一字不差（fresh=true 连开三次）',()=>{
  const idx=[41,60,7].find(i=>GEN.LEVELS[i]&&Number.isInteger(GEN.LEVELS[i].seed));
  assert.ok(idx!==undefined,'关卡表还没有钉种子，先跑 npm run author:levels');
  const s=new mod.Session(18);s.command('continue');
  s.reset(idx,true);const first=R.signature(s.grid);
  s.reset(idx,true);assert.equal(R.signature(s.grid),first,'重开换了牌');
  s.reset(idx,true);assert.equal(R.signature(s.grid),first);
  s.reset(idx,false);assert.equal(R.signature(s.grid),first);
});
test('pinnedSeed 就是关卡表里那一颗，视图诊断条可以直接读',()=>{
  const s=new mod.Session(18);s.command('continue');
  assert.equal(s.pinnedSeed,GEN.LEVELS[s.levelIndex].seed);
});
test('没钉种子的关仍按老行为每次换牌（无尽池依赖这条）',()=>{
  const i=0,keep=GEN.LEVELS[i].seed;
  try{
    delete GEN.LEVELS[i].seed;
    const s=new mod.Session(18);s.command('continue');
    s.reset(i,true);const a=R.signature(s.grid);
    s.reset(i,true);assert.notEqual(R.signature(s.grid),a,'删了 seed 还不换牌，说明翻种子的分支被删掉了');
  }finally{GEN.LEVELS[i].seed=keep;}
});
