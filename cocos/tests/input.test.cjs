const test=require('node:test');const assert=require('node:assert/strict');
const R=require('../.test/core/Rules.js');const {Session}=require('../.test/core/Session.js');
const V=require('../.view-test/view/GameView.js');const {Controller}=require('../.view-test/view/Input.js');
function setup(g,lockR=[],lockC=[]){
  const s=new Session(18);s.grid=g;s.runs=R.runsFor(g,lockR,lockC);s.total=R.count(g);s.modal='none';s.solution=[];s.selected=null;s.moves=0;s.hint=[];
  let ticks=0;const c=new Controller(s,{tick(){ticks++;}});return {s,c,ticks:()=>ticks};
}
const frame=c=>V.render(c.model(),750,1334);
const center=(f,p)=>[f.board.x+(p.c+.5)*f.board.cellW,f.board.y+(p.r+.5)*f.board.cellH];
const button=(f,id)=>{const h=f.hits.find(h=>h.id===id);assert.ok(h,'缺少按钮 '+id);return [h.x+h.w/2,h.y+h.h/2];};
function drag(c,from,dx,dy){let f=frame(c);const [x,y]=center(f,from);c.down(f,x,y);
  for(let i=1;i<=6;i++){f=frame(c);c.move(f,x+dx*i/6,y+dy*i/6);}return {f,x:x+dx,y:y+dy};}
test('点击唯一搭子直接消除并产生有界消除特效',()=>{
  const {s,c}=setup([[['1p'],['1p'],['3p'],['4p']]]);const f=frame(c);const [x,y]=center(f,{r:0,c:0});
  c.down(f,x,y);c.up(f,x,y);assert.equal(R.count(s.grid),2);assert.equal(c.effect.cells.length,2);
  assert.equal(c.update(.1),true);assert.ok(c.effect.progress>0&&c.effect.progress<1);c.update(1);assert.equal(c.effect,null);assert.equal(c.update(.1),false);
});
test('横拖整格：拖动中预览、每过一格轻震，松手执行一次滑动与连消',()=>{
  const {s,c,ticks}=setup([[['2p','1p'],[],['2p','1p']]]);const before=JSON.stringify(s.grid);
  const d=drag(c,{r:0,c:0},frame(c).board.cellW*1.1,4);
  assert.equal(c.drag.run,0);assert.ok(Math.abs(c.drag.offset-1.1)<1e-6);assert.equal(JSON.stringify(s.grid),before,'拖动中不改动规则状态');
  assert.equal(ticks(),1);c.up(d.f,d.x,d.y);assert.equal(R.count(s.grid),0);assert.equal(s.moves,1);assert.equal(s.modal,'win');assert.equal(c.drag,null);
});
test('拖动不足半格松手：不滑动、不算点击',()=>{
  const {s,c}=setup([[['1p'],['2p'],['1p'],['3p']]]);const d=drag(c,{r:0,c:0},frame(c).board.cellW*.4,0);
  c.up(d.f,d.x,d.y);assert.equal(s.moves,0);assert.equal(s.selected,null);assert.equal(R.count(s.grid),4);
});
test('锁轨方向不偷偷换轴：给出提示与震动，松手无操作',()=>{
  let feedback=0;const {s,c}=setup([[['1p'],['2p']],[['3p'],['4p']]],[0]);s.platform={load(){},save(){},feedback(){feedback++;}};
  const before=JSON.stringify(s.grid);const d=drag(c,{r:0,c:0},frame(c).board.cellW*1.2,0);
  assert.equal(c.drag,null);assert.match(s.message,/推不动/);assert.equal(feedback,1);
  c.up(d.f,d.x,d.y);assert.equal(JSON.stringify(s.grid),before);assert.equal(s.selected,null);assert.equal(s.moves,0);
  const v=drag(c,{r:0,c:0},0,frame(c).board.cellH*1.2);assert.equal(c.drag.run,s.runs.findIndex(r=>r.axis==='col'&&r.index===0));c.up(v.f,v.x,v.y);assert.equal(s.moves,1);
});
test('按钮必须按下与抬起在同一按钮；弹框挡住棋盘',()=>{
  const {s,c}=setup([[['1p'],['1p'],['3p'],['4p']]]);let f=frame(c);const [hx,hy]=button(f,'help');
  c.down(f,hx,hy);c.up(f,10,10);assert.equal(s.modal,'none');c.down(f,hx,hy);c.up(f,hx,hy);assert.equal(s.modal,'help');
  f=frame(c);const [x,y]=center(f,{r:0,c:0});c.down(f,x,y);c.move(f,x+200,y);c.up(f,x+200,y);assert.equal(R.count(s.grid),4);assert.equal(c.model().drag,null);
});
test('清台页选关可用，解锁的关卡能进入',()=>{
  const {s,c}=setup([[['1p'],['1p']]]);let f=frame(c);let [x,y]=center(f,{r:0,c:0});c.down(f,x,y);c.up(f,x,y);assert.equal(s.modal,'win');
  s.levelIndex=4;s.maxLevel=4;f=frame(c);[x,y]=button(f,'levels');c.down(f,x,y);c.up(f,x,y);assert.equal(s.modal,'levels');
  f=frame(c);assert.equal(f.hits.filter(h=>h.id.startsWith('level:')).length,5);[x,y]=button(f,'level:1');c.down(f,x,y);c.up(f,x,y);
  assert.equal(s.modal,'none');assert.equal(s.levelIndex,1);
});
