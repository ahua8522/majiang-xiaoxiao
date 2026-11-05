# 章首玩法教学（第一阶段：章 6 将将胡一屏做穿整条链）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给玩家一张手写的教学小盘，进真关之前用真实规则演一遍、并按住他的手做一次关键动作，替掉现在"读完就消失的文字卡"。

**Architecture:** 教学内容存在 `core/tutorials.ts`（纯数据，不 import `cc`），状态机在 `core/Tutorial.ts`（只调 `Rules.transition`，不建 `Session`），视图用**第二个 `Board` 实例**画在新增的 `screen='tutorial'` 上。触发沿用既有的 `Session.tip` 通道——`tip` 非空时牌桌输入、限时走表、状态落盘三件早已被挡住，教学不需要新写屏蔽。任何异常一律退回今天的文字卡。

**Tech Stack:** Cocos Creator 3.8.8 + TypeScript 5.2；测试用 `node:test` + `node:assert`，core 先用 `tsc` 编到 `.test/core/` 再 require；构建产物走 web-mobile + headless Chrome/CDP 截图验收。

**Spec:** `docs/superpowers/specs/2026-10-18-chapter-tutorial-design.md` — 本计划实现它的 §九 实施顺序第 1、2 步（架构 + 章 6），第二阶段的 13 屏数据在本计划 Task 1 的表结构上加条目即可，不需要改任何代码。

## Global Constraints

每一条都是项目级硬约束，每个任务的验收都隐含包含它们（值逐字抄自 spec 与现有代码）：

- 不改 `assets/scripts/core/levels.ts` 的任何字段，不改 `tools/author-levels.cjs`（`intro` 是它 543 行的 `INTRO_RULES` + 810-813 行推导 + 926 行序列化的产物，手改必被下次跑批冲掉）。224 关的 `map`/`seed`/`hash`/`faces`/`parMax` 一字不动。
- 不改 `core/Rules.ts`、`core/Generator.ts`、`core/Session.ts` 的既有函数签名与行为语义（Session 只允许改 `setupLevel` 的 tip 赋值与 `dismissTip`，见 Task 2）。
- 存档 `version` 保持 `3`，不新增字段；教学已看状态复用既有 `tipsSeen`（键名 `'ch5'` 这种）。
- `core/` 下的新文件**不得 import `'cc'`**，否则 `npm run build:core` 编不过、node 门禁拿不到数据。
- 不新增 npm 依赖（现有 devDeps 只有 `@cocos/creator-types`、`esbuild`、`miniprogram-ci`、`typescript`）。
- 每屏教学里 `need`（要玩家亲手做）的步骤 **≤ 2 个**，整屏目标时长 **≤ 12 秒**。
- 教学文案白话优先；牌型名一律照 `docs/关卡最终设计.md`、`docs/关卡玩法梳理.md` 与实际 `goal`/`dialect` 数据核对，不许自己编规则。`z5/z6/z7 = 中/發/白`、`f1..f8 = 春夏秋冬梅兰竹菊` 的依据是 `Session.faceName`（`core/Session.ts:121-128`）。
- 教学的任何失败路径（查不到脚本、`parseBoard` 抛、`transition` 抛、`expect` 对不上）都必须 `session.command('tip-ok')` 进真关——教学永远是加法，不许变成进关的门槛。
- `view/` 下新文件里每个 `addComponent(Sprite)` 附近必须给出 `makeNode({w, h})` 或 `setContentSize()`——`tests/view-source.test.cjs` 会扫源码，缺尺寸就是"节点建出来了但一个像素都不画"。
- 版本号本轮不动（`GameRoot.APP_VERSION = '1.2.5'`、`cocos/package.json` 的 `1.2.5`）。体验版上传需要用户另行明确授权。

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `cocos/assets/scripts/core/tutorials.ts` | 新建 | 教学的数据格式、盘面字面量解析、把"意图"解析成 `Action`、`expect` 校验。纯数据 + 纯函数 |
| `cocos/assets/scripts/core/Tutorial.ts` | 新建 | 一台状态机：持 `grid/runs/step`，只通过 `advance()` 改状态。自动演示与玩家手指共用它 |
| `cocos/tests/tutorial.test.cjs` | 新建 | 门禁：每条脚本跑真 `Rules`，断言每步 `expect` 成立；并测状态机的拒绝/前进/降级 |
| `cocos/package.json` | 改 | `build:core` 加两个新 core 文件；`test` 脚本加 `tests/tutorial.test.cjs` |
| `cocos/assets/scripts/core/Session.ts` | 改 `:193`、`:172-178` | 展示决策：章教学键优先、与机制键一起去重、第 1 关不再每次弹 |
| `cocos/assets/scripts/view/GameRoot.ts` | 改 | 新 `Screen`、`SCREEN_MODAL` 登记、第二个 `Board` 实例、`renderTutorial()`、教学手势分支、自动演示计时、降级出口 |
| `cocos/tests/session.test.cjs` | 改 | 补 tip 决策的断言（并修正"第 1 关每次弹"那条旧断言） |

`Board`、`widgets`、`Rules` 都不动。

---

### Task 1: 教学数据格式与章 6 脚本（core/tutorials.ts）

**Files:**
- Create: `cocos/assets/scripts/core/tutorials.ts`
- Modify: `cocos/package.json`（`build:core` 与 `test` 两条脚本）
- Test: `cocos/tests/tutorial.test.cjs`

**Interfaces:**
- Consumes: `core/Rules.ts` 的 `Grid`/`Cell`/`Pos`/`Run`/`Action`/`Dialect`/`Change`/`transition`/`runsFor`/`top`；`core/Generator.ts` 的 `stateLegal(g: Grid): boolean`
- Produces（Task 2/3/4/5 都靠这些名字）:
  - `interface TutTarget {slide?: {axis: 'row'|'col'; index: number}; tap?: [Pos, Pos]}`（两个字段都可选；用哪个由 `step.need` 决定。写成 union 类型会让 `st.on.slide` 这种访问编译不过）
  - `interface TutStep {say: string; need?: 'slide'|'tap'; on: TutTarget; step?: number; expect: {changed: boolean; pairs: number; faces?: string[]}}`
  - `interface Tutorial {chapter: number; title: string; board: string[]; dialect?: Dialect; lockR?: number[]; lockC?: number[]; oneWay?: {axis: 'row'|'col'; index: number; dir: 1|-1}[]; steps: TutStep[]; close: string}`
  - `const CHAPTER_TUTORIALS: Tutorial[]`
  - `function tutorialFor(chapter: number): Tutorial | null`
  - `function tutorialByKey(key: string): Tutorial | null` — 键形如 `'ch5'`
  - `function tutorialKey(chapter: number): string` — `'ch' + chapter`
  - `function parseBoard(rows: string[]): Grid`
  - `function tutorialRuns(t: Tutorial, grid: Grid): Run[]`
  - `function findRun(t: Tutorial, on: TutTarget, runs: Run[]): number` — 返回 runs 下标，`-1` = 找不到
  - `function stepOk(step: TutStep, out: Change): boolean`
  - `function canonicalAction(t: Tutorial, step: TutStep, runs: Run[]): Action | null` — 自动演示与门禁重放用的规范动作

- [ ] **Step 1: 先写门禁测试（此刻模块还不存在，必然红）**

创建 `cocos/tests/tutorial.test.cjs`：

```javascript
/**
 * 教学脚本的门禁。
 *
 * 教学盘是手写的，所以它必须**当场跑真 Rules 跑得出脚本宣称的效果**——
 * 「教一个盘上不存在的东西比不教更糟」这条教训（wild:true 实测 8 关有 4 关没发百搭）
 * 在手写盘上的对应物就是：expect 写错了、规则改了、格子挪了让下标指错轨，全都得在这里红。
 * 运行时视图也是拿 expect 当"这一步走没走对"的判据，所以这条门禁同时是行为测试。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));
const R = core('Rules.js');
const G = core('Generator.js');
const T = core('tutorials.js');

test('盘面字面量：空格、木桩、叠层、冰、百搭都解析成 core 的形状', () => {
  const g = T.parseBoard(['2p . #', '5m|5m 6s~ f3*']);
  assert.equal(g[0][0].length, 1);
  assert.deepEqual(g[0][0], ['2p']);
  assert.equal(g[0][1], null);                       // '.' → 空洞
  assert.equal(g[0][2], '#');                        // '#' → 木桩（不是数组）
  assert.deepEqual(g[1][0], ['5m', '5m']);           // 叠两层，数组末尾是顶面
  assert.equal(R.top(g, {r: 1, c: 0}), '5m');
  assert.equal(R.top(g, {r: 1, c: 1}), '6s~');       // 一层冰
  assert.equal(R.hasIce(R.top(g, {r: 1, c: 1})), true);
  assert.equal(R.isWild(R.top(g, {r: 1, c: 2})), true);
});

test('章 6 将将胡：三步都跑出脚本宣称的效果（含"推得动但消不掉"）', () => {
  const t = T.tutorialFor(5);
  assert.equal(t.title, '将将胡');
  const grid = T.parseBoard(t.board);
  assert.equal(G.stateLegal(grid), true, '教学盘必须满足牌池不变量');
  let runs = T.tutorialRuns(t, grid);
  // 开局必须"不推就什么都消不掉"，否则第一步没有教学价值
  assert.equal(R.pairs(grid, t.dialect).length, 0);
  assert.equal(R.tapPairs(grid, t.dialect).length, 0);

  const s1 = t.steps[0], s2 = t.steps[1];
  const ri = T.findRun(t, s1.on, runs);
  assert.ok(ri >= 0, '第一条滑轨意图必须解析得到');
  const a1 = R.transition(grid, runs, {kind: 'slide', run: ri, step: s1.step}, t.dialect);
  assert.equal(T.stepOk(s1, a1), true, '第一步必须消掉一对 2 筒');
  assert.equal(a1.erased.length, 1);
  assert.equal(a1.erased[0].face, '2p');

  const runs2 = T.tutorialRuns(t, a1.grid);
  const ri2 = T.findRun(t, s2.on, runs2);
  const a2 = R.transition(a1.grid, runs2, {kind: 'slide', run: ri2, step: s2.step}, t.dialect);
  assert.equal(T.stepOk(s2, a2), true, '第二步必须"推得动、消 0 对"——这是整段教学的意义');
  assert.equal(a2.changed, true);
  assert.equal(a2.erased.length, 0);
  assert.ok(R.liveCount(a2.grid, t.dialect) > 0, '哑弹必须留在盘上，正好用来讲"剩下的不用管"');
});

test('意图用 axis+index，不用 runs 下标：改小盘形状不许把动作指到别的轨', () => {
  const t = T.tutorialFor(5);
  const wide = T.parseBoard(['2p 6s 2p .', '8m 5m 8m .']);   // 右边多一列空洞
  const runs = T.tutorialRuns(t, wide);
  assert.equal(T.findRun(t, {slide: {axis: 'row', index: 0}}, runs), runs.findIndex((r) => r.axis === 'row' && r.index === 0));
  const picked = runs[T.findRun(t, {slide: {axis: 'row', index: 0}}, runs)];
  assert.equal(picked.axis, 'row');
  assert.equal(picked.index, 0);
});

test('expect 写错必须红：把"消 1 对"改成"消 5 对"，门禁就要拒（防的是门禁自己失效）', () => {
  const t = T.tutorialFor(5);
  const bad = {...t.steps[0], expect: {changed: true, pairs: 5}};
  const grid = T.parseBoard(t.board), runs = T.tutorialRuns(t, grid);
  const out = R.transition(grid, runs, {kind: 'slide', run: T.findRun(t, bad.on, runs), step: bad.step}, t.dialect);
  assert.equal(T.stepOk(bad, out), false);
});

test('每条教学脚本都自洽：步数 ≤2 个动手、意图可解析、逐步重放不卡住', () => {
  for (const t of T.CHAPTER_TUTORIALS) {
    assert.equal(t.steps.filter((s) => s.need).length <= 2, true, `${t.title}: 动手步骤不超过 2 个`);
    let grid = T.parseBoard(t.board);
    assert.equal(G.stateLegal(grid), true, `${t.title}: 盘面不合法`);
    for (const s of t.steps) {
      const runs = T.tutorialRuns(t, grid);
      const ri = T.findRun(t, s.on, runs);
      assert.ok(ri >= 0, `${t.title}: 意图解析不到轨`);
      const out = R.transition(grid, runs, s.on.slide ? {kind: 'slide', run: ri, step: s.step ?? 1} : {kind: 'match', a: s.on.tap[0], b: s.on.tap[1]}, t.dialect);
      assert.equal(T.stepOk(s, out), true, `${t.title}: 步骤「${s.say}」的 expect 与真实结果不符`);
      grid = out.grid;
    }
  }
});
```

- [ ] **Step 2: 跑一次，确认它是"因为模块不存在而红"，不是红在别处**

Run: `cd cocos && npm run build:core && node --test tests/tutorial.test.cjs`
Expected: FAIL，报错是 `Cannot find module '.../.test/core/tutorials.js'`（还没写实现）。如果报的是别的，先修测试本身。

- [ ] **Step 3: 实现 `core/tutorials.ts`**

```typescript
/**
 * 章首教学的**数据**：一张手写小盘 + 一串带期望结果的动作。
 *
 * 为什么教学内容不写在关卡上：`intro` 是 tools/author-levels.cjs 的 INTRO_RULES 跑批推导
 * 出来的，手改 levels.ts 下次跑批就没了；而且真关卡的盘可能根本没有要教的那个东西
 * （wild:true 实测 8 关有 4 关一张百搭都没发）。教学盘手写在这里，想教的牌一定在盘上，
 * 而 224 关的数据、seed/hash、跑批、钉审全部不受影响。
 *
 * 本文件**不许 import 'cc'**：node 门禁（tests/tutorial.test.cjs）要能在没有引擎的环境里
 * 跑真 Rules，这条同时也是 npm run build:core 能不能编过的前提。
 */
import {Action, Change, Cell, Dialect, Grid, Pos, Run, hasIce, isWild, runsFor} from './Rules';

/** 意图：推某一条轨，或点两张牌。两个字段都是可选，用哪个就由 `need` 决定。 */
export interface TutTarget {
  slide?: {axis: 'row' | 'col'; index: number};
  tap?: [Pos, Pos];
}

export interface TutStep {
  /** 这一屏说给玩家的一句话 */
  say: string;
  /** 缺省 = 自动演示；给了 = 必须玩家亲手做（硬引导只认这一条意图） */
  need?: 'slide' | 'tap';
  on: TutTarget;
  /** 自动演示与门禁重放用的规范步数（+1 = 内容移向 cells 高索引，与 rotate 一致） */
  step?: number;
  /**
   * 这一步必须看到的效果。它同时是三样东西：
   * ① node 门禁的断言；② 运行时"这一步走没走对、要不要前进"的判据；③ 防呆（对不上就回弹）。
   * `pairs: 0` 是合法且有价值的：章 6 第二步教的正是「推得动，但配不成对」。
   */
  expect: {changed: boolean; pairs: number; faces?: string[]};
}

export interface Tutorial {
  chapter: number;
  title: string;
  /** 盘面字面量：一行一个字符串，格之间空格；'.'=空洞 '#'=木桩 'a|b'=叠两层 尾 '~'=冰 '*'=百搭 */
  board: string[];
  dialect?: Dialect;
  lockR?: number[];
  lockC?: number[];
  oneWay?: {axis: 'row' | 'col'; index: number; dir: 1 | -1}[];
  steps: TutStep[];
  /** 最后一段收尾文案：把小盘的结论搬到真关上 */
  close: string;
}

/** 下标 = 章号。第一阶段只放章 6（数组里 index 5），其余章没有条目 → 不弹教学。 */
export const CHAPTER_TUTORIALS: Tutorial[] = [
  {
    chapter: 5,
    title: '将将胡',
    // 开局 pairs()/tapPairs() 都是 0：不推就什么都消不掉，教学必须靠动作开口。
    board: ['2p 6s 2p', '8m 5m 8m'],
    dialect: {ranks: [2, 5, 8]},
    steps: [
      {say: '这一关只有 2、5、8 能配成对。推这一行，让两张二筒碰头。', need: 'slide',
        on: {slide: {axis: 'row', index: 0}}, step: 1, expect: {changed: true, pairs: 1, faces: ['2p']}},
      {say: '再推同一行一次：六筒跟着挪了位，但它不在 2、5、8 里。', need: 'slide',
        on: {slide: {axis: 'row', index: 0}}, step: 1, expect: {changed: true, pairs: 0}},
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
 * 小盘改一格形状，写死的下标就指到别的轨上——和第 75 关「解锁后 19→21 条、同一下标
 * 从 row4 变成 row2」是同一个 bug 家族。
 */
export function findRun(t: Tutorial, on: TutTarget, runs: Run[]): number {
  if (!on.slide) return -1;
  return runs.findIndex((r) => r.axis === on.slide!.axis && r.index === on.slide!.index && !r.locked);
}

/** 这一步的真实结果对不对得上脚本写的期望。视图拿它决定"前进还是回弹"。 */
export function stepOk(step: TutStep, out: Change): boolean {
  if (out.changed !== step.expect.changed) return false;
  if (out.erased.length !== step.expect.pairs) return false;
  if (step.expect.faces) {
    const got: string[] = [];
    for (const p of out.erased) { got.push(p.face, p.other); }
    for (const want of step.expect.faces) {
      if (!got.some((f) => topOf(f) === want)) return false;
    }
  }
  return true;
}

/** 期望里写牌面时不带冰/百搭后缀，比较时剥掉，省得脚本作者去猜 `5s~` 还是 `5s~~`。 */
function topOf(face: string): string {
  let f = face;
  while (hasIce(f)) f = f.slice(0, -1);
  if (isWild(f)) f = f.slice(0, -1);
  return f;
}

/** 给控制器用的规范动作（自动演示与门禁重放都走它）。 */
export function canonicalAction(t: Tutorial, step: TutStep, runs: Run[]): Action | null {
  if (step.on.tap) return {kind: 'match', a: step.on.tap[0], b: step.on.tap[1]};
  const ri = findRun(t, step.on, runs);
  return ri < 0 ? null : {kind: 'slide', run: ri, step: step.step ?? 1};
}
```

调用方需要 `hasIce`/`isWild`/`top` 时直接从 `./Rules` 取，本文件不做 re-export——`tsc` 对"同一个名字从两条路径导出"的处理不值得赌。

- [ ] **Step 4: 把新文件接进编译与测试链**

改 `cocos/package.json` 两条脚本（其余一字不动）：

```jsonc
"build:core": "tsc assets/scripts/core/levels.ts assets/scripts/core/Rules.ts assets/scripts/core/Generator.ts assets/scripts/core/Session.ts assets/scripts/core/tutorials.ts --outDir .test/core --target ES2020 --module commonjs --strict --skipLibCheck",
"test": "npm run build:core && node --test tests/core.test.cjs tests/generation.test.cjs tests/session.test.cjs tests/transpile.test.cjs tests/view-source.test.cjs tests/levels-meta.test.cjs tests/levels-seed.test.cjs tests/timelimit.test.cjs tests/dialect.test.cjs tests/goals.test.cjs tests/tutorial.test.cjs",
```

- [ ] **Step 5: 跑门禁，确认全绿**

Run: `cd cocos && npm run test`
Expected: `tests/tutorial.test.cjs` 5 条全 pass，且原有 10 个测试文件不新增失败（此刻还没动 Session，应当一条都不红）。

- [ ] **Step 6: Commit**

```bash
git add cocos/assets/scripts/core/tutorials.ts cocos/tests/tutorial.test.cjs cocos/package.json
git commit -m "feat(tutorial): 教学数据格式——手写小盘配真 Rules 断言，先把将将胡的「推得动但配不成」钉进门禁"
```

---

### Task 2: 展示决策（Session 的 tip 该弹哪一张）

**Files:**
- Modify: `cocos/assets/scripts/core/Session.ts:184-194`（`setupLevel`）、`:172-178`（`dismissTip`）
- Test: `cocos/tests/session.test.cjs`（补例）+ 必要时修正既有断言

**Interfaces:**
- Consumes: Task 1 的 `tutorialFor(chapter)`、`tutorialKey(chapter)`、`tutorialByKey(key)`
- Produces: `Session.introTutorial: Tutorial | null`（视图据此决定开教学屏还是弹文字卡）；`Session.tip` 的取值集合扩大（多出 `'ch5'` 这类键），类型仍是 `string | null` 不变

- [ ] **Step 1: 先写失败测试**

在 `cocos/tests/session.test.cjs` 末尾追加：

```javascript
test('章教学键优先：章 6 首见弹教学，看完之后同关不再弹任何东西', () => {
  const S = core('Session.js').Session;
  const s = new S(1, platform);
  s.tipsSeen = {};
  s.reset(80, false);                                   // 章 6（index 5）首关
  assert.equal(s.tip, 'ch5');
  assert.equal(s.introTutorial.title, '将将胡');
  s.dismissTip();
  assert.equal(s.tip, null);
  assert.equal(s.tipsSeen['ch5'], true);
  s.reset(80, false);
  assert.equal(s.tip, null, '已经看过的章教学不许重演');
});

test('去重：章首同时是机制首见时，dismissTip 一次把两个键都标记（不许演完冰又弹冰的卡）', () => {
  const S = core('Session.js').Session;
  const s = new S(1, platform);
  s.tipsSeen = {};
  s.reset(48, false);                                   // 章 4（index 3）首关：既是 ch3 教学又是 ice
  assert.equal(s.tip, 'ch3');
  s.dismissTip();
  assert.equal(s.tipsSeen['ice'], true, '机制键必须一起标记');
  s.reset(49, false);
  assert.equal(s.tip, null);
});

test('第 1 关从「每次进都弹 basic」改成「只弹一次」：8 秒的交互不能每次重演', () => {
  const S = core('Session.js').Session;
  const s = new S(1, platform);
  s.tipsSeen = {};
  s.reset(0, false);
  assert.equal(s.tip, 'basic');
  s.dismissTip();
  assert.equal(s.tipsSeen['basic'], true);
  s.reset(0, false);
  assert.equal(s.tip, null);
});

test('无尽段与没有脚本的章：不弹教学，退回既有行为', () => {
  const S = core('Session.js').Session;
  const s = new S(1, platform);
  s.tipsSeen = {};
  s.reset(16, false);                                   // 章 2 首关，本阶段没有 ch1 脚本
  assert.equal(s.tip, 'lockRow', '没有教学脚本的章必须继续走机制文字卡');
  assert.equal(s.introTutorial, null);
});
```

- [ ] **Step 2: 跑一次确认红在新行为上**

Run: `cd cocos && npm run test`
Expected: FAIL —— `s.introTutorial is undefined`、`s.tip` 期望 `'ch5'` 实得 `null`。
同时留意**既有的**"第 1 关每次弹 basic"断言会不会红：如果红了，改掉那条断言，并在它的注释里写清"改成只弹一次的理由见 spec §5.1"。不许为了让旧断言绿而放宽新行为。

- [ ] **Step 3: 实现**

`core/Session.ts` 顶部 import 加：

```typescript
import {Tutorial, tutorialFor, tutorialKey} from './tutorials';
```

`setupLevel` 里把第 193 行那一句整行替换：

```typescript
    // 展示决策（spec §5.1）：章教学优先，其次机制首见，再次第 1 关的基础卡。
    // 章号从 def.chapter 取，取不到退回 floor(index/16)——与 difficulty 同一个口径（见上面 :134）。
    // 判据是「这一章第一次被进入」而不是「这一关是章首」：玩家从选关跳进章 6 的第 4 关也得补上，
    // 而教学内容与具体盘面无关（小盘是手写的），插在哪一关都不会错。
    const chapter = this.def.chapter ?? Math.floor(chosen / 16);
    const tut = tutorialFor(chapter);
    if (tut && !this.tipsSeen[tutorialKey(chapter)]) this.tip = tutorialKey(chapter);
    else if (chosen === 0 && !this.tipsSeen['basic']) this.tip = 'basic';
    else this.tip = this.def.intro && !this.tipsSeen[this.def.intro] ? this.def.intro : null;
```

`dismissTip` 整块替换（去重 + basic 也要记账）：

```typescript
  dismissTip(): void {
    const t = this.tip;
    if (!t) return;
    this.tipsSeen[t] = true;
    // 章教学演过就算看过它覆盖的机制——否则「小盘演完冰、进关又弹一张冰的文字卡」。
    // 只有真的命中过机制首见才标记，别把无关的键写脏。
    if (tutorialByKey(t) && this.def.intro && !this.tipsSeen[this.def.intro]) this.tipsSeen[this.def.intro] = true;
    this.save();
    this.tip = null;
    this.revision++;
  }
```

`introTip` 旁边加一个视图用的 getter：

```typescript
  /** 这一关该弹的是「手写小盘教学」还是「文字卡」：非 null 就开教学屏。 */
  get introTutorial(): Tutorial | null { return this.tip ? tutorialByKey(this.tip) : null; }
```

`restore()`（`:94`）里已经有 `this.tip = null`——读档的中盘不该补教学，这条不变，别动。

- [ ] **Step 4: 跑门禁**

Run: `cd cocos && npm run test`
Expected: 新增 4 条全绿，既有一条都不红。

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/Session.ts cocos/tests/session.test.cjs
git commit -m "feat(tutorial): 章教学键由章号推导，不进关卡表；机制首见一起去重"
```

---

### Task 3: 教学状态机（core/Tutorial.ts）

**Files:**
- Create: `cocos/assets/scripts/core/Tutorial.ts`
- Test: `cocos/tests/tutorial.test.cjs`（追加）

**Interfaces:**
- Consumes: Task 1 的 `Tutorial`/`TutStep`/`parseBoard`/`tutorialRuns`/`canonicalAction`/`stepOk`；`Rules.transition`
- Produces: `class TutorialRun`，成员：
  - `constructor(t: Tutorial, watch?: boolean)`
  - `grid: Grid` / `runs: Run[]` / `revision: number` / `index: number`
  - `get step(): TutStep | null`（`null` = 讲完了）
  - `get done(): boolean` / `get failed(): boolean` / `get watchMode(): boolean`
  - `advance(action: Action): {advanced: boolean; erased: Pair[]; message: string}`
  - `canonical(): Action | null`
  - `targetCells(): Pos[]`（喂 `Board` 的 `hintCells`）
  - `sayFor(action: Action): string`（回弹/换方向时的话术）

- [ ] **Step 1: 先写失败测试**

追加到 `cocos/tests/tutorial.test.cjs`：

```javascript
test('状态机：只接受与脚本一致的动作，其余一律回弹且不改盘面', () => {
  const Tu = core('Tutorial.js');
  const t = T.tutorialFor(5);
  const run = new Tu.TutorialRun(t);
  assert.equal(run.index, 0);
  assert.equal(run.done, false);
  assert.equal(run.step.say, t.steps[0].say);

  // 错误方向（step = -1）：真 Rules 会改盘，但对不上 expect → 必须不提交
  const before = JSON.stringify(run.grid);
  const bad = run.advance({kind: 'slide', run: T.findRun(t, t.steps[0].on, run.runs), step: -1});
  assert.equal(bad.advanced, false);
  assert.equal(JSON.stringify(run.grid), before, '回弹不许偷偷改掉盘面');
  assert.equal(run.index, 0);

  const ok = run.advance(run.canonical());
  assert.equal(ok.advanced, true);
  assert.equal(ok.erased.length, 1);
  assert.equal(run.index, 1);

  run.advance(run.canonical());
  assert.equal(run.done, true, '两步走完就该结束');
  assert.equal(run.step, null);
});

test('状态机：意图解析不到轨时标记 failed，视图据此降级', () => {
  const Tu = core('Tutorial.js');
  const t = {...T.tutorialFor(5), lockR: [0], lockC: []};   // 把要推的那一行锁死
  const run = new Tu.TutorialRun(t);
  assert.equal(run.canonical(), null);
  run.advance({kind: 'slide', run: 0, step: 1});
  assert.equal(run.failed, true);
});

test('watch 模式（玩法说明里的重放）：不做强制，逐步自动演到底', () => {
  const Tu = core('Tutorial.js');
  const run = new Tu.TutorialRun(T.tutorialFor(5), true);
  assert.equal(run.watchMode, true);
  let guard = 0;
  while (!run.done && !run.failed && guard++ < 10) run.advance(run.canonical());
  assert.equal(run.done, true);
});
```

- [ ] **Step 2: 跑一次确认红在 `Cannot find module`**

Run: `cd cocos && node --test tests/tutorial.test.cjs`

- [ ] **Step 3: 实现 `core/Tutorial.ts`**

```typescript
/**
 * 教学状态机：一张手写小盘 + 一串带期望结果的动作，走的是**真 Rules**。
 *
 * 三件事由这个类保证：
 * ① 自动演示与玩家手指共用 `advance()` 这一条路径 → 演给他看的就是真规则，不是第二套假动画；
 * ② 只提交「与脚本 expect 一致」的动作，对不上就回弹，所以教学状态永远就是脚本状态；
 * ③ 任何一步解析不到 / transition 抛异常就置 `failed`，视图据此退回文字卡，教学绝不挡住进关。
 *
 * 不建 Session：Session.reset 会发牌、落盘、推 maxLevel、定 par、算星级、进 history，
 * 教学目标一分钱都不能花掉这些。输入屏蔽与限时停表由 Session.tip 负责（spec §5.2）。
 *
 * 本文件不许 import 'cc'——node 门禁要在无引擎环境里跑它。
 */
import {Action, Grid, Pair, Pos, Run, transition} from './Rules';
import {Tutorial, TutStep, canonicalAction, parseBoard, stepOk, tutorialRuns} from './tutorials';

export interface AdvanceResult {advanced: boolean; erased: Pair[]; message: string}

export class TutorialRun {
  grid: Grid;
  runs: Run[];
  index = 0;
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
  /** 视图的取证探针与玩法说明的重放入口都要认章号。 */
  get chapterIndex(): number { return this.t.chapter; }
  get closing(): string { return this.t.close; }

  /** 唯一的状态入口。手指的拖拽和自动演示都从这里进，区别只在动作来源。 */
  advance(action: Action | null): AdvanceResult {
    const st = this.step;
    if (!st || this.done) return {advanced: false, erased: [], message: this.t.close};
    if (this.failed || !action) { this.failed = true; return {advanced: false, erased: [], message: ''}; }
    let out;
    try {
      out = transition(this.grid, this.runs, action, this.t.dialect);
    } catch {
      this.failed = true; this.revision++;
      return {advanced: false, erased: [], message: ''};
    }
    if (!stepOk(st, out)) {
      // 推错了不改盘面：教学盘的状态必须一直就是脚本描述的那一盘，否则后面的步骤全错位
      this.revision++;
      return {advanced: false, erased: [], message: this.sayFor(action)};
    }
    this.grid = out.grid;
    this.runs = tutorialRuns(this.t, this.grid);
    this.index++;
    this.revision++;
    return {advanced: true, erased: out.erased, message: st.say};
  }

  /** 自动演示与 watch 模式用的规范动作；解析不到 = 脚本与盘面脱节 → 让调用方走降级。 */
  canonical(): Action | null {
    const st = this.step;
    if (!st) return null;
    try { return canonicalAction(this.t, st, this.runs); } catch { this.failed = true; return null; }
  }

  /** 要玩家亲手做的那一步，把目标格交给视图画高亮（Board 的 hintCells 已经是蓝框，白拿）。 */
  targetCells(): Pos[] {
    const st = this.step;
    if (!st || this.watch) return [];
    if (st.on.tap) return [st.on.tap[0], st.on.tap[1]];
    if (!st.on.slide) return [];
    const run = this.runs.find((r) => r.axis === st.on.slide!.axis && r.index === st.on.slide!.index && !r.locked);
    return run ? run.cells.slice() : [];
  }

  /** 回弹时说的话：按"这一步本来要看到什么"分化，不是一句「推错了再来」。 */
  sayFor(action: Action): string {
    const st = this.step;
    if (!st) return '';
    if (action.kind === 'slide') {
      if (st.need !== 'slide') return '这一屏先看，不用动手。';
      const want = st.on.slide;
      const run = this.runs[action.run];
      if (!run || !want) return '就推亮起来的那一条。';
      if (run.axis !== want.axis || run.index !== want.index) return `按住亮起来的那${want.axis === 'row' ? '一行' : '一列'}再拖。`;
      return st.expect.pairs > 0 ? '换个方向再推一次：牌要从另一头碰上来。' : '就是这个方向，再推一格试试。';
    }
    return st.need === 'tap' ? '点亮的这两张牌。' : '这一屏先看，不用动手。';
  }
}
```

- [ ] **Step 4: 接进编译链并跑绿**

`cocos/package.json` 的 `build:core` 文件列表再加一项（放在 `tutorials.ts` 后面）：

```
assets/scripts/core/Tutorial.ts
```

Run: `cd cocos && npm run test`
Expected: 全绿（tutorial.test.cjs 8 条）。

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/Tutorial.ts cocos/tests/tutorial.test.cjs cocos/package.json
git commit -m "feat(tutorial): 教学状态机——自动演示与手指共用一条 advance 路径，只提交与脚本一致的动作"
```

---

### Task 4: 视图接入（GameRoot 的教学屏）

**Files:**
- Modify: `cocos/assets/scripts/view/GameRoot.ts`（`Screen` 类型 `:105`、`SCREEN_MODAL` `:113-116`、`onLoad` 的 `screens` `:216-222`、`update` `:312-358`、`setScreen` `:379-384`、`render` `:469-497`、`renderBoard` 之后加 `renderTutorial`、`onTouch` `:1222-1254`、`activate` `:406-443`、`__mj` 探针 `:250-256`）
- Test: `cocos/tests/view-source.test.cjs`（追加一条源码断言）+ `npm run check:cocos`

**Interfaces:**
- Consumes: `Session.introTutorial`、`TutorialRun`、`Board.build(model, atlas, x, y, cellW, cellH)`、`Board.cellAt/cellCenter/setDrag/playErase`、`widgets` 的 `makeNode/makeLabel/makePlate/makeButton/makeSprite/clearChildren/fadeIn/hex`
- Produces: `screen === 'tutorial'`、`activate('tutorial:<章号>')`（截图与调试入口）、`__mj().tutorial` 探针

- [ ] **Step 1: 先写源码级防回归断言（这一层测不出来只能扫，理由同 view-source.test.cjs 的既有注释）**

追加到 `cocos/tests/view-source.test.cjs`：

```javascript
test('教学屏的 Board 实例不许挂在 overlay 下（overlay 每次重绘都 clearChildren 销毁）', () => {
  const src = fs.readFileSync(path.join(VIEW, 'GameRoot.ts'), 'utf8');
  assert.match(src, /this\.tutBoard = new Board\(this\.screens\.tutorial/, '教学 Board 实例必须只建一次并挂在 screen-tutorial 下');
  assert.match(src, /tutorial: 'none'/, 'SCREEN_MODAL 必须登记 tutorial：漏登记就是"每秒重播淡入"那一类事故');
  assert.match(src, /case 'tutorial-close': this\.tut = null; this\.setScreen\(this\.tutFrom\)/, '回跳必须认 tutFrom，不许用 dialogParent()');
});

test('教学任何失败都要退回文字卡：降级出口必须存在', () => {
  const src = fs.readFileSync(path.join(VIEW, 'GameRoot.ts'), 'utf8');
  assert.match(src, /tutorialFail\(\)/, '降级必须集中成一个出口，不许散在 catch 里');
  assert.match(src, /session\.command\('tip-ok'\)/, '降级就是释放 tip');
});
```

- [ ] **Step 2: 跑一次，确认红在缺字符串上（源码还没有这些）**

Run: `cd cocos && npm run test`
Expected: FAIL —— `new Board(this.screens.tutorial` 匹配不到。

- [ ] **Step 3: 加屏：类型、登记表、节点、Board 第二实例**

`Screen` 联合类型加 `'tutorial'`：

```typescript
type Screen = 'home' | 'levels' | 'board' | 'settings' | 'win' | 'lose' | 'pause' | 'help' | 'restart' | 'tutorial';
```

`SCREEN_MODAL` 加一行（`Record<Screen, Modal>` 会**编译期强制**你加，漏了就红——这是 commit e82ec48 换来的保险）：

```typescript
  home: 'home', board: 'none', settings: 'settings', levels: 'levels', win: 'win', lose: 'lose',
  help: 'help', pause: 'pause', restart: 'restart',
  // 教学屏映射 'none'：停表与挡输入由 Session.tip 非空负责（tick/apply/tap/notice/command 五处），
  // 这里再造一个 modal 只会让"到底谁停的表"变成两处逻辑。
  tutorial: 'none'
```

`DIALOG_ORIGIN` **不加**条目：教学屏只有一个「跳过」按钮，缺省会继承来源（牌桌），正确。

`onLoad` 的 `this.screens = {...}` 里加节点，并在 `this.board` 之后建第二实例：

```typescript
        tutorial: makeNode(this.node, {name: 'screen-tutorial'}),
```

```typescript
    // 教学牌桌：Board 的第二实例。显存代价≈0——牌图集只烘一张基准格，显示尺寸靠 contentSize 缩放，
    // 多一份只有节点池（十来个 Sprite）。但"≈0"是推理不是证据：
    // 验收要用 __mjDiag() 的 atlasReport 在真机预览里读一次实际纹理占用。
    this.tutBoard = new Board(this.screens.tutorial, this.ui);
    this.tutChrome = makeNode(this.screens.tutorial, {name: 'tutorial-chrome'});
    this.tutChrome.setSiblingIndex(1);   // 文案/按钮画在牌之上
```

字段声明加上：

```typescript
  private tutBoard!: Board;
  private tutChrome!: Node;
  private tut: TutorialRun | null = null;
  private tutFrom: Screen = 'board';
  private tutWait = 0;
  private tutPress: {x: number; y: number; cell: Pos | null; axis: 'row' | 'col' | null; blocked: boolean} | null = null;
  private tutDrag: {run: number; offset: number} | null = null;
```

`GameRoot.ts` 顶部的 import 补齐（现在只 import 了 `LEVELS`/`levelAt`/`CHAPTER_NAMES` 那几样）：

```typescript
import {CHAPTER_TUTORIALS, Tutorial, tutorialFor} from '../core/tutorials';
import {TutorialRun} from '../core/Tutorial';
```

（`CHAPTER_NAMES` 已经从 `../core/levels` 导入，Task 5 才用得到它。）

- [ ] **Step 4: 进出教学屏的口子**

`setScreen` 开头加一句，让它成为**唯一**的决策点（冷启动、选关、下一关、继续、重开全都经过它）：

```typescript
  private setScreen(s: Screen): void {
    // 首见教学插在进牌桌之前：只在"进牌桌"这一个口子上拦，别在四个调用点各写一遍。
    if (s === 'board' && this.session.introTutorial) { s = 'tutorial'; this.startTutorial(this.session.introTutorial, 'board'); }
    this.screen = s;
    ...
```

新增两个方法（放 `renderTipCard` 附近）：

```typescript
  /** 开一段教学。from 记录关掉之后回哪一屏：进关前拦截 = 'board'，玩法说明重放 = 'help'。 */
  private startTutorial(t: Tutorial, from: Screen): void {
    try {
      this.tut = new TutorialRun(t, from === 'help');
      this.tutFrom = from;
      this.tutWait = 0;
      this.endGesture();
    } catch (e) {
      this.tut = null;
      this.tutorialFail();
    }
  }

  /**
   * 降级：教学是加法，任何不对劲都立刻释放 tip 进真关，行为退化成今天的文字卡。
   * 真机读不到 console，所以这条是唯一能兜住「教学在真机上炸了」的东西。
   */
  private tutorialFail(): void {
    if (this.session.introTutorial) this.session.command('tip-ok');
    this.tut = null;
    this.setScreen(this.tutFrom === 'help' ? 'help' : 'board');
  }
```

`activate()` 的 switch 里加：

```typescript
      case 'tutorial-skip': this.session.command('tip-ok'); this.tut = null; this.setScreen('board'); break;
      // 回跳只认 tutFrom（是从哪一屏进来的），不能用 dialogParent()：那时 screen 已经是
      // 'tutorial'，dialogParent() 的第一条分支不成立，会把"从玩法说明进来重放"甩回牌桌。
      case 'tutorial-close': this.tut = null; this.setScreen(this.tutFrom); break;
      case 'tutorial-ok':
        if (this.tut && !this.tut.failed) { this.session.command('tip-ok'); this.tut = null; this.setScreen('board'); }
        else this.tutorialFail();
        break;
      default:
        if (id.startsWith('level:')) this.startLevel(Number(id.slice(6)));
        else if (id.startsWith('tutorial:')) {
          const n = Number(id.slice(9)), t = tutorialFor(n), from = this.screen;
          if (t) { this.tutFrom = from; this.setScreen('tutorial'); this.startTutorial(t, from); }
        }
```

（`tutorial:` 那条既给玩法说明的重放用，也是 CDP 截图的入口——它不依赖玩家进度，`__mjTap('tutorial:5')` 在体验版和 web 构建里都能直接开章 6 教学。）

- [ ] **Step 5: render() 里画这一屏**

`render()` 里在 `show(this.screens.board, boardVisible)` 之后加：

```typescript
    show(this.screens.tutorial, this.screen === 'tutorial');
    if (this.screen === 'tutorial') this.renderTutorial();
```

并把诊断行的挂载点带上教学屏（否则教学屏出问题真机上连诊断行都读不到）：

```typescript
    this.atlasDiag(this.screen === 'tutorial' ? this.screens.tutorial : boardVisible ? this.boardChrome : this.screens.home);
```

`renderTutorial()` 实现（放在 `renderTipCard` 之后）：

```typescript
  /**
   * 教学屏：暗底 + 手写小盘 + 一句话 + 按钮。
   *
   * 三条布局约束，动之前先读：
   * ① 牌区必须放在**按钮与文案之外**，且手势只在 `tutBoard.cellAt()` 命中时开启——
   *    与牌桌同一套规则（按钮节点自己的 TOUCH_END 与全局 input 监听互不重叠），这样不需要手工命中数组；
   * ② 教学 Board 不挂 overlay：`render()` 每帧 `clearChildren(overlay)` 会把节点池连锅端掉；
   * ③ 高亮直接喂 `hintCells`，Board 已经把它画成蓝框（drawHighlights），不再自己画洞。
   */
  private renderTutorial(): void {
    const run = this.tut;
    // 没有控制器 = 这一屏不该开着（tip 已被释放 / 上一步刚降级）。直接降级，别画半张屏：
    // 以前"画面只剩文字"这类事故都是从这种兜底分支随手画了个面板开始的。
    if (!run) { this.tutorialFail(); return; }
    if (run.failed) { this.tutorialFail(); return; }
    const W = this.size.w, H = this.size.h;
    this.clearTutorialChrome();

    const rows = run.grid.length, cols = run.grid[0] ? run.grid[0].length : 1;
    const plateH = 76, sayTop = H / 2 - 150, toolsH = 132;
    const availH = sayTop - 150 - toolsH;
    const sidePad = cols <= 4 ? 34 : 44;
    const cellW = Math.min((W - sidePad * 2) / cols, availH / (rows + .4) / 1.24, 156);
    const cellH = cellW * 1.24;
    const bw = cellW * cols, bh = cellH * rows;
    const top = sayTop - 40;
    this.tutCell = {cellW, cellH};
    this.tutBoard.build({
      grid: run.grid, runs: run.runs, selected: null,
      hintCells: run.step && run.step.need ? run.targetCells() : [],
      drag: this.tutDrag,
      lockedRows: [], lockedCols: [], oneWay: [], pendingUnlock: []
    }, this.ensureTileAtlas(), -bw / 2, top - Math.max(0, (availH - bh) / 2), cellW, cellH);

    const root = this.tutChrome;
    const plate = makePlate(root, this.ui, 360, plateH, 0, H / 2 - 68 - this.safeTop);
    makeLabel(plate, `${run.title} · 怎么玩`, {x: 0, y: 22, size: 34, color: '#FBF3DE', align: 'center', bold: true, serif: true});

    const step = run.step;
    const say = step ? step.say : run.closing;
    makeLabel(root, say, {x: -(W - 100) / 2 + 50, y: sayTop, size: 27, color: palette.ink, align: 'left'});

    if (!step) {
      makeButton(root, this.ui, {x: 0, y: -H / 2 + 150, w: 340, h: 92, text: run.watchMode ? '看好了，开始' : '明白了，开始', style: 'jade', size: 30,
        onTap: () => this.activate(run.watchMode ? 'tutorial-close' : 'tutorial-ok')});
    } else if (!step.need || run.watchMode) {
      makeButton(root, this.ui, {x: 0, y: -H / 2 + 150, w: 260, h: 92, text: '跳过教学', style: 'cream', size: 26,
        onTap: () => this.activate('tutorial-skip')});
    } else {
      makeButton(root, this.ui, {x: W / 2 - 150, y: H / 2 - 60 - this.safeTop, w: 190, h: 60, text: '跳过', style: 'cream', size: 22,
        onTap: () => this.activate('tutorial-skip')});
    }
  }

  private clearTutorialChrome(): void { clearChildren(this.tutChrome); }
```

`this.tutCell` 记得声明：`private tutCell: {cellW: number; cellH: number} | null = null;`（手势换算要用）。

- [ ] **Step 6: update(dt) 里驱动自动演示**

`update()` 在 `if (!this.dirty) return;` **之前**插（和 `session.tick(dt)` 同一个理由：不先判时间就不会安排重绘）：

```typescript
    // 教学屏的自动演示节拍走 dt 累加，和限时关同一个入口，不新增 cc.schedule。
    // 切后台掉帧时 dt 会很大，钳一下：演示是给人看的，不许一次跳过三步。
    if (this.screen === 'tutorial' && this.tut && !this.tut.failed) {
      const st = this.tut.step;
      if (st && (!st.need || this.tut.watchMode)) {
        this.tutWait += Math.min(dt, 0.25);
        if (this.tutWait >= (this.tut.watchMode ? 1.1 : 1.6)) {
          this.tutWait = 0;
          const r = this.tut.advance(this.tut.canonical());
          if (this.tut.failed) this.tutorialFail();
          else { if (r.erased.length) this.tutBoard.playErase(r.erased); this.dirty = true; }
        }
      } else this.tutWait = 0;
    }
```

- [ ] **Step 7: 手势分支**

`onTouch()` 最上面加一条路由（现有那句 `if (this.screen !== 'board') return;` 保持不变）：

```typescript
    if (this.screen === 'tutorial') { this.onTutorialTouch(e); return; }
```

新增方法（拖拽换算照抄 `onMove`/`onUp` 的既有口径：**cc 的 +y 向上，列方向要取负**，这个符号错过一次、代价是整段牌跳位）：

```typescript
  /**
   * 教学屏手势。只做牌桌那套的子集：判定轴 → 找轨 → 预览 → 松手提交。
   *
   * 与牌桌的关键区别：**只有和脚本 expect 一致的动作会被提交**（TutorialRun.advance 负责回弹），
   * 所以这里不需要遮罩挖洞就已经"硬"了——小盘就 2×3，误触本身几乎不可能。
   */
  private onTutorialTouch(e: EventTouch): void {
    const run = this.tut;
    const id = e.getID();
    if (e.type === Input.EventType.TOUCH_START) {
      if (!run || run.failed || this.tutPress) return;
      const st = run.step;
      if (!st || !st.need || run.watchMode) return;                 // 自动演示期间不吃操作
      const {x, y} = this.toDesign(e);
      const cell = this.tutBoard.cellAt(x, y);
      if (!cell) return;                                            // 落在按钮区 → 交给节点自己
      this.touchId = id;
      this.tutPress = {x, y, cell, axis: null, blocked: false};
      this.tutDrag = null;
      return;
    }
    if (!this.tutPress) return;
    if (id !== this.touchId) return;
    if (e.type === Input.EventType.TOUCH_MOVE) {
      const {x, y} = this.toDesign(e);
      const p = this.tutPress, cw = this.tutCell ? this.tutCell.cellW : 1, ch = this.tutCell ? this.tutCell.cellH : 1;
      const dx = x - p.x, dy = y - p.y;
      if (!p.axis) {
        const slop = Math.max(8, Math.min(cw, ch) * .22);
        if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
        p.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
        const ri = run.runs.findIndex((r) => r.axis === p.axis && !r.locked && r.cells.some((q) => q.r === p.cell!.r && q.c === p.cell!.c));
        if (ri < 0) { p.blocked = true; this.tutHint = '这一条推不动：按住亮起来的那一条。'; this.dirty = true; return; }
        this.tutDrag = {run: ri, offset: 0};
      }
      if (!this.tutDrag) return;
      const len = run.runs[this.tutDrag.run].cells.length || 1;
      const raw = p.axis === 'row' ? dx / cw : -dy / ch;
      this.tutDrag = {run: this.tutDrag.run, offset: Math.max(-len, Math.min(len, raw))};
      this.tutBoard.setDrag(this.tutDrag);                          // 每次 move 都跟手，不重建
      return;
    }
    this.touchId = null;
    const p = this.tutPress, drag = this.tutDrag;
    this.tutPress = null; this.tutDrag = null;
    this.tutBoard.setDrag(null);
    this.dirty = true;
    if (e.type === Input.EventType.TOUCH_CANCEL || !run) return;
    const {x, y} = this.toDesign(e);
    if (drag) {
      const len = run.runs[drag.run] ? run.runs[drag.run].cells.length : 0;
      if (!len) return;
      const k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) this.commitTutorial({kind: 'slide', run: drag.run, step: k > len / 2 ? k - len : k});
      return;
    }
    if (p && p.cell && !p.blocked && !p.axis) {
      const end = this.tutBoard.cellAt(x, y);
      if (end && end.r === p.cell.r && end.c === p.cell.c) {
        const sel = this.tutSel;
        if (!sel) { this.tutSel = end; }
        else { this.commitTutorial({kind: 'match', a: sel, b: end}); this.tutSel = null; }
        this.dirty = true;
      }
    }
  }

  /** 提交一个动作给状态机；回弹就把话术贴到横幅上，不改盘面。 */
  private commitTutorial(action: Action): void {
    const run = this.tut;
    if (!run) return;
    const before = run.revision;
    const r = run.advance(action);
    if (run.failed) { this.tutorialFail(); return; }
    if (r.advanced) { if (r.erased.length) this.tutBoard.playErase(r.erased); this.tutHint = ''; }
    else if (run.revision !== before) this.tutHint = r.message;
    this.dirty = true;
  }
```

补两个字段：`private tutHint = ''; private tutSel: Pos | null = null;`，并把 `this.tutHint` 在 `renderTutorial()` 的 `say` 那行一起画出来：

```typescript
    if (this.tutHint) makeLabel(root, this.tutHint, {x: -(W - 100) / 2 + 50, y: sayTop - 40, size: 24, color: palette.jadeDeep, align: 'left'});
```

`makeLabel` 的 y 是**文字盒顶部**（`renderTipCard` 的注释里记着这条，写成 `+` 会把文字画到面板外）。

- [ ] **Step 8: 调试与取证口子**

`__mj()` 探针的返回值里加教学状态，CDP 截图才读得回"这一步到底走没走"：

```typescript
      tutorial: this.tut ? {chapter: this.tut.chapterIndex, step: this.tut.index, done: this.tut.done, failed: this.tut.failed, watch: this.tut.watchMode,
        cellW: this.tutCell ? this.tutCell.cellW : 0, board: this.tutBoard ? {rows: this.tutBoard.gridRows, cols: this.tutBoard.gridCols, origin: this.tutBoard.origin} : null} : null,
```

（`chapterIndex` 这个 getter 在 Task 3 的 `TutorialRun` 里已经定义，就是 `this.t.chapter`。）

`onDestroy` 里不用额外清理：`tutBoard` 的节点在 `screens.tutorial` 子树上，随场景一起销毁；纹理是共享的 `TileAtlas`/`UiAtlas`，dispose 已经在 `onDestroy` 里统一做了。

- [ ] **Step 9: 编译 + 全链测试**

Run: `cd cocos && npm run check:cocos && npm run test`
Expected: `tsc -p tsconfig.check.json` 零错误（`SCREEN_MODAL` 漏登记会在这里红）；测试全绿，含 Step 1 那两条源码断言。

- [ ] **Step 10: 看画面（单测绿不等于看过画面）**

用既有的 web-mobile 构建 + 静态服务 + headless Chrome/CDP 那条路（**不要用 7456**，先验端口身份）：

```bash
node cocos/tools/rebuild-watch.cjs &        # 或走 auto-build 扩展；result.json 的 success 不可信，要自己确认产物时间戳
node cocos/tools/devtools-verify.cjs --wait 75 --url "http://127.0.0.1:<port>/index.html?level=80"
```

CDP 里执行并核对：

```javascript
__mjTap('tutorial:5');          // 直接开章 6 教学，不依赖进度
__mj().tutorial                 // → {chapter:5, step:0, done:false, failed:false, cellW:...}
__mj().screen                   // → 'tutorial'
__mjDiag()                      // 记下 atlas 条目与显存读数
```

必须用眼睛确认的四件事：牌真的画出来了（不是"只剩文字"）、蓝框亮在第 1 行、匾额文案没出面板、拖一行时牌跟手且松手只消那一对 2 筒。截图存进 `docs/mockups/`，命名 `tutorial-ch6-step{0,1,2}.png`。

第五件事要等进了真关再验：**两个 Board 实例不许互相拽牌**。教学关掉之后在真牌桌上推任意一轨，`__mj().board.origin` 和 `__mj().tutorial.board.origin` 必须是两套坐标、只有前者的牌在动（`playErase` 的幽灵层与 `setDrag` 的预览都是按实例隔离的，这条是推理，spec §十 把它列为未验项）。

- [ ] **Step 11: Commit**

```bash
git add cocos/assets/scripts/view/GameRoot.ts cocos/tests/view-source.test.cjs docs/mockups
git commit -m "feat(tutorial): 教学屏——手写小盘用第二个 Board 实例，硬引导靠只认目标动作实现"
```

---

### Task 5: 玩法说明变成 14 条章目录（回看入口）

**Files:**
- Modify: `cocos/assets/scripts/view/GameRoot.ts:1100-1121`（`renderHelp`）
- Test: `cocos/tests/view-source.test.cjs` 追加一条

**Interfaces:**
- Consumes: `CHAPTER_TUTORIALS`、`CHAPTER_NAMES`、`activate('tutorial:<n>')`
- Produces: 玩法说明屏 = 章列表，点一条 = watch 模式重放；`panelHeight` 随条目数变化

- [ ] **Step 1: 写源码断言**

```javascript
test('玩法说明不许再留写死的 6 行白话；条目必须由教学表驱动', () => {
  const src = fs.readFileSync(path.join(VIEW, 'GameRoot.ts'), 'utf8');
  assert.match(src, /CHAPTER_TUTORIALS\.filter/, '玩法条目必须由教学表生成（数据两处用）');
  assert.doesNotMatch(src, /'木块与空洞会截断滑轨/, '写死那 6 行必须被替掉');
});
```

这两条都要**先红后绿**：第二条用 `doesNotMatch` 断言一句现在还在源码里的白话，所以它现在必然红——不要把它换成一条"永远不会红"的正则。

- [ ] **Step 2: 替换 `renderHelp`**

```typescript
  /**
   * 玩法说明 = 章目录。点一条就地重放那段教学（watch 模式：全部自动演示、不要求动手、不挡输入）。
   *
   * 这里是「文字说明空洞」的永久解：玩家忘了清龙收什么，不用重推到章 12 再撞一次。
   * 条目由 CHAPTER_TUTORIALS 生成——第一阶段只有章 6 一条，就只列一条；
   * 后面每补一屏数据，这里自动多一行，不需要改视图代码。
   */
  private renderHelp(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w;
    const items = CHAPTER_TUTORIALS.filter((t) => !!tutorialFor(t.chapter));
    const oTitle = 44, oTop = 124, lstep = 92;
    const ph = oTop + items.length * lstep + 40 + 130;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 140, ph, 0, py - ph / 2);
    makeLabel(root, '玩法', {x: 0, y: py - oTitle, size: 42, color: palette.jadeDeep, align: 'center', bold: true, serif: true});
    items.forEach((t, i) => {
      const y = py - oTop - i * lstep;
      const n = makeNode(root, {w: W - 190, h: lstep - 14, x: 0, y: y - (lstep - 14) / 2, name: 'help:' + t.chapter});
      makeSprite(n, this.ui.frame('btn-cream'), W - 190, lstep - 14, 0, 0, true, this.ui.inset('btn-cream'));
      makeLabel(n, `第 ${t.chapter + 1} 章 · ${CHAPTER_NAMES[t.chapter] || t.title}`, {x: -(W - 190) / 2 + 26, y: 12, size: 26, color: palette.ink, align: 'left', bold: true});
      makeLabel(n, t.steps.map((s) => s.say).join(' ').slice(0, 30) + '…', {x: -(W - 190) / 2 + 26, y: -22, size: 20, color: palette.inkSoft, align: 'left'});
      bindPress(n, () => this.activate('tutorial:' + t.chapter));
    });
    if (!items.length) makeLabel(root, '这一版还没有可回看的章节教学。', {x: 0, y: py - oTop, size: 24, color: palette.inkSoft, align: 'center'});
    makeButton(root, this.ui, {x: 0, y: py - ph + 65, w: 340, h: 86, text: '知道了', style: 'jade', size: 30, onTap: () => this.activate('back-home')});
    this.animateIn();
  }
```

顶部 import 补 `CHAPTER_TUTORIALS`、`tutorialFor`（来自 `../core/tutorials`）。

「跳过」与 watch 完成后的回跳由 Task 4 的 `tutorial-close` → `this.tutFrom` 负责（不是 `dialogParent()`）；从玩法说明进教学再关掉，必须回到说明屏，这条要在 CDP 里验一次。

- [ ] **Step 3: 全链跑绿 + 看画面**

Run: `cd cocos && npm run check:cocos && npm run test`
CDP：`__mjTap('about')` → 截图 `docs/mockups/help-chapters.png`；再 `__mjTap('tutorial:5')` → 演完 → 确认回到说明屏而不是牌桌或大厅（这条正是 commit e82ec48「弹框回跳只认从哪一屏打开的」的延伸场景）。

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/view/GameRoot.ts cocos/tests/view-source.test.cjs docs/mockups
git commit -m "feat(tutorial): 玩法说明改成章目录，点一条重放该章教学——回看入口与首次教学共用一份数据"
```

---

### Task 6: 端到端验收（真机 + 显存读数）

**Files:**
- Modify: `docs/superpowers/specs/2026-10-18-chapter-tutorial-design.md`（在 §十 每条风险后面写实测结论）

- [ ] **Step 1: 从干净存档走一遍真实路径**

清掉本地存档后（CDP：`localStorage.clear()` + 重载），必须看到：开局是第 1 关 + 现有 `basic` 文字卡（章 1 还没有教学脚本，不许出现空白教学屏）→ 一路 `next` 打到第 81 关（章 6 首关）→ 进关**先弹章 6 教学**而不是文字卡 → 两步做完自动进牌桌 → 牌桌的步数/星级/进度条都是从 0 开始、没被教学吃掉一格。

Run（CDP）：
```javascript
__mj().model.moves      // 教学结束后必须仍是 0
__mj().model.levelIndex // 80
__mj().model.par        // 与 npm run export:table 的那一关参考解步数一致
```

- [ ] **Step 2: 限时关停表验一次**

`__mjTap('level:223')`（第 224 关，限时 74 秒）之后如果弹了教学，`__mj().model.timeLeft` 必须**冻结不动**；没弹则跳过这条并记下"该关没有教学"。这条防的就是 commit e82ec48 那一类"tip 挡不住走表"的回归。

- [ ] **Step 3: 微信开发者工具预览，读一次显存**

按既有流程走 wechatide 预览（上传要另行授权，这里只预览）。在 vConsole 执行 `__mjDiag()`，把教学屏打开前/后的 atlas 报告都抄下来，写进 spec §十：
- 「第二个 Board 实例不新烘纹理」这条推理成立与否；
- 教学屏的 draw call / 节点数增量；
- 鸿蒙那台之前黑屏的机型有没有异常。

- [ ] **Step 4: 打扰程度自评**

从头推章 1 → 章 6，记两条：这段教学你愿意看几遍（1 遍 / 愿意跳过）；跳过按钮的位置是否顺手。把结论写回 spec §十 最后一条，作为第二阶段铺 13 屏的输入。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-18-chapter-tutorial-design.md
git commit -m "docs(tutorial): 章 6 教学一屏的端到端验收结论（显存读数、停表、存档干净）"
```

---

## 第二阶段（不在本计划内，架构验过之后单独出）

`CHAPTER_TUTORIALS` 再补 13 条数据 + 每条过同一道门禁 + 逐张 CDP 截图。Task 1 的"每条脚本都自洽"那条测试会自动扫新条目，所以**第二阶段不需要改任何视图代码**。表结构、文案口径、锁/单向轨/冰/百搭的字面量写法都在 spec §三 那张 14 屏表里。
