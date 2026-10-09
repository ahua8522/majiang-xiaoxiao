import {Action,Grid,Pos,Run,count,pairs,runsFor,rotate,transition,top} from './Rules';
export const CHAPTERS=['茶馆初学','庭院进阶','掌柜试炼'];
export const CAMPAIGN_LEVELS=18;
const NAMES=['第一盏茶','四方小桌','舒展牌桌','绕过木桩','竹影回廊','曲径寻对','叠翠藏牌','先看下层','双层转角','八列茶席','机关茶室','分段连消','横轨封锁','纵横棋局','锁轨回廊','三层藏锋','交叉机关','掌柜终局'];
export interface Level {name:string;subtitle:string;chapter:string;map:string[];lockR:number[];lockC:number[];scramble:number;faces:number;rank:number}
export function levelAt(index:number):Level {
  const i=Number.isFinite(index)?Math.max(0,Math.min(CAMPAIGN_LEVELS-1,Math.floor(index))):0,stage=Math.floor(i/3),part=i%3;
  const rows=stage===0?(part===0?3:4):stage===1?(part===2?6:5):stage<4?6:7;
  const cols=stage===0?(part===2?6:4):stage<3?6:8;
  const map=Array.from({length:rows},()=>Array.from({length:cols},()=> '1'));
  if(stage>=1){map[1][0]=map[1][1]='#';if(part===2||stage>=3)map[rows-2][cols-2]=map[rows-2][cols-1]='#';}
  if(stage>=2)for(let r=2;r<rows-1;r++)for(let c=2;c<cols-2;c++)map[r][c]='2';
  if(stage>=3){map[0][0]=map[0][1]='.';map[rows-1][cols-2]=map[rows-1][cols-1]='.';}
  if(stage>=5)for(let c=2;c<cols-2;c++)map[3][c]='3';
  if(stage>=2&&part>=1){map[0][2]=map[0][3]='2';if(part===2)map[rows-1][2]=map[rows-1][3]='2';}
  const tips=['同牌相邻才能消；横拖一行，竖拖一列','木桩截断轨道，利用另一方向绕行','只消顶层；整叠推走，留意下面的牌','空洞与木桩分段，规划每一段循环','金色锁轨禁止滑动，交叉方向仍可通行','多层、锁轨与障碍组合；争取无辅助三星'];
  return {name:NAMES[i],chapter:CHAPTERS[Math.floor(i/6)],subtitle:tips[stage],map:map.map(row=>row.join('')),
    lockR:stage>=4?[2,...(part===2?[4]:[])]:[],lockC:stage>=5?[3,...(part===2?[5]:[])]:[],
    scramble:2+stage*7+part*4,faces:Math.min(34,6+stage*5+part*2),rank:stage+1};
}
export const LEVELS:Level[]=Array.from({length:CAMPAIGN_LEVELS},(_,i)=>levelAt(i));
export const FACES:string[]=[];
for(let i=1;i<=9;i++)for(const suit of ['p','s','m'])FACES.push(i+suit);
for(let i=1;i<=7;i++)FACES.push('z'+i);
export function rng(seed:number):()=>number{return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffled<T>(items:T[],random:()=>number):T[]{const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function empty(level:Level):Grid{return level.map.map(row=>[...row].map(c=>c==='.'?null:c==='#'?'#':[]));}
/** Capacity matching places every pair on opposite checkerboard colours. */
function locations(level:Level,random:()=>number):{a:Pos;b:Pos}[]{
  const left:Pos[]=[],right:Pos[]=[];
  level.map.forEach((row,r)=>[...row].forEach((v,c)=>{for(let d=0;d<(Number(v)||0);d++)((r+c)%2?right:left).push({r,c});}));
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
function certify(start:Grid,runs:Run[],proposed:Action[]):Action[]|null{
  let g=start;const solution:Action[]=[];
  for(const a of proposed){
    const next=transition(g,runs,a);
    if(next.changed){g=next.grid;solution.push(a);}
  }
  for(let pair=pairs(g)[0];pair;pair=pairs(g)[0]){
    const a:Action={kind:'match',a:pair.a,b:pair.b},next=transition(g,runs,a);
    g=next.grid;solution.push(a);
  }
  return count(g)===0?solution:null;
}
function construct(index:number,seed:number,tokens?:string[]):Deal|null{
  const level=levelAt(index);
  const random=rng(seed),places=locations(level,random);
  const pool=shuffled(FACES,random).slice(0,level.faces);
  const faces=tokens?shuffled(tokens,random):shuffled(pool.concat(pool),random).slice(0,places.length);
  if(faces.length>places.length)return null;
  const used=places.slice(0,faces.length),base=empty(level);
  used.forEach((p,i)=>{(base[p.a.r][p.a.c] as string[]).push(faces[i]);(base[p.b.r][p.b.c] as string[]).push(faces[i]);});
  const runs=runsFor(base,level.lockR,level.lockC);
  const removals:Action[]=used.slice().reverse().map(p=>({kind:'match',a:p.a,b:p.b}));
  let best:Deal|null=null,bestScore=Infinity;
  for(let attempt=0;attempt<32;attempt++){
    let g=base;const inverse:Action[]=[];
    for(let j=0;j<level.scramble&&runs.length;j++){
      const ri=Math.floor(random()*runs.length),step=random()<0.5?-1:1;
      g=rotate(g,runs[ri],step);inverse.unshift({kind:'slide',run:ri,step:-step});
    }
    const solution=certify(g,runs,inverse.concat(removals));
    if(solution){
      const score=pairs(g).length;
      if(score<bestScore){best={grid:g,runs,solution,seed,fallback:false};bestScore=score;}
      if(score<=Math.max(1,Math.floor(faces.length/12)))break;
    }
  }
  if(best)return best;
  const solution=certify(base,runs,removals);
  return solution?{grid:base,runs,solution,seed,fallback:true}:null;
}
export function generate(index:number,seed:number):Deal{
  if(!Number.isInteger(index)||index<0||index>=CAMPAIGN_LEVELS)throw new Error('关卡索引越界');
  const deal=construct(index,seed);if(!deal)throw new Error('关卡无法生成可验证的清台路线');return deal;
}
/** Redistribution may change stack heights but never faces, count, holes or obstacles. */
export function redeal(index:number,g:Grid,seed:number):Deal|null{
  const freq=new Map<string,number>();
  g.forEach(row=>row.forEach(cell=>{if(Array.isArray(cell))for(const f of cell)freq.set(f,(freq.get(f)||0)+1);}));
  const tokens:string[]=[];
  for(const [f,n]of freq){if(n%2!==0||n>4)return null;for(let i=0;i<n/2;i++)tokens.push(f);}
  return construct(index,seed,tokens);
}
