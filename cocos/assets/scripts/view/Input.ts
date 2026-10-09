import {Drag, Effect, Frame, Pos, Run, Cell, Action, ViewModel, cellAt, hitTest} from './GameView';

/** Structural view of core/Session so the view layer compiles on its own. */
export interface Game {
  grid: Cell[][]; runs: Run[]; levelIndex: number; maxLevel: number; total: number; moves: number;
  selected: Pos | null; hint: Action[]; message: string; modal: string;
  reducedMotion: boolean; vibration: boolean; lastChain: number; revision: number;
  lastErased: {a: Pos; b: Pos}[]; levelNames?: string[];
  levelCount?: number; levelName?: string; chapter?: string; difficulty?: number; par?: number;
  hintsLeft?: number; shufflesLeft?: number; canUndo?: boolean; rating?: number; stars?: Record<string, number>; levelPage?: number;
  tap(p: Pos): void; slide(run: number, step: number): boolean; command(id: string): void; notice(text: string): void;
}
export interface Haptics {tick(): void}

interface Press {x: number; y: number; button: string | null; cell: Pos | null; axis: 'row' | 'col' | null; blocked: boolean}

export const EFFECT_SECONDS = 0.42;

/** Turns pointer events on a rendered Frame into Session actions, with live drag preview. */
export class Controller {
  drag: Drag | null = null;
  effect: Effect | null = null;
  private press: Press | null = null;
  private lastStep = 0;
  constructor(readonly game: Game, private haptics: Haptics = {tick() {}}) {}

  model(): ViewModel {
    const g = this.game;
    return {
      grid: g.grid, runs: g.runs, levelIndex: g.levelIndex, maxLevel: g.maxLevel, total: g.total, moves: g.moves,
      selected: g.selected, hint: g.hint, message: g.message, modal: g.modal, reducedMotion: g.reducedMotion,
      vibration: g.vibration, lastChain: g.lastChain, drag: g.modal === 'none' ? this.drag : null, effect: this.effect,
      levelNames: g.levelNames, levelCount: g.levelCount ?? g.levelNames?.length, levelName: g.levelName, chapter: g.chapter,
      difficulty: g.difficulty, par: g.par, hintsLeft: g.hintsLeft, shufflesLeft: g.shufflesLeft,
      canUndo: g.canUndo, rating: g.rating, stars: g.stars, levelPage: g.levelPage
    };
  }

  down(f: Frame, x: number, y: number): void {
    this.drag = null; this.lastStep = 0;
    this.press = {x, y, button: hitTest(f, x, y), cell: null, axis: null, blocked: false};
    if (!this.press.button) this.press.cell = cellAt(f, x, y);
  }

  move(f: Frame, x: number, y: number): void {
    const p = this.press;
    if (!p || !p.cell || p.blocked || this.game.modal !== 'none') return;
    const dx = x - p.x, dy = y - p.y, b = f.board;
    if (!p.axis) {
      const slop = Math.max(8, Math.min(b.cellW, b.cellH) * 0.22);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
      p.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
      const run = this.runAt(p.cell, p.axis);
      if (run < 0) {
        // Never silently switch axis: the player asked for this direction.
        p.blocked = true;
        this.game.notice(p.axis === 'row' ? '这一行被锁轨或木块卡住，推不动；试试竖着拖。' : '这一列被锁轨或木块卡住，推不动；试试横着拖。');
        return;
      }
      this.drag = {run, offset: 0};
    }
    if (!this.drag) return;
    const len = this.game.runs[this.drag.run].cells.length;
    const raw = p.axis === 'row' ? dx / b.cellW : dy / b.cellH;
    this.drag = {run: this.drag.run, offset: Math.max(-len, Math.min(len, raw))};
    const step = Math.round(this.drag.offset);
    if (step !== this.lastStep) { this.lastStep = step; if (this.game.vibration) this.haptics.tick(); }
  }

  up(f: Frame, x: number, y: number): void {
    this.move(f, x, y);
    const p = this.press, drag = this.drag;
    this.press = null; this.drag = null; this.lastStep = 0;
    if (!p) return;
    const before = this.game.revision;
    if (p.button) { if (hitTest(f, x, y) === p.button) this.game.command(p.button); }
    else if (drag) {
      const len = this.game.runs[drag.run].cells.length, k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) this.game.slide(drag.run, k > len / 2 ? k - len : k);
    } else if (p.cell && !p.blocked && !p.axis) {
      const end = cellAt(f, x, y);
      if (end?.r === p.cell.r && end.c === p.cell.c) this.game.tap(p.cell);
    }
    if (this.game.revision !== before) this.afterAction();
  }

  cancel(): void { this.press = null; this.drag = null; this.lastStep = 0; }

  /** Advance animations; returns true while a redraw is needed. */
  update(dt: number): boolean {
    if (!this.effect) return false;
    const progress = this.effect.progress + Math.max(0, Number.isFinite(dt) ? dt : 0) / EFFECT_SECONDS;
    this.effect = progress >= 1 ? null : {cells: this.effect.cells, progress};
    return true;
  }

  private afterAction(): void {
    const cells = this.game.lastErased.flatMap(e => [e.a, e.b]);
    this.effect = cells.length ? {cells, progress: 0} : null;
  }

  private runAt(cell: Pos, axis: 'row' | 'col'): number {
    return this.game.runs.findIndex(r => r.axis === axis && r.cells.some(q => q.r === cell.r && q.c === cell.c));
  }
}
