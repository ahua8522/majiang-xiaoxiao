import {Action,Grid,Pos,Run,Pair,clone,count,equal,partners,pairs,searchHint,signature,top,transition} from './Rules';
import {generate,redeal,LEVELS} from './Generator';
export type Modal='none'|'help'|'settings'|'restart'|'win'|'levels';
export interface Platform {load():unknown;save(data:unknown):void;feedback():void}
interface Snapshot {grid:Grid;moves:number;lastChain:number;solution:Action[];hint:Action[]}
const local:Platform={load:()=>null,save:()=>{},feedback:()=>{}};
export class Session {
  grid:Grid=[];runs:Run[]=[];levelIndex=0;maxLevel=0;total=0;moves=0;
  selected:Pos|null=null;hint:Action[]=[];message='';modal:Modal='none';
  reducedMotion=false;vibration=true;lastChain=0;solution:Action[]=[];lastErased:Pair[]=[];
  revision=0;seed:number;private history:Snapshot[]=[];private platform:Platform;
  constructor(seed=Date.now(),platform:Platform=local){
    this.seed=seed;this.platform=platform;let data:any;
    try{data=platform.load();if(typeof data==='string')data=JSON.parse(data);}catch{data=null;}
    if(data&&typeof data==='object'){
      if(Number.isInteger(data.maxLevel))this.maxLevel=Math.max(0,Math.min(4,data.maxLevel));
      this.reducedMotion=data.reducedMotion===true;this.vibration=data.vibration!==false;
    }
    this.reset(this.maxLevel,false);
  }
  private save(){try{this.platform.save({version:1,maxLevel:this.maxLevel,reducedMotion:this.reducedMotion,vibration:this.vibration});}catch{/* Storage quota must not block play. */}}
  private remember(){this.history.push({grid:clone(this.grid),moves:this.moves,lastChain:this.lastChain,solution:this.solution.slice(),hint:this.hint.slice()});if(this.history.length>80)this.history.shift();}
  reset(index=this.levelIndex,fresh=true){
    const chosen=Math.max(0,Math.min(LEVELS.length-1,index));
    if(fresh)this.seed=(this.seed+0x9e3779b9)>>>0;
    const deal=generate(chosen,this.seed);
    this.levelIndex=chosen;this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.total=count(this.grid);
    this.moves=0;this.lastChain=0;this.selected=null;this.hint=[];this.history=[];this.modal='none';this.lastErased=[];
    this.message=chosen===0?'相同牌挨着，点一下就消；拖一行试试。':LEVELS[chosen].subtitle;
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
    if(action.kind==='slide')this.moves++;
    if(out.erased.length&&this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}
    this.message=out.erased.length?(out.chain>1?`连消 ${out.chain} 层，带走 ${out.erased.length} 对！`:`碰个对！消掉 ${out.erased.length} 对。`):'再转个方向，牌会从轨道另一头回来。';
    if(this.hint.length)this.message=this.describe(this.hint[0]);
    if(count(this.grid)===0){this.modal='win';this.maxLevel=Math.max(this.maxLevel,Math.min(4,this.levelIndex+1));this.hint=[];this.save();}
    // No failure modal from an approximate solver. Players retain undo / shuffle / restart.
    this.revision++;return true;
  }
  tap(p:Pos){
    if(this.modal!=='none')return;
    if(!top(this.grid,p)){this.selected=null;this.revision++;return;}
    if(this.selected&&partners(this.grid,this.selected).some(q=>equal(q,p))){this.apply({kind:'match',a:this.selected,b:p});return;}
    const near=partners(this.grid,p);
    if(near.length===1){this.apply({kind:'match',a:p,b:near[0]});return;}
    this.selected=equal(this.selected,p)?null:p;
    this.message=near.length>1?'有不止一个搭子，点你想消的那张。':'拖动这一行或这一列，把搭子推到旁边。';
    this.revision++;
  }
  /** Feedback for gestures that cannot become an action (locked rail, wood block, hole). */
  notice(text:string){if(this.modal!=='none')return;this.selected=null;this.message=text;if(this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}this.revision++;}
  get levelNames():string[]{return LEVELS.map(l=>l.name);}
  slide(run:number,step:number):boolean{return this.apply({kind:'slide',run,step});}
  undo():boolean{
    if(this.modal!=='none'&&this.modal!=='win')return false;
    const snap=this.history.pop();if(!snap){this.message='还没有需要撤销的操作。';this.revision++;return false;}
    this.grid=snap.grid;this.moves=snap.moves;this.lastChain=snap.lastChain;this.solution=snap.solution;this.hint=snap.hint;
    this.selected=null;this.modal='none';this.lastErased=[];this.message='刚才的整次操作，已经一起撤回。';this.revision++;return true;
  }
  shuffle():boolean{
    if(this.modal!=='none'||!count(this.grid))return false;
    const deal=redeal(this.levelIndex,this.grid,(this.seed+this.revision*7919)>>>0);
    if(!deal){this.message='这次无法安全重排，原来的牌没有改动。';this.revision++;return false;}
    this.remember();this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.hint=[];this.selected=null;this.lastChain=0;this.lastErased=[];
    this.message='剩余的牌重新摆好了，层数也会变化。';this.revision++;return true;
  }
  describe(a:Action):string{
    if(a.kind==='match')return `点亮着的对子：第 ${a.a.r+1} 行第 ${a.a.c+1} 列。`;
    const r=this.runs[a.run];return `${this.hint.length>1?'先':''}推第 ${r.index+1} ${r.axis==='row'?'行':'列'}，向${r.axis==='row'?(a.step>0?'右':'左'):(a.step>0?'下':'上')} ${Math.abs(a.step)} 格${this.hint.length>1?'；下一步会接着提示。':'。'}`;
  }
  requestHint(){
    if(this.modal!=='none')return;
    const h=searchHint(this.grid,this.runs,{budget:1800,maxDepth:count(this.grid)<=6?8:3});
    this.hint=h.status==='found'?h.actions:[];
    if(!this.hint.length&&this.solution.length)this.hint=[this.solution[0]];
    this.message=this.hint.length?this.describe(this.hint[0]):h.status==='dead'?'当前确实没有消除路线，可以撤销、洗牌或重开。':'暂时没找到短路线，不代表无解。可以继续推，或试试洗牌。';
    this.revision++;
  }
  command(id:string){
    const open=this.modal;
    if(open!=='none'){
      if(id==='close'){this.modal='none';this.revision++;return;}
      if(open==='settings'&&id==='toggle-motion'){this.reducedMotion=!this.reducedMotion;this.save();this.revision++;return;}
      if(open==='settings'&&id==='toggle-vibration'){this.vibration=!this.vibration;this.save();this.revision++;return;}
      if(open==='restart'&&id==='confirm-restart'){this.reset();return;}
      if(open==='win'&&id==='next'){this.reset((this.levelIndex+1)%5);return;}
      if(open==='win'&&id==='replay'){this.reset();return;}
      if(open==='win'&&id==='levels'){this.modal='levels';this.revision++;return;}
      if(open==='levels'&&id.startsWith('level:')){const i=Number(id.slice(6));if(Number.isInteger(i)&&i>=0&&i<=this.maxLevel)this.reset(i);return;}
      return;
    }
    if(id==='hint'){this.requestHint();return;}
    if(id==='shuffle'){this.shuffle();return;}
    if(id==='undo'){this.undo();return;}
    if(['settings','help','restart','levels'].includes(id)){this.modal=id as Modal;this.selected=null;this.hint=[];this.lastErased=[];this.revision++;}
  }
}
