/**
 * 教学状态机：一张手写小盘 + 一串带期望结果的动作，走的是**真 Rules**。
 *
 * 三件事由这个类保证：
 * ① 自动演示与玩家手指共用 `advance()` 这一条路径 → 演给他看的就是真规则，不是第二套假动画；
 * ② 只提交「与脚本 expect 一致」的动作，对不上就回弹不改盘面，所以教学状态永远就是脚本状态；
 * ③ 任何一步解析不到 / transition 抛异常就置 `failed`，视图据此退回文字卡——
 *    教学是加法，**不许变成进关的门槛**。
 *
 * 为什么不建一个 Session 来跑教学盘：`Session.reset()` 会发牌、落盘、推 `maxLevel`、定 `par`、
 * 算星级、进 `history`——教学目标一分钱都不能花掉这些。输入屏蔽与限时关停表由 `Session.tip`
 * 非空负责（tick/apply/tap/notice/command 五处已经挡着），教学只需要在结束时放掉它。
 *
 * 本文件不许 import 'cc'：node 门禁要在无引擎环境里跑它。
 */
import {Action, Grid, Pair, Pos, Run, transition} from './Rules';
import {Tutorial, TutStep, canonicalAction, parseBoard, stepOk, tutorialRuns} from './tutorials';

export interface AdvanceResult {advanced: boolean; erased: Pair[]; message: string}

export class TutorialRun {
  grid: Grid;
  runs: Run[];
  /** 当前讲到第几步 */
  index = 0;
  /** 视图按它判重要不要重绘（与 Session.revision 同义，但完全独立：教学不许动玩家的局） */
  revision = 0;
  failed = false;
  private t: Tutorial;
  private watch: boolean;

  constructor(t: Tutorial, watch = false) {
    this.t = t;
    this.watch = watch;
    this.grid = parseBoard(t.board);
    this.runs = tutorialRuns(t, this.grid);
  }

  get watchMode(): boolean { return this.watch; }
  get step(): TutStep | null { return this.index < this.t.steps.length ? this.t.steps[this.index] : null; }
  get done(): boolean { return this.index >= this.t.steps.length; }
  get title(): string { return this.t.title; }
  /** 视图取证与玩法说明的重放入口都要认章号。 */
  get chapterIndex(): number { return this.t.chapter; }
  get closing(): string { return this.t.close; }

  /**
   * 唯一的状态入口。手指拖出来的动作和自动演示的规范动作都从这里进，区别只在来源。
   * @param action 传 `null` = 这一步连意图都解析不到 → 置 failed，让调用方走降级。
   */
  advance(action: Action | null): AdvanceResult {
    const st = this.step;
    if (!st || this.done) return {advanced: false, erased: [], message: this.t.close};
    if (this.failed || !action) { this.failed = true; this.revision++; return {advanced: false, erased: [], message: ''}; }
    let out;
    try {
      out = transition(this.grid, this.runs, action, this.t.dialect);
    } catch {
      this.failed = true; this.revision++;
      return {advanced: false, erased: [], message: ''};
    }
    if (!stepOk(st, out)) {
      // 推错了不改盘面：后面每一步都是按脚本那一盘算的，偷偷提交就会整段错位
      this.revision++;
      return {advanced: false, erased: [], message: this.sayFor(action)};
    }
    this.grid = out.grid;
    this.runs = tutorialRuns(this.t, this.grid);
    this.index++;
    this.revision++;
    return {advanced: true, erased: out.erased, message: st.say};
  }

  /** 自动演示与 watch 模式用的规范动作；解析不到就返回 null，由调用方降级。 */
  canonical(): Action | null {
    const st = this.step;
    if (!st) return null;
    try { return canonicalAction(this.t, st, this.runs); } catch { this.failed = true; return null; }
  }

  /**
   * 要玩家亲手做的那一步，把目标格交给视图画高亮。
   * 视图直接喂给 `Board.build({hintCells})`——蓝框是现成的（Board.drawHighlights），不用画遮罩洞。
   */
  targetCells(): Pos[] {
    const st = this.step;
    if (!st || this.watch) return [];
    if (st.on.tap) return [st.on.tap[0], st.on.tap[1]];
    if (!st.on.slide) return [];
    const want = st.on.slide;
    const run = this.runs.find((r) => r.axis === want.axis && r.index === want.index && !r.locked);
    return run ? run.cells.slice() : [];
  }

  /**
   * 回弹时说的话：按「这一步本来要看到什么」分化，不是一句「推错了再来」。
   * 判据是效果而不是方向——三格轨 `['2p','6s','2p']` 朝两端转都能让两张二筒碰头，
   * 所以不许在这里写"请朝右推"这种话。
   */
  sayFor(action: Action): string {
    const st = this.step;
    if (!st) return '';
    if (action.kind === 'slide') {
      if (st.need !== 'slide') return '这一屏先看，不用动手。';
      const want = st.on.slide, run = this.runs[action.run];
      if (!run || !want) return '就推亮起来的那一条。';
      if (run.axis !== want.axis || run.index !== want.index) {
        return `按住亮起来的那${want.axis === 'row' ? '一行' : '一列'}再拖。`;
      }
      return st.expect.pairs > 0 ? '换个方向再推一次：牌要从另一头碰上来。' : '就是这个方向，再推一格试试。';
    }
    return st.need === 'tap' ? '点亮起的这两张牌。' : '这一屏先看，不用动手。';
  }
}
