import {Action,Grid,Pos,Run,count,runsFor,rotate,transition,top} from './Rules';
export interface Level {name:string;subtitle:string;map:string[];lockR:number[];lockC:number[];scramble:number}
export const LEVELS:Level[]=[
  {name:'初来茶馆',subtitle:'滑一滑，碰个对',map:['111111','111111','111111','111111','111111'],lockR:[],lockC:[],scramble:2},
  {name:'绕过小木桩',subtitle:'木桩把轨道分成了小段',map:['11111111','11#11#11','11111111','11111111','1#1111#1','11111111'],lockR:[],lockC:[],scramble:6},
  {name:'好牌在下面',subtitle:'整叠一起推，先消上层',map:['..1111..','11122111','11#22#11','11#22#11','11122111','..1111..'],lockR:[],lockC:[],scramble:10},
  {name:'转个弯试试',subtitle:'横向锁住了？试试竖着走',map:['111111111','112222211','1#11111#1','111222111','11#111#11','111111111'],lockR:[2],lockC:[],scramble:14},
  {name:'茶馆小掌柜',subtitle:'木桩、叠牌和锁轨一起上场',map:['.111#111.','111232111','1#11311#1','111323111','1#11311#1','111232111','.111#111.'],lockR:[1],lockC:[4],scramble:20}
];
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
    else if(a.kind==='match'&&(top(g,a.a)||top(g,a.b)))return null;
  }
  return count(g)===0?solution:null;
}
function construct(index:number,seed:number,tokens?:string[]):Deal|null{
  const level=LEVELS[index];if(!level)return null;
  const random=rng(seed),places=locations(level,random);
  const kinds=[12,16,20,24,30][index],pool=shuffled(FACES,random).slice(0,kinds);
  const faces=tokens?shuffled(tokens,random):shuffled(pool.concat(pool),random).slice(0,places.length);
  if(faces.length>places.length)return null;
  const used=places.slice(0,faces.length),base=empty(level);
  used.forEach((p,i)=>{(base[p.a.r][p.a.c] as string[]).push(faces[i]);(base[p.b.r][p.b.c] as string[]).push(faces[i]);});
  const runs=runsFor(base,level.lockR,level.lockC);
  const removals:Action[]=used.slice().reverse().map(p=>({kind:'match',a:p.a,b:p.b}));
  for(let attempt=0;attempt<12;attempt++){
    let g=base;const inverse:Action[]=[];
    for(let j=0;j<level.scramble&&runs.length;j++){
      const ri=Math.floor(random()*runs.length),step=random()<0.5?-1:1;
      g=rotate(g,runs[ri],step);inverse.unshift({kind:'slide',run:ri,step:-step});
    }
    const solution=certify(g,runs,inverse.concat(removals));
    if(solution)return {grid:g,runs,solution,seed,fallback:false};
  }
  const solution=certify(base,runs,removals);
  return solution?{grid:base,runs,solution,seed,fallback:true}:null;
}
export function generate(index:number,seed:number):Deal{
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
