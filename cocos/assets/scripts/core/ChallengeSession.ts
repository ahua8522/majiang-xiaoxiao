/**
 * 挑战模式的会话层：无尽盘面、整行/整列循环滑动、提示/洗牌、独立存档。
 *
 * 刻意不复用主线 Session：主线围绕滑轨分段、星级、限步/限时构建；挑战模式没有这些概念，
 * 动作也是「整线循环滑动 + 只允许有效移动」。这里只共享 Grid/Pos/Run 类型与存档适配器形状。
 */
import {Grid, Pos, Run, clone} from './Rules';
import {Axis, CPair, ChallengeDeal, Rotate, applyRotate, boardKey, generateChallenge, legalMoves, linesFor, reshuffleChallenge, sameFaceCells, solve, tileCount} from './Challenge';

export interface ChallengePlatform {load(): unknown; save(data: unknown): void; feedback(): void}
const local: ChallengePlatform = {load: () => null, save: () => {}, feedback: () => {}};

const HINTS_PER_BOARD = 3;
const SHUFFLES_PER_BOARD = 2;

interface SaveShape {
  version?: number;
  baseSeed?: number;
  draw?: number;
  cleared?: number;
  grid?: unknown;
  initialGrid?: unknown;
  solution?: unknown;
  initialSolution?: unknown;
  moves?: number;
  hintsUsed?: number;
  shufflesUsed?: number;
  won?: boolean;
  stuck?: boolean;
}

function validGrid(raw: unknown): raw is Grid {
  if (!Array.isArray(raw) || !raw.length || !Array.isArray(raw[0])) return false;
  const cols = raw[0].length;
  if (!cols) return false;
  const freq = new Map<string, number>();
  let tiles = 0;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== cols) return false;
    for (const cell of row) {
      if (cell === null) continue;
      if (!Array.isArray(cell) || cell.length !== 1 || typeof cell[0] !== 'string' || !cell[0]) return false;
      freq.set(cell[0], (freq.get(cell[0]) || 0) + 1);
      tiles++;
    }
  }
  if (tiles % 2) return false;
  for (const n of freq.values()) if (n > 4 || n % 2) return false;
  return true;
}

function validSolution(raw: unknown): raw is Rotate[] {
  if (!Array.isArray(raw)) return false;
  for (const a of raw) {
    if (!a || typeof a !== 'object') return false;
    const p = a as Rotate;
    if (p.axis !== 'row' && p.axis !== 'col') return false;
    if (!Number.isInteger(p.index) || !Number.isInteger(p.step) || p.step === 0) return false;
  }
  return true;
}

/** 证书校验：按路线滑一遍必须清台。坏档里的路线只能丢掉，不能拿来误导提示。 */
function solutionWorks(g: Grid, solution: Rotate[]): boolean {
  let board = clone(g);
  for (const a of solution) {
    const res = applyRotate(board, a);
    if (!res.changed) return false;
    board = res.grid;
  }
  return tileCount(board) === 0;
}

export class ChallengeSession {
  grid: Grid = [];
  runs: Run[] = [];
  solution: Rotate[] = [];
  initialGrid: Grid = [];
  initialSolution: Rotate[] = [];
  hint: Rotate | null = null;
  rows = 0;
  cols = 0;
  cleared = 0;
  moves = 0;
  hintsUsed = 0;
  shufflesUsed = 0;
  total = 0;
  message = '';
  won = false;
  stuck = false;
  baseSeed: number;
  /** 出盘计数器：每开一盘 +1，同一关重进也换一副牌。 */
  draw = 0;
  revision = 0;
  private platform: ChallengePlatform;

  constructor(seed = Date.now() >>> 0, platform: ChallengePlatform = local) {
    this.baseSeed = seed >>> 0;
    this.platform = platform;
    let data: SaveShape | null = null;
    try {
      const raw = platform.load();
      data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as SaveShape | null;
    } catch { data = null; }
    if (!this.restore(data)) {
      this.cleared = 0;
      this.startBoard(1);
    }
  }

  get level(): number {return this.cleared + 1;}
  get remaining(): number {return tileCount(this.grid);}
  get hintsLeft(): number {return HINTS_PER_BOARD - this.hintsUsed;}
  get shufflesLeft(): number {return SHUFFLES_PER_BOARD - this.shufflesUsed;}
  get progress(): number {return this.total ? (this.total - this.remaining) / this.total : 0;}

  /** QA/截图用：直接开第 N 盘（会覆盖当前这一盘并落盘）。 */
  startAt(level: number): void {
    this.startBoard(Math.max(1, Math.floor(level)));
    this.revision++;
  }

  describe(action: Rotate): string {
    const dir = action.axis === 'row' ? (action.step > 0 ? '右' : '左') : (action.step > 0 ? '下' : '上');
    return `把第 ${action.index + 1} ${action.axis === 'row' ? '行' : '列'}向${dir}滑 ${Math.abs(action.step)} 格`;
  }

  private seedFor(level: number): number {
    return (this.baseSeed + Math.imul(level, 0x85ebca6b) + Math.imul(this.draw + 1, 0x9e3779b9)) >>> 0;
  }

  private startBoard(level: number): void {
    const deal = generateChallenge(level, this.seedFor(level));
    this.draw++;
    this.applyDeal(deal);
    this.cleared = level - 1;
    this.moves = 0;
    this.hintsUsed = 0;
    this.shufflesUsed = 0;
    this.hint = null;
    this.won = false;
    this.stuck = false;
    this.message = `第 ${level} 盘：整行整列循环滑动；同线同牌自动消。`;
    this.save();
  }

  private applyDeal(deal: ChallengeDeal): void {
    this.grid = deal.grid;
    this.solution = deal.solution.slice();
    this.initialGrid = clone(deal.grid);
    this.initialSolution = deal.solution.slice();
    this.rows = deal.rows;
    this.cols = deal.cols;
    this.runs = linesFor(deal.rows, deal.cols);
    this.total = tileCount(deal.grid);
  }

  private restore(data: SaveShape | null): boolean {
    if (!data || data.version !== 1 || !validGrid(data.grid) || !validGrid(data.initialGrid)) return false;
    if (!Number.isInteger(data.cleared) || (data.cleared as number) < 0) return false;
    if (![data.moves, data.hintsUsed, data.shufflesUsed].every((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 100000)) return false;
    if (!Number.isInteger(data.baseSeed)) return false;
    this.baseSeed = (data.baseSeed as number) >>> 0;
    this.draw = Number.isInteger(data.draw) && (data.draw as number) >= 0 ? (data.draw as number) : 0;
    this.cleared = data.cleared as number;
    this.grid = clone(data.grid);
    this.initialGrid = clone(data.initialGrid);
    this.rows = this.grid.length;
    this.cols = this.grid[0].length;
    this.runs = linesFor(this.rows, this.cols);
    this.total = tileCount(this.initialGrid);
    this.moves = data.moves as number;
    this.hintsUsed = Math.min(HINTS_PER_BOARD, data.hintsUsed as number);
    this.shufflesUsed = Math.min(SHUFFLES_PER_BOARD, data.shufflesUsed as number);
    this.won = data.won === true;
    this.stuck = data.stuck === true;
    this.solution = validSolution(data.solution) && solutionWorks(this.grid, data.solution) ? data.solution.slice() : [];
    this.initialSolution = validSolution(data.initialSolution) && solutionWorks(this.initialGrid, data.initialSolution) ? data.initialSolution.slice() : [];
    this.hint = null;
    // 赢了的盘必须是空盘；没赢的盘不能是空盘。对不上就按新盘处理。
    if (this.won ? this.remaining !== 0 : this.remaining === 0) return false;
    this.message = this.won ? `第 ${this.cleared} 盘已经清台。` : `第 ${this.level} 盘：接着上一盘走。`;
    return true;
  }

  private save(): void {
    try {
      this.platform.save({
        version: 1, baseSeed: this.baseSeed, draw: this.draw, cleared: this.cleared,
        grid: this.grid, initialGrid: this.initialGrid,
        solution: this.solution, initialSolution: this.initialSolution,
        moves: this.moves, hintsUsed: this.hintsUsed, shufflesUsed: this.shufflesUsed,
        won: this.won, stuck: this.stuck
      });
    } catch { /* 存储失败不能挡着玩 */ }
  }

  /**
   * 提交一次整线滑动。只有真的消掉牌才生效；`erased` 交给视图播消除动画。
   * 返回 null 表示这一步无效（盘面没变）。
   */
  rotate(axis: Axis, index: number, step: number): {erased: CPair[]; chain: number} | null {
    this.hint = null;
    if (this.won || this.stuck) return null;
    const out = applyRotate(this.grid, {axis, index, step});
    if (!out.changed) {
      this.message = '这一滑消不掉牌：挑战模式只允许能凑成一对的滑动。';
      this.revision++;
      return null;
    }
    const planned = this.solution.length ? applyRotate(this.grid, this.solution[0]) : null;
    if (planned?.changed && boardKey(planned.grid) === boardKey(out.grid)) this.solution.shift();
    else this.solution = [];
    this.grid = out.grid;
    this.moves++;
    this.message = out.chain > 1 ? `连消 ${out.chain} 层，带走 ${out.erased.length} 对。`
      : out.erased.length > 1 ? `一滑收掉 ${out.erased.length} 对。` : '碰个对！';
    if (this.remaining === 0) {
      this.won = true;
      this.cleared++;
      this.solution = [];
      this.message = `第 ${this.cleared} 盘清台。`;
    } else if (legalMoves(this.grid, 1).length === 0) {
      this.rescue();
    }
    this.save();
    this.revision++;
    return {erased: out.erased, chain: out.chain};
  }

  /** 走死时的免费救援：重排剩余牌，不扣洗牌次数。 */
  private rescue(): void {
    const deal = reshuffleChallenge(this.grid, (this.baseSeed + this.revision * 7919) >>> 0);
    if (!deal) {
      this.stuck = true;
      this.message = '这盘走死了，点「重开这一盘」。';
      return;
    }
    this.grid = deal.grid;
    this.solution = deal.solution.slice();
    this.rows = deal.rows;
    this.cols = deal.cols;
    this.runs = linesFor(deal.rows, deal.cols);
    this.hint = null;
    this.message = '牌走死了，已经免费重排一次。';
  }

  requestHint(): boolean {
    if (this.won || this.stuck) return false;
    if (this.hintsLeft <= 0) {
      this.message = '本盘三次提示已用完。';
      this.revision++;
      return false;
    }
    let action: Rotate | null = null;
    if (this.solution.length && applyRotate(this.grid, this.solution[0]).changed) {
      action = this.solution[0];
    } else if (this.remaining <= 24) {
      // 只剩小半盘才值得现场搜索；大盘搜一次会把手指按下去的那一帧吃掉几百毫秒。
      const plan = solve(this.grid, {maxStates: 600, maxMs: 60});
      if (plan && plan.length) {this.solution = plan; action = plan[0];}
    }
    if (!action) {
      const moves = legalMoves(this.grid, 1);
      if (moves.length) action = moves[0].action;
    }
    if (!action) {
      this.rescue();
      this.revision++;
      return false;
    }
    this.hint = action;
    this.hintsUsed++;
    this.message = this.describe(action);
    this.save();
    this.revision++;
    return true;
  }

  shuffle(): boolean {
    if (this.won || this.stuck) return false;
    if (this.shufflesLeft <= 0) {
      this.message = '本盘两次洗牌已用完。';
      this.revision++;
      return false;
    }
    const deal = reshuffleChallenge(this.grid, (this.baseSeed + this.revision * 7919 + 17) >>> 0);
    if (!deal) {
      this.message = '这次没洗开，先自己走一步。';
      this.revision++;
      return false;
    }
    this.grid = deal.grid;
    this.solution = deal.solution.slice();
    this.rows = deal.rows;
    this.cols = deal.cols;
    this.runs = linesFor(deal.rows, deal.cols);
    this.hint = null;
    this.shufflesUsed++;
    this.message = '牌重新摆好了，牌种和张数都没变。';
    this.save();
    this.revision++;
    return true;
  }

  restart(): void {
    this.grid = clone(this.initialGrid);
    this.solution = this.initialSolution.slice();
    this.hint = null;
    this.moves = 0;
    this.hintsUsed = 0;
    this.shufflesUsed = 0;
    this.won = false;
    this.stuck = false;
    this.message = '这一盘重新开始。';
    this.save();
    this.revision++;
  }

  next(): boolean {
    if (!this.won) return false;
    this.startBoard(this.cleared + 1);
    this.revision++;
    return true;
  }

  peek(p: Pos): Pos[] {return sameFaceCells(this.grid, p);}

  /** 视图命中用：某条线在 `runs` 里的下标（先所有行、再所有列）。 */
  runIndex(axis: Axis, index: number): number {
    return axis === 'row' ? index : this.rows + index;
  }
}
