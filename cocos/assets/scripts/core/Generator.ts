import {Action,Dialect,Grid,Pos,Run,count,iceLayers,isWild,liveCount,pairs,pairable,runsFor,rotate,sameFacePairs,slidable,stripIce,suitOf,top,transition,unwild} from './Rules';
import {LevelDef,LEVELS,levelAt} from './levels';

export {LEVELS,levelAt};
export type {LevelDef};

/** 基础牌池：9 筒 + 9 条 + 9 万 + 7 字（34 种）。 */
export const BASE_FACES:string[]=[];
for(let i=1;i<=9;i++)for(const suit of ['p','s','m'])BASE_FACES.push(i+suit);
for(let i=1;i<=7;i++)BASE_FACES.push('z'+i);
/** 花牌：春夏秋冬 / 梅兰竹菊（8 种），只在 def.flowers 的关卡入池；def.wild 时带 `*` 后缀当百搭。 */
export const FLOWER_FACES:string[]=[];
for(let i=1;i<=8;i++)FLOWER_FACES.push('f'+i);
/** 鞭炮牌（不在随机池里，只由 def.bombs 注入）。 */
export const BOMB_FACE='b1';
/** 全牌池（含花牌与鞭炮，供图集烘焙与存档校验用）。 */
export const FACES:string[]=BASE_FACES.concat(FLOWER_FACES).concat([BOMB_FACE]);
/** 存档校验用：接受冰面（`~` 可叠多层）、百搭（`*`）与鞭炮。 */
export const isFace=(f:string):boolean=>{
  let base=f;
  while(base.endsWith('~'))base=base.slice(0,-1);
  if(base.endsWith('*'))base=base.slice(0,-1);
  return FACES.includes(base);
};
/**
 * 当前生效的锁轨：永久锁（lockR/lockC）+ 尚未解锁的连锁锁（unlock）。
 * 连锁锁的解锁条件是「累计消掉 after 对」，所以每次消除后都要重算 runs。
 */
export function activeLocks(def:LevelDef,cleared:number):{lockR:number[];lockC:number[]}{
  const lockR=def.lockR.slice(),lockC=def.lockC.slice();
  for(const u of def.unlock||[]){
    if(u.after>cleared)(u.axis==='row'?lockR:lockC).push(u.index);
  }
  return {lockR,lockC};
}
/**
 * 这一关的目标**实际给得出多少**。
 *
 * 每种牌整局最多 4 张 = 2 对，而关卡表里的 `goal.count` 写着 3~12（author 工具当年
 * 统计口径错了：见 tools/author-levels.cjs 的说明），于是 15 个目标关的目标一个都够不着，
 * 「不必清空也能过」的设计等于没生效。这里按盘面实际可完成量收敛。
 */
export function goalPairs(def:LevelDef,grid:Grid):number{
  const g=def.goal;if(!g)return 0;
  let avail=0;
  if(g.kind==='face'){
    const base=unwild(g.face!);
    grid.flat().forEach(cell=>{if(Array.isArray(cell))cell.forEach(f=>{if(unwild(stripIce(f))===base)avail++;});});
    avail=Math.floor(avail/2);
  }else if(g.kind==='collect'){
    // 集组：目标是「这一组里有几种能凑成一对」。每种最多 4 张 = 2 对，但集组要的是
    // 这一种出现过，所以 ≥2 张算一种；不足 2 张的（被百搭收走、或开局就单张）够不着，不能算进分母。
    const tally=new Map<string,number>();
    grid.flat().forEach(cell=>{if(Array.isArray(cell))cell.forEach(f=>{
      const b=unwild(stripIce(f));
      if(g.faces&&g.faces.includes(b))tally.set(b,(tally.get(b)||0)+1);
    });});
    // Array.from 而不是 [...tally.values()]：构建器会把后者转译成 [].concat(迭代器)，
    // 在产物里得到一个装着迭代器对象的数组——transpile.test 专门守这条。
    return Array.from(tally.values()).filter(n=>n>=2).length;
  }else{
    // 碎冰目标：剩余冰层总数（厚冰算两层）
    grid.flat().forEach(cell=>{if(Array.isArray(cell))cell.forEach(f=>{avail+=iceLayers(f);});});
  }
  return Math.max(0,Math.min(g.count,avail));
}

export function rng(seed:number):()=>number{return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffled<T>(items:T[],random:()=>number):T[]{const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function empty(def:LevelDef):Grid{return def.map.map(row=>row.split('').map(c=>c==='.'?null:c==='#'?'#':[]));}
/** Capacity matching places every pair on opposite checkerboard colours. */
function locations(def:LevelDef,random:()=>number):{a:Pos;b:Pos}[]{
  const left:Pos[]=[],right:Pos[]=[];
  def.map.forEach((row,r)=>row.split('').forEach((v,c)=>{for(let d=0;d<(Number(v)||0);d++)((r+c)%2?right:left).push({r,c});}));
  const L=shuffled(left,random),R=shuffled(right,random);
  const edges=L.map(a=>shuffled(R.map((b,i)=>({b,i})).filter(({b})=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1).map(v=>v.i),random));
  const owner=new Array(R.length).fill(-1);
  const visit=(li:number,seen:Set<number>):boolean=>{
    for(const ri of edges[li]){if(seen.has(ri))continue;seen.add(ri);if(owner[ri]<0||visit(owner[ri],seen)){owner[ri]=li;return true;}}return false;
  };
  for(let i=0;i<L.length;i++)visit(i,new Set());
  return shuffled(owner.flatMap((li,ri)=>li<0?[]:[{a:L[li],b:R[ri]}]),random);
}
export interface Deal {grid:Grid;runs:Run[];solution:Action[];seed:number;fallback:boolean}
/**
 * 一对牌的牌面。同面写成 `'5p'`；异面混合对（洗牌时落单牌由百搭吸收才会出现）写成 `['5p','f1*']`。
 * 混合对只允许**其中一侧是百搭**，否则 `partners()` 不认这一对，证书会当场断掉。
 */
export type Token=string|[string,string];
const pairOf=(t:Token):[string,string]=>Array.isArray(t)?[t[0],t[1]]:[t,t];
/**
 * 证书重放：按给定路线走一遍，能清台才算这条路线成立。
 *
 * ⚠️ 路线里的滑轨动作**必须用生成时的 `runs` 重放**，不能每步按当前盘面重算：
 * 滑轨是按「当前哪些格子有牌」算出来的，牌被消掉后 runs 的结构与下标都会变，
 * 重算会让逆操作打到别的轨上，重放跑偏、留下一堆没有搭子的孤儿牌（实测：第 79 关直接生成失败）。
 * 动态解锁（unlock）只影响「初始哪些轨被标成 locked」，而路线里的滑轨都在开局状态下合法，所以用初始 runs 就够。
 */
function certify(start:Grid,runs:Run[],proposed:Action[],d?:Dialect):Action[]|null{
  let g=start;const solution:Action[]=[];
  for(const a of proposed){
    const next=transition(g,runs,a,d);
    if(next.changed){g=next.grid;solution.push(a);}
  }
  // 收尾：优先消同面对，百搭留到最后——否则百搭可能把别人的搭子吃掉、留下孤儿
  for(let pair=sameFacePairs(g,d)[0]||pairs(g,d)[0];pair;pair=sameFacePairs(g,d)[0]||pairs(g,d)[0]){
    const a:Action={kind:'match',a:pair.a,b:pair.b},next=transition(g,runs,a,d);
    if(!next.changed)break;
    g=next.grid;solution.push(a);
  }
  // 方言关的终点是"还能配的都消光了"，哑弹留在盘上；非方言关 liveCount 等于 count，行为不变。
  return liveCount(g,d)===0?solution:null;
}
/**
 * 锁轨上「相邻两格同面」= 开局白送的对子。
 *
 * 注意锁轨并不是静止的：锁行不能沿自身方向滑动，但**会被垂直方向的列轨带进带出**，
 * 所以锁轨格里的牌是打乱的结果，只能在打乱打分里罚它，不能靠调整 base 的牌面分配解决。
 */
function railConflicts(g: Grid, def: LevelDef): number {
  const locked=(p:Pos)=>def.lockR.includes(p.r)||def.lockC.includes(p.c);
  const faceAt=(p:Pos)=>top(g,p);
  let n=0;
  for(let r=0;r<g.length;r++)for(let c=0;c<g[r].length;c++){
    const p={r,c};if(!locked(p))continue;
    for(const q of [{r,c:c+1},{r:r+1,c}])if(locked(q)){
      const a=faceAt(p),b=faceAt(q);
      if(a&&a===b)n++;
    }
  }
  return n;
}
/** 越小越好：先看限步能否满足，再看锁轨冲突、白送对子，最后才是参考解长度。 */
function rankOf(def:LevelDef,grid:Grid,par:number):number[]{
  const limit=def.moveLimit||0;
  return [limit&&par>limit?1:0,railConflicts(grid,def),sameFacePairs(grid,def.dialect).length,par];
}
/** 逐元素字典序比较（JS 里 `[1,2]<[3,4]` 是按字符串比的，不能用 `<`）。 */
function cmp(a:number[],b:number[]):number{
  for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}
  return 0;
}
/**
 * 出关入口：偶尔会有种子摇不出可验证的清台证书（实测冰面关约 4%），
 * 这里用**确定性派生种子**重试几次，保证任何种子都能出关——否则玩家一进关就崩。
 * 派生是纯函数（seed 与尝试次数决定），所以同一关卡 + 同一种子仍然完全可复现。
 *
 * 参考解长度会随种子从 22 跳到 197，限步关若不挑种子，就会出现
 * 「照着游戏自己的提示走完，步数已经用尽」的必败开局（实测约 5% 的开局）。
 * 所以这里跨种子按 rank 取最优，但**只要某一个种子的解能进步数上限就立刻出关**
 * （与旧行为一致，不会拖慢启动）。
 */
export function construct(def:LevelDef,seed:number,tokens?:Token[]):Deal|null{
  let best:Deal|null=null,bestRank:number[]|null=null;
  for(let attempt=0;attempt<6;attempt++){
    const s=attempt===0?seed:((seed^Math.imul(attempt,0x9e3779b9))>>>0);
    const deal=constructOnce(def,s,tokens);
    if(!deal)continue;
    const r=rankOf(def,deal.grid,deal.solution.length);
    if(!bestRank||cmp(r,bestRank)<0){best=deal;bestRank=r;}
    if(!r[0])return deal;
  }
  return best;
}

function constructOnce(def:LevelDef,seed:number,tokens?:Token[]):Deal|null{
  const random=rng(seed),places=locations(def,random);
  const d=def.dialect;
  // 花牌只在 def.flowers 的关卡入池（否则第 1 关就可能摸到「春/梅」，与教学节奏打架）
  // 鞭炮只由 def.bombs 注入，绝不能留在随机池里（否则数量翻倍、难度失控）
  const source=def.flowers?FACES:BASE_FACES;
  const goalBase=def.goal&&def.goal.kind==='face'?unwild(def.goal.face!):null;
  const kinds=source.filter(f=>f!==BOMB_FACE);
  // 方言关把牌池一分为二：**有效面**（能配对，必须消光）与**哑弹面**（永远配不上，只当滑块）。
  // 放置逻辑完全不动——哑弹照样成对放，所以二分图匹配和证书路线都不用改。
  const liveKinds=kinds.filter(f=>pairable(f,d));
  const dudKinds=kinds.filter(f=>!pairable(f,d));
  const pool=shuffled(liveKinds,random).slice(0,Math.max(1,def.faces));
  // 目标关：目标牌面**一定**要上盘。老写法是从牌池随机切 def.faces 种，
  // 于是 15 个目标关经常整局摸不到目标牌（实测 20 个种子里只在 3~12 次里出现）。
  if(!tokens&&goalBase&&source.includes(goalBase)&&!pool.includes(goalBase))pool[pool.length-1]=goalBase;
  const doubled=pool.concat(pool);
  // 开局路径全程是「同面字符串」，只有洗牌路径才会带异面混合对，所以牌面后缀在这里处理干净
  let faces:Token[];
  if(tokens)faces=shuffled(tokens,random);
  else{
    let liveList:string[]=goalBase&&source.includes(goalBase)
      ?[goalBase,goalBase].concat(shuffled(doubled.filter(f=>f!==goalBase),random))
      :shuffled(doubled,random);
    // 哑弹最多占四成（设计线是"哑弹比例 ≤55%"，这里给证书留出更宽松的余量）。
    // 每种哑弹最多两对 = 4 张，守住的还是「每面 ≤4 张」那条存档不变量。
    const dudPairs=d&&dudKinds.length?Math.min(Math.floor(places.length*0.4),dudKinds.length*2):0;
    const livePairs=places.length-dudPairs;
    if(liveList.length<livePairs)return null;      // 有效面撑不起这一盘：参数太窄，换参数
    const dudList=shuffled(dudKinds.concat(dudKinds),random);
    // 先保证目标对在切片里（截断之前把 goal 顶到最前），再整体洗序
    const combined=liveList.slice(0,livePairs).concat(dudList.slice(0,dudPairs));
    // 只有真掺了哑弹才整体洗序（否则哑全会挤在末尾连成一片）。没有哑弹时保持原顺序——
    // 这不是洁癖：无条件洗序会改变每一关的发牌，让已经钉死的 120 关集体换盘。
    faces=dudPairs?shuffled(combined,random):combined;
  }
  // 百搭：花牌加 `*` 后缀（redeal 的 tokens 已自带，不重复加）
  if(!tokens&&def.wild)faces=faces.map(f=>typeof f==='string'&&f[0]==='f'&&!f.endsWith('*')&&!f.endsWith('~')?f+'*':f);
  if(faces.length>places.length)return null;
  // 鞭炮：把前若干对换成鞭炮（只在随机开局注入，redeal 的 tokens 自带）。
  // 方言关不注入：鞭炮牌面是 `b1`，在白名单方言里属于哑弹，注入就成了一张"会炸但配不掉"的牌。
  const bombCount=tokens||d?0:Math.min(Math.max(0,def.bombs||0),faces.length);
  for(let i=0;i<bombCount;i++)faces[i]=BOMB_FACE;
  // 冰面：只在新开局包冰。厚冰（两层 `~~`）优先落在 ice2 对里；花牌与鞭炮不包冰。
  // 哑弹也不包冰——冰意味着"要消两次"，而哑弹永远消不掉，包冰只会造出看不懂的死格。
  const iceCount=tokens?0:Math.min(Math.max(0,def.ice||0),faces.length);
  if(iceCount>0){
    const ice2=Math.min(Math.max(0,def.ice2||0),iceCount);
    const order=shuffled(faces.map((_,i)=>i).filter(i=>{const f=faces[i];return typeof f==='string'&&!f.startsWith('b')&&f[0]!=='f'&&pairable(f,d);}),random);
    order.slice(0,iceCount).forEach((i,k)=>{const f=faces[i] as string;if(!f.endsWith('~'))faces[i]=f+'~'.repeat(k<ice2?2:1);});
  }
  const used=places.slice(0,faces.length);
  const base=empty(def);
  used.forEach((p,i)=>{const[fa,fb]=pairOf(faces[i]);(base[p.a.r][p.a.c] as string[]).push(fa);(base[p.b.r][p.b.c] as string[]).push(fb);});
  const startLocks=activeLocks(def,0);
  const runs=runsFor(base,startLocks.lockR,startLocks.lockC,def.oneWay);
  // 打乱只从「此刻推得动」的轨里抽：锁轨现在也占数组下标，抽中它只是白跑一次证书
  const free=slidable(runs);
  // 逆推证书：冰面对要消两次（碎冰 + 收牌），其余一对一次。
  // 哑弹**不进路线**——它本来就配不动，写进路线只会让 `certify` 在那一步拿到 changed:false、
  // 于是证书缺步、`liveCount` 归零的判据也被一起作废。
  const removals:Action[]=[];
  for(let i=used.length-1;i>=0;i--){
    const p=used[i];
    if(!pairable(pairOf(faces[i])[0],d))continue;
    removals.push({kind:'match',a:p.a,b:p.b});
    if(pairOf(faces[i])[0].endsWith('~'))removals.push({kind:'match',a:p.a,b:p.b});
  }
  // 质量线：开局直接对子不超过牌位的 1/6；锁轨上的相邻同面单独罚（那些对子没法靠滑动拆开）。
  // 目标按字典序：先保限步能满足，再做到锁轨 0 冲突，然后压直接对子数。
  const ideal=Math.max(1,Math.floor(faces.length/12));
  // 预算按"还能消的牌"算：哑弹不可能被白送消掉，算进去会稀释质量线（方言关会显得异常干净）。
  const quality=Math.max(1,Math.floor(liveCount(base,d)/6));
  let best:Deal|null=null,bestRank:number[]|null=null;
  const scrambleRounds=(rounds:number,stopPairs:number,steps:number)=>{
    for(let attempt=0;attempt<rounds;attempt++){
      let g=base;const inverse:Action[]=[];
      for(let j=0;j<steps&&free.length;j++){
        const ri=free[Math.floor(random()*free.length)],step=random()<0.5?-1:1;
        g=rotate(g,runs[ri],step);inverse.unshift({kind:'slide',run:ri,step:-step});
      }
      const solution=certify(g,runs,inverse.concat(removals),def.dialect);
      if(!solution)continue;
      const r=rankOf(def,g,solution.length);
      if(!bestRank||cmp(r,bestRank)<0){best={grid:g,runs,solution,seed,fallback:false};bestRank=r;}
      if(!r[1]&&r[2]<=stopPairs)return;
    }
  };
  scrambleRounds(32,ideal,def.scramble);
  if(bestRank&&(bestRank[1]>0||bestRank[2]>quality))scrambleRounds(64,quality,def.scramble);
  if(bestRank&&bestRank[1]>0)scrambleRounds(64,quality,def.scramble*2);
  if(bestRank&&bestRank[1]>0)scrambleRounds(64,quality,def.scramble*4);
  if(best)return best;
  const solution=certify(base,runs,removals,def.dialect);if(!solution)return null;
  let current:Deal={grid:base,runs,solution,seed,fallback:true};
  best=current;bestRank=rankOf(def,base,solution.length);
  // Grow a verified route incrementally when a full scramble breaks the certificate.
  for(let j=0;j<def.scramble*4&&free.length;j++){
    const ri=free[Math.floor(random()*free.length)],step=random()<0.5?-1:1;
    const grid=rotate(current.grid,runs[ri],step);
    const route=certify(grid,runs,[{kind:'slide',run:ri,step:-step},...current.solution],def.dialect);
    if(!route)continue;
    const r=rankOf(def,grid,route.length);
    if(r[1]<=rankOf(def,current.grid,current.solution.length)[1]&&r[2]<=rankOf(def,current.grid,current.solution.length)[2])current={grid,runs,solution:route,seed,fallback:false};
    if(cmp(r,bestRank!)<0){best={grid,runs,solution:route,seed,fallback:false};bestRank=r;}
    if(!r[1]&&r[2]<=ideal)break;
  }
  return best;
}
export function generate(index:number,seed:number):Deal{
  if(!Number.isInteger(index)||index<0||index>=LEVELS.length)throw new Error('关卡索引越界');
  const deal=construct(LEVELS[index],seed);if(!deal)throw new Error('关卡无法生成可验证的清台路线');return deal;
}
/**
 * 把盘面上的牌凑成「可重排的对子清单」：同面两两成对，落单的牌由一张百搭吸收。
 * 返回 null 表示这盘牌已经不可能被重排（落单牌多过可用的百搭）。
 *
 * 为什么不能要求「每种牌都是偶数张」：百搭一次收走两张**不同面**的牌，用过一次
 * 牌面计数必然变成奇数（实测第 60 关消一对就是 3m×3、f5*×3）。旧的奇偶校验会把
 * 这种合法的中盘状态当成脏数据——存档被丢、洗牌永久不可用。
 */
export function tokensFrom(g:Grid):Token[]|null{
  const freq=new Map<string,number>();
  g.forEach(row=>row.forEach(cell=>{if(Array.isArray(cell))for(const f of cell)freq.set(f,(freq.get(f)||0)+1);}));
  const out:Token[]=[],left:string[]=[];
  for(const [f,n]of freq){
    if(n>4)return null;
    for(let i=0;i<Math.floor(n/2);i++)out.push(f);
    if(n%2)left.push(f);
  }
  while(left.length>1){
    const iw=left.findIndex(isWild);
    if(iw<0)return null;                     // 落单的牌没有百搭能收它
    const w=left.splice(iw,1)[0];
    // 优先收掉「非百搭」的落单牌：百搭配百搭也合法，但普通牌只有这条路能成对
    const jn=left.findIndex(f=>!isWild(f));
    out.push([w,left.splice(jn>=0?jn:0,1)[0]]);
  }
  return left.length?null:out;               // 剩一张落单 = 牌数是奇数 = 非法盘面
}
/** 中盘状态是否合法（存档校验用）：总数为偶、每种牌 ≤4 张。 */
export function stateLegal(g:Grid):boolean{
  const tiles=count(g);
  if(!tiles||tiles%2)return false;
  const freq=new Map<string,number>();
  g.flat().forEach(cell=>{if(Array.isArray(cell))cell.forEach(f=>freq.set(f,(freq.get(f)||0)+1));});
  return !Array.from(freq.values()).some(n=>n>4);
}
/** Redistribution may change stack heights but never faces, count, holes or obstacles. */
export function redeal(index:number,g:Grid,seed:number):Deal|null{
  const tokens=tokensFrom(g);
  if(!tokens)return null;
  return construct(LEVELS[index],seed,tokens);
}
