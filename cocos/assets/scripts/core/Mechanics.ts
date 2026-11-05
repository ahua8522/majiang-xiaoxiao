import {Action, Change, Grid, Pos, bare, count, hasIce, key, runsFor, signature, slidable, tapPairs, transition} from './Rules';
import type {LevelDef} from './levels';

export interface MechanicState {marks:number[];collected:Record<string,number>;charge:number}
export const freshMechanics=(def:LevelDef):MechanicState=>({marks:(def.floors||[]).map(()=>0),collected:{},charge:0});
export const copyMechanics=(s:MechanicState):MechanicState=>({marks:s.marks.slice(),collected:{...s.collected},charge:s.charge});
export const floorDone=(def:LevelDef,s:MechanicState):number=>(def.floors||[]).filter((f,i)=>(s.marks[i]||0)>=f.need).length;
export function advanceMechanics(def:LevelDef,state:MechanicState,out:Change):MechanicState {
  const s=copyMechanics(state),removed:Pos[]=[];
  for(const pair of out.erased){
    // A mixed iced/uniced pair strips ice but retains BOTH tiles.
    if(hasIce(pair.face)||hasIce(pair.other))continue;
    for(const [p,f] of [[pair.a,pair.face],[pair.b,pair.other]] as [Pos,string][]){
      removed.push(p);const b=bare(f);s.collected[b]=(s.collected[b]||0)+1;
    }
  }
  if(def.energy)s.charge=Math.min(4,s.charge+removed.length/2);
  (def.floors||[]).forEach((f,i)=>{
    // Buds require separate committed actions, not two cascade waves in one swipe.
    const hit=removed.some(p=>f.kind==='dew'?Math.abs(p.r-f.r)+Math.abs(p.c-f.c)===1:p.r===f.r&&p.c===f.c);
    if(hit)s.marks[i]=Math.min(f.need,(s.marks[i]||0)+1);
  });
  return s;
}
export function mechanicLocks(def:LevelDef,cleared:number,s:MechanicState){
  const lockR=def.lockR.slice(),lockC=def.lockC.slice();
  for(const u of def.unlock||[])if(cleared<u.after)(u.axis==='row'?lockR:lockC).push(u.index);
  for(const u of def.keyLocks||[])if((s.collected[u.face]||0)<u.count)(u.axis==='row'?lockR:lockC).push(u.index);
  return {lockR,lockC};
}
export function mechanicGoal(def:LevelDef,s:MechanicState):number{
  if(def.floors?.length)return floorDone(def,s);
  const g=def.goal;if(!g)return 0;
  if(g.kind==='collect')return (g.faces||[]).filter(f=>(s.collected[f]||0)>=2).length;
  if(g.kind==='face')return Math.floor((s.collected[bare(g.face||'')]||0)/2);
  return 0;
}
export function restoreMechanics(def:LevelDef,raw:any):MechanicState|null{
  if(!raw||!Array.isArray(raw.marks)||raw.marks.length!==(def.floors||[]).length||!raw.collected||typeof raw.collected!=='object')return null;
  if(!raw.marks.every((n:any,i:number)=>Number.isInteger(n)&&n>=0&&n<=def.floors![i].need))return null;
  if(!Number.isInteger(raw.charge)||raw.charge<0||raw.charge>4)return null;
  if(!Object.entries(raw.collected).every(([f,n])=>/^(?:[1-9][mps]|z[1-7]|f[1-8]|b1)$/.test(f)&&Number.isInteger(n)&&Number(n)>=0&&Number(n)<=(f==='b1'?8:4)))return null;
  return {marks:raw.marks.slice(),collected:{...raw.collected},charge:raw.charge};
}
/** Validate saved plans against the current board, floors and changing locks. */
export function restoreRoute(def:LevelDef,grid:Grid,state:MechanicState,cleared:number,raw:any,requireGoal=true):Action[]{
  if(!Array.isArray(raw)||raw.length>136)return [];
  let g=grid,s=state,c=cleared;const route:Action[]=[];
  for(const a of raw){
    if(!a||!['match','slide'].includes(a.kind))return [];
    if(a.kind==='match'&&![a.a,a.b].every(p=>p&&Number.isInteger(p.r)&&Number.isInteger(p.c)&&p.r>=0&&p.r<g.length&&p.c>=0&&p.c<g[0].length))return [];
    if(a.kind==='slide'&&(!Number.isInteger(a.run)||a.run<0||!Number.isInteger(a.step)||Math.abs(a.step)>32))return [];
    const l=mechanicLocks(def,c,s),runs=runsFor(g,l.lockR,l.lockC,def.oneWay),out=transition(g,runs,a);
    if(!out.changed)return [];
    c+=(count(g)-count(out.grid))/2;s=advanceMechanics(def,s,out);g=out.grid;route.push(a.kind==='match'?{kind:'match',a:{...a.a},b:{...a.b}}:{kind:'slide',run:a.run,step:a.step});
  }
  const done=def.goal?mechanicGoal(def,s)>=def.goal.count:count(g)===0;
  return !requireGoal||done?route:[];
}
/** Goal-aware bounded search: only return a complete, verified objective route.
 * If the budget expires, no hint is charged; undo/restart remains available. */
export function searchObjective(def:LevelDef,grid:Grid,state:MechanicState,cleared:number,budget=6000):Action[]{
  const deadline=Date.now()+100,need=def.floors?.length||def.goal?.count||0;
  const solved=(g:Grid,s:MechanicState)=>need?mechanicGoal(def,s)>=need:count(g)===0;
  const queue:{g:Grid;s:MechanicState;c:number;path:Action[]}[]=[{g:grid,s:state,c:cleared,path:[]}];
  const sig=(g:Grid,s:MechanicState)=>signature(g)+'|'+JSON.stringify(s);
  const seen=new Set([sig(grid,state)]);
  let visited=0;
  for(let i=0;i<queue.length&&visited<budget&&Date.now()<deadline;i++){
    const cur=queue[i];if(cur.path.length>=12)continue;
    const locks=mechanicLocks(def,cur.c,cur.s),runs=runsFor(cur.g,locks.lockR,locks.lockC,def.oneWay);
    const actions:Action[]=tapPairs(cur.g).map(p=>({kind:'match',a:p.a,b:p.b}));
    for(const ri of slidable(runs))for(let k=1;k<runs[ri].cells.length;k++){
      const n=runs[ri].cells.length,dir=runs[ri].dir;
      let step=k>n/2?k-n:k;if(dir&&dir*step<0)step+=dir*n;
      actions.push({kind:'slide',run:ri,step});
    }
    for(const a of actions){
      if(++visited>budget||Date.now()>deadline)return [];
      const out=transition(cur.g,runs,a);if(!out.changed)continue;
      const s=advanceMechanics(def,cur.s,out),path=cur.path.concat([a]);
      if(solved(out.grid,s))return path;
      if(!count(out.grid))continue;
      const id=sig(out.grid,s);if(seen.has(id))continue;seen.add(id);
      queue.push({g:out.grid,s,c:cur.c+(count(cur.g)-count(out.grid))/2,path});
    }
  }
  return [];
}
