# 机制首见引导 · 体验版解锁 · 按钮纯色实施计划

> **已被 2026-10-23 修订取代**：机制提示最终改为“每章首次进入弹一次章首弹框”，不再做真盘强制引导/小盘教学。
> 以 `docs/superpowers/specs/2026-10-23-mechanic-coach-trial-unlock-design.md` 第十一节为准；本计划保留作历史记录。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 体验版 14 章全可进；18 个机制首现在真实牌桌上强制走 1–3 步并高亮机制；开始/继续按钮改纯色无渐变。

**Architecture:** 选关门槛收进 `Session.canEnterChapter()`；新增 `core/coach.ts` 存机制文案与步数，`Session.coach` 用认证解 `solution[0]` 做目标动作，走对后现成 `apply()` 推进；视图复用牌桌横幅与 `Board` 高亮，不建第二块盘。按钮在 `art.ts` 增加 `flat` 画法。

**Tech Stack:** Cocos Creator 3.8.8（cc 原生 UI）、TypeScript core（无 cc，可 node 测试）、node:test、headless Chrome/CDP 截图。

**Spec:** `docs/superpowers/specs/2026-10-23-mechanic-coach-trial-unlock-design.md`

## Global Constraints

- 不改 `levels.ts` 的 map / seed / hash / faces / parMax；不改 `Generator` / `Rules`。
- 不加存档字段、不改 `version: 4`；引导进度写 `tipsSeen['coach:'+key]`。
- 引导永远可跳过；证书为空 / 任何步骤异常 → 退回 `TIP_CONTENT` 文字卡。
- 本轮不提交代码：工作树已有大量未提交改动，保留给用户验收。只新增/修改下列文件。
- 文案单行 ≤16 个汉字（横幅 `overflow = NONE`，超了会画到屏外）。

---

### Task 1: 体验版章节准入

**Files:**
- Modify: `cocos/assets/scripts/core/Session.ts`（`canEnterChapter`）
- Modify: `cocos/assets/scripts/view/GameRoot.ts:1141`（`gateBlocked`）
- Test: `cocos/tests/progression.test.cjs`

**Interfaces:**
- Produces: `Session.canEnterChapter(chapter:number):boolean`
- Consumes: `chapterStars` / `gateFor`（已在 Session 内）

- [ ] **Step 1: 写失败测试**

在 `tests/progression.test.cjs` 末尾加：

```js
test('体验版 unlockAll：任意章节/任意关都放行，但不推进 maxLevel', () => {
  const s = create();
  assert.equal(s.canEnterChapter(13), false, '正式版默认第 14 章锁着');
  s.unlockAll = true;
  assert.equal(s.canEnterChapter(13), true);
  assert.equal(s.canEnter(223), true);
  assert.equal(s.maxLevel, 0, '跳关不推进解锁进度');
  s.unlockAll = false;
  assert.equal(s.canEnterChapter(13), false);
  assert.equal(s.canEnter(223), false);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npm run build:core && node --test tests/progression.test.cjs`
Expected: FAIL，`s.canEnterChapter is not a function`。

- [ ] **Step 3: 实现**

`Session.ts` 在 `canEnter()` 前加：

```ts
canEnterChapter(chapter:number):boolean{
  if(this.unlockAll)return true;
  if(chapter<=0)return true;
  return this.chapterStars(chapter-1)>=gateFor(chapter-1);
}
canEnter(index:number):boolean{
  if(!Number.isInteger(index)||index<0||index>=LEVELS.length)return false;
  if(!this.canEnterChapter(chapterOf(index)))return false;
  return index<=this.maxLevel;
}
```

`GameRoot.ts:1141` 改成：

```ts
const gateBlocked = !this.session.canEnterChapter(ci);
```

- [ ] **Step 4: 跑测试与类型检查**

Run: `cd cocos && node --test tests/progression.test.cjs && npm run check:cocos`
Expected: PASS。

---

### Task 2: 按钮纯色

**Files:**
- Modify: `cocos/assets/scripts/view/art.ts:400-418`（`drawButton`）
- Modify: `cocos/assets/scripts/view/assets.ts:196-203`
- Verify: 首页 + 暂停菜单截图

**Interfaces:**
- Produces: `ButtonArtOpts.flat?: boolean`
- 颜色：主 `palette.jade` / 描边 `palette.jadeDeep`；次 `#FFFDF6` / 描边 `#D8B872`

- [ ] **Step 1: 改画法**

`art.ts` 的 `ButtonArtOpts` 加：

```ts
/** 纯色按钮：单色填充，不画渐变 / 高光 / 铆钉 */
flat?: boolean;
```

`drawButton()` 的填充改为：

```ts
rr(ctx, x, y, w, h * .9, r);
ctx.fillStyle = o.flat ? top : linear(ctx, x, y, x, y + h * .9, [[0, top], [1, bottom]]);
ctx.fill();
if (o.flat) {
  strokeRR(ctx, x, y, w, h * .9, r, o.stroke ?? edge, Math.max(1.5, h * .022));
  return;
}
```

（高光 / 铆钉分支保留在 `flat` 返回之后。）

- [ ] **Step 2: 改烘焙参数**

`assets.ts`：

```ts
const btn = (name: string, top: string, bottom: string, edge: string, stud: string, flat = false) =>
  put(name, 200, 100, (c, x, y, w, h) => drawButton(c, x, y, w, h, top, bottom, edge, h * .34,
    flat ? {flat: true, stroke: edge} : {studs: true, stud}), [40, 34, 40, 34]);
btn('btn-jade', palette.jade, palette.jade, palette.jadeDeep, palette.goldLight, true);
btn('btn-cream', '#FFFDF6', '#FFFDF6', '#D8B872', palette.gold, true);
btn('btn-gold', '#F5D27A', palette.gold, palette.goldDeep, palette.gold);
btn('btn-disabled', '#EFE8D6', '#EFE8D6', '#CBBE9E', '#CBBE9E', true);
```

- [ ] **Step 3: 截图验收**

构建 web-mobile 后（或等 Task 5 后统一构建）用 `temp/home-shots/capture.cjs`：

```bash
node temp/home-shots/capture.cjs temp/home-shots/home-flat.png '?screen=home'
node temp/home-shots/capture.cjs temp/home-shots/pause-flat.png '?screen=board&level=0' "...点击 icon:pause..."
```

Expected: 主按钮单一深绿、次按钮单一暖白；无顶部高光/铆钉；文字对比度正常。

---

### Task 3: Coach 数据与聚焦

**Files:**
- Create: `cocos/assets/scripts/core/coach.ts`
- Modify: `cocos/package.json`（`build:core` 加 `coach.ts`）
- Test: `cocos/tests/coach.test.cjs`（先建空文件，Task 4 填行为）

**Interfaces:**
- Produces: `CoachText`, `COACH_TEXT`, `coachFor(key)`, `coachSeenKey(key)`, `coachFocusCells(def, grid, key)`
- `CoachText`: `{key,title,say:string[],steps:1|2|3,bounce?:boolean,focus?:...}`

- [ ] **Step 1: 建数据文件**

按 spec 2.2 的表写 18 条（`basic` + 17 个，不含 `only258`）。至少保证：
`basic/stack/moveLimit/unlock/ice/bomb/ice2/flower/noSuit/only19/stack3/oneSuit = steps 1`；
`collect = 2`；`wild/goal = 3`；`lockRow/lockCol/oneWay = steps 1 + bounce: true`。
`only258` 不写。文案见 spec 3.2.1 与各机制现有 `TIP_CONTENT`，一句一行，≤16 汉字。

`coachFocusCells()` 用 `top` / `bare` / `hasIce` / `iceLayers` / `isWild` / `isBomb` / `suitOf`，按 spec 3.2.3 的 `focus` 取值返回格子：

```ts
export function coachFocusCells(def: LevelDef, grid: Grid, key: string): Pos[] {
  const t = coachFor(key); if (!t?.focus) return [];
  const out: Pos[] = [];
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!Array.isArray(cell) || !cell.length) return;
    const f = cell[cell.length - 1], p = {r, c};
    switch (t.focus) {
      case 'ice': if (hasIce(f)) out.push(p); break;
      case 'ice2': if (iceLayers(f) >= 2) out.push(p); break;
      case 'bomb': if (isBomb(f)) out.push(p); break;
      case 'wild': if (isWild(f)) out.push(p); break;
      case 'flower': if (/^f[1-8]$/.test(bare(f))) out.push(p); break;
      case 'stack': if (cell.length >= 2) out.push(p); break;
      case 'stack3': if (cell.length >= 3) out.push(p); break;
      case 'goal': {
        const g = def.goal; if (!g) break;
        if (g.kind === 'ice') { if (hasIce(f)) out.push(p); }
        else if (g.kind === 'face') { if (bare(f) === g.face) out.push(p); }
        else if ((g.faces || []).includes(bare(f))) out.push(p);
        break;
      }
      case 'collect': if ((def.goal?.faces || []).includes(bare(f))) out.push(p); break;
      case 'noSuit': if (suitOf(f) === def.dialect?.noSlideSuit) out.push(p); break;
    }
  }));
  return out;
}
```

- [ ] **Step 2: 加进编译链**

`package.json` 的 `build:core` 命令行加 `assets/scripts/core/coach.ts`。

- [ ] **Step 3: 编译并检查**

Run: `cd cocos && npm run build:core && node -e "const C=require('./.test/core/coach.js'); console.log(Object.keys(C.COACH_TEXT).length)"`
Expected: 输出 18。

---

### Task 4: Session.coach 状态机

**Files:**
- Modify: `cocos/assets/scripts/core/Session.ts`
- Test: `cocos/tests/coach.test.cjs`

**Interfaces:**
- Produces: `Session.coach`, `coachBounceRun()`, `coachAllowsSlide(run)`, `coachDragHint()`, `coachNote(text)`, `feed(action)`, `finishCoach(skipped)`
- Consumes: `COACH_TEXT` / `coachSeenKey` / `coachFor`

- [ ] **Step 1: 写测试**

`coach.test.cjs` 用 `new Session(1, memory)` + `s.reset(levelIndex)`，遍历 `COACH_TEXT`：

```js
for (const [key, text] of Object.entries(COACH_TEXT)) {
  const idx = LEVELS.findIndex((l) => l.intro === key);
  const s = new Session(1, mem()); s.reset(idx);
  assert.ok(s.coach, key + ' 应该起引导');
  assert.equal(s.coach.total, text.steps + (text.bounce ? 1 : 0));
  if (text.bounce) {
    const run = s.coachBounceRun(); assert.ok(run >= 0);
    assert.equal(s.slide(run, 1), true, '试错步必须被接受');
    assert.equal(s.coach.index, 1);
  }
  for (let i = 0; i < text.steps; i++) {
    const a = s.solution[0]; assert.ok(a);
    assert.equal(s.feed(a), true, key + ' 第 ' + (i + 1) + ' 步应被接受');
  }
  assert.equal(s.coach, null, key + ' 应结束');
  assert.equal(s.tipsSeen[key], true);
  assert.equal(s.tipsSeen['coach:' + key], true);
  // 剩余认证解仍能走完（目标关允许提前胡）
  for (let i = 0; i < 80 && s.modal !== 'win' && s.solution.length; i++) {
    assert.equal(s.feed(s.solution[0]), true, key + ' 剩余解断了');
  }
  assert.equal(s.modal, 'win', key + ' 引完必须仍可通关');
}
```

再加一条：`basic` 引导中喂一个错误动作，盘面不变、`coach.hint` 非空；`command('coach-skip')` 后 `coach===null`。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npm run build:core && node --test tests/coach.test.cjs`
Expected: FAIL，`s.coach` 不存在。

- [ ] **Step 3: 实现 Session**

按 spec 3.2.2 加字段与流程，关键点：

```ts
import {COACH_TEXT, CoachText, coachFor, coachSeenKey} from './coach';
export interface CoachState {text: CoachText; index: number; total: number; hint: string;}

coach: CoachState | null = null;
private introKey: string | null = null;

private maybeStartCoach(): void {
  const key = this.introKey;
  if (!key) return;
  const text = coachFor(key);
  if (!text || this.tipsSeen[coachSeenKey(key)] || this.solution.length < text.steps) {
    if (text && !this.tipsSeen[key]) this.tip = key;   // 证书不够 → 文字卡
    return;
  }
  this.coach = {text, index: 0, total: text.steps + (text.bounce ? 1 : 0), hint: ''};
  this.revision++;
}
```

`setupLevel()` 末尾的展示决策改为先算 `introKey = chosen===0&&!seen.basic ? 'basic' : (def.intro&&!seen[def.intro] ? def.intro : null)`；有章教学则 `tip=tutKey`，否则有 coach 数据且未 seen 则 `tip=null`（等 reset 起），否则 `tip=introKey`。`reset()` 在 `this.solution=deal.solution` 后调 `this.maybeStartCoach()`。`restore()` 置 `this.coach=null`。

动作入口：

```ts
slide(run:number,step:number):boolean{const a={kind:'slide',run,step};return this.coach?this.coachAct(a):this.apply(a);}
tap(p:Pos):boolean{
  if(this.coach)return this.coachTap(p);
  // 原逻辑；所有 return 改成返回 apply 结果或 false
}
feed(a:Action):boolean{return this.coach?this.coachAct(a):this.apply(a);}
command(id:string){if(this.coach){if(id==='coach-skip')this.finishCoach(true);else if(['hint','shuffle','undo'].includes(id)){this.coachNote('先完成这一步。');return;} ...}}
```

`coachAct()`：试错步只接受 `coachBounceRun()`；正常步比较 `transition()` 结果盘面 `signature`，一致才 `apply()`；`coachAdvance()` 在 `apply` 后 index++。`finishCoach()` 写两个 `tipsSeen`、清 coach、save、revision++。`tick()` / `undo()` 加 `|| this.coach` 挡住。

- [ ] **Step 4: 跑测试**

Run: `cd cocos && node --test tests/coach.test.cjs`
Expected: 18 条全 PASS；若某关剩余解走不完，说明该机制不该取前缀步数，回到 spec 表改步数，不许放宽断言。

---

### Task 5: 牌桌 Coach 视图

**Files:**
- Modify: `cocos/assets/scripts/view/Board.ts`（`focusCells`）
- Modify: `cocos/assets/scripts/view/GameRoot.ts`
- Test: 截图 + `__mj()` 读数

**Interfaces:**
- Consumes: `Session.coach`, `coachBounceRun`, `coachAllowsSlide`, `coachDragHint`, `coachNote`, `feed`
- Produces: `__mj().coach`, `__mjCoach(action)`

- [ ] **Step 1: Board 聚焦框**

`BoardModel` 加可选 `focusCells?: Pos[]`；`drawHighlights()` 在 `hintCells` 前：

```ts
for (const p of model.focusCells || []) add(p, 'gold');
```

- [ ] **Step 2: 横幅**

`renderBoard()` 里：

```ts
const coach = S.coach;
const bannerText = this.drag ? this.dragLine()
  : coach ? (coach.hint || `${coach.text.title} · ${coach.text.say[Math.min(coach.index, coach.text.say.length - 1)]}${coach.total > 1 ? ` ${Math.min(coach.index + 1, coach.total)}/${coach.total}` : ''}`)
  : (S.message || '轻点配对 / 横竖拖动整段');
```

横幅右侧加文字链接“跳过 ›”：

```ts
if (coach) { const skip = makeNode(banner, {w: 84, h: 44, x: (W - 68) / 2 - 52, y: 0, name: 'coach-skip'});
  makeLabel(skip, '跳过 ›', {x: 42, y: 14, size: 22, color: palette.jadeDeep, align: 'right', bold: true});
  bindPress(skip, () => this.activate('coach-skip')); }
```

`activate` 加 `case 'coach-skip': this.session.command('coach-skip'); break;`。文本用 `clipText`（按 `textWidth` 截断加 `…`）保证不压按钮。

- [ ] **Step 3: 高亮与手势**

`hintCells()` / `hintAction()` 在 coach 非空时优先用 `coach` 的目标：
- 试错步：目标轨整条蓝框；`hintAction = null`；
- 正常步：`S.solution[0]` 的 slide/match 原样给 Board；
- `focusCells: this.focusCells()` 从 `coachFocusCells(levelAt(S.levelIndex), S.grid, S.coach.text.key)` 取。

`onMove` 在 `runAt` 之后：

```ts
if (this.session.coach && !this.session.coachAllowsSlide(run)) {
  p.blocked = true;
  this.session.coachNote(this.session.coachDragHint());
  return;
}
```

`runAt()` 允许 coach 的试错锁轨：`const allowLocked = this.session.coach ? this.session.coachBounceRun() : -1;`，循环里 `if (runLocked(r) && i !== allowLocked) continue;`。
`onUp` 对试错步：没有拖动时若 `press.coachRun != null`，用 `step = run.dir ? -run.dir : 1` 调 `session.slide`；否则按原逻辑，但把 `session.slide/tap` 的返回值用于是否 `afterAction()`。

- [ ] **Step 4: 取证**

`__mj()` 增加：

```ts
coach: this.session.coach ? {key: this.session.coach.text.key, total: this.session.coach.total,
  index: this.session.coach.index, hint: this.session.coach.hint} : null
```

加 `(globalThis as any).__mjCoach = (a:Action) => this.session.feed(a);`（与 `__mjTutHit` 同一用途）。

- [ ] **Step 5: 截图**

用 `temp/home-shots/capture.cjs` 清 `tipsSeen` 后逐张拍：
- `?level=0` 第 1 关 basic；
- `?level=48` 冰面；
- `?level=65` 野百搭第 2 步（用 `__mjCoach` 喂一步）；
- `?level=16` 锁行试错（`__mjCoach({kind:'slide',run:<锁轨>,step:1})`）；
- `?screen=home` / `?screen=board&level=0` 点击暂停后的纯色按钮。

Expected: 横幅不压“跳过”、金色聚焦框在机制牌上、蓝轨/箭头指向目标、跳过可点。

---

### Task 6: 全量验收

- [ ] `cd cocos && npm test` 全绿（含新增 `coach.test.cjs`）。
- [ ] `cd cocos && npm run check:cocos` 绿。
- [ ] `git diff --check` 干净。
- [ ] 真机自评：第 1 关手指推一步、第 49 关冰面高亮、第 17 关锁行试错、跳过按钮、引导后牌桌正常。
- [ ] 报告：改了哪些文件、测试数字、截图路径、未验项（真机手势、体验版实机章节）。

## Self-Review

- Spec 覆盖：体验版（Task 1）、18 机制（Task 3/4）、视图（Task 5）、按钮（Task 2）、降级/跳过（Task 4）、验收（Task 6）。
- 无占位：所有步骤给了具体路径、函数名、代码或命令。
- 类型一致：`CoachText` / `CoachState` / `coachFocusCells` / `coachAllowsSlide` / `feed` 在 Task 3/4/5 使用同一签名。
