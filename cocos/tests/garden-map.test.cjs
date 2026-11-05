const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
const {buildSync}=require('esbuild');
function view(name){const filename=path.resolve(__dirname,'../assets/scripts/view',name+'.ts'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(buildSync({entryPoints:[filename],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,filename);return m.exports;}
const UI=view('sunnyLayout');
const {Session}=require('../.test/core/Session');
const a=(s,h=1440)=>({w:750,h,safe:100,s,page:0,theme:'jade',practice:false});
const nodes=s=>UI.sunnyMap(a(s)).filter(i=>i.kind==='stage');

test('正式版与未知环境逐关开放，开发和体验版保留锁定外观但允许进入',()=>{
 const s=new Session(1);s.maxLevel=3;s.stars={0:3,1:2,2:1};
 for(const env of ['release',undefined,null,'unknown',true]){s.setEnvironment(env);assert.equal(s.canEnter(3),true);assert.equal(s.canEnter(4),false);assert.equal(s.canEnter(519),false);}
 s.setEnvironment('release');const appearance=nodes(s).map(({id,name})=>({id,name}));
 for(const env of ['trial','develop']){s.setEnvironment(env);assert.equal(s.canEnter(519),true);assert.equal(s.isLevelUnlocked(4),false);assert.deepEqual(nodes(s).map(({id,name})=>({id,name})),appearance);assert.equal(nodes(s).find(i=>i.id==='level:4').enabled,true);}
 for(const i of [-1,520,NaN,1.5])assert.equal(s.canEnter(i),false);
 s.setEnvironment('release');assert.equal(nodes(s).find(i=>i.id==='level:4').enabled,false);
});
test('测试跳关不解锁主线，换正式环境后不能通过继续或下一关绕过限制',()=>{
 const store={value:null,load(){return this.value},save(v){this.value=JSON.parse(JSON.stringify(v))},feedback(){}};
 const s=new Session(1,store);s.setEnvironment('trial');s.reset(40);s.tip=null;for(const action of s.solution.slice()){s.feed(action);if(s.modal==='win')break;}
 assert.equal(s.modal,'win');assert.equal(s.maxLevel,0);s.setEnvironment('release');s.command('next');assert.equal(s.levelIndex,40);
 s.command('home');s.command('continue');assert.equal(s.levelIndex,0);assert.equal(s.maxLevel,0);
 const restored=new Session(1,store);assert.equal(restored.unlockAll,false);assert.equal(restored.canEnter(40),false);
});
test('分页地图每章只显示 20 关，首末页边界与横幅留白正确',()=>{
 const s=new Session(1);s.setEnvironment('trial');
 for(const h of [1230,1440,1750])for(const page of [0,1,25]){
  const state={...a(s,h),page},ui=UI.sunnyMap(state),stages=ui.filter(i=>i.kind==='stage'),map=ui.find(i=>i.kind==='garden');
  assert.equal(stages.length,20);assert.equal(ui.filter(i=>i.kind==='garden').length,1);
  assert.equal(stages[0].id,'level:'+page*20);assert.equal(stages[19].id,'level:'+(page*20+19));
  assert.equal(ui.find(i=>i.id==='page-prev').enabled,page>0);assert.equal(ui.find(i=>i.id==='page-next').enabled,page<25);
  assert.ok(map.y+map.h<UI.sunnyBannerArea(state).y);
  assert.ok(!ui.some(i=>['home','album','workshop'].includes(i.id)));
  for(const i of ui.filter(i=>i.id))assert.ok(i.y+i.h<=UI.sunnyBannerArea(state).y,`按钮 ${i.id} 挤入横幅区域`);
 }
});
