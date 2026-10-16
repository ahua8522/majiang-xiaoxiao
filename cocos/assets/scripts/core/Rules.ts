export interface Pos { r: number; c: number }
export type Cell = string[] | null | '#';
export type Grid = Cell[][];
/** `dir` 只出现在单向轨上：+1 = 只能朝高索引方向推（右/下），-1 = 只能朝低索引方向推。 */
/**
 * `locked` 标出「这条轨此刻推不动」（永久锁，或还没到进度的连锁锁）。
 *
 * 锁轨**照样进数组**，这是刻意的：`Action.slide.run` 是数组下标，锁轨一旦缺席，
 * 连锁解锁触发时整个数组就会错位——生成时的证书路线、已经发给玩家的提示、
 * 手指按下时记下的拖轨下标，全都指向别的轨（实测第 75 关：解锁后 19→21 条，
 * 同一个下标从 row4 变成 row2，照着提示推就推错行）。
 * 现在数组的形状只取决于盘面，锁只体现在 flag 上，下标终生有效。
 */
export interface Run { axis: 'row' | 'col'; index: number; cells: Pos[]; dir?: 1 | -1; locked?: boolean }
export type Action = { kind: 'slide'; run: number; step: number } | { kind: 'match'; a: Pos; b: Pos };
/**
 * 一对被消掉的牌。`face` 是 a 侧牌面，`other` 是 b 侧牌面。
 *
 * 两个都要记：百搭（`f3*`）能和任何牌配对，两侧牌面**天生不同**，只记 a 侧
 * 会让同一步棋的记账取决于「玩家先点哪张」（实测：先点百搭算「收走一对」、
 * 先点冰牌算「只碎冰」，连锁解锁阈值与目标进度都会因此偏差）。
 */
export interface Pair { a: Pos; b: Pos; face: string; other: string }
export interface Change { grid: Grid; changed: boolean; erased: Pair[]; chain: number }
export interface Hint { status: 'found' | 'unknown' | 'dead' | 'solved'; actions: Action[]; visited: number }
export const key = (p: Pos): string => p.r + ',' + p.c;
export const equal = (a: Pos | null, b: Pos | null): boolean => !!a && !!b && a.r === b.r && a.c === b.c;
export const clone = (g: Grid): Grid => g.map(row => row.map(c => Array.isArray(c) ? c.slice() : c));
export const count = (g: Grid): number => g.reduce((n,row) => n + row.reduce((m,c) => m + (Array.isArray(c) ? c.length : 0), 0), 0);
export const top = (g: Grid, p: Pos): string | null => { const cell = g[p.r]?.[p.c]; return Array.isArray(cell) && cell.length ? cell[cell.length-1] : null; };
export const signature = (g: Grid): string => JSON.stringify(g);
/**
 * 盘面指纹（FNV-1a 32 位，8 位十六进制）。用来给关卡钉**内容**而不只是钉**种子**。
 *
 * 为什么光有 seed 不够：`关卡内容 = f(map, params, seed, 生成器实现)`。前三样都不变、
 * 但 Generator 的挑选逻辑被改了一行，发出来的牌就整盘换了（实测：本轮重写
 * `constructOnce` 的候选排序之后，120 关的参考解有 30 关变了，而 map 一字未改）。
 * 种子只挡得住"改公式"，指纹才挡得住"改引擎"。
 */
export const boardHash = (g: Grid): string => {
  const s = signature(g);
  let h = 0x811C9DC5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 冰面牌的牌面以 `~` 结尾：一层冰一个 `~`（`5s~~` = 厚冰，要碎两次）。 */
export const hasIce = (face: string): boolean => face.endsWith('~');
export const iceLayers = (face: string): number => { let n = 0; while (face.endsWith('~')) { face = face.slice(0, -1); n++; } return n; };
/** 剥掉一层冰（多层冰要连着消几次）。 */
export const stripIce = (face: string): string => hasIce(face) ? face.slice(0, -1) : face;
/** 百搭牌（花牌）牌面以 `*` 结尾：能与任意牌配对。 */
export const isWild = (face: string): boolean => face.endsWith('*');
export const unwild = (face: string): string => isWild(face) ? face.slice(0, -1) : face;
/** 鞭炮牌（配对时震碎四邻冰层）。 */
export const isBomb = (face: string): boolean => face.startsWith('b');
/**
 * 方言规则：**只约束「哪些牌能配对」**，不碰滑轨、不碰放置。
 *
 * 这就是它便宜的原因——生成器仍然成对放牌（哑弹也照样成对放，只是永远配不上），
 * `certify()` 的逆推路线和重放 machinery 一字不改。
 * 代价只有一条：「清台」不再是 `count===0`，而是 `liveCount===0`。
 * 这条必须在通关、判死、提示、进度、证书、失败文案六个地方同时改，
 * 漏一个就会出现"消完了但不通关"或"还能消却判死"。
 */
export interface Dialect {
  /** 数牌白名单：只有这些点数的数牌能配对（将将胡 [2,5,8]、幺九 [1,9]）。 */
  ranks?: number[];
  /** 只许一门成对（清一色）。与 `ranks` 同时给时取交集。 */
  suit?: 'p' | 's' | 'm';
  /** 该门的牌不参与滑动连消，只能点消（断门）。它仍然"能配对"，所以不算哑弹。 */
  noSlideSuit?: 'p' | 's' | 'm';
  /** 字牌（东南西北中發白）也算有效面。幺九/国士本来就把字牌算在内。 */
  honors?: boolean;
}
/** 牌面本体：剥掉冰（可多层）与百搭后缀。`z1~*` → `z1`。 */
export const bare = (f: string): string => {
  let b = f;
  while (b.endsWith('~')) b = b.slice(0, -1);
  if (b.endsWith('*')) b = b.slice(0, -1);
  return b;
};
/** 花色：数牌取末位 p/s/m，字牌 `z`、花牌 `f`、鞭炮 `b`。 */
export const suitOf = (f: string): string => {const m = /^(\d)([psm])$/.exec(bare(f));return m ? m[2] : bare(f)[0];};
/** 点数：数牌 1-9，其余 0。 */
export const rankOf = (f: string): number => {const m = /^(\d)[psm]$/.exec(bare(f));return m ? Number(m[1]) : 0;};
/** 这张牌在本关方言下**还能不能配对**。不能 = 哑弹（只能当滑块，留在盘上算通关）。 */
export function pairable(face: string, d?: Dialect): boolean {
  if (!d) return true;
  if (isWild(face)) return true;                       // 财神永远能配，不被白名单误伤
  const s = suitOf(face);
  if (s !== 'p' && s !== 's' && s !== 'm') {
    if (s === 'z' && d.honors) return true;    // 幺九带字牌：真实麻将的国士就是这么算的
    return !d.ranks && !d.suit;                 // 否则花牌/字牌/鞭炮在白名单关里都是哑弹
  }
  if (d.suit && s !== d.suit) return false;
  if (d.ranks && !d.ranks.includes(rankOf(face))) return false;
  return true;
}
/** 滑动连消的额外门槛：缺门的牌能点消、但不能被滑消顺手带走。 */
function slideOk(face: string, d?: Dialect): boolean {
  return pairable(face, d) && !(d && d.noSlideSuit && suitOf(face) === d.noSlideSuit);
}
/** 还能被消掉的牌数。**通关、判死、进度条全看这个，不看 `count`。** */
export const liveCount = (g: Grid, d?: Dialect): number =>
  g.reduce((n, row) => n + row.reduce((m, c) => m + (Array.isArray(c) ? c.filter(f => pairable(f, d)).length : 0), 0), 0);
export function partners(g: Grid, p: Pos, d?: Dialect): Pos[] {
  const face = top(g,p);
  if (!face || !pairable(face, d)) return [];            // 自己先是哑弹，就没有搭子
  const wild = isWild(face);
  return [{r:p.r-1,c:p.c},{r:p.r,c:p.c+1},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1}].filter(q => {
    const f = top(g,q);
    if (!f || !pairable(f, d)) return false;
    return wild || isWild(f) || f === face;
  });
}
/** 可消对子（含百搭）。生成器统计「白送对子」请用 sameFacePairs——百搭天然能配一切，不该算进去。 */
export function pairs(g: Grid, d?: Dialect): Pair[] {
  const out: Pair[] = [];
  g.forEach((row,r) => row.forEach((_,c) => {
    const a={r,c}, face=top(g,a); if (!face || !slideOk(face, d)) return;
    for (const b of [{r,c:c+1},{r:r+1,c}]) {
      const f = top(g,b);
      if (!f || !slideOk(f, d)) continue;
      if (f === face || isWild(face) || isWild(f)) out.push({a,b,face,other:f});
    }
  }));
  return out;
}
/** 只统计「同面」的对子（不含百搭），供生成器质量线使用。 */
export function sameFacePairs(g: Grid, d?: Dialect): Pair[] {
  return pairs(g, d).filter(pr => !isWild(pr.face) && top(g,pr.b) === pr.face);
}
export function runsFor(g: Grid, lockR: number[], lockC: number[], oneWay?: {axis:'row'|'col';index:number;dir:1|-1}[]): Run[] {
  const out: Run[]=[];
  const dirOf=(axis:'row'|'col',index:number):1|-1|undefined=>oneWay?.find(w=>w.axis===axis&&w.index===index)?.dir;
  for (const axis of ['row','col'] as const) {
    const n=axis==='row'?g.length:g[0].length, len=axis==='row'?g[0].length:g.length;
    for(let i=0;i<n;i++) {
      // 锁住的轨不能跳过（跳过会让下标随解锁状态漂移），只是打上 locked 标记；
      // 真正的拒绝在 transition 里。
      const locked=(axis==='row'?lockR:lockC).includes(i);
      let cells: Pos[]=[];
      const flush=()=>{
        if(cells.length>1){
          const run:Run={axis,index:i,cells};
          const dir=dirOf(axis,i);
          if(dir)run.dir=dir;
          if(locked)run.locked=true;
          out.push(run);
        }
        cells=[];
      };
      for(let j=0;j<len;j++) {
        const p=axis==='row'?{r:i,c:j}:{r:j,c:i};
        if(Array.isArray(g[p.r][p.c]))cells.push(p);else flush();
      }
      flush();
    }
  }
  return out;
}
/** `runs` 里当前推得动的轨道下标（锁轨排除，别把判定预算浪费在必然无效的尝试上）。 */
export const slidable = (runs: Run[]): number[] => runs.map((_, i) => i).filter(i => !runs[i].locked);
/** Raw rotation is for construction and drag preview only; gameplay always calls transition. */
export function rotate(g: Grid, run: Run, step: number): Grid {
  const out=clone(g),len=run.cells.length,k=((step%len)+len)%len;
  for(let i=0;i<len;i++) {const to=run.cells[i],from=run.cells[(i-k+len)%len];out[to.r][to.c]=Array.isArray(g[from.r][from.c])?(g[from.r][from.c] as string[]).slice():g[from.r][from.c];}
  return out;
}
/** 弹出一层：普通牌直接消掉，冰面牌只剥一层冰（多层冰要连着消几次）。 */
function popOrReveal(g: Grid, p: Pos, face: string, revealed: Set<string>): void {
  const cell = g[p.r][p.c] as string[];
  cell.pop();
  if (hasIce(face)) { cell.push(stripIce(face)); revealed.add(key(p)); }
}
/**
 * 鞭炮：震碎「与它相邻的冰牌」以及**全场同面的冰牌**。
 *
 * ⚠️ 绝不能只震碎单个格子的冰：冰牌成对存在（一对两张同面），只碎其中一张会让这一对变成
 * 「一张露脸、一张还带冰」，两张永远配不上——直接产生永久死牌，生成器的清台证书也会崩
 * （实测：第 79 关基础逆推路线失败）。按「面」整组震碎天然保持成对。
 */
function shatterAround(g: Grid, cells: Pos[], revealed: Set<string>): void {
  const faces = new Set<string>();
  for (const p of cells) for (const q of [{r:p.r-1,c:p.c},{r:p.r,c:p.c+1},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1}]) {
    const f = top(g,q);
    if (f && hasIce(f)) faces.add(f);
  }
  if (!faces.size) return;
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) {
    const f = top(g,{r,c});
    if (f && faces.has(f)) popOrReveal(g,{r,c},f,revealed);
  }
}
export function transition(g: Grid, runs: Run[], action: Action, d?: Dialect): Change {
  const none=():Change=>({grid:g,changed:false,erased:[],chain:0});
  let next: Grid, affected: Set<string>;
  if(action.kind==='match') {
    if(!partners(g,action.a,d).some(p=>equal(p,action.b)))return none();
    next=clone(g);
    const fa=top(g,action.a)!, fb=top(g,action.b)!;
    const revealed=new Set<string>();
    popOrReveal(next,action.a,fa,revealed);
    popOrReveal(next,action.b,fb,revealed);
    if(isBomb(fa)||isBomb(fb))shatterAround(next,[action.a,action.b],revealed);
    return {grid:next,changed:true,erased:[{a:action.a,b:action.b,face:fa,other:fb}],chain:1};
  }
  const run=runs[action.run];
  if(!run || run.locked || !Number.isInteger(action.step) || action.step%run.cells.length===0)return none();
  if(run.dir&&action.step*run.dir<0)return none();   // 单向轨：反向推无效
  next=rotate(g,run,action.step);
  if(signature(next)===signature(g))return none();
  affected=new Set(run.cells.map(key));
  // 本事务里刚碎冰露出的格子不再参与连消：冰牌要消两次，不能一滑顺手全收
  const revealed=new Set<string>();
  const erased: Pair[]=[];let chain=0;
  for(;;) {
    const candidates=pairs(next,d).filter(p=>!revealed.has(key(p.a))&&!revealed.has(key(p.b))
      &&(affected.has(key(p.a))||affected.has(key(p.b))));
    if(!candidates.length)break;
    const used=new Set<string>();let round=0;
    // Stable top-to-bottom, left-to-right pairing; one tile can participate once per wave.
    for(const p of candidates) {
      if(used.has(key(p.a))||used.has(key(p.b)))continue;
      const fa=top(next,p.a)!, fb=top(next,p.b)!;
      popOrReveal(next,p.a,fa,revealed);
      popOrReveal(next,p.b,fb,revealed);
      if(isBomb(fa)||isBomb(fb))shatterAround(next,[p.a,p.b],revealed);
      used.add(key(p.a));used.add(key(p.b));affected.add(key(p.a));affected.add(key(p.b));
      erased.push(p);round++;
    }
    if(!round)break;chain++;
  }
  return {grid:next,changed:true,erased,chain};
}
/**
 * 可靠的死局判定（不是近似搜索）。
 *
 * 判死条件：当前没有可消对子，且**从当前状态出发、所有可达状态都没有任何一步能减少牌数**
 * （把「无进展的滑动」全部走完，状态空间穷尽）。预算用尽时一律返回 false（不许误判死局）。
 *
 * 为什么必须自己走一遍：`searchHint` 有深度上限，撞到上限就返回 `unknown`——而 `unknown`
 * 按设计不判死。孤零零的牌可以在一条长轨里滑来滑去、永远不产生对子，会被它一路探索到预算耗尽，
 * 于是「既不判死也不判胜」卡住（实测：最后剩一叠孤牌时就是这个症状）。
 *
 * `makeRuns` 必须按**传入的盘面**重算滑轨：牌消掉后旧 runs 会指着空格，
 * 用它做判定会把「动不了」误判成「还能动」。
 *
 * 访问数与时间两个预算用尽时一律返回 false——宁可漏判死局，不许误判。
 * 时间上限是后加的：这条判定每次落子后都会跑，不能让它一帧吃掉几百毫秒。
 */
export function isDead(g: Grid, makeRuns: (grid: Grid) => Run[], budget = 2000, timeMs = 60, d?: Dialect): boolean {
  const total = liveCount(g, d);
  if (!total) return false;              // 能消的都消光了（方言关允许还剩哑弹）
  if (pairs(g, d).length) return false;     // 还有直接可消的对子
  const deadline = Date.now() + timeMs;
  const seen = new Set([signature(g)]);
  const queue: Grid[] = [g];
  let visited = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const runs = makeRuns(cur);
    for (const ri of slidable(runs)) {
      const len = runs[ri].cells.length;
      for (let k = 1; k < len; k++) {
        if (visited >= budget || Date.now() > deadline) return false;   // 预算用尽 → 不许判死
        visited++;
        let step = k > len / 2 ? k - len : k;
        const dir = runs[ri].dir;
        if (dir && step * dir < 0) step += dir * len;
        const next = transition(cur, runs, {kind: 'slide', run: ri, step}, d);
        if (!next.changed) continue;
        if (liveCount(next.grid, d) < total) return false;   // 有进展 → 不是死局
        const sig = signature(next.grid);
        if (seen.has(sig)) continue;
        seen.add(sig); queue.push(next.grid);
      }
    }
  }
  return true;
}
/** 近似搜索：找一条能把牌数减少的短路线。Exhaustion 与预算上限是两回事——撞到深度上限只能返回 unknown。 */
export function searchHint(g: Grid,runs: Run[],options: {budget?: number;maxDepth?: number}={},d?: Dialect): Hint {
  const budget=options.budget??2400,maxDepth=options.maxDepth??3;
  const total=liveCount(g,d),direct=pairs(g,d);
  if(!total)return {status:'solved',actions:[],visited:0};
  if(direct.length)return {status:'found',actions:[{kind:'match',a:direct[0].a,b:direct[0].b}],visited:0};
  const queue: {grid:Grid;path:Action[]}[]=[{grid:g,path:[]}];
  const seen=new Set([signature(g)]);let visited=0,limited=false;
  for(let qi=0;qi<queue.length;qi++) {
    const cur=queue[qi];
    if(cur.path.length>=maxDepth){limited=true;continue;}
    for(const ri of slidable(runs))for(let k=1;k<runs[ri].cells.length;k++) {
      if(visited>=budget)return {status:'unknown',actions:[],visited};
      visited++;
      let step=k>runs[ri].cells.length/2?k-runs[ri].cells.length:k;
      // 单向轨只能顺向推：绕另一圈取同方向的等价步数
      const dir=runs[ri].dir;
      if(dir&&step*dir<0)step+=dir*runs[ri].cells.length;
      const action:Action={kind:'slide',run:ri,step},next=transition(cur.grid,runs,action,d);
      if(!next.changed)continue;
      const path=cur.path.concat(action);
      if(liveCount(next.grid,d)<total)return {status:'found',actions:path,visited};
      const sig=signature(next.grid);if(seen.has(sig))continue;
      seen.add(sig);queue.push({grid:next.grid,path});
    }
  }
  return {status:limited?'unknown':'dead',actions:[],visited};
}
