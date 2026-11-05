/** Interactive design study. Production Session/levels and saves are not modified. */
import {Action, Grid, Pos, Run, clone, count, equal, hasIce, key, partners, runsFor, searchHint, signature, top, transition} from '../../cocos/assets/scripts/core/Rules';
import {construct} from '../../cocos/assets/scripts/core/Generator';
import type {LevelDef} from '../../cocos/assets/scripts/core/levels';

export type Mode = 'classic' | 'ice' | 'garden' | 'orders' | 'energy';
export const MODES: {id: Mode; title: string; eyebrow: string; rule: string; isNew: boolean}[] = [
  {id: 'classic', title: '清风入席', eyebrow: '第一站 · 同牌碰头', rule: '点相邻同牌；拖动整行或整列。', isNew: false},
  {id: 'ice', title: '冰晶花园', eyebrow: '经典机关 · 破冰', rule: '同层冰牌先破冰，再配对收走。', isNew: false},
  {id: 'garden', title: '花圃初开', eyebrow: '新机制 · 开花', rule: '在花圃上消牌，点亮四朵花。', isNew: true},
  {id: 'orders', title: '心愿收集', eyebrow: '新组合 · 双份目标', rule: '收齐目标牌，其他牌也能消。', isNew: true},
  {id: 'energy', title: '灵感连消', eyebrow: '新机制 · 灵感充能', rule: '消四对，攒一次免费提示。', isNew: true}
];

interface Snapshot {grid: Grid; solution: Action[]; moves: number; charge: number; streak: number; bestStreak: number; blooms: string[]; collected: Record<string, number>}

export class DesignSession {
  mode: Mode;
  grid: Grid;
  solution: Action[];
  initial: Grid;
  initialSolution: Action[];
  selected: Pos | null = null;
  hint: Action | null = null;
  moves = 0;
  charge = 0;
  streak = 0;
  bestStreak = 0;
  blooms = new Set<string>();
  flowerCells = new Set<string>();
  collected: Record<string, number> = {};
  orderFaces: string[] = [];
  history: Snapshot[] = [];
  message: string;
  budget: number;
  par: number;

  constructor(mode: Mode = 'classic') {
    this.mode = mode;
    const d: LevelDef = {map: mode === 'classic' ? ['1111', '1111', '1111', '1111'] : ['11111', '11111', '11111', '11111', '11111', '11111'], lockR: [], lockC: [], faces: mode === 'classic' ? 4 : 8, scramble: 8, seed: 16, hash: '', ...(mode === 'ice' ? {ice: 2} : {})};
    const deal = construct(d, 16);
    if (!deal) throw new Error('Design board could not be certified');
    this.grid = clone(deal.grid); this.initial = clone(deal.grid);
    this.solution = deal.solution.slice(); this.initialSolution = deal.solution.slice();
    this.par = deal.solution.length;
    this.budget = this.par + 10;
    this.message = MODES.find(m => m.id === mode)!.rule;
    // Choose flower floors from actual certificate removals: the displayed objective is attainable.
    let g = clone(this.grid);
    const firstRemoval = new Map<string, number>();
    let turn = 0;
    for (const a of this.solution) {
      const out = transition(g, runsFor(g, [], []), a);
      for (const p of out.erased) {
        if(hasIce(p.face)||hasIce(p.other))continue;
        for (const [pos, face] of [[p.a, p.face], [p.b, p.other]] as [Pos, string][]) {
          if (!hasIce(face) && !firstRemoval.has(key(pos))) firstRemoval.set(key(pos), turn);
          const base = face.replace(/[~*]+$/, '');
          if (!this.orderFaces.includes(base) && this.orderFaces.length < 2) this.orderFaces.push(base);
        }
      }
      g = out.grid;
      turn++;
    }
    // Spread objectives across the route. Four marks from the first cascade would finish in one move.
    const floors = [...firstRemoval.entries()].sort((a,b) => a[1]-b[1]);
    for (const fraction of [0, .34, .67, 1]) this.flowerCells.add(floors[Math.round((floors.length - 1) * fraction)][0]);
  }
  get runs(): Run[] {return runsFor(this.grid, [], []);}
  get left(): number {return count(this.grid);}
  get won(): boolean {
    if (this.mode === 'garden') return this.flowerCells.size > 0 && this.blooms.size === this.flowerCells.size;
    if (this.mode === 'orders') return this.orderFaces.every(f => (this.collected[f] || 0) >= 2);
    return this.left === 0;
  }
  get lost(): boolean {return !this.won && this.moves >= this.budget;}
  get stars(): number {return this.moves <= this.par + 2 ? 3 : this.moves <= this.par + 5 ? 2 : 1;}
  get progress(): number {
    if (this.mode === 'garden') return this.blooms.size / this.flowerCells.size;
    if (this.mode === 'orders') return this.orderFaces.reduce((n,f) => n + Math.min(2,this.collected[f] || 0),0) / 4;
    return 1 - this.left / count(this.initial);
  }
  apply(action: Action): boolean {
    if (this.won || this.lost) return false;
    const out = transition(this.grid, this.runs, action); // No dialect: identical adjacent faces always pair.
    if (!out.changed) {this.message = '把同牌推到相邻位置。'; return false;}
    this.history.push({grid: clone(this.grid), solution: this.solution.slice(), moves: this.moves, charge: this.charge, streak: this.streak, bestStreak: this.bestStreak, blooms: [...this.blooms], collected: {...this.collected}});
    const expected = this.solution.length ? transition(this.grid, this.runs, this.solution[0]) : null;
    this.solution = expected?.changed && signature(expected.grid) === signature(out.grid) ? this.solution.slice(1) : [];
    let removed = 0;
    for (const p of out.erased) for (const [pos, face] of [[p.a, p.face], [p.b, p.other]] as [Pos, string][]) {
      if (hasIce(p.face)||hasIce(p.other)) continue;
      removed++;
      const base = face.replace(/[~*]+$/, '');
      this.collected[base] = (this.collected[base] || 0) + 1;
      if (this.flowerCells.has(key(pos))) this.blooms.add(key(pos));
    }
    this.charge = Math.min(4, this.charge + removed / 2);
    this.streak = removed ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.grid = out.grid; this.moves++; this.selected = null; this.hint = null;
    this.message = removed ? (out.chain > 1 ? `连消 ${out.chain} 层` : `消除 ${removed / 2} 对`) : out.erased.length ? '冰碎了，再配对收走。' : '找找新出现的对子。';
    if (this.won) this.message = '这一桌，收得漂亮！';
    return true;
  }
  tap(p: Pos): boolean {
    if (this.won || this.lost || !top(this.grid, p)) return false;
    if (this.selected && !equal(this.selected,p) && partners(this.grid, this.selected).some(q => equal(q,p))) return this.apply({kind: 'match', a: this.selected, b: p});
    this.selected = p; this.hint = null;
    this.message = partners(this.grid,p).length ? '点旁边亮起的同牌。' : '拖动行或列，让同牌碰头。';
    return false;
  }
  undo(): boolean {
    const s = this.history.pop(); if (!s) return false;
    this.grid = s.grid; this.solution = s.solution; this.moves = s.moves; this.charge = s.charge;
    this.streak = s.streak; this.bestStreak = s.bestStreak; this.blooms = new Set(s.blooms); this.collected = s.collected;
    this.selected = null; this.hint = null; this.message = '已撤销，换个走法。'; return true;
  }
  requestHint(): Action | null {
    if (this.won || this.lost) return null;
    if (!this.solution.length) {
      const result = searchHint(this.grid, this.runs, {budget: 18000, maxDepth: 24});
      if (result.status === 'found') this.solution = result.actions;
    }
    this.hint = this.solution[0] || null;
    this.message = this.hint ? (this.hint.kind === 'match' ? '点亮起来的这两张牌。' : `拖动亮起来的第 ${this.runs[this.hint.run].index + 1} ${this.runs[this.hint.run].axis === 'row' ? '行' : '列'}，向${this.runs[this.hint.run].axis === 'row' ? (this.hint.step > 0 ? '右' : '左') : (this.hint.step > 0 ? '下' : '上')} ${Math.abs(this.hint.step)} 格。`) : '这桌需要重新想一想，可以回退或重开。';
    return this.hint;
  }
  useEnergy(): boolean {
    if (this.charge < 4 || !this.requestHint()) return false;
    this.charge = 0; return true;
  }
}
