/**
 * 章首教学的**数据**：一张手写小盘 + 一串带期望结果的动作。
 *
 * 为什么教学内容不写在关卡上：`intro` 是 tools/author-levels.cjs 的 INTRO_RULES（543 行）跑批
 * 推导、810-813 行按「第一个命中该机制的关」赋值、926 行序列化进 levels.ts 的产物——手改
 * levels.ts 下次跑批就没了。而且真关卡的盘可能根本没有要教的那个东西（`wild:true` 实测
 * 8 个百搭关有 4 关一张百搭都没发出来，**教一个盘上不存在的东西比不教更糟**）。
 * 教学盘手写在这里：想教的牌一定在盘上，而 224 关的数据、seed/hash、跑批、钉审全部不受影响。
 *
 * 本文件**不许 import 'cc'**：node 门禁（tests/tutorial.test.cjs）要在没有引擎的环境里
 * 跑真 Rules，这条同时也是 `npm run build:core` 能不能编过的前提。
 */
import {Action, Change, Cell, Dialect, Grid, Pos, Run, hasIce, isWild, runsFor} from './Rules';

/** 意图：推某一条轨，或点两张牌。两个字段都可省略，用哪个由 `step.need` 决定。 */
export interface TutTarget {
  /** axis+index 是「意图」，**不是** runs 数组下标（下标随盘面形状变，见 findRun 的注释） */
  slide?: {axis: 'row' | 'col'; index: number};
  tap?: [Pos, Pos];
}

export interface TutStep {
  /** 这一屏说给玩家的一句话 */
  say: string;
  /** 缺省 = 自动演示；给了 = 必须玩家亲手做（硬引导只认这一条意图） */
  need?: 'slide' | 'tap';
  on: TutTarget;
  /** 自动演示与门禁重放用的规范步数（+1 = 内容移向 cells 的高索引，与 rotate 一致） */
  step?: number;
  /**
   * 这一步必须看到的效果。它同时是三样东西：
   * ① node 门禁的断言；② 运行时「这一步走没走对、要不要前进」的判据；③ 防呆（对不上就回弹）。
   * `pairs: 0` 是合法且有价值的：章 6 第二步教的正是「推得动，但配不成对」。
   */
  expect: {changed: boolean; pairs: number; faces?: string[]};
}

export interface Tutorial {
  chapter: number;
  title: string;
  /** 盘面字面量：一行一个字符串，格之间用空格；'.'=空洞 '#'=木桩 'a|b'=叠两层 尾 '~'=冰 '*'=百搭 */
  board: string[];
  dialect?: Dialect;
  lockR?: number[];
  lockC?: number[];
  oneWay?: {axis: 'row' | 'col'; index: number; dir: 1 | -1}[];
  steps: TutStep[];
  /** 收尾那一段：把小盘的结论搬到真关上 */
  close: string;
}

/**
 * 下标 = 数组里的位置，`chapter` 才是章号。
 * 第一阶段只放章 6（将将胡）一条：没有条目的章不弹教学，继续走现在的机制文字卡。
 */
export const CHAPTER_TUTORIALS: Tutorial[] = [
  {
    chapter: 5,
    title: '将将胡',
    // 开局 pairs()/tapPairs() 都是 0：不推就什么都消不掉，教学必须由动作开口。
    // 6 筒是哑弹（ranks 只放行 2、5、8），8 筒和 5 筒能配但此刻不相邻。
    board: ['2p 6s 2p', '8m 5m 8m'],
    dialect: {ranks: [2, 5, 8]},
    steps: [
      {
        say: '这一关只有 2、5、8 能配成对。推这一行，让两张二筒碰头。',
        need: 'slide', on: {slide: {axis: 'row', index: 0}}, step: 1,
        expect: {changed: true, pairs: 1, faces: ['2p']}
      },
      {
        say: '再推同一行一次：六筒跟着挪了位，但它不在 2、5、8 里。',
        need: 'slide', on: {slide: {axis: 'row', index: 0}}, step: 1,
        // changed:true + pairs:0 就是这一步的教学内容本身，不是失败。
        expect: {changed: true, pairs: 0}
      }
    ],
    close: '推得动的轨 ≠ 消得掉的牌。这一章只找 2、5、8；剩下消不掉的不用管，能消的清光就胡了。'
  }
];

export function tutorialKey(chapter: number): string { return 'ch' + chapter; }

export function tutorialFor(chapter: number): Tutorial | null {
  return CHAPTER_TUTORIALS.find((t) => t.chapter === chapter) || null;
}

/** 视图与 Session 只拿 tip 字符串，所以按键反查；不是 'ch' 开头（机制卡）一律 null。 */
export function tutorialByKey(key: string): Tutorial | null {
  if (!key || key.slice(0, 2) !== 'ch') return null;
  const n = Number(key.slice(2));
  return Number.isInteger(n) && n >= 0 ? tutorialFor(n) : null;
}

/**
 * 盘面字面量 → core 的 Grid。
 * 顶面是数组**最后一个**元素（与 Rules.top 一致），所以 `'3m|2p'` 表示 3m 压着 2p、露出的是 2p。
 */
export function parseBoard(rows: string[]): Grid {
  return rows.map((row) => row.trim().split(/\s+/).map((cell): Cell => {
    if (cell === '.' || cell === '') return null;
    if (cell === '#') return '#';
    return cell.split('|');
  }));
}

/** 按教学自己的锁/方向配置重算滑轨（牌消掉之后必须重算，理由同 Session.refreshRuns）。 */
export function tutorialRuns(t: Tutorial, grid: Grid): Run[] {
  return runsFor(grid, t.lockR || [], t.lockC || [], t.oneWay);
}

/**
 * 意图 → runs 下标。
 *
 * 故意**不**让脚本写 runs 数组下标：`runsFor` 的数组顺序由盘面形状决定（先行后列），
 * 小盘改一格形状，写死的下标就指到别的轨上——和第 75 关「解锁后 19→21 条、同一下标从
 * row4 变成 row2」是同一个 bug 家族。锁轨也算命中不了：推下去只会被 transition 拒掉，
 * 教学里宁可解析失败去走降级，也不要演一次"牌推歪了又弹回去"。
 */
export function findRun(t: Tutorial, on: TutTarget, runs: Run[]): number {
  if (!on.slide) return -1;
  const want = on.slide;
  return runs.findIndex((r) => r.axis === want.axis && r.index === want.index && !r.locked);
}

/** 这一步的真实结果对不对得上脚本写的期望。视图拿它决定「前进还是回弹」。 */
export function stepOk(step: TutStep, out: Change): boolean {
  if (out.changed !== step.expect.changed) return false;
  if (out.erased.length !== step.expect.pairs) return false;
  if (step.expect.faces) {
    const got: string[] = [];
    for (const p of out.erased) got.push(p.face, p.other);
    for (const want of step.expect.faces) {
      if (!got.some((f) => bareFace(f) === want)) return false;
    }
  }
  return true;
}

/** 期望里写牌面时不带冰/百搭后缀，比较时剥掉，省得脚本作者去猜 `5s~` 还是 `5s~~`。 */
function bareFace(face: string): string {
  let f = face;
  while (hasIce(f)) f = f.slice(0, -1);
  if (isWild(f)) f = f.slice(0, -1);
  return f;
}

/** 自动演示与门禁重放用的规范动作；解析不到轨就返回 null，由调用方走降级。 */
export function canonicalAction(t: Tutorial, step: TutStep, runs: Run[]): Action | null {
  if (step.on.tap) return {kind: 'match', a: step.on.tap[0], b: step.on.tap[1]};
  const ri = findRun(t, step.on, runs);
  return ri < 0 ? null : {kind: 'slide', run: ri, step: step.step ?? 1};
}
