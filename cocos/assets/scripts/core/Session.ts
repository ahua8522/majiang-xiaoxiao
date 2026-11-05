import {Action,Grid,Pos,Run,Pair,clone,count,Dialect,equal,hasIce,isDead,liveCount,partners,pairs,runsFor,searchHint,signature,stripIce,top,transition,unwild} from './Rules';
import {Deal,generate,goalPairs,redeal,stateLegal,LEVELS,levelAt,isFace,activeLocks,LevelDef} from './Generator';
import {CAMPAIGN_VERSION,CHAPTER_LENGTH} from './Campaign';
import {MechanicState,freshMechanics,copyMechanics,advanceMechanics,mechanicGoal,mechanicLocks,restoreMechanics,restoreRoute,searchObjective} from './Mechanics';
import {Tutorial,tutorialByKey} from './tutorials';
import {coachFor,coachSeenKey} from './coach';
import type {CoachState} from './coach';
export type Modal='none'|'home'|'help'|'settings'|'restart'|'win'|'levels'|'lose'|'pause';
/** 失败原因：步数用尽 / 时间到 / 牌走死。失败页按它给不同的出路（见 `docs/玩法深度与变现设计.md` A3）。 */
export type FailReason=''|'step'|'time'|'dead';
export interface Platform {load():unknown;save(data:unknown):void;feedback():void}
interface Snapshot {grid:Grid;moves:number;lastChain:number;solution:Action[];hint:Action[];clearedPairs:number;goalDone:number;timeLeft:number;score:number;mechanics:MechanicState;energySpent:number}
const local:Platform={load:()=>null,save:()=>{},feedback:()=>{}};
/**
 * 本地日期戳（`YYYY-MM-DD`）。道具账本按它判断「是不是新的一天」。
 *
 * 用本地时区而不是 UTC：玩家的「今天」是他手机上的今天，跨天重置跟着他的作息走。
 * 这个函数不许依赖 cc（core 要在 node 门禁里跑）。
 */
export function dayStamp(now:Date=new Date()):string{
  const p=(n:number):string=>(n<10?'0':'')+n;
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`;
}
/** 关卡选择每页格数（4 列 × 5 行，扁平网格，不分组）。 */
export const PAGE_SIZE=CHAPTER_LENGTH;
/** 一章的关数，与选关页的 4×5 一屏一致。章节门槛按它切分。 */
export const CHAPTER_SIZE=PAGE_SIZE;
/** 每章满星数 = 20 关 × 3 星。 */
export const CHAPTER_MAX_STARS=CHAPTER_SIZE*3;
/** 章节准入保留兼容接口，不设刷星门槛。 */
export const CHAPTER_GATE=Array.from({length:26},()=>0);
export const chapterOf=(index:number):number=>Math.floor(index/CHAPTER_SIZE);
export const gateFor=(chapter:number):number=>CHAPTER_GATE[chapter]??0;
/** 星级只看参考路线与实际步数；提示、洗牌不扣星。 */
export function ratingFor(moves:number,par:number):1|2|3{
  if(par<=0)return 3;
  if(moves<=par+Math.max(1,Math.round(par*0.08)))return 3;
  if(moves<=par+Math.max(2,Math.round(par*0.35)))return 2;
  return 1;
}
/** 本关的 2 星线 / 3 星线（选关页「再快 N 步」与通关页文案共用，避免两处各算一遍）。 */
export function starLines(par:number):{three:number;two:number}{
  if(par<=0)return{three:0,two:0};
  return{three:par+Math.max(1,Math.round(par*0.08)),two:par+Math.max(2,Math.round(par*0.35))};
}
export class Session {
  mechanics:MechanicState=freshMechanics(LEVELS[0]);
  legacyProgress:unknown=null;
  private energySpent=0;
  grid:Grid=[];runs:Run[]=[];levelIndex=0;maxLevel=0;total=0;moves=0;
  selected:Pos|null=null;hint:Action[]=[];message='';modal:Modal='none';
  reducedMotion=false;vibration=true;lastChain=0;solution:Action[]=[];lastErased:Pair[]=[];
  revision=0;seed:number;private history:Snapshot[]=[];private platform:Platform;
  /** 限时关剩余秒数；非限时关恒 0。只由 `tick` 递减，视图负责按帧喂 dt。 */
  timeLeft=0;private paused=false;
  /**
   * 这一局是否已经结束（通关 / 判负）。结束的一局不落盘（见 `save()`），
   * 也不能从大厅「继续」回来——否则会回到已经赢了的盘或 0 秒的限时盘。
   * 撤销会把状态退回到未结束。
   */
  private finished=false;
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
  /**
   * 真盘机制引导。与 `tip` 互斥：章教学仍走 tip（手写小盘），机制首见走 coach（真实牌桌）。
   * 非空时牌桌只接受引导目标动作；跳过关、读完档都不会重放。
   */
  coach:CoachState|null=null;
  /** 本关该展示的机制键；setupLevel 决定，reset 装好 solution 后再起 coach。 */
  private introKey:string|null=null;
  /** 上一次进入的章号；说明是否展示由持久化 tipsSeen 决定。 */
  private lastChapter:number|null=null;
  /** 已经看过的机制说明（持久化，避免每次都弹）。 */
  tipsSeen:Record<string,boolean>={};
  /** 本局得分（B1）：`Σ erased×10×(1+0.5×(chain-1))`，鼓励一次多消与多波连锁。 */
  score=0;
  /** 每关最高分 / 历史最少步数。`bestMoves` 是选关页「再快 N 步」的唯一依据。 */
  best:Record<string,number>={};
  bestMoves:Record<string,number>={};
  /**
   * 每关的参考解步数（`par`）。
   *
   * `par` 不在关卡表里——它是 `generate()` 的产物（证书长度），选关页要为 16 关各跑一次
   * 生成才能拿到，成本约 800ms，不能现算。所以通关时把它记下来，
   * 供选关页算「再快 N 步能升几星」。没通关的关没有这个数，也就不显示刷星导航。
   */
  pars:Record<string,number>={};
  /** 同一局道具用量持久化；免费重开恢复提示与洗牌。 */
  used:Record<string,{h:number;s:number}>={};
  /** 道具账本的日期戳（本地 YYYY-MM-DD）。跨天整表清空。 */
  usedDay='';
  /** 复活（A3）：本关已用次数，上限 2。第一次 +3 步，第二次 +1 步。 */
  revivesUsed=0;
  /** 复活额外换来的步数预算；`moveLimit` 要把它加上去。 */
  bonusMoves=0;
  /** 本次失败的成因。失败页据此决定给「+3 步」「+30 秒」还是「免费洗牌」。 */
  failReason:FailReason='';
  /** 提示计划的总步数（B1 提示改造）。视图用它显示「第 2/5 步」。 */
  hintTotal=0;
  private returnModal:Modal='none';
  constructor(seed=Date.now(),platform:Platform=local){
    this.seed=seed;this.platform=platform;let data:any;
    try{data=platform.load();if(typeof data==='string')data=JSON.parse(data);}catch{data=null;}
    if(data&&typeof data==='object'&&data.campaign!==CAMPAIGN_VERSION){
      // Keep the old records recoverable; rewritten boards must not inherit old scores or an incompatible live board.
      this.legacyProgress={maxLevel:data.maxLevel,stars:data.stars,best:data.best,bestMoves:data.bestMoves,run:data.run};
      data={...data,stars:{},best:{},bestMoves:{},pars:{},tipsSeen:{},used:{},run:null};
    }else if(data?.legacyProgress)this.legacyProgress=data.legacyProgress;
    if(data&&typeof data==='object'){
      if(Number.isInteger(data.maxLevel))this.maxLevel=Math.max(0,Math.min(LEVELS.length-1,data.maxLevel));
      if(data.stars&&typeof data.stars==='object')for(const [i,n]of Object.entries(data.stars))if(/^\d+$/.test(i)&&Number(i)<=this.maxLevel&&Number.isInteger(n)&&Number(n)>=1&&Number(n)<=3)this.stars[i]=Number(n);
      if(data.tipsSeen&&typeof data.tipsSeen==='object')for(const [k,v]of Object.entries(data.tipsSeen))if(v===true)this.tipsSeen[k]=true;
      // 最高分 / 最少步数：只收合法数字，坏档不许把选关页的「再快 N 步」算成 NaN。
      const nums=(src:any,ok:(n:number)=>boolean):Record<string,number>=>{
        const out:Record<string,number>={};
        if(src&&typeof src==='object')for(const [i,n]of Object.entries(src))if(/^\d+$/.test(i)&&Number.isInteger(n)&&ok(Number(n)))out[i]=Number(n);
        return out;
      };
      this.best=nums(data.best,(n)=>n>=0);
      this.bestMoves=nums(data.bestMoves,(n)=>n>0);
      this.pars=nums(data.pars,(n)=>n>0);
      // 道具账本只在同一天内有效：跨天整表清空（A2 的兜底，防止「提示用完又打不过」永久卡死）。
      const today=dayStamp();
      if(data.usedDay===today&&data.used&&typeof data.used==='object'){
        for(const [i,v]of Object.entries(data.used)){
          if(!/^\d+$/.test(i)||!v||typeof v!=='object')continue;
          const h=Math.max(0,Math.min(9,Number((v as any).h)||0)),s=Math.max(0,Math.min(9,Number((v as any).s)||0));
          if(h||s)this.used[i]={h,s};
        }
      }
      this.usedDay=today;
      this.reducedMotion=data.reducedMotion===true;this.vibration=data.vibration!==false;
    }else{this.usedDay=dayStamp();}
    // 有合法中盘就**不要再发一次牌**：reset 会完整生成一局（实测 61~553ms），
    // 然后立刻被读档的盘面覆盖。`restore` 返回 false 才需要初始化一副新牌。
    if(!(data?.version>=2&&this.restore(data.run))){this.lastChapter=null;this.reset(this.maxLevel,false);}
    this.modal='home';
  }
  private save(){try{this.platform.save({version:5,campaign:CAMPAIGN_VERSION,legacyProgress:this.legacyProgress,maxLevel:this.maxLevel,stars:this.stars,best:this.best,bestMoves:this.bestMoves,pars:this.pars,
    used:this.used,usedDay:this.usedDay,
    reducedMotion:this.reducedMotion,vibration:this.vibration,tipsSeen:this.tipsSeen,
    // 已经结束（通关 / 判负）的一局不再当成"可以继续的进度"落盘：否则冷启动会回到
    // 一个已经赢了的目标盘（win 弹框不会重放）或 0 秒的限时盘（tick 只在 before>0 时判负，
    // 于是 0 秒还能一直推）。通关那一局本来也不该继续。
    run:!this.finished&&count(this.grid)?{hash:this.def.hash,mechanics:this.mechanics,solution:this.solution,hint:this.hint,energySpent:this.energySpent,index:this.levelIndex,seed:this.seed,grid:this.grid,total:this.total,moves:this.moves,par:this.par,
      hintsUsed:this.hintsUsed,shufflesUsed:this.shufflesUsed,clearedPairs:this.clearedPairs,goalDone:this.goalDone,goalTarget:this.goalTarget,
      score:this.score,bonusMoves:this.bonusMoves,revivesUsed:this.revivesUsed,hintTotal:this.hintTotal,timeLeft:Math.round(this.timeLeft*10)/10}:null});}catch{/* Storage quota must not block play. */}}
  /** @returns 是否已经装好一副可玩的牌桌（false = 调用方需要用 `reset` 初始化）。 */
  private restore(run:any):boolean{
    if(!run||!Number.isInteger(run.index)||run.index<0||run.index>this.maxLevel||!Array.isArray(run.grid))return false;
    if(run.hash!==levelAt(run.index).hash)return false;
    const restored=restoreMechanics(levelAt(run.index),run.mechanics);if(!restored)return false;
    const map=levelAt(run.index).map,grid=run.grid as Grid;
    if(grid.length!==map.length||!grid.every((row,r)=>Array.isArray(row)&&row.length===map[r].length&&row.every((cell,c)=>map[r][c]==='.'?cell===null:map[r][c]==='#'?cell==='#':Array.isArray(cell)&&cell.length<=3&&cell.every(f=>isFace(f)))))return false;
    // 额度上限放宽到 9：广告补给（C3/C4）会把次数加回 1，固定卡 3/2 会把补给过的存档当脏档丢弃。
    if(![run.total,run.moves,run.par,run.seed,run.hintsUsed,run.shufflesUsed].every(n=>Number.isInteger(n)&&n>=0)||run.hintsUsed>9||run.shufflesUsed>9||run.moves>100000||run.par>10000)return false;
    // 中盘状态的合法性：牌总数为偶、每种牌 ≤4 张。
    // **不能**要求每种牌偶数张——百搭一次收走两张不同面的牌，用过一次必然出现奇数张
    // （实测第 60 关消一对就是 3m×3、f5*×3）。旧校验把这种合法进度当脏档丢弃：
    // 玩家重开直接回到开局，洗牌也从此永久不可用。
    if(!stateLegal(grid)||count(grid)>run.total||run.total>136)return false;
    if(Object.values(restored.collected).reduce((n,v)=>n+v,0)!==run.total-count(grid))return false;
    // 剩余时间必须恢复，否则杀进程重进＝白送一次倒计时重置，限步关可以靠反复退出刷成无限时间。
    // 旧的 version 2 存档没有这个字段，退到"满值"而不是 0（那批档不可能来自限时关）。
    const level=levelAt(run.index),limit=level.timeLimit||0;
    const tl=Number.isFinite(run.timeLeft)?run.timeLeft:limit;
    // 时间已经用完的一局不是"还能继续"的进度：恢复它只会得到一个 0 秒的牌桌
    // （tick 的判负条件是 `before>0`，0 秒反而永远不会再判负）。按"这一关重新来"处理。
    if(limit&&tl<=0){this.reset(run.index,false);this.message='上一局时间已经用完，这一关重新开始。';return true;}
    // 已经通关的一局同理，交给调用方从 `maxLevel` 重新开局（那里是下一关）。
    // `goalTarget` 是本次新增的字段；老存档没有它，只能靠盘面判断。
    const target=Number.isInteger(run.goalTarget)?run.goalTarget:0;
    if(target>0&&Number.isInteger(run.goalDone)&&run.goalDone>=target)return false;
    // 这里不再调 `reset()`：reset 会先完整生成一局新牌、再被下面的存档盘面覆盖，
    // 于是冷启动白白多花一次发牌（实测单次 61~553ms）。
    this.setupLevel(run.index);
    this.timeLeft=Math.max(0,Math.min(tl,limit));
    this.grid=clone(grid);this.mechanics=restored;this.seed=run.seed;this.total=run.total;this.moves=run.moves;this.par=run.par;
    this.energySpent=Number.isInteger(run.energySpent)?Math.max(0,run.energySpent):0;
    // 进度条分母要能恢复：哑弹不可能被消掉，所以「已消的牌」全是能消的，
    // liveTotal = 现在还能消的 + 已经消掉的。不补这一句，读档后进度条会除以 0。
    this.liveTotal=liveCount(this.grid,this.dialect)+(this.total-count(this.grid));
    // 道具额度**以账本为准**，不能信 `run.hintsUsed`：账本跨天会整表清空，
    // 而中盘快照里存的是清空前的旧账——照它恢复，跨天白送的额度就没了。
    const book=this.used[this.levelIndex];
    this.hintsUsed=book?book.h:0;this.shufflesUsed=book?book.s:0;
    // 分数与复活预算必须跟着盘面一起恢复：不恢复 bonusMoves 就等于「杀进程重进白送 3 步」，
    // 不恢复 revivesUsed 就等于每关能无限复活。
    this.score=Number.isInteger(run.score)?Math.max(0,run.score):0;
    this.bonusMoves=Number.isInteger(run.bonusMoves)?Math.max(0,run.bonusMoves):0;
    this.revivesUsed=Number.isInteger(run.revivesUsed)?Math.max(0,Math.min(2,run.revivesUsed)):0;
    this.hintTotal=Number.isInteger(run.hintTotal)?Math.max(0,run.hintTotal):0;
    this.clearedPairs=Number.isInteger(run.clearedPairs)?Math.max(0,run.clearedPairs):0;
    this.goalDone=Number.isInteger(run.goalDone)?Math.max(0,run.goalDone):0;
    // 目标按「已经收到手的 + 盘上还剩的」收敛，绝不让读档之后的目标变成够不着的数字
    this.goalTarget=target||goalPairs(this.def,this.grid);
    // 读中盘不补放引导：引导只服务“新开这一关”。玩家杀进程不该被同一段教学再拦一次。
    // 保留 setupLevel 根据换章算出的章首弹框：冷启动读中盘也属于“进入这一章”。
    this.refreshRuns();this.coach=null;this.introKey=null;
    this.solution=restoreRoute(this.def,this.grid,this.mechanics,this.clearedPairs,run.solution);
    this.hint=restoreRoute(this.def,this.grid,this.mechanics,this.clearedPairs,run.hint,false);
    this.hintTotal=this.hint.length?Math.max(this.hint.length,this.hintTotal):0;
    this.message='牌桌已保留，接着上一盘慢慢想。';
    return true;
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
    const l=mechanicLocks(this.def,this.clearedPairs,this.mechanics);
    this.runs=runsFor(this.grid,l.lockR,l.lockC,this.def.oneWay);
  }
  get levelCount(){return LEVELS.length;}
  /** 本关钉死的发牌种子；`null` = 该关没钉（主线不该出现，无尽段之外的兜底路径）。 */
  get pinnedSeed(){return Number.isInteger(this.def.seed)?this.def.seed>>>0:null;}
  /** 本关限时秒数；0 = 不限时。视图据此决定要不要画倒计时。 */
  get timeLimit(){return this.def.timeLimit||0;}
  /** 本关方言（哪些牌能配对）。所有配对判定都要带上它。 */
  get dialect():Dialect|undefined{return this.def.dialect;}
  /** 还能被消掉的牌数。方言关的进度条和剩余数必须用它，否则玩家面对一堆消不掉的哑弹永远到不了 0。 */
  get remaining(){return liveCount(this.grid,this.dialect);}
  /** 开局时还能消的牌数，作进度条分母；total 仍是全部牌位（存档校验靠它，别动）。 */
  liveTotal=0;
  /** 牌面代号 → 中文名（目标关 HUD 等界面文案用）。 */
  static faceName(face:string):string{
    const nums='一二三四五六七八九';
    const m=/^(\d)([psm])$/.exec(face);
    if(m)return nums[Number(m[1])-1]+(m[2]==='p'?'筒':m[2]==='s'?'条':'万');
    if(/^z[1-7]$/.test(face))return ['東','南','西','北','中','發','白'][Number(face[1])-1];
    if(/^f[1-8]$/.test(face))return ['春','夏','秋','冬','梅','兰','竹','菊'][Number(face[1])-1];
    return face;
  }
  /**
   * 难度 1~5：按章推进。旧口径 `1+floor(index/20)` 在 224 关下会把前三章全标成同一级，
   * 而章节才是玩家感知的难度台阶。
   */
  // 用 ?? 而不是 Number.isInteger 判空：TS 不认后者做类型窄化。
  get difficulty(){const c=this.def.chapter??Math.floor(this.levelIndex/CHAPTER_SIZE);return Math.max(1,Math.min(5,1+Math.floor(c/6)));}
  get hintsLeft(){return Math.max(0,3-this.hintsUsed)+(this.mechanics.charge>=4?1:0);}
  get shufflesLeft(){return 2-this.shufflesUsed;}
  /** 旧方言与固定位置目标不提供洗牌，避免重排破坏解题条件。 */
  get shuffleBlocked(){return !!this.def.dialect||!!this.def.floors?.length;}
  get canUndo(){return this.history.length>0;}
  /** 本关步数上限（0 = 不限步）。复活换来的额外步数算在里面。 */
  get moveLimit(){return (this.def.moveLimit||0)+this.bonusMoves;}
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
  get objectiveText():string{
    const g=this.goal;
    if(this.def.floors?.length){const names={flower:'开花',dew:'浇水',bud:'花苞'};return `${names[this.def.floors[0].kind]} ${this.goalDone}/${this.goalNeed}`;}
    if(g?.kind==='collect')return `收集 ${this.goalDone}/${this.goalNeed} 种`;
    if(g?.kind==='face')return `${Session.faceName(g.face||'')} ${this.goalDone}/${this.goalNeed}`;
    if(g?.kind==='ice')return `破冰 ${this.goalDone}/${this.goalNeed}`;
    return `剩余 ${this.remaining} 张`;
  }

  /**
   * 可靠的死局判定（不是近似搜索）：没有可消对子，且所有可达状态都没有任何一步能减少牌数。
   * 视图在每次落子后调用；预算用尽时返回 false（不误判）。
   */
  get dead():boolean{
    if(this.goalReached)return false;
    if(!liveCount(this.grid,this.dialect))return !!this.def.floors?.length;
    return isDead(this.grid,(grid)=>{const l=mechanicLocks(this.def,this.clearedPairs,this.mechanics);return runsFor(grid,l.lockR,l.lockC,this.def.oneWay);},2000,60,this.dialect);
  }
  /** 待展示的说明卡：第 1 关固定教学；其余机制只在首次出现时弹一次。 */
  get introTip():string|null{return this.tip;}
  /** 这一关该弹的是「手写小盘教学」还是「文字卡」：非 null 就开教学屏（视图据此分岔）。 */
  get introTutorial():Tutorial|null{return this.tip?tutorialByKey(this.tip):null;}
  dismissTip():void{
    const t=this.tip;
    if(!t)return;
    this.tipsSeen[t]=true;
    // 章小盘演过，就算看过它覆盖的那张机制卡——否则「演完冰、进关又弹一张冰的文字卡」。
    // 只标真命中过的键，别把无关的机制写脏。
    // 第 1 关同理：章 1 的教学脚本补上之后，dismiss 完不许再掉去弹 basic 文字卡。
    if(tutorialByKey(t)){
      if(this.def.intro&&!this.tipsSeen[this.def.intro])this.tipsSeen[this.def.intro]=true;
      // 章教学已经讲过这套机制：连 coach 一起标掉，避免之后某关又弹一次真盘引导。
      if(this.def.intro&&coachFor(this.def.intro))this.tipsSeen[coachSeenKey(this.def.intro)]=true;
      if(this.levelIndex===0)this.tipsSeen['basic']=true;
    }
    this.save();
    this.tip=null;this.revision++;
  }

  /* ── 真盘机制引导（coach） ───────────────────────────── */

  /**
   * 试错步的目标轨：锁行取第一条锁行、锁列取第一条锁列、单向轨取第一条带 dir 的轨。
   * 返回 runs 下标；不是试错步或找不到时返回 -1。
   */
  coachBounceRun():number{
    const c=this.coach;
    if(!c||!c.text.bounce||c.index>0)return -1;
    for(let i=0;i<this.runs.length;i++){
      const r=this.runs[i];
      if(c.text.key==='lockRow'&&r.axis==='row'&&r.locked)return i;
      if(c.text.key==='lockCol'&&r.axis==='col'&&r.locked)return i;
      if(c.text.key==='oneWay'&&r.dir)return i;
    }
    return -1;
  }
  /** 引导期间这次拖动能不能起手：试错步只认目标锁轨；正常步只认目标轨；点消步一律不拖。 */
  coachAllowsSlide(run:number):boolean{
    const c=this.coach;
    if(!c)return true;
    if(c.text.bounce&&c.index===0)return run===this.coachBounceRun();
    const a=this.solution[0];
    return !!a&&a.kind==='slide'&&a.run===run;
  }
  /** 手势被引导拒绝时给视图的一句短话。 */
  coachDragHint():string{
    const c=this.coach;
    if(!c)return '';
    if(c.text.bounce&&c.index===0)return c.text.key==='oneWay'?'反着箭头推一下，看看推不推得动。':'拖亮起来的那一行，看看推不推得动。';
    const a=this.solution[0];
    return a&&a.kind==='match'?'点亮起的两张牌，不用拖。':'拖亮起来的那一行。';
  }
  /** 把一句纠正贴到引导横幅上；无引导时退化成普通 notice。 */
  coachNote(text:string):void{
    if(!this.coach){this.notice(text);return;}
    this.coach.hint=text;this.revision++;
  }
  /** 测试与 headless 取证用：直接喂一个 Action，绕开手势。 */
  feed(action:Action):boolean{return this.coach?this.coachAct(action):this.apply(action);}

  private coachTap(p:Pos):boolean{
    const c=this.coach!;
    if(this.modal!=='none')return false;
    const want=this.solution[0];
    if((c.text.bounce&&c.index===0)||!want||want.kind!=='match'){this.coachNote(this.coachDragHint());return false;}
    if(!equal(p,want.a)&&!equal(p,want.b)){this.coachNote('点亮起的两张牌。');return false;}
    if(this.selected&&equal(this.selected,p)){this.selected=null;this.revision++;return false;}
    if(this.selected&&(equal(this.selected,want.a)||equal(this.selected,want.b))){
      return this.coachAct({kind:'match',a:this.selected,b:p});
    }
    this.selected=p;this.revision++;return false;
  }
  /**
   * 唯一提交口：目标动作永远取 `solution[0]`。判据与提示一样——比较结果盘面，
   * 反向推同一轨、点另一侧，只要盘面一样都算对。
   */
  private coachAct(action:Action):boolean{
    const c=this.coach;
    if(!c||this.modal!=='none')return false;
    if(c.text.bounce&&c.index===0){
      const run=this.coachBounceRun();
      if(run<0||action.kind!=='slide'||action.run!==run){
        this.coachNote(action.kind==='match'?'点亮起的那两张牌。':'推亮起来的那一行。');
        return false;
      }
      if(c.text.key==='oneWay'){
        const r=this.runs[run];
        if(!r||!r.dir||action.step===0||action.step*r.dir>0){
          this.coachNote('反着箭头推一下。');return false;
        }
      }
      c.index++;c.hint='';
      if(c.index>=c.total)this.finishCoach(false);else this.revision++;
      return true;
    }
    const want=this.solution[0];
    if(!want){this.finishCoach(true);return false;}
    let exp, got;
    try {
      exp=transition(this.grid,this.runs,want,this.dialect);
      got=transition(this.grid,this.runs,action,this.dialect);
    } catch {
      // 规则层出意外时立刻降级进关，别把玩家卡在引导里。
      this.finishCoach(true);return false;
    }
    if(!got.changed||signature(got.grid)!==signature(exp.grid)){
      this.coachNote(this.coachWrongLine(action,want));return false;
    }
    const ok=this.apply(action);
    if(ok){
      c.index++;c.hint='';
      if(c.index>=c.total||this.modal!=='none'||!this.solution.length)this.finishCoach(false);
      else this.revision++;
    }
    return ok;
  }
  private coachWrongLine(action:Action,want:Action):string{
    if(want.kind==='match')return '点亮起的那两张牌。';
    if(action.kind==='slide'&&want.kind==='slide'&&action.run===want.run)return '换个方向再推一次。';
    return '按住亮起来的那一行再拖。';
  }
  /** 完成或跳过：把机制键与 coach 键一起写进 tipsSeen，之后不再弹。 */
  private finishCoach(skipped:boolean):void{
    const c=this.coach;
    if(!c)return;
    this.tipsSeen[c.text.key]=true;
    this.tipsSeen[coachSeenKey(c.text.key)]=true;
    this.coach=null;
    if(this.modal==='none'){
      // 第 1 关只强制教了拖动；点消这条留在收尾提醒里，否则新玩家不知道第二种操作。
      this.message=skipped?'跳过引导，接着推。'
        :(c.text.key==='basic'?'也可以直接点两张同牌；接着推。':'引导完成，接着推。');
    }
    this.save();this.revision++;
  }
  /** 当前弹窗是从哪一屏打开的：'home' 表示首页，'none' 表示牌桌。
   *  视图必须据此决定弹窗底下画哪一屏——否则从首页打开设置会露出牌桌。 */
  get openedFrom():Modal{return this.returnModal;}
  /**
   * 本章已拿到的星数。**只统计已通关的关**（`stars` 里没有的关不贡献）。
   * 章节门槛（B2）与选关页页脚的「还需 N 星」都读它。
   */
  chapterStars(chapter:number):number{
    const from=chapter*CHAPTER_SIZE,to=Math.min(from+CHAPTER_SIZE,LEVELS.length);
    let n=0;for(let i=from;i<to;i++)n+=this.stars[i]||0;
    return n;
  }
  /** 本章星数门槛。 */
  gateOf(chapter:number):number{return gateFor(chapter);}
  /** 距离解锁本章还差几星（0 = 已达标）。 */
  gateGap(chapter:number):number{return Math.max(0,gateFor(chapter)-this.chapterStars(chapter));}
  /** 正式版按 maxLevel 线性解锁；开发与体验版可跳关验证。 */
  canEnterChapter(chapter:number):boolean{
    if(this.unlockAll)return true;
    if(chapter<=0)return true;
    return chapter*CHAPTER_SIZE<=this.maxLevel;
  }
  canEnter(index:number):boolean{
    if(!Number.isInteger(index)||index<0||index>=LEVELS.length)return false;
    if(this.unlockAll)return true;              // 体验版/开发版：进度与星数门槛都绕过
    if(index>this.maxLevel)return false;
    return this.canEnterChapter(chapterOf(index));
  }
  /** 星级：只看步数（旧口径的「用道具掉星」已删，理由见 `ratingFor` 注释）。 */
  get rating(){return ratingFor(this.moves,this.par);}
  /** 本关的 2 星线 / 3 星线。视图（牌桌 HUD、失败页、选关页）直接用，避免两端各算一遍算岔。 */
  get starLines(){return starLines(this.par);}
  private remember(){this.history.push({grid:clone(this.grid),moves:this.moves,lastChain:this.lastChain,solution:this.solution.slice(),hint:this.hint.slice(),clearedPairs:this.clearedPairs,goalDone:this.goalDone,timeLeft:this.timeLeft,score:this.score,mechanics:copyMechanics(this.mechanics),energySpent:this.energySpent});if(this.history.length>80)this.history.shift();}
  /** 只装配关卡的静态部分（定义、计数器、待弹的说明卡），**不发牌**。 */
  private setupLevel(chosen:number,chapterEntry=false):void{
    this.levelIndex=chosen;this.def=levelAt(chosen);this.mechanics=freshMechanics(this.def);this.energySpent=0;
    this.finished=false;this.coach=null;this.introKey=null;
    this.moves=0;this.lastChain=0;this.selected=null;this.hint=[];this.history=[];this.modal='none';this.lastErased=[];
    // 读档保留同一局用量，reset 已先清空本关账本。
    const book=this.used[chosen];
    this.hintsUsed=book?book.h:0;this.shufflesUsed=book?book.s:0;
    this.levelPage=Math.floor(chosen/PAGE_SIZE);this.returnModal='none';
    this.clearedPairs=0;this.goalDone=0;this.goalTarget=0;
    this.score=0;this.bonusMoves=0;this.revivesUsed=0;this.failReason='';this.hintTotal=0;
    this.timeLeft=this.def.timeLimit||0;this.paused=false;
    // 展示决策：每章**第一次进入**时弹一次章首说明，关掉即自由玩。
    // 不再按机制首现弹卡，也不再把章 6 拦进独立小盘教学屏。
    // 判据是「这一章第一次被进入」而不是「这一关是章首」：玩家从选关跳进章 6 的第 4 关，
    // 也该补上这段与具体盘面无关的章级说明。
    const chapter=this.def.chapter??Math.floor(chosen/CHAPTER_SIZE);
    // 每章首次阅读后记住，冷启动与重开都不重复。
    const tipKey='ctip:'+chapter;
    this.tip=!this.tipsSeen[tipKey]?tipKey:null;
    this.lastChapter=chapter;
    this.introKey=null;                                  // 旧 coach / intro 机制停用
  }
  /**
   * 起真盘引导：目标动作取认证解 `solution[0]`，所以只在 reset 装好 solution 之后调用。
   * 证书步数不够（理论上不该发生）就退回文字卡——引导永远不是进关门槛。
   */
  private maybeStartCoach():void{
    const key=this.introKey;
    if(!key||this.tip)return;                 // 章教学优先；tip 非空时不走 coach
    const text=coachFor(key);
    if(!text||this.tipsSeen[coachSeenKey(key)])return;
    try {
      if(this.solution.length<text.steps){this.tip=key;this.revision++;return;}
      this.coach={text,index:0,total:text.steps+(text.bounce?1:0),hint:''};
      this.revision++;
    } catch {
      // 教学是加法：起不来就退回文字卡，绝不能把进关拦住。
      this.coach=null;this.tip=key;this.revision++;
    }
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
    // 钉了种子的关**只能**用它：换派生种子重试会发出另一盘，等于当着玩家的面换关卡内容。
    // 真发不出牌是数据事故（跑批与 levels-seed 门禁本该拦住），所以要指名该重跑什么命令。
    const pin=LEVELS[chosen]?.seed;
    const attempts=Number.isInteger(pin)?[pin>>>0]:[1,2,3,4].map(k=>(this.seed+Math.imul(k,0x9e3779b9))>>>0);
    for(const s of attempts){
      try{return{index:chosen,deal:generate(chosen,s)};}catch{/* 没钉种子的关：换下一颗派生种子 */}
    }
    console.error('[core] 这一关发不出可验证的牌，已兜底到第 1 关。钉死种子的关出现这条＝levels.ts 与 .test 不同步，请重跑 npm run author:levels',{level:chosen,seed:this.seed,pin});
    this.seed=(this.seed+1)>>>0;
    return{index:0,deal:generate(0,this.seed)};
  }
  reset(index=this.levelIndex,fresh=true,chapterEntry=false){
    const wanted=Number.isFinite(index)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(index))):0;
    // 关卡是固定谜题：这一关钉了 seed，重开就必须看到同一盘（玩家背板重来才有三星动力，
    // 作者试玩的那一盘也必须就是玩家拿到的那一盘）。没钉的关保留旧的"每次换一副"行为。
    const pin=LEVELS[wanted]?.seed;
    this.seed=Number.isInteger(pin)?pin>>>0:(fresh?(this.seed+0x9e3779b9)>>>0:this.seed);
    const{index:chosen,deal}=this.deal(wanted);
    delete this.used[chosen];
    this.setupLevel(chosen,chapterEntry);
    this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.refreshRuns();
    this.total=count(this.grid);this.liveTotal=liveCount(this.grid,this.dialect);this.par=deal.solution.length;
    this.goalTarget=goalPairs(this.def,this.grid);
    this.message=chosen===0?'同牌相邻，轻点消除；拖动一行或一列，松手自动消。'
      :(chosen!==wanted?'这一关暂时发不出可解的牌，先给你摆了第 1 关。':'看清这盘的障碍，先找出第一步。');
    this.maybeStartCoach();
    this.revision++;
  }
  setPaused(v:boolean){this.paused=v;}
  /**
   * 限时关的秒数推进。视图每帧喂 dt，**只有牌桌活跃、无弹窗、没被说明卡挡住、未暂停时才走表**。
   *
   * 单帧钳到 0.25 秒：小游戏切后台掉帧、一次 GC 卡十几秒，都不许把倒计时吃掉——
   * 玩家因为手机卡了一下就被判负，是要投诉的。真实时间靠 `paused` 挡，不用 `Date.now()` 追：
   * 追时间必然在"接电话回来"的那一刻做出错误判决。
   * @returns 是否跨过了整秒（视图据此决定要不要重绘）
   */
  tick(dt:number):boolean{
    if(!this.def.timeLimit||this.modal!=='none'||this.tip||this.coach||this.paused)return false;
    const before=this.timeLeft;
    this.timeLeft=Math.max(0,this.timeLeft-Math.min(Math.max(dt,0),0.25));
    if(this.timeLeft<=0&&before>0){
      this.modal='lose';this.finished=true;this.failReason='time';this.message=`时间到，还差 ${liveCount(this.grid,this.dialect)} 张可消。`;this.save();return true;
    }
    const crossed=Math.ceil(this.timeLeft)!==Math.ceil(before);
    // 每跨过整秒就落盘。剩余时间不进存档的话，杀进程重进＝倒计时满血复活，
    // 限时关可以靠反复退出刷成无限时间——这是会被拿来刷星级的漏洞，不是体验问题。
    if(crossed)this.save();
    return crossed;
  }
  private apply(action:Action):boolean{
    if(this.modal!=='none'||this.tip)return false;
    const out=transition(this.grid,this.runs,action,this.dialect);if(!out.changed)return false;
    // 目标数必须在 `this.grid` 被这一步改掉**之前**定下来：绕过 reset 直接装盘的路径
    // 会在这里就地补算一次，等盘面改完再算就变成 0 了（碎冰/收对之后牌已经不在盘上）。
    const need=this.goalNeed;
    this.remember();
    const nextMechanics=advanceMechanics(this.def,this.mechanics,out);
    const sameMarks=(change:typeof out)=>advanceMechanics(this.def,this.mechanics,change).marks.join()===nextMechanics.marks.join();
    const planned=this.solution[0],expected=planned?transition(this.grid,this.runs,planned,this.dialect):null;
    if(expected?.changed&&signature(expected.grid)===signature(out.grid)&&sameMarks(expected))this.solution.shift();else this.solution=[];
    const hinted=this.hint[0];
    if(hinted&&signature(transition(this.grid,this.runs,hinted,this.dialect).grid)===signature(out.grid)&&sameMarks(transition(this.grid,this.runs,hinted,this.dialect))){
      // 提示是**分步计划**（B1）：走对一步就前进到下一步，玩家不用再点一次提示。
      this.hint.shift();
      if(!this.hint.length)this.hintTotal=0;
    }else{
      // 没按计划走：整个计划作废。留在屏上的指引一旦和盘面对不上，
      // 比不给指引更糟——玩家会照着错的走。
      this.hint=[];this.hintTotal=0;
    }
    const previousGrid=this.grid;
    this.mechanics=nextMechanics;
    this.grid=out.grid;this.selected=null;this.lastChain=out.chain;this.lastErased=out.erased;
    this.moves++;
    // 分数（B1）：一次消得多、连锁波数多，得分才高。
    // 这是把「随便推一下反正会自动连锁」变成「找一条能连三波的轨」的唯一手段。
    this.score+=Math.round(out.erased.length*10*(1+0.5*(Math.max(1,out.chain)-1)));
    // 进度统计：碎冰不算「消掉一对」；目标按 面/冰 两种口径累计。
    // 两侧牌面都要看（`Pair.other`）：百搭与冰牌配对时 a/b 牌面不同，只看 a 侧
    // 会让记账取决于「玩家先点哪张」（实测：先点百搭算收走一对、先点冰牌算只碎冰）。
    const whole=(p:Pair):boolean=>!hasIce(p.face)&&!hasIce(p.other);
    const anyIce=(p:Pair):boolean=>hasIce(p.face)||hasIce(p.other);
    const cleared=out.erased.filter(whole).length;
    this.clearedPairs+=cleared;
    const g=this.goal;
    if(g){
      if(g.kind==='ice'){
        const layers=(grid:Grid)=>grid.flat().reduce((n,c)=>n+(Array.isArray(c)?c.reduce((v,f)=>v+(f.match(/~/g)||[]).length,0):0),0);
        this.goalDone+=layers(previousGrid)-layers(this.grid);
      }else this.goalDone=mechanicGoal(this.def,this.mechanics);
      if(need)this.goalDone=Math.min(this.goalDone,need);
    }
    this.refreshRuns();
    if(out.erased.length&&this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}
    const brokeIce=out.erased.some(anyIce);
    this.message=brokeIce
      ?'冰层碎了，露出牌面再消一次才能收走。'
      // 麻将语汇是白捡的手感：碰 / 杠 / 胡 三个词，零美术成本，题材浓度比再加一种机制高。
      :(out.erased.length?(out.chain>=3?`杠！连消 ${out.chain} 层，带走 ${out.erased.length} 对。`
        :out.chain>1?`碰！连消 ${out.chain} 层，带走 ${out.erased.length} 对。`
        :`碰个对！消掉 ${out.erased.length} 对。`)
        :'再转个方向，牌会从轨道另一头回来。');
    if(this.hint.length)this.message=this.hintLead()+this.describe(this.hint[0]);
    // 方言关的终点是还能配的都消光：哑弹留在盘上也算清台（判据见 Rules.liveCount）
    const done=liveCount(this.grid,this.dialect)===0;
    if((done&&!this.goal)||this.goalReached){
      this.modal='win';this.finished=true;if(this.levelIndex<=this.maxLevel)this.maxLevel=Math.max(this.maxLevel,Math.min(LEVELS.length-1,this.levelIndex+1));
      const lv=this.levelIndex;
      this.stars[lv]=Math.max(this.stars[lv]||0,this.rating);
      // 最高分 / 最少步数：都只往好的方向写，重打一次打砸了不许把纪录冲掉。
      this.best[lv]=Math.max(this.best[lv]||0,this.score);
      this.bestMoves[lv]=this.bestMoves[lv]?Math.min(this.bestMoves[lv],this.moves):this.moves;
      // par 记下来供选关页算「再快 N 步」。它不在关卡表里（是 generate 的产物），
      // 选关页不可能为 16 关各跑一次生成，所以只能通关时顺手存。
      if(this.par>0)this.pars[lv]=this.par;
      // 通关即结清本关道具账本：下一关是新账本，重进这一关（刷星）也重新有 3 次提示。
      delete this.used[lv];
      this.hint=[];this.hintTotal=0;
      this.message=done?'胡了！清台。':'胡了！目标达成。';
    }else if(done&&this.goal){
      this.modal='lose';this.finished=true;this.failReason='dead';this.message='目标还没完成，试试换个消除位置。';
    }else if(this.moveLimit&&this.moves>=this.moveLimit){
      // 步数用尽：明确判负（视图据此弹失败页）
      this.modal='lose';this.finished=true;this.failReason='step';this.message=`步数用尽，还差 ${liveCount(this.grid,this.dialect)} 张可消。`;
    }
    this.save();this.revision++;return true;
  }
  /** @returns 是否真的提交了一步（选中第一张牌返回 false，视图据此不跑胜负判定）。 */
  tap(p:Pos):boolean{
    if(this.coach)return this.coachTap(p);
    if(this.modal!=='none'||this.tip)return false;
    this.lastErased=[];
    if(!top(this.grid,p)){this.selected=null;this.revision++;return false;}
    if(this.selected&&partners(this.grid,this.selected,this.dialect).some(q=>equal(q,p))){return this.apply({kind:'match',a:this.selected,b:p});}
    const near=partners(this.grid,p,this.dialect);
    if(near.length===1){return this.apply({kind:'match',a:p,b:near[0]});}
    this.selected=equal(this.selected,p)?null:p;
    this.message=near.length>1?'有不止一个搭子，点你想消的那张。':'拖动这一行或这一列，把搭子推到旁边。';
    this.revision++;
    return false;
  }
  /** Feedback for gestures that cannot become an action (locked rail, wood block, hole). */
  notice(text:string){if(this.coach){this.coachNote(text);return;}if(this.modal!=='none'||this.tip)return;this.selected=null;this.lastErased=[];this.message=text;if(this.vibration){try{this.platform.feedback();}catch{/* Optional haptics. */}}this.revision++;}
  /**
   * 视图判定「牌走死」（`dead` 为真）之后调用。
   *
   * 以前视图只是把屏幕切到失败页，Session 仍停在 `modal='none'` 的活跃状态：
   * 限时关会继续走表（失败原因被改写成"时间到"），存档也会把死盘写进去，
   * 冷启动后落在一个既没有失败页、也走不动的牌桌上。
   */
  finishDead():void{
    if(this.finished)return;
    this.finished=true;this.modal='lose';this.failReason='dead';
    this.message='牌走死了：剩下的牌凑不出可消的组合。';
    this.save();this.revision++;
  }
  /** 失败后免费补步，上限两次；位置目标死局用撤销或重开。 */
  get canRevive():boolean{return this.modal==='lose'&&this.finished&&this.failReason!=='dead'&&this.revivesUsed<2;}
  /** 这次复活能换多少：第一次 +3 步，第二次 +1 步。不做递减上限就是无限续命。 */
  get reviveBonus():number{return this.revivesUsed===0?3:1;}
  /** 免费续局：保留盘面与机关进度，补充步数或兼容模式的时间。 */
  revive():boolean{
    if(!this.canRevive)return false;
    const bonus=this.reviveBonus;
    if(this.failReason==='step'){
      this.bonusMoves+=bonus;
    }else if(this.failReason==='time'){
      this.timeLeft=Math.max(0,this.timeLeft)+30;
    }else return false;
    this.revivesUsed++;
    this.finished=false;this.modal='none';this.failReason='';this.selected=null;this.hint=[];this.hintTotal=0;
    this.message=this.bonusMoves?`补了 ${bonus} 步，接着推。`:'补了 30 秒，接着推。';
    this.save();this.revision++;return true;
  }
  /** 非位置目标死局可免费重排；位置目标必须保留布局。 */
  rescueShuffle():boolean{
    if(this.modal!=='lose'||this.failReason!=='dead')return false;
    if(this.shuffleBlocked){this.message='位置目标需要保留原布局，可以撤销或重开。';this.revision++;return false;}
    const deal=redeal(this.levelIndex,this.grid,(this.seed+this.revision*7919)>>>0);
    if(!deal){this.message='这一关的牌重排不开，只能重新开始。';this.revision++;return false;}
    this.remember();
    this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.refreshRuns();this.hint=[];this.hintTotal=0;
    this.selected=null;this.lastChain=0;this.lastErased=[];
    this.refreshRuns();
    this.finished=false;this.modal='none';this.failReason='';
    this.message='牌重排过了，接着来。';
    this.save();this.revision++;return true;
  }
  slide(run:number,step:number):boolean{const a={kind:'slide' as const,run,step};return this.coach?this.coachAct(a):this.apply(a);}
  undo():boolean{
    if(this.tip||this.coach)return false;
    // 步数/时间失败用续局；位置目标死局可以撤销恢复路线。
    if(this.modal!=='none'&&this.modal!=='win'&&!(this.modal==='lose'&&this.failReason==='dead'))return false;
    const snap=this.history.pop();if(!snap){this.message='还没有需要撤销的操作。';this.revision++;return false;}
    this.grid=snap.grid;
    // ⚠️ A1：`moves` 与 `timeLeft` **刻意不回退**。
    // 回退就等于限步关可以「推→撤销→再推」无限穷举（138 关，占 61%），
    // 限时关可以靠撤销把时间倒流。撤销的代价必须是「花掉 1 步 / 花掉已经流逝的时间」。
    this.lastChain=snap.lastChain;this.solution=snap.solution;this.hint=snap.hint;this.hintTotal=0;
    this.clearedPairs=snap.clearedPairs;this.goalDone=snap.goalDone;this.score=snap.score;this.mechanics=copyMechanics(snap.mechanics);
    // Undo removes earned charge but cannot refund a hint already received.
    this.mechanics.charge=Math.max(0,this.mechanics.charge-4*(this.energySpent-snap.energySpent));
    // 从失败页撤销回来：这一局重新变成"活着"，时间也退回落子前的那一瞬。
    // 只把 modal 改成 none 而不退时间，会出现"0 秒还能继续推"的漏洞
    // （tick 的判负条件要求 before>0）。
    this.finished=false;this.failReason='';this.refreshRuns();
    this.selected=null;this.modal='none';this.lastErased=[];this.message=this.moveLimit?'已撤销，步数不退。':'已撤销。';this.save();this.revision++;return true;
  }
  shuffle():boolean{
    if(this.modal!=='none'||this.tip||!count(this.grid))return false;
    if(this.shuffleBlocked){this.notice('位置目标关请用撤销或重开。');return false;}
    if(!this.shufflesLeft){this.notice('本关两次免费洗牌已用完，可以撤销或重开。');return false;}
    const deal=redeal(this.levelIndex,this.grid,(this.seed+this.revision*7919)>>>0);
    if(!deal){this.message='这次无法安全重排，原来的牌没有改动。';this.revision++;return false;}
    this.remember();this.grid=deal.grid;this.runs=deal.runs;this.solution=deal.solution;this.hint=[];this.selected=null;this.lastChain=0;this.lastErased=[];
    this.refreshRuns();
    this.shufflesUsed++;
    // 账本要跟着落盘：否则重开一次洗牌次数就复活，稀缺性又没了（A2）。
    this.used[this.levelIndex]={h:this.hintsUsed,s:this.shufflesUsed};
    this.message='原牌重新摆好；洗牌不改牌种。';this.save();this.revision++;return true;
  }
  /**
   * 提示文案。**必须短**：它要和「第 1/3 步 · 」前缀一起塞进顶部横幅一行，
   * 以前写成「先推第 1 行，向右 1 格；下一步会接着提示。」+ 前缀就溢出了，
   * 玩家看到的是一条被截断的省略号。
   */
  describe(a:Action):string{
    if(a.kind==='match')return `点第 ${a.a.r+1} 行第 ${a.a.c+1} 列这一对。`;
    const r=this.runs[a.run];
    return `推第 ${r.index+1} ${r.axis==='row'?'行':'列'}，向${r.axis==='row'?(a.step>0?'右':'左'):(a.step>0?'下':'上')} ${Math.abs(a.step)} 格。`;
  }
  /**
   * 生成一段**分步提示计划**（B1 提示改造）。
   *
   * 旧口径是 `searchHint(maxDepth=3)`：它只回答「眼前 3 步内能消什么」，
   * 对 par=40 的关等于给了 9 步、剩下 31 步还是不会走。玩家体感是「提示没用」。
   *
   * 新口径：`solution`（生成器证书路线）还跟得上当前盘面时，直接沿它给 K 步——
   * 一次提示卖的是「这一段怎么走」。走偏了才退回局部搜索，并且明说不再保证三星。
   */
  private planHint():Action[]{
    const K=Math.max(3,Math.min(8,Math.round(this.par/6)||3));
    if(this.solution.length){
      // 只验第一步：它在**当前** runs 上能执行，说明 solution 没走偏。
      // 逐步骤验会踩「牌消掉后 runs 重算、下标指到别的轨」那个老坑（见 Rules.Run 的注释）。
      if(transition(this.grid,this.runs,this.solution[0],this.dialect).changed)return this.solution.slice(0,K);
    }
    if(this.def.floors?.length||this.def.keyLocks?.length){return searchObjective(this.def,this.grid,this.mechanics,this.clearedPairs).slice(0,K);}
    const h=searchHint(this.grid,this.runs,{budget:1800,maxDepth:liveCount(this.grid,this.dialect)<=6?8:3},this.dialect);
    if(h.status==='found'&&h.actions.length)return h.actions;
    if(this.solution.length)return [this.solution[0]];
    return [];
  }
  /** 分步提示的前缀「第 2/5 步 · 」。推对一步后由 `apply` 接着用，玩家能看出计划在往前走。 */
  private hintLead():string{
    if(this.hintTotal<=1)return '';
    const done=this.hintTotal-this.hint.length+1;
    return `第 ${done}/${this.hintTotal} 步 · `;
  }
  requestHint(){
    if(this.modal!=='none'||this.tip||this.coach)return;
    this.lastErased=[];
    if(this.hint.length){this.message=this.describe(this.hint[0]);this.revision++;return;}
    if(!this.hintsLeft){this.notice(this.def.energy?'提示已用完。消牌充能，或免费重开。':'提示已用完，可以撤销或免费重开。');return;}
    const plan=this.planHint();
    this.hint=plan;this.hintTotal=plan.length;
    if(this.hint.length){if(this.mechanics.charge>=4){this.mechanics.charge=0;this.energySpent++;}else this.hintsUsed++;this.used[this.levelIndex]={h:this.hintsUsed,s:this.shufflesUsed};this.save();}
    // 方言关本来就不给洗牌（`shuffleBlocked`），让玩家"试试洗牌"只会换来一句拒绝。
    const retry=this.shuffleBlocked?'可以撤销或重开':'可以撤销、洗牌或重开';
    const lead=this.hintLead();
    this.message=this.hint.length?lead+this.describe(this.hint[0]):`暂时没找到短路线，不代表无解。${retry}。`;
    this.revision++;
  }
  command(id:string){
    // 引导期间挡住会改盘面/改进度的操作；关卡/设置/首页这些导航仍然放行，
    // 否则玩家被引导卡在牌桌上，连回首页都做不到。
    if(this.coach){
      if(id==='coach-skip'){this.finishCoach(true);return;}
      // 只挡会改盘面/改路线的三个道具；重开会重新起引导，不存在绕过。
      const blocked=id==='hint'||id==='shuffle'||id==='undo';
      if(blocked){this.coachNote('先完成这一步。');return;}
    }
    if(id==='tip-ok'){this.dismissTip();return;}
    const open=this.modal;
    if(open!=='none'){
      if(id==='close'){this.modal=this.returnModal;this.returnModal='none';this.revision++;return;}
      if(open==='home'&&id==='continue'){
        if(this.finished||!count(this.grid)){
          // 门槛挡住 maxLevel（章末打完了但星数不够）时，退回最后一个能进的关。
          // 直接 `reset(maxLevel)` 会把玩家塞进一个锁着的章——门槛就形同虚设。
          let i=this.maxLevel;
          while(i>0&&!this.canEnter(i))i--;
          this.reset(i);
        }
        // 从首页“开始游戏/继续”进牌桌也算进入这一章：每次都给章首说明，右上角可跳过。
        const key='ctip:'+(this.def.chapter??Math.floor(this.levelIndex/CHAPTER_SIZE));this.tip=this.tipsSeen[key]?null:key;
        this.modal='none';this.save();this.revision++;return;
      }
      if(open==='home'&&['help','settings','levels'].includes(id)){this.returnModal='home';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/PAGE_SIZE);this.revision++;return;}
      if(open==='settings'&&id==='toggle-motion'){this.reducedMotion=!this.reducedMotion;this.save();this.revision++;return;}
      if(open==='settings'&&id==='toggle-vibration'){this.vibration=!this.vibration;this.save();this.revision++;return;}
      if(open==='restart'&&id==='confirm-restart'){this.reset();this.save();return;}
      if(open==='win'&&id==='next'&&this.levelIndex<LEVELS.length-1){this.reset(this.levelIndex+1);this.save();return;}
      if(open==='win'&&id==='home'){this.modal='home';this.revision++;return;}
      if(open==='win'&&id==='replay'){this.reset();this.save();return;}
      if(open==='win'&&id==='levels'){this.returnModal='win';this.modal='levels';this.revision++;return;}
      // 失败（步数用尽 / 时间到 / 死局）：重开、复活、死局救援或回首页。
      // 死局允许撤销；步数耗尽只能续局或重开。
      if(open==='lose'&&(id==='replay'||id==='restart')){this.reset();this.save();return;}
      if(open==='lose'&&id==='home'){this.modal='home';this.revision++;return;}
      if(open==='lose'&&id==='revive'){this.revive();return;}
      if(open==='lose'&&id==='rescue'){this.rescueShuffle();return;}
      if((open==='win'||open==='lose')&&id==='undo'){this.undo();return;}
      if(open==='levels'&&(id==='page-prev'||id==='page-next')){this.levelPage=Math.max(0,Math.min(Math.ceil(this.levelCount/PAGE_SIZE)-1,this.levelPage+(id==='page-next'?1:-1)));this.revision++;return;}
      if(open==='levels'&&id.startsWith('level:')){const i=Number(id.slice(6));if(Number.isInteger(i)&&this.canEnter(i)){this.reset(i,true,true);this.save();}return;}
      return;
    }
    if(this.tip)return;                       // 说明卡未关闭时不接受牌桌指令
    if(id==='hint'){this.requestHint();return;}
    if(id==='shuffle'){this.shuffle();return;}
    if(id==='undo'){this.undo();return;}
    if(['home','settings','help','restart','levels'].includes(id)){this.returnModal='none';this.modal=id as Modal;this.levelPage=Math.floor(this.levelIndex/PAGE_SIZE);this.selected=null;this.hint=[];this.lastErased=[];this.save();this.revision++;}
  }
}
