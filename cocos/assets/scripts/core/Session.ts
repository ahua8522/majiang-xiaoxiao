import {Action,Grid,Pos,Run,Pair,clone,count,equal,hasIce,isDead,partners,pairs,runsFor,searchHint,signature,stripIce,top,transition,unwild} from './Rules';
import {Deal,generate,goalPairs,redeal,stateLegal,LEVELS,levelAt,isFace,activeLocks,LevelDef} from './Generator';
export type Modal='none'|'home'|'help'|'settings'|'restart'|'win'|'levels'|'lose';
export interface Platform {load():unknown;save(data:unknown):void;feedback():void}
interface Snapshot {grid:Grid;moves:number;lastChain:number;solution:Action[];hint:Action[];clearedPairs:number;goalDone:number}
const local:Platform={load:()=>null,save:()=>{},feedback:()=>{}};
/** 关卡选择每页格数（4 列 × 4 行，扁平网格，不分组）。 */
export const PAGE_SIZE=16;
export class Session {
  grid:Grid=[];runs:Run[]=[];levelIndex=0;maxLevel=0;total=0;moves=0;
  selected:Pos|null=null;hint:Action[]=[];message='';modal:Modal='none';
  reducedMotion=false;vibration=true;lastChain=0;solution:Action[]=[];lastErased:Pair[]=[];
  revision=0;seed:number;private history:Snapshot[]=[];private platform:Platform;
  par=0;hintsUsed=0;shufflesUsed=0;stars:Record<string,number>={};levelPage=0;
  /** 体验版 / 开发版全解锁（视图按 wx envVersion 设置）：选关不再受 maxLevel 限制，但跳关不推进进度。 */
  unlockAll=false;
  /** 累计「真正消掉」的对数（碎冰不算）——连锁解锁的阈值与目标进度都基于它。 */
  clearedPairs=0;
  /** 目标关进度（已达成数）。 */
  goalDone=0;
  /**
   * 本关**实际能完成**的目标数 = `min(def.goal.count, 盘面上这个牌面凑得出的对数)`。
   * 关卡表里的 count 是设计意图（历史口径算错，写着 3~12 对，而每种牌最多 4 张 = 2 对），
   * 按实际量收敛之后，目标关才真的是「不必清空也能过」。HUD 必须显示这个数。
   */
  goalTarget=0;
  /** 待展示的说明卡（第 1 关教学 / 机制首现）。非空时牌桌输入被屏蔽。 */
  tip:string|null=null;
  /** 已经看过的机制说明（持久化，避免每次都弹）。 */
  tipsSeen:Record<string,boolean>={};
  private returnModal:Modal='none';
  constructor(seed=Date.now(),platform:Platform=local){
    this.seed=seed;this.platform=platform;let data:any;
    try{data=platform.load();if(typeof data==='string')data=JSON.parse(data);}catch{data=null;}
    if(data&&typeof data==='object'){
      if(Number.isInteger(data.maxLevel))this.maxLevel=Math.max(0,Math.min(LEVELS.length-1,data.maxLevel));
      if(data.stars&&typeof data.stars==='object')for(const [i,n]of Object.entries(data.stars))if(/^\d+$/.test(i)&&Number(i)<=this.maxLevel&&Number.isInteger(n)&&Number(n)>=1&&Number(n)<=3)this.stars[i]=Number(n);
      if(data.tipsSeen&&typeof data.tipsSeen==='object')for(const [k,v]of Object.entries(data.tipsSeen))if(v===true)this.tipsSeen[k]=true;
      this.reducedMotion=data.reducedMotion===true;this.vibration=data.vibration!==false;
    }
    this.reset(this.maxLevel,false);
    if(data?.version===2)this.restore(data.run);
    this.modal='home';
  }
  private save(){try{this.platform.save({version:2,maxLevel:this.maxLevel,stars:this.stars,reducedMotion:this.reducedMotion,vibration:this.vibration,tipsSeen:this.tipsSeen,
    run:count(this.grid)?{index:this.levelIndex,seed:this.seed,grid:this.grid,total:this.total,moves:this.moves,par:this.par,hintsUsed:this.hintsUsed,shufflesUsed:this.shufflesUsed,clearedPairs:this.clearedPairs,goalDone:this.goalDone}:null});}catch{/* Storage quota must not block play. */}}
  private restore(run:any){
    if(!run||!Number.isInteger(run.index)||run.index<0||run.index>this.maxLevel||!Array.isArray(run.grid))return;
    const map=levelAt(run.index).map,grid=run.grid as Grid;
    if(grid.length!==map.length||!grid.every((row,r)=>Array.isArray(row)&&row.length===map[r].length&&row.every((cell,c)=>map[r][c]==='.'?cell===null:map[r][c]==='#'?cell==='#':Array.isArray(cell)&&cell.length<=3&&cell.every(f=>isFace(f)))))return;
    if(![run.total,run.moves,run.par,run.seed,run.hintsUsed,run.shufflesUsed].every(n=>Number.isInteger(n)&&n>=0)||run.hintsUsed>3||run.shufflesUsed>2||run.moves>100000||run.par>10000)return;
    // 中盘状态的合法性：牌总数为偶、每种牌 ≤4 张。
    // **不能**要求每种牌偶数张——百搭一次收走两张不同面的牌，用过一次必然出现奇数张
    // （实测第 60 关消一对就是 3m×3、f5*×3）。旧校验把这种合法进度当脏档丢弃：
    // 玩家重开直接回到开局，洗牌也从此永久不可用。
    if(!stateLegal(grid)||count(grid)>run.total||run.total>136)return;
    // 这里不再调 `reset()`：reset 会先完整生成一局新牌、再被下面的存档盘面覆盖，
    // 于是冷启动白白多花一次发牌（实测单次 61~553ms）。
    this.setupLevel(run.index);
    this.grid=clone(grid);this.seed=run.seed;this.total=run.total;this.moves=run.moves;this.par=run.par;
    this.hintsUsed=run.hintsUsed;this.shufflesUsed=run.shufflesUsed;
    this.clearedPairs=Number.isInteger(run.clearedPairs)?Math.max(0,run.clearedPairs):0;
    this.goalDone=Number.isInteger(run.goalDone)?Math.max(0,run.goalDone):0;
    // 目标按「已经收到手的 + 盘上还剩的」收敛，绝不让读档之后的目标变成够不着的数字
    this.goalTarget=Math.max(this.goalDone,goalPairs(this.def,this.grid));
    this.refreshRuns();this.tip=null;this.solution=[];this.message='牌桌已保留，接着上一盘慢慢想。';
  }
  /** 当前关的关卡定义（reset 时从关卡表取；单测可直接替换）。 */
  def:LevelDef=LEVELS[0];
  /**
   * 按「当前盘面 + 当前已消对数」重算滑轨。
   *
   * 必须每次消除后重算：① 牌消掉后旧 runs 会指着空格，死局判定与提示都会被带偏；
   * ② 连锁解锁要按进度放开锁轨。
   */
  private refreshRuns():void{
    const l=activeLocks(this.def,this.clearedPairs);
    this.runs=runsFor(this.grid,l.lockR,l.lockC,this.def.oneWay);
  }
  get levelCount(){return LEVELS.length;}
  /** 牌面代号 → 中文名（目标关 HUD 等界面文案用）。 */
  static faceName(face:string):string{
    const nums='一二三四五六七八九';
    const m=/^(\d)([psm])$/.exec(face);
    if(m)return nums[Number(m[1])-1]+(m[2]==='p'?'筒':m[2]==='s'?'条':'万');
    if(/^z[1-7]$/.test(face))return ['東','南','西','北','中','發','白'][Number(face[1])-1];
    if(/^f[1-8]$/.test(face))return ['春','夏','秋','冬','梅','兰','竹','菊'][Number(face[1])-1];
    return face;
  }
  /** 难度 1~5，由关卡序号推导；关卡数据本身不再携带章节与名称。 */
  get difficulty(){return Math.min(5,1+Math.floor(this.levelIndex/20));}
  get hintsLeft(){return 3-this.hintsUsed;}
  get shufflesLeft(){return 2-this.shufflesUsed;}
  get canUndo(){return this.history.length>0;}
  /** 本关步数上限（0 = 不限步）。 */
  get moveLimit(){return this.def.moveLimit||0;}
  get movesLeft(){return this.moveLimit?Math.max(0,this.moveLimit-this.moves):0;}
  /** 目标关进度；无目标返回 null。 */
  get goal(){return this.def.goal||null;}
  /**
   * 本关**需要**完成的目标数：`min(def.goal.count, 盘面给得出的对数)`。
   *
   * 正常进关（reset / restore）时就已经定死在 `goalTarget` 里——不能边收边算，
   * 否则收掉一对之后盘面上只剩一对，目标会越算越小。这里只为「绕过 reset 直接改 def」
   * 的路径（单测、调试）就地补算一次并冻结。
   */
  get goalNeed(){
    if(!this.goal)return 0;
    if(!this.goalTarget)this.goalTarget=goalPairs(this.def,this.grid);
    return this.goalTarget;
  }
  /** 只看 `goalNeed`，不看关卡表里那个可能偏大的 `count`。 */
  get goalReached(){return this.goalNeed>0&&this.goalDone>=this.goalNeed;}
  /**
   * 可靠的死局判定（不是近似搜索）：没有可消对子，且所有可达状态都没有任何一步能减少牌数。
   * 视图在每次落子后调用；预算用尽时返回 false（不误判）。
   */
  get dead():boolean{
    if(!count(this.grid)||this.goalReached)return false;
    return isDead(this.grid,(grid)=>{const l=activeLocks(this.def,this.clearedPairs);return runsFor(grid,l.lockR,l.lockC,this.def.oneWay);},2000);
  }
  /** 待展示的说明卡：第 1 关固定教学；其余机制只在首次出现时弹一次。 */
  get introTip():string|null{return this.tip;}
  dismissTip():void{
    const t=this.tip;
    if(t&&t!=='basic'){this.tipsSeen[t]=true;this.save();}
    this.tip=null;this.revision++;
  }
  /** 当前弹窗是从哪一屏打开的：'home' 表示首页，'none' 表示牌桌。
   *  视图必须据此决定弹窗底下画哪一屏——否则从首页打开设置会露出牌桌。 */
  get openedFrom():Modal{return this.returnModal;}
  get rating(){return this.moves<=this.par&&!this.hintsUsed&&!this.shufflesUsed?3:this.moves<=Math.ceil(this.par*1.5)?2:1;}
  private remember(){this.history.push({grid:clone(this.grid),moves:this.moves,lastChain:this.lastChain,solution:this.solution.slice(),hint:this.hint.slice(),clearedPairs:this.clearedPairs,goalDone:this.goalDone});if(this.history.length>80)this.history.shift();}
  /** 只装配关卡的静态部分（定义、计数器、待弹的说明卡），**不发牌**。 */
  private setupLevel(chosen:number):void{
    this.levelIndex=chosen;this.def=levelAt(chosen);
    this.moves=0;this.lastChain=0;this.selected=null;this.hint=[];this.history=[];this.modal='none';this.lastErased=[];
    this.hintsUsed=0;this.shufflesUsed=0;this.levelPage=Math.floor(chosen/PAGE_SIZE);this.returnModal='none';
    this.clearedPairs=0;this.goalDone=0;this.goalTarget=0;
    // 第 1 关的教学卡每次进都弹（新玩家可能重开）；机制说明只在首次出现时弹
    this.tip=chosen===0?'basic':(this.def.intro&&!this.tipsSeen[this.def.intro]?this.def.intro:null);
  }
  /**
   * 发牌，**绝不向上抛**。
   *
   * `generate` 内部已经用确定性派生种子重试过 6 次，理论上仍可能全部摇不出可验证的清台路线。
   * 以前这里把异常直接抛穿：`onLoad` 里一句 `new Session()` 炸掉就是整屏空白，
   * 而真机读不到 console。现在换种子重试，最后兜到第 1 关（360 次抽样 0 失败），
   * 保证界面一定起得来。
   */
  private deal(chosen:number):{index:number;deal:Deal}{
    for(let k=0;k<4;k++){
      try{return{index:chosen,deal:generate(chosen,(this.seed+Math.imul(k+1,0x9e3779b9))>>>0)};}catch{/* 换下一个派生种子 */}
    }
    console.error('[core] 这一关发不出可验证的牌，已兜底到第 1 关',{level:chosen,seed:this.seed});
    this.seed=(this.seed+1)>>>0;
    return{index:0,deal:generate(0,this.seed)};
  }
  reset(index=this.levelIndex,fresh=true){
    const wanted=Number.isFinite(index)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(index))):0;
    if(fresh)this.seed=(this.seed+0x9e3779b9)>>>0;
    const{index:chosen,deal}=this.deal(wanted);
    this.setupLevel(chosen);
    this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;
    this.total=count(this.grid);this.par=deal.solution.length;
    this.goalTarget=goalPairs(this.def,this.grid);
    this.message=chosen===0?'同牌相邻，轻点消除；拖动一行或一列，松手自动消。'
      :(chosen!==wanted?'这一关暂时发不出可解的牌，先给你摆了第 1 关。':'看清这盘的障碍，先找出第一步。');
    this.revision++;
  }
  private apply(action:Action):boolean{
    if(this.modal!=='none'||this.tip)return false;
    const out=transition(this.grid,this.runs,action);if(!out.changed)return false;
    // 目标数必须在 `this.grid` 被这一步改掉**之前**定下来：绕过 reset 直接装盘的路径
    // 会在这里就地补算一次，等盘面改完再算就变成 0 了（碎冰/收对之后牌已经不在盘上）。
    const need=this.goalNeed;
    this.remember();
    const planned=this.solution[0],expected=planned?transition(this.grid,this.runs,planned):null;
    if(expected?.changed&&signature(expected.grid)===signature(out.grid))this.solution.shift();else this.solution=[];
    const hinted=this.hint[0];
    if(hinted&&signature(transition(this.grid,this.runs,hinted).grid)===signature(out.grid))this.hint.shift();else this.hint=[];
    this.grid=out.grid;this.selected=null;this.lastChain=out.chain;this.lastErased=out.erased;
    this.moves++;
    // 进度统计：碎冰不算「消掉一对」；目标按 面/冰 两种口径累计。
    // 两侧牌面都要看（`Pair.other`）：百搭与冰牌配对时 a/b 牌面不同，只看 a 侧
    // 会让记账取决于「玩家先点哪张」（实测：先点百搭算收走一对、先点冰牌算只碎冰）。
    const whole=(p:Pair):boolean=>!hasIce(p.face)&&!hasIce(p.other);
    const anyIce=(p:Pair):boolean=>hasIce(p.face)||hasIce(p.other);
    const cleared=out.erased.filter(whole).length;
    this.clearedPairs+=cleared;
    const g=this.goal;
    if(g){
      const base=unwild(g.face||'');
      const isGoal=(p:Pair):boolean=>unwild(stripIce(p.face))===base||unwild(stripIce(p.other))===base;
      this.goalDone+=g.kind==='face'?(g.face?out.erased.filter(isGoal).length:cleared):out.erased.filter(anyIce).length;
      if(need)this.goalDone=Math.min(this.goalDone,need);
    }
    this.refreshRuns();
    if(out.erased.length&&this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}
    const brokeIce=out.erased.some(anyIce);
    this.message=brokeIce
      ?'冰层碎了，露出牌面再消一次才能收走。'
      :(out.erased.length?(out.chain>1?`连消 ${out.chain} 层，带走 ${out.erased.length} 对！`:`碰个对！消掉 ${out.erased.length} 对。`):'再转个方向，牌会从轨道另一头回来。');
    if(this.hint.length)this.message=this.describe(this.hint[0]);
    const done=count(this.grid)===0;
    if(done||this.goalReached){
      this.modal='win';this.maxLevel=Math.max(this.maxLevel,Math.min(LEVELS.length-1,this.levelIndex+1));
      this.stars[this.levelIndex]=Math.max(this.stars[this.levelIndex]||0,this.rating);this.hint=[];
      if(!done)this.message='目标达成，通关！';
    }else if(this.moveLimit&&this.moves>=this.moveLimit){
      // 步数用尽：明确判负（视图据此弹失败页）
      this.modal='lose';this.message=`步数用尽，还差 ${count(this.grid)} 张。`;
    }
    this.save();this.revision++;return true;
  }
  tap(p:Pos){
    if(this.modal!=='none'||this.tip)return;
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
  notice(text:string){if(this.modal!=='none'||this.tip)return;this.selected=null;this.lastErased=[];this.message=text;if(this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}this.revision++;}
  slide(run:number,step:number):boolean{return this.apply({kind:'slide',run,step});}
  undo():boolean{
    if(this.tip)return false;
    if(this.modal!=='none'&&this.modal!=='win'&&this.modal!=='lose')return false;
    const snap=this.history.pop();if(!snap){this.message='还没有需要撤销的操作。';this.revision++;return false;}
    this.grid=snap.grid;this.moves=snap.moves;this.lastChain=snap.lastChain;this.solution=snap.solution;this.hint=snap.hint;
    this.clearedPairs=snap.clearedPairs;this.goalDone=snap.goalDone;this.refreshRuns();
    this.selected=null;this.modal='none';this.lastErased=[];this.message='刚才的整次操作，已经一起撤回。';this.save();this.revision++;return true;
  }
  shuffle():boolean{
    if(this.modal!=='none'||this.tip||!count(this.grid))return false;
    if(!this.shufflesLeft){this.notice('本关两次免费洗牌已用完，可以撤销或重开。');return false;}
    const deal=redeal(this.levelIndex,this.grid,(this.seed+this.revision*7919)>>>0);
    if(!deal){this.message='这次无法安全重排，原来的牌没有改动。';this.revision++;return false;}
    this.remember();this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.hint=[];this.selected=null;this.lastChain=0;this.lastErased=[];
    this.refreshRuns();
    this.shufflesUsed++;this.message='原牌重新摆好；洗牌不改牌种，使用辅助最多获两星。';this.save();this.revision++;return true;
  }
  describe(a:Action):string{
    if(a.kind==='match')return `点亮着的对子：第 ${a.a.r+1} 行第 ${a.a.c+1} 列。`;
    const r=this.runs[a.run];return `${this.hint.length>1?'先':''}推第 ${r.index+1} ${r.axis==='row'?'行':'列'}，向${r.axis==='row'?(a.step>0?'右':'左'):(a.step>0?'下':'上')} ${Math.abs(a.step)} 格${this.hint.length>1?'；下一步会接着提示。':'。'}`;
  }
  requestHint(){
    if(this.modal!=='none'||this.tip)return;
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
    if(id==='tip-ok'){this.dismissTip();return;}
    const open=this.modal;
    if(open!=='none'){
      if(id==='close'){this.modal=this.returnModal;this.returnModal='none';this.revision++;return;}
      if(open==='home'&&id==='continue'){if(!count(this.grid))this.reset(this.maxLevel);this.modal='none';this.save();this.revision++;return;}
      if(open==='home'&&['help','settings','levels'].includes(id)){this.returnModal='home';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/PAGE_SIZE);this.revision++;return;}
      if(open==='settings'&&id==='toggle-motion'){this.reducedMotion=!this.reducedMotion;this.save();this.revision++;return;}
      if(open==='settings'&&id==='toggle-vibration'){this.vibration=!this.vibration;this.save();this.revision++;return;}
      if(open==='restart'&&id==='confirm-restart'){this.reset();this.save();return;}
      if(open==='win'&&id==='next'&&this.levelIndex<LEVELS.length-1){this.reset(this.levelIndex+1);this.save();return;}
      if(open==='win'&&id==='home'){this.modal='home';this.revision++;return;}
      if(open==='win'&&id==='replay'){this.reset();this.save();return;}
      if(open==='win'&&id==='levels'){this.returnModal='win';this.modal='levels';this.revision++;return;}
      // 失败（步数用尽 / 死局）：重开或回首页
      if(open==='lose'&&(id==='replay'||id==='restart')){this.reset();this.save();return;}
      if(open==='lose'&&id==='home'){this.modal='home';this.revision++;return;}
      if(open==='lose'&&id==='undo'){if(this.undo())this.modal='none';return;}
      if(open==='levels'&&(id==='page-prev'||id==='page-next')){this.levelPage=Math.max(0,Math.min(Math.ceil(this.levelCount/PAGE_SIZE)-1,this.levelPage+(id==='page-next'?1:-1)));this.revision++;return;}
      if(open==='levels'&&id.startsWith('level:')){const i=Number(id.slice(6));if(Number.isInteger(i)&&i>=0&&(i<=this.maxLevel||this.unlockAll)){this.reset(i);this.save();}return;}
      return;
    }
    if(this.tip)return;                       // 说明卡未关闭时不接受牌桌指令
    if(id==='hint'){this.requestHint();return;}
    if(id==='shuffle'){this.shuffle();return;}
    if(id==='undo'){this.undo();return;}
    if(['home','settings','help','restart','levels'].includes(id)){this.returnModal='none';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/PAGE_SIZE);this.selected=null;this.hint=[];this.lastErased=[];this.save();this.revision++;}
  }
}
