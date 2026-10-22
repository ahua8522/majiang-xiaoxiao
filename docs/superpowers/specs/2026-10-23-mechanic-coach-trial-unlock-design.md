# 机制首见引导 · 体验版解锁 · 按钮纯色设计

日期：2026-10-23 · 分支：`feat/levels-224` · 状态：待实施
拍板人：wanqinghua（载体=真关卡盘面 / 强度=强制开局 1–3 步 + 高亮 / 可跳过 / 按钮纯色无渐变）

## 一、目标

1. **体验版所有关卡可进**：`envVersion === 'trial' | 'develop'` 时，选关页 14 章全部可点。
2. **机制首现不再只弹文字卡**：首次遇到机制时，在真实牌桌上强制走完 1–3 步，盘面高亮该机制，做对才放开；保留“跳过”与文字卡降级。
3. **开始/继续一类按钮改纯色**：去掉渐变、高光、铆钉，保留圆角、描边、实心厚度与按下缩放。

## 二、现状与证据

### 2.1 体验版解锁

- `Session.canEnter()` 已经认 `unlockAll`（`Session.ts:329-336`）。
- `Session.unlockAll` 由 `wx.getAccountInfoSync().miniProgram.envVersion` 设为 `trial` / `develop`（`GameRoot.ts:261-266`）。
- **真正挡住的是选关页**：`renderLevels()` 另算 `gateBlocked = ci > 0 && this.session.gateGap(ci - 1) > 0`（`GameRoot.ts:1141`），未看 `unlockAll`，于是体验版第 2 章起整页灰、卡片不挂点击。

### 2.2 机制首现

- 关卡表里 `intro` 共 19 个键，每个键只在首次出现的关赋值（`tools/author-levels.cjs:543` 的 `INTRO_RULES` + `:810-813`）。
- 今天这些键全部走 `TIP_CONTENT` 文字卡（`GameRoot.ts:39-61`）→ `renderTipCard()`（`GameRoot.ts:696-712`）。
- 章首小盘教学只落地了章 6“将将胡”一条（`tutorials.ts`），由 `tip` 非空挡住牌桌，优先于机制卡。
- 已在真实生成盘面上实测“首次能亲手触发机制的最短认证步数”：

| 机制键 | 首现关 | 强制步数（认证解前缀） | 说明 |
|---|---|---|---|
| basic | 1 | 1 | 第 1 关也改成动手 |
| stack | 12 | 1 | 消到叠牌 |
| lockRow | 17 | 试错 + 1 | 先推锁行（推不动），再走认证首步 |
| lockCol | 18 | 试错 + 1 | 同上，列方向 |
| moveLimit | 21 | 1 | 顶栏步数已在，走一步即讲清 |
| oneWay | 34 | 试错 + 1 | 先反推（推不动），再顺推 |
| unlock | 35 | 1 | 消一对，锁轨计数前进 |
| ice | 49 | 1 + 高亮 | 认证解第 7 步才碰冰，不硬推 |
| bomb | 53 | 1 + 高亮 | 认证解第 6 步才碰鞭炮，不硬推 |
| ice2 | 54 | 1 | 认证首步就碎厚冰 |
| flower | 65 | 1 + 高亮 | 认证解第 6 步才碰花牌，不硬推 |
| wild | 66 | 3 | 认证解第 3 步碰百搭 |
| goal | 67 | 3 | 认证解第 3 步推进目标 |
| only258 | 81 | 不做 | 章 6 小盘教学已覆盖，避免重复 |
| noSuit | 97 | 1 + 高亮 | 认证解不碰断门；不取自选动作 |
| only19 | 113 | 1 | 认证首步即可配 |
| stack3 | 119 | 1 + 高亮 | 认证解第 5 步才碰三层，不硬推 |
| oneSuit | 129 | 1 | 认证首步即可配 |
| collect | 145 | 2 | 认证解第 2 步推进集组 |

原则：**一律取认证解 `solution` 的前缀，不取自选“看起来能教”的动作**。自选动作可能把盘面带离可解路线，而 `certify` 不对外暴露，无法在运行时证明剩余盘面仍可解。引完仍在认证解上，后续一定走得通。

### 2.3 按钮

当前按钮由 `assets.ts:196-203` 调 `drawButton()` 烘焙：渐变填充 + 顶部高光 + 两端金铆钉（`art.ts:400-418`）。开始游戏、继续游戏、知道了都用 `btn-jade`；关卡选择、重新开始、返回首页等用 `btn-cream`。

## 三、方案

### 3.1 体验版全解锁

在 `Session` 增加：

```ts
canEnterChapter(chapter: number): boolean {
  if (this.unlockAll) return true;
  if (chapter <= 0) return true;
  return this.chapterStars(chapter - 1) >= gateFor(chapter - 1);
}
```

`renderLevels()` 的 `gateBlocked` 改为 `!this.session.canEnterChapter(ci)`；`canEnter()` 内部也复用它，消除两处手算。体验版第 2 章起不再灰页，卡片正常挂点击。`unlockAll` 不推进 `maxLevel` 的语义不变。

### 3.2 机制首见强制引导（真盘 Coach）

#### 3.2.1 数据

新增 `core/coach.ts`，纯数据 + 纯函数，不 import `'cc'`：

```ts
export interface CoachText {
  key: string;          // 与 LevelDef.intro 对齐
  title: string;        // 机制名，横幅左侧
  say: string[];        // 每一步一句，按 index 取，末句重复
  steps: 1 | 2 | 3;     // 认证解前缀步数
  bounce?: boolean;     // 先做一次“推不动”的试错
  focus?: 'ice' | 'ice2' | 'bomb' | 'wild' | 'flower' | 'stack' | 'stack3' | 'goal' | 'collect' | 'noSuit';
}
export const COACH_TEXT: Record<string, CoachText>;
export function coachFor(key: string): CoachText | null;
export function coachSeenKey(key: string): string;   // 'coach:' + key
```

`focus` 只决定盘面上哪些格子加金色聚焦框；不参与动作判定。`steps` / `bounce` 按 2.2 的表写死，`tests/coach.test.cjs` 逐关验证。

#### 3.2.2 Session 状态机

新增：

```ts
coach: {
  text: CoachText;
  index: number;     // 已完成步数
  total: number;     // steps + (bounce ? 1 : 0)
  hint: string;      // 做错时的短句，视图直接显示
} | null = null;
```

- **起点**：`setupLevel()` 仍按原优先级决定章教学 / 机制键；若选中的机制键有 `COACH_TEXT` 且 `tipsSeen['coach:'+key]` 未真，则先不设 `tip`，等 `reset()` 装好 `solution` 后调 `startCoach()`。
- **目标动作**：始终是 `this.solution[0]`。走对后现成的 `apply()` 会 `solution.shift()`，下一步自然前移，不需要另存脚本。
- **接受判据**：与 `apply()` 里提示的判据一致——把玩家动作与 `solution[0]` 各跑一次 `transition()`，比较结果盘面 `signature()`；一致才提交。反向推同一轨、点另一侧，只要盘面一样都算对。
- **试错步**：`lockRow` / `lockCol` 只接受目标锁轨上的滑动（结果必为 `changed:false`）；`oneWay` 只接受与 `dir` 相反的滑动。做完不推进 `solution`，只进入下一步。
- **拒绝**：不改盘面，只写 `coach.hint`（“按住亮起来的那一行再拖”/“点亮起的两张牌”/“反着推一下，看看推不推得动”），`revision++`。
- **tap 步**：引导期间点非高亮牌不自动配对、不改 `selected`；只允许点亮起的两张。
- **停表与封口**：`tick()` 增加 `|| this.coach`；`command()` 在 `coach` 非空时只认 `coach-skip`，提示/洗牌/撤销/重开全部不响应；`undo()` 也加 `|| this.coach` 兜底。
- **结束**：完成最后一步或点“跳过” → `finishCoach()`：写 `tipsSeen[key] = true`、`tipsSeen['coach:'+key] = true`，清空 `coach`，`save()`，`revision++`。旧机制键一并标 seen，之后不再弹文字卡。
- **降级**：`solution` 为空、`startCoach()` 抛异常、任一步 `transition` 对不上盘面 → 清空 `coach`、设 `tip = key`，退回今天的文字卡。跳过与降级都永远可用。
- **读档**：`restore()` 本来就把 `tip` 置空；同时把 `coach` 置空。引导只在“新开这一关”出现，读中盘不重放。

#### 3.2.3 视图

- **横幅**：复用牌桌顶部 62px 横幅（`GameRoot.ts:974-980`），不新增大面板。`coach` 非空时显示：
  - 左：`机制名 · 当步说明`，带 `1/3` 步数；
  - 右：小号“跳过”按钮，走 `activate('coach-skip')`；
  - 做错时同一行换成 `coach.hint`，用警示色。
- **高亮**：动作仍走现成的 `hintCells`（蓝轨）/`hintAction`（方向箭头 / 金色对子脉冲）；机制本身新增 `focusCells`（金色框）：
  - `ice` / `ice2`：所有带 `~` 的牌；
  - `bomb`：所有 `b*` 牌；
  - `wild`：所有带 `*` 的牌；
  - `flower`：所有 `f1..f8`；
  - `stack` / `stack3`：层数 ≥2 / ≥3 的格子；
  - `goal` / `collect`：目标牌面在盘上的格子；`goal.kind === 'ice'` 时聚焦冰牌；
  - `noSuit`：所有该门的牌；
  - 方言白名单（将将胡 / 幺九 / 清一色）不做全局金色框（会糊成一片），只靠蓝轨与横幅。
- **手势**：`coach` 要求滑动时，只允许从目标轨起手；要求点消时不开启拖动；试错步允许在目标锁轨/单向轨上拖。其余手势直接回一句 `coach.hint`，不产生拖动预览。
- **不遮盘面**：不新增全屏卡片、不挖遮罩洞、不建第二个 Board；牌桌完整可见。
- **取证**：`__mj()` 增加 `coach: {key, total, index, hint} | null`；增加 `__mjCoach(action)` 供 headless 喂动作（与 `__mjTutHit` 同一用途）。

#### 3.2.4 范围与边界

- 做 18 个机制键（19 减去 `only258`），第 1 关 `basic` 也算。
- 章 6 小盘教学保留原样；`dismissTip()` 处理章教学时同时写 `coach:only258`，避免之后某关又弹一次将将胡引导。
- 不改 `levels.ts` 的 map / seed / hash / faces / parMax，不改 `Generator` / `certify` / `Rules`。
- 不加存档字段、不改 `version: 4`；`coach:` 键复用 `tipsSeen`。

### 3.3 按钮纯色

- `drawButton()` 增加 `flat?: boolean`：为真时用单色填充，不画渐变、高光、铆钉；仍保留底部实心厚度与描边。
- `btn-jade`：实心 `palette.jade` #2E7D4F，描边 `palette.jadeDeep` #1C5B37，白字。
- `btn-cream`：实心 `#FFFDF6`，描边 `#D8B872`，深绿字 #3E5A3A。
- `btn-disabled`：实心 `#EFE8D6`，描边 `#CBBE9E`。
- `btn-gold` / `btn-dark` 不动：前者是奖励色，后者是牌桌工具条，不属于“开始/继续”这一族。
- 9 宫格尺寸与按下缩放不变；改的是烘焙画法，不涉及布局。

## 四、文件与测试

**改**：

- `cocos/assets/scripts/core/Session.ts`：`canEnterChapter`、coach 状态机、tick/command/undo/tap/slide、setupLevel/reset/restore/dismissTip。
- `cocos/assets/scripts/view/GameRoot.ts`：选关门槛、coach 横幅/跳过、focusCells、手势限制、`__mj` 取证。
- `cocos/assets/scripts/view/Board.ts`：`BoardModel.focusCells` + `drawHighlights` 金框。
- `cocos/assets/scripts/view/assets.ts` / `art.ts`：纯色按钮。
- `cocos/package.json`：`build:core` 加 `coach.ts`；`test` 加 `tests/coach.test.cjs`。

**新增**：

- `cocos/assets/scripts/core/coach.ts`
- `cocos/tests/coach.test.cjs`

**验收**：

1. `npm test`：`coach.test.cjs` 遍历 18 个键，生成真实盘面，逐键走完引导；断言步数、试错步 `changed:false`、最后一步命中该机制（有 `focus` 的键）、剩余 `solution` 仍能走完。
2. `progression.test.cjs` 增加 `unlockAll` 下 `canEnter` / `canEnterChapter` 全开。
3. `npm run check:cocos` 绿。
4. web-mobile + headless Chrome/CDP 逐张截图：第 1 关 basic 引导、冰面高亮、野百搭第 2 步、锁行试错、横幅“跳过”、纯色首页、纯色暂停菜单。
5. 真机自评：手势是否顺手、横幅文字是否溢出、跳过是否可点、引导后牌桌是否正常。CDP 推不动牌桌拖轨（`isMobile=false` 不发 TOKENS），这一段必须真机看。

## 五、风险

- **横幅一行放不下**：文案必须控制在 ~16 个汉字内；超了会画到屏幕外（`makeLabel` overflow = NONE）。截图逐张量。
- **强制手势与玩家直觉冲突**：只认目标轨，推错会回弹；回弹文案要短。真机自评，若普遍烦躁，优先缩短步数而不是加动画。
- **读档绕过引导**：`restore()` 不重放 coach；玩家杀进程可跳过。这是刻意接受的口子——引导不是门槛，且本来就有“跳过”。
- **`solution` 与盘面不同步**：只接受结果盘面一致的动作，和现有提示同一条判据；对不上直接降级文字卡，不硬演。
- **纯色按钮失去层次**：靠底部实心厚度与描边保留按压反馈；截图对比确认不与奶油面板糊在一起。
