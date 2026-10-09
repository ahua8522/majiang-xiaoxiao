import {Action,Grid,Pos,Run,Pair,clone,count,equal,partners,pairs,searchHint,signature,top,transition} from './Rules';
import {generate,redeal,LEVELS,levelAt,FACES} from './Generator';
export type Modal='none'|'home'|'help'|'settings'|'restart'|'win'|'levels';
export interface Platform {load():unknown;save(data:unknown):void;feedback():void}
interface Snapshot {grid:Grid;moves:number;lastChain:number;solution:Action[];hint:Action[]}
const local:Platform={load:()=>null,save:()=>{},feedback:()=>{}};
export class Session {
  grid:Grid=[];runs:Run[]=[];levelIndex=0;maxLevel=0;total=0;moves=0;
  selected:Pos|null=null;hint:Action[]=[];message='';modal:Modal='none';
  reducedMotion=false;vibration=true;lastChain=0;solution:Action[]=[];lastErased:Pair[]=[];
  revision=0;seed:number;private history:Snapshot[]=[];private platform:Platform;
  par=0;hintsUsed=0;shufflesUsed=0;stars:Record<string,number>={};levelPage=0;
  private returnModal:Modal='none';
  constructor(seed=Date.now(),platform:Platform=local){
    this.seed=seed;this.platform=platform;let data:any;
    try{data=platform.load();if(typeof data==='string')data=JSON.parse(data);}catch{data=null;}
    if(data&&typeof data==='object'){
      if(Number.isInteger(data.maxLevel))this.maxLevel=Math.max(0,Math.min(LEVELS.length-1,data.maxLevel));
      if(data.stars&&typeof data.stars==='object')for(const [i,n]of Object.entries(data.stars))if(/^\d+$/.test(i)&&Number(i)<=this.maxLevel&&Number.isInteger(n)&&Number(n)>=1&&Number(n)<=3)this.stars[i]=Number(n);
      this.reducedMotion=data.reducedMotion===true;this.vibration=data.vibration!==false;
    }
    this.reset(this.maxLevel,false);
    if(data?.version===2)this.restore(data.run);
    this.modal='home';
  }
  private save(){try{this.platform.save({version:2,maxLevel:this.maxLevel,stars:this.stars,reducedMotion:this.reducedMotion,vibration:this.vibration,
    run:count(this.grid)?{index:this.levelIndex,seed:this.seed,grid:this.grid,total:this.total,moves:this.moves,par:this.par,hintsUsed:this.hintsUsed,shufflesUsed:this.shufflesUsed}:null});}catch{/* Storage quota must not block play. */}}
  private restore(run:any){
    if(!run||!Number.isInteger(run.index)||run.index<0||run.index>this.maxLevel||!Array.isArray(run.grid))return;
    const map=levelAt(run.index).map,grid=run.grid as Grid;
    if(grid.length!==map.length||!grid.every((row,r)=>Array.isArray(row)&&row.length===map[r].length&&row.every((cell,c)=>map[r][c]==='.'?cell===null:map[r][c]==='#'?cell==='#':Array.isArray(cell)&&cell.length<=3&&cell.every(f=>FACES.includes(f)))))return;
    if(![run.total,run.moves,run.par,run.seed,run.hintsUsed,run.shufflesUsed].every(n=>Number.isInteger(n)&&n>=0)||run.hintsUsed>3||run.shufflesUsed>2||run.moves>100000||run.par>10000)return;
    const tally=new Map<string,number>();grid.flat().forEach(cell=>{if(Array.isArray(cell))cell.forEach(f=>tally.set(f,(tally.get(f)||0)+1));});
    if(!count(grid)||count(grid)>run.total||run.total>136||[...tally.values()].some(n=>n%2||n>4))return;
    this.reset(run.index,false);this.grid=clone(grid);this.seed=run.seed;this.total=run.total;this.moves=run.moves;this.par=run.par;this.hintsUsed=run.hintsUsed;this.shufflesUsed=run.shufflesUsed;this.solution=[];this.message='牌桌已保留，接着上一盘慢慢想。';
  }
  get levelCount(){return LEVELS.length;}
  get levelName(){return levelAt(this.levelIndex).name;}
  get chapter(){return levelAt(this.levelIndex).chapter;}
  get difficulty(){return levelAt(this.levelIndex).rank;}
  get hintsLeft(){return 3-this.hintsUsed;}
  get shufflesLeft(){return 2-this.shufflesUsed;}
  get canUndo(){return this.history.length>0;}
  get rating(){return this.moves<=this.par&&!this.hintsUsed&&!this.shufflesUsed?3:this.moves<=Math.ceil(this.par*1.5)?2:1;}
  private remember(){this.history.push({grid:clone(this.grid),moves:this.moves,lastChain:this.lastChain,solution:this.solution.slice(),hint:this.hint.slice()});if(this.history.length>80)this.history.shift();}
  reset(index=this.levelIndex,fresh=true){
    const chosen=Number.isFinite(index)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(index))):0;
    if(fresh)this.seed=(this.seed+0x9e3779b9)>>>0;
    const deal=generate(chosen,this.seed);
    this.levelIndex=chosen;this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.total=count(this.grid);
    this.moves=0;this.lastChain=0;this.selected=null;this.hint=[];this.history=[];this.modal='none';this.lastErased=[];
    this.par=deal.solution.length;this.hintsUsed=0;this.shufflesUsed=0;this.levelPage=Math.floor(chosen/6);this.returnModal='none';
    this.message=chosen===0?'同牌相邻，轻点消除；拖动一行或一列，松手自动消。':levelAt(chosen).subtitle;
    this.revision++;
  }
  private apply(action:Action):boolean{
    if(this.modal!=='none')return false;
    const out=transition(this.grid,this.runs,action);if(!out.changed)return false;
    this.remember();
    const planned=this.solution[0],expected=planned?transition(this.grid,this.runs,planned):null;
    if(expected?.changed&&signature(expected.grid)===signature(out.grid))this.solution.shift();else this.solution=[];
    const hinted=this.hint[0];
    if(hinted&&signature(transition(this.grid,this.runs,hinted).grid)===signature(out.grid))this.hint.shift();else this.hint=[];
    this.grid=out.grid;this.selected=null;this.lastChain=out.chain;this.lastErased=out.erased;
    this.moves++;
    if(out.erased.length&&this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}
    this.message=out.erased.length?(out.chain>1?`连消 ${out.chain} 层，带走 ${out.erased.length} 对！`:`碰个对！消掉 ${out.erased.length} 对。`):'再转个方向，牌会从轨道另一头回来。';
    if(this.hint.length)this.message=this.describe(this.hint[0]);
    if(count(this.grid)===0){this.modal='win';this.maxLevel=Math.max(this.maxLevel,Math.min(LEVELS.length-1,this.levelIndex+1));this.stars[this.levelIndex]=Math.max(this.stars[this.levelIndex]||0,this.rating);this.hint=[];}
    // No failure modal from an approximate solver. Players retain undo / shuffle / restart.
    this.save();this.revision++;return true;
  }
  tap(p:Pos){
    if(this.modal!=='none')return;
    this.lastErased=[];
    if(!top(this.grid,p)){this.selected=null;this.revision++;return;}
    if(this.selected&&partners(this.grid,this.selected).some(q=>equal(q,p))){this.apply({kind:'match',a:this.selected,b:p});return;}
    const near=partners(this.grid,p);
    if(near.length===1){this.apply({kind:'match',a:p,b:near[0]});return;}
    this.selected=equal(this.selected,p)?null:p;
    this.message=near.length>1?'有不止一个搭子，点你想消的那张。':'拖动这一行或这一列，把搭子推到旁边。';
    this.revision++;
  }
  /** Feedback for gestures that cannot become an action (locked rail, wood block, hole). */
  notice(text:string){if(this.modal!=='none')return;this.selected=null;this.lastErased=[];this.message=text;if(this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}this.revision++;}
  get levelNames():string[]{return LEVELS.map(l=>l.name);}
  slide(run:number,step:number):boolean{return this.apply({kind:'slide',run,step});}
  undo():boolean{
    if(this.modal!=='none'&&this.modal!=='win')return false;
    const snap=this.history.pop();if(!snap){this.message='还没有需要撤销的操作。';this.revision++;return false;}
    this.grid=snap.grid;this.moves=snap.moves;this.lastChain=snap.lastChain;this.solution=snap.solution;this.hint=snap.hint;
    this.selected=null;this.modal='none';this.lastErased=[];this.message='刚才的整次操作，已经一起撤回。';this.save();this.revision++;return true;
  }
  shuffle():boolean{
    if(this.modal!=='none'||!count(this.grid))return false;
    if(!this.shufflesLeft){this.notice('本关两次免费洗牌已用完，可以撤销或重开。');return false;}
    const deal=redeal(this.levelIndex,this.grid,(this.seed+this.revision*7919)>>>0);
    if(!deal){this.message='这次无法安全重排，原来的牌没有改动。';this.revision++;return false;}
    this.remember();this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.hint=[];this.selected=null;this.lastChain=0;this.lastErased=[];
    this.shufflesUsed++;this.message='原牌重新摆好；洗牌不改牌种，使用辅助最多获两星。';this.save();this.revision++;return true;
  }
  describe(a:Action):string{
    if(a.kind==='match')return `点亮着的对子：第 ${a.a.r+1} 行第 ${a.a.c+1} 列。`;
    const r=this.runs[a.run];return `${this.hint.length>1?'先':''}推第 ${r.index+1} ${r.axis==='row'?'行':'列'}，向${r.axis==='row'?(a.step>0?'右':'左'):(a.step>0?'下':'上')} ${Math.abs(a.step)} 格${this.hint.length>1?'；下一步会接着提示。':'。'}`;
  }
  requestHint(){
    if(this.modal!=='none')return;
    this.lastErased=[];
    if(this.hint.length){this.message=this.describe(this.hint[0]);this.revision++;return;}
    if(!this.hintsLeft){this.notice('本关三次免费提示已用完，试试撤销或重开。');return;}
    const h=searchHint(this.grid,this.runs,{budget:1800,maxDepth:count(this.grid)<=6?8:3});
    this.hint=h.status==='found'?h.actions:[];
    if(!this.hint.length&&this.solution.length)this.hint=[this.solution[0]];
    if(this.hint.length){this.hintsUsed++;this.save();}
    this.message=this.hint.length?this.describe(this.hint[0]):h.status==='dead'?'当前确实没有消除路线，可以撤销、洗牌或重开。':'暂时没找到短路线，不代表无解。可以继续推，或试试洗牌。';
    this.revision++;
  }
  command(id:string){
    const open=this.modal;
    if(open!=='none'){
      if(id==='close'){this.modal=this.returnModal;this.returnModal='none';this.revision++;return;}
      if(open==='home'&&id==='continue'){if(!count(this.grid))this.reset(this.maxLevel);this.modal='none';this.save();this.revision++;return;}
      if(open==='home'&&['help','settings','levels'].includes(id)){this.returnModal='home';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/6);this.revision++;return;}
      if(open==='settings'&&id==='toggle-motion'){this.reducedMotion=!this.reducedMotion;this.save();this.revision++;return;}
      if(open==='settings'&&id==='toggle-vibration'){this.vibration=!this.vibration;this.save();this.revision++;return;}
      if(open==='restart'&&id==='confirm-restart'){this.reset();this.save();return;}
      if(open==='win'&&id==='next'&&this.levelIndex<LEVELS.length-1){this.reset(this.levelIndex+1);this.save();return;}
      if(open==='win'&&id==='home'){this.modal='home';this.revision++;return;}
      if(open==='win'&&id==='replay'){this.reset();this.save();return;}
      if(open==='win'&&id==='levels'){this.returnModal='win';this.modal='levels';this.revision++;return;}
      if(open==='levels'&&(id==='page-prev'||id==='page-next')){this.levelPage=Math.max(0,Math.min(Math.ceil(this.levelCount/6)-1,this.levelPage+(id==='page-next'?1:-1)));this.revision++;return;}
      if(open==='levels'&&id.startsWith('level:')){const i=Number(id.slice(6));if(Number.isInteger(i)&&i>=0&&i<=this.maxLevel){this.reset(i);this.save();}return;}
      return;
    }
    if(id==='hint'){this.requestHint();return;}
    if(id==='shuffle'){this.shuffle();return;}
    if(id==='undo'){this.undo();return;}
    if(['home','settings','help','restart','levels'].includes(id)){this.returnModal='none';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/6);this.selected=null;this.hint=[];this.lastErased=[];this.save();this.revision++;}
  }
}
