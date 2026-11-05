/** Deterministic 520-level authoring. New targets are selected from actual removal
 * traces, then checked using the same mechanic state and dynamic rails as Session. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),core=n=>require(path.join(root,'.test/core',n+'.js'));
const G=core('Generator'),R=core('Rules'),M=core('Mechanics'),{CHAPTERS,CHAPTER_LENGTH}=core('Campaign');
const levels=[],seen=new Set(),report=[];
const source=path.join(root,'assets/scripts/core/levels.ts');
const old=fs.readFileSync(source,'utf8');
const types=old.slice(old.indexOf('export interface LevelDef'),old.indexOf('/** 关卡表'));
const shuffled=(a,random)=>a.map(x=>({x,v:random()})).sort((a,b)=>a.v-b.v).map(v=>v.x);
function makeDef(index,attempt){
  const ci=Math.floor(index/20),k=index%20,chapter=CHAPTERS[ci],rest=k===8||k===14;
  let kind=chapter[1];
  if(kind==='final')kind=['flower-key','bud-way','dew-block','collect-ice','stack3'][Math.floor(k/4)];
  const seed=(20261105+Math.imul(index+1,7919)+Math.imul(attempt,104729))>>>0,random=G.rng(seed);
  // Alternate layouts within a chapter. Chapter finales get a larger board;
  // learning and relaxation levels stay compact even late in the campaign.
  const sizes=index<20?[[4,3],[4,4],[4,5]]:index<60?[[4,5],[5,6],[4,6]]:
    index<160?[[5,6],[6,6],[6,7]]:index<280?[[6,7],[6,8],[7,8]]:
    index<400?[[6,8],[7,8],[8,8]]:[[6,8],[7,8],[8,9],[8,10]];
  let [cols,rows]=sizes[k<4?0:k===19?sizes.length-1:Math.floor(k/4)%sizes.length];
  if(rest&&ci>0){cols=ci<8?4:6;rows=ci<8?5:6;}
  if(cols%2&&rows%2)rows--;
  const map=Array.from({length:rows},()=>Array(cols).fill('1')),dominos=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols-1;c+=2)dominos.push([{r,c},{r,c:c+1}]);
  if(cols%2)for(let r=0;r<rows-1;r+=2)dominos.push([{r,c:cols-1},{r:r+1,c:cols-1}]);
  const order=shuffled(dominos,random);
  const holes=index<4?Math.min(index,2):Math.min(order.length-4,(k%4)+(rest?2:0));
  for(const pair of order.slice(0,holes))for(const p of pair)map[p.r][p.c]=kind.includes('block')?'#':'.';
  const stack=kind.includes('stack')||kind.includes('bud');
  if(stack)for(const pair of order.slice(holes,holes+(kind==='stack3'?4:kind.includes('bud')?5:2+k%3)))for(const p of pair)map[p.r][p.c]=kind==='stack3'?'3':'2';
  const slots=map.flat().reduce((n,v)=>n+(Number(v)||0),0);
  const def={map:map.map(row=>row.join('')),lockR:[],lockC:[],faces:Math.max(4,Math.ceil(slots/4),Math.min(14,4+Math.floor(ci/3)+k%3)),scramble:index<4?2+index:Math.min(22,5+ci/2|0)+(rest?0:k%5),seed,hash:'',chapter:ci,energy:ci>=5};
  if(kind.includes('ice')||kind==='bomb'){def.ice=rest?1:Math.min(5,1+Math.floor(k/5));if(ci>=12&&k%7===6)def.ice2=1;}
  if(kind==='bomb'){def.ice=Math.max(2,def.ice);def.bombs=1;}
  if(kind.includes('way')||kind==='oneWay')def.oneWay=[{axis:k%2?'col':'row',index:Math.floor((k%2?cols:rows)/2),dir:k%3?-1:1}];
  if(kind==='lock')(k%2?def.lockR:def.lockC).push(Math.floor((k%2?rows:cols)/2));
  if(kind.includes('key'))def.keyLocks=[{axis:k%2?'row':'col',index:Math.floor((k%2?rows:cols)/2),face:['z6','4s','6s','9s'][k%4],count:2}];
  if(kind==='unlock')def.unlock=[{axis:k%2?'row':'col',index:Math.floor((k%2?rows:cols)/2),after:2+k%4}];
  if(kind==='wild'){def.flowers=true;def.wild=true;def.goal={kind:'face',face:'f1*',count:1};}
  if(kind.includes('collect'))def.goal={kind:'collect',faces:shuffled(['4s','6s','9s','z6','z5','2p','7p','3m'],random).slice(0,k<4?1:k<13?2:3),count:k<4?1:k<13?2:3};
  return {def,kind,rest};
}
function trace(def,deal){
  let grid=deal.grid,state=M.freshMechanics(def),cleared=0;const events=[];
  for(const a of deal.solution){
    const l=M.mechanicLocks(def,cleared,state),runs=R.runsFor(grid,l.lockR,l.lockC,def.oneWay),out=R.transition(grid,runs,a);
    if(!out.changed)return null;
    const cells=[];for(const p of out.erased)if(!R.hasIce(p.face)&&!R.hasIce(p.other))cells.push(p.a,p.b);
    state=M.advanceMechanics(def,state,out);cleared+=cells.length/2;grid=out.grid;
    events.push(cells);
  }
  return R.count(grid)?null:{events,state};
}
function addFloors(def,kind,events){
  const type=kind.includes('bud')?'bud':kind.includes('dew')?'dew':kind.includes('flower')?'flower':null;if(!type)return true;
  const visits=new Map();events.forEach((cells,turn)=>{
    const hit=new Set();for(const p of cells){
      const choices=type==='dew'?[{r:p.r-1,c:p.c},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1},{r:p.r,c:p.c+1}]:[p];
      for(const q of choices)if(q.r>=0&&q.r<def.map.length&&q.c>=0&&q.c<def.map[0].length&&/[123]/.test(def.map[q.r][q.c]))hit.add(R.key(q));
    }
    for(const key of hit){if(!visits.has(key))visits.set(key,[]);visits.get(key).push(turn);}
  });
  const need=type==='bud'?2:1,choices=Array.from(visits).filter(([,v])=>v.length>=need).sort((a,b)=>a[1][need-1]-b[1][need-1]);
  const n=Math.min(type==='bud'?3:4,choices.length);if(n<2)return false;
  const picked=[];for(let i=0;i<n;i++)picked.push(choices[Math.round(i*(choices.length-1)/(n-1))]);
  def.floors=picked.map(([key])=>{const [r,c]=key.split(',').map(Number);return {r,c,kind:type,need};});
  def.goal={kind:'garden',count:n};return true;
}
for(let index=0;index<520;index++){
  let accepted=null;
  for(let attempt=0;attempt<120&&!accepted;attempt++){
    const {def,kind,rest}=makeDef(index,attempt),deal=G.construct(def,def.seed);if(!deal)continue;
    const slots=def.map.join('').split('').reduce((n,v)=>n+(Number(v)||0),0);
    if(R.count(deal.grid)!==slots||deal.solution.length>90||seen.has(R.boardHash(deal.grid)))continue;
    const t=trace(def,deal);if(!t||!addFloors(def,kind,t.events))continue;
    const final=trace(def,deal);if(!final)continue;
    if(def.goal&&def.goal.kind!=='ice'&&M.mechanicGoal(def,final.state)<def.goal.count)continue;
    if((def.keyLocks||[]).some(k=>(final.state.collected[k.face]||0)<k.count))continue;
    // Flowers must require more than the opening action; avoid a nominal one-swipe level.
    if(def.floors&&t.events.length<4)continue;
    def.hash=R.boardHash(deal.grid);def.referencePar=deal.solution.length;
    if(index>=20&&!rest&&index%5!==0)def.moveLimit=deal.solution.length+Math.max(8,Math.ceil(deal.solution.length*.45));
    if(index%20===0)def.intro='ctip:'+def.chapter;
    accepted={def,deal,kind};
  }
  if(!accepted)throw Error('Could not author level '+(index+1));
  levels.push(accepted.def);seen.add(accepted.def.hash);report.push({level:index+1,chapter:accepted.def.chapter+1,kind:accepted.kind,par:accepted.deal.solution.length,rows:accepted.def.map.length,cols:accepted.def.map[0].length});
  if((index+1)%20===0)console.log(`${index+1}/520 · ${CHAPTERS[accepted.def.chapter][0]}`);
}
const lines=levels.map((d,i)=>`  // 第 ${i+1} 关 · ${d.map[0].length} 列 × ${d.map.length} 行 · 参考解 ${d.referencePar} 步\n  ${JSON.stringify(d)},`);
fs.writeFileSync(source,'/** 520 关 / 26 章。由 tools/author-campaign.cjs 生成并按真实机关状态验证。 */\n'+types+'/** 关卡表，共 520 关。 */\nexport const LEVELS: LevelDef[] = [\n'+lines.join('\n')+'\n];\nexport {CAMPAIGN_VERSION, CHAPTER_LENGTH} from \'./Campaign\';\nimport {CHAPTERS} from \'./Campaign\';\nexport const CHAPTER_NAMES: string[] = CHAPTERS.map(c=>c[0]);\nexport function levelAt(index:number):LevelDef{return LEVELS[Number.isFinite(index)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(index))):0];}\n');
const reportFile=path.resolve(root,'../temp/campaign-author-report.json');
fs.mkdirSync(path.dirname(reportFile),{recursive:true});
fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
console.log('Authored 520 distinct boards with replayed objectives.');
