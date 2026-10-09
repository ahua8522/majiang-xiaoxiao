export interface Pos { r: number; c: number }
export type Cell = string[] | null | '#';
export type Grid = Cell[][];
export interface Run { axis: 'row' | 'col'; index: number; cells: Pos[] }
export type Action = { kind: 'slide'; run: number; step: number } | { kind: 'match'; a: Pos; b: Pos };
export interface Pair { a: Pos; b: Pos; face: string }
export interface Change { grid: Grid; changed: boolean; erased: Pair[]; chain: number }
export interface Hint { status: 'found' | 'unknown' | 'dead' | 'solved'; actions: Action[]; visited: number }
export const key = (p: Pos): string => p.r + ',' + p.c;
export const equal = (a: Pos | null, b: Pos | null): boolean => !!a && !!b && a.r === b.r && a.c === b.c;
export const clone = (g: Grid): Grid => g.map(row => row.map(c => Array.isArray(c) ? c.slice() : c));
export const count = (g: Grid): number => g.reduce((n,row) => n + row.reduce((m,c) => m + (Array.isArray(c) ? c.length : 0), 0), 0);
export const top = (g: Grid, p: Pos): string | null => { const cell = g[p.r]?.[p.c]; return Array.isArray(cell) && cell.length ? cell[cell.length-1] : null; };
export const signature = (g: Grid): string => JSON.stringify(g);
export function partners(g: Grid, p: Pos): Pos[] {
  const face = top(g,p);
  return face ? [{r:p.r-1,c:p.c},{r:p.r,c:p.c+1},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1}].filter(q => top(g,q) === face) : [];
}
export function pairs(g: Grid): Pair[] {
  const out: Pair[] = [];
  g.forEach((row,r) => row.forEach((_,c) => {
    const a={r,c}, face=top(g,a); if (!face) return;
    for (const b of [{r,c:c+1},{r:r+1,c}]) if (top(g,b)===face) out.push({a,b,face});
  }));
  return out;
}
export function runsFor(g: Grid, lockR: number[], lockC: number[]): Run[] {
  const out: Run[]=[];
  for (const axis of ['row','col'] as const) {
    const n=axis==='row'?g.length:g[0].length, len=axis==='row'?g[0].length:g.length;
    for(let i=0;i<n;i++) {
      if((axis==='row'?lockR:lockC).includes(i))continue;
      let cells: Pos[]=[];
      const flush=()=>{if(cells.length>1)out.push({axis,index:i,cells});cells=[];};
      for(let j=0;j<len;j++) {
        const p=axis==='row'?{r:i,c:j}:{r:j,c:i};
        if(Array.isArray(g[p.r][p.c]))cells.push(p);else flush();
      }
      flush();
    }
  }
  return out;
}
/** Raw rotation is for construction and drag preview only; gameplay always calls transition. */
export function rotate(g: Grid, run: Run, step: number): Grid {
  const out=clone(g),len=run.cells.length,k=((step%len)+len)%len;
  for(let i=0;i<len;i++) {const to=run.cells[i],from=run.cells[(i-k+len)%len];out[to.r][to.c]=Array.isArray(g[from.r][from.c])?(g[from.r][from.c] as string[]).slice():g[from.r][from.c];}
  return out;
}
export function transition(g: Grid, runs: Run[], action: Action): Change {
  const none=():Change=>({grid:g,changed:false,erased:[],chain:0});
  let next: Grid, affected: Set<string>;
  if(action.kind==='match') {
    if(!partners(g,action.a).some(p=>equal(p,action.b)))return none();
    next=clone(g); const face=top(g,action.a)!;
    (next[action.a.r][action.a.c] as string[]).pop(); (next[action.b.r][action.b.c] as string[]).pop();
    return {grid:next,changed:true,erased:[{a:action.a,b:action.b,face}],chain:1};
  }
  const run=runs[action.run];
  if(!run || !Number.isInteger(action.step) || action.step%run.cells.length===0)return none();
  next=rotate(g,run,action.step);
  if(signature(next)===signature(g))return none();
  affected=new Set(run.cells.map(key));
  const erased: Pair[]=[];let chain=0;
  for(;;) {
    const candidates=pairs(next).filter(p=>affected.has(key(p.a))||affected.has(key(p.b)));
    if(!candidates.length)break;
    const used=new Set<string>();let round=0;
    // Stable top-to-bottom, left-to-right pairing; one tile can participate once per wave.
    for(const p of candidates) {
      if(used.has(key(p.a))||used.has(key(p.b)))continue;
      (next[p.a.r][p.a.c] as string[]).pop();(next[p.b.r][p.b.c] as string[]).pop();
      used.add(key(p.a));used.add(key(p.b));affected.add(key(p.a));affected.add(key(p.b));
      erased.push(p);round++;
    }
    if(!round)break;chain++;
  }
  return {grid:next,changed:true,erased,chain};
}
/** Exhaustion and resource limits are deliberately distinct. Never infer dead from a depth cap. */
export function searchHint(g: Grid,runs: Run[],options: {budget?: number;maxDepth?: number}={}): Hint {
  const budget=options.budget??2400,maxDepth=options.maxDepth??3;
  const total=count(g),direct=pairs(g);
  if(!total)return {status:'solved',actions:[],visited:0};
  if(direct.length)return {status:'found',actions:[{kind:'match',a:direct[0].a,b:direct[0].b}],visited:0};
  const queue: {grid:Grid;path:Action[]}[]=[{grid:g,path:[]}];
  const seen=new Set([signature(g)]);let visited=0,limited=false;
  for(let qi=0;qi<queue.length;qi++) {
    const cur=queue[qi];
    if(cur.path.length>=maxDepth){limited=true;continue;}
    for(let ri=0;ri<runs.length;ri++)for(let k=1;k<runs[ri].cells.length;k++) {
      if(visited>=budget)return {status:'unknown',actions:[],visited};
      visited++;
      const step=k>runs[ri].cells.length/2?k-runs[ri].cells.length:k;
      const action:Action={kind:'slide',run:ri,step},next=transition(cur.grid,runs,action);
      if(!next.changed)continue;
      const path=cur.path.concat(action);
      if(count(next.grid)<total)return {status:'found',actions:path,visited};
      const sig=signature(next.grid);if(seen.has(sig))continue;
      seen.add(sig);queue.push({grid:next.grid,path});
    }
  }
  return {status:limited?'unknown':'dead',actions:[],visited};
}
