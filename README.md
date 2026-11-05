# 快乐推麻对对消 · 微信小游戏（Cocos Creator 3.8）

绿玉庭院风格的牌类「推一推，碰个对」消除小游戏：相邻同牌点一下就消；按住一行横拖、一列竖拖，整段循环滑动，滑完自动连消。首页另有独立的**挑战模式**：整行/整列循环滑动，同线同牌自动消，盘面无尽、无步数失败。

界面**零美术资源**：背景、牌面、按钮、图标全部由代码画出来（`view/art.ts` + `view/garden.ts`），启动时烘焙成两张图集。**图标一律是线描矢量图，不使用 emoji**——emoji 的字形与配色由系统字体决定，在各平台不一致，且会直接破坏整套中式配色。

## 架构：一份核心代码，渲染全部交给引擎

```
cocos/                       Cocos Creator 3.8 工程（唯一产物）
  assets/scripts/core/       纯规则，不依赖 cc：Rules（滑动/配对/连消/提示搜索）、Generator（关卡+清台证书）、Session（评级/辅助/续局存档）、levels（224 关 / 14 章数据，每关钉死 seed + 盘面指纹）、Challenge/ChallengeSession（挑战模式：整线循环滑动 + 反向构造生成器 + 独立存档）
  assets/scripts/view/
    theme.ts                 设计令牌（色板 / 圆角 / 厚度 / 排版），不依赖 cc
    art.ts                   纯 Canvas2D 画法（牌面 / 卡片 / 按钮 / 星 / 锁 / 箭头 / 图标），不依赖 cc 与 DOM
    garden.ts                程序化庭院背景 + 首页木桌（整屏大图，烘焙成一张纹理）
    atlas.ts                 把离屏画布烘焙成 cc 的 SpriteFrame；平台差异只在这一层（wx.createCanvas / document.createElement）
    assets.ts                图集内容：牌图集（34 面，按格子尺寸烘焙）+ UI 图集（9 宫格 + 线描图标，一次性烘焙）
    widgets.ts               cc 原生控件装配：面板 / 按钮 / 匾额 / 文字 / 开关 / 星 / 高亮
    Board.ts                 牌桌：节点池 + 拖动预览 + 消除 tween
    GameRoot.ts              场景根：屏幕状态机 + 全局棋盘手势；唯一的引擎挂载点
  build-templates/wechatgame/ 只放启动页美术（background/logo/slogan.png），不放代码
  build-options/wechatgame.json 构建选项：模块清单 + 启动页底色 + 场景
  tests/                     node:test 用例
demo/                        早期 H5 demo（设计参考）
demo/h5/                     UI 定稿的可玩 H5 demo（复用同一套 core，Canvas2D 渲染）
```

**渲染全部交给引擎**：牌面与 UI 素材在启动时用 Canvas2D 烘焙进两张图集（牌 / UI），之后牌桌上一张牌就是 1 个 Sprite 四边形，整屏合批后只剩个位数 draw call。对比早期「每个图元一个 Graphics 现算贝塞尔」的实现（一张 9 筒 ≈ 6804 顶点、整桌 28 层 MeshBuffer），这是两个数量级的差别。

**`core` / `theme` / `art` 完全不依赖 `cc`**，可以在 Node 里单独测试；从 `atlas.ts` 往上才开始接触引擎。`GameRoot` 是唯一的挂载点：可点控件各自挂自己的 `TOUCH_END`（`widgets.bindPress`），**没有手工命中数组**；全局触摸只负责棋盘手势，且只对落在棋盘格上的触摸生效，两者互不重叠。

**视图层的坐标是「可见区单位」**，不是设计分辨率：宽度优先适配下宽度恒为 750，但**高度随屏幕比例变**（20:9 屏约 1623，不是 1334）。所以纵向位置一律相对 `this.size.h` 算，写死 `DESIGN_H` 会让画面缩在中间一条、上下各留空带；触摸坐标用 `getUILocation()` 时**只平移到中心、不能再按设计分辨率缩放**（它返回的已经是 UI 空间坐标）。

**挂了 `Sprite` 的节点必须给真实尺寸**：`makeNode` 默认 contentSize 是 0×0，而 Sprite 用 `SizeMode.CUSTOM` 时渲染尺寸就是 contentSize——节点建了、`spriteFrame` 也设了，画面上却一个像素都没有。`tests/view-source.test.cjs` 用源码扫描兜住这条。

**UI 图集必须 1 倍烘焙**（`new UiAtlas(1)`）。九宫格的 inset 有两个身份：UV 按**纹理像素**切（`sprite-frame.ts#_calculateSlicedUV` 里的 `rect.x + insetLeft`），顶点位置按**节点单位**算而且只缩不放（`assembler/sprite/sliced.ts#updateVertexData` 里的 `leftWidth * xScale`）。两者只在「纹理像素 : 设计单位 = 1:1」时一致——按 2 倍烘焙再把 inset 乘 2，UV 是对的，但**渲染出来的边框和圆角会变成设计值的 2 倍**，与 `demo/h5` 直接画出来的几何对不上。牌图集不切片，仍可 2 倍烘焙只赚清晰度。

**给 Label / Sprite 染色的字符串必须是 hex**：cc 的 `Color.fromHEX` 只认 `#RGB` / `#RRGGBB` / `#RRGGBBAA`，传 `rgba(...)` 会得到 `Number('0xrgba...')` = NaN → 全透明黑，文字直接看不见。`rgba()` 只允许出现在交给 Canvas2D 的绘制函数里。

## 开发

在仓库根目录执行：

```bash
cd cocos && npm ci && cd ..   # 首次，装 cocos 工程的依赖
npm test                      # = cd cocos && npm run test:all（规则 + 存档 + 源码扫描 + 压力审查 + 严格类型检查）
npm run demo                  # 浏览器里试玩：H5 demo，http://127.0.0.1:8090
npm run build:wechat          # = node cocos/tools/rebuild-watch.cjs，触发编辑器构建并校验产物
npm run verify                # 微信开发者工具模拟器截图取证
npm run verify:ui             # CDP 驱动 headless Chrome 打 web-mobile 包：弹框回跳 16 步 + 暂停弹框连拍验帧（要先 node cocos/temp/refresh-web.cjs 8477 出包）
```

Cocos 工程不再自带浏览器预览（`npm run preview` 随旧的 Canvas2D 视图层一并移除）：
看效果统一走 `demo/h5`，它复用同一套 `core` 与同一套设计稿；微信侧调试走
「开发者工具打开 `cocos/build/wechatgame`」。

### 编辑器预览（可以直接截图/自动化）

编辑器的预览本身就是一个本地 HTTP 服务：**`http://127.0.0.1:7456/`**（`netstat` 里 7456 的属主进程就是 `CocosCreator.exe`）。可以直接用浏览器打开它截图、点击，控制台也能读到游戏侧 `console.log`（含 `mark()` 打的启动阶段、`atlas-scene 750x1623` 这类信息）——比微信开发者工具好排查得多。直达某一屏：`?screen=board&level=11`。

⚠️ **编辑器不会监听外部进程对源文件的改动**（`touch`、原地追加都不触发重编译），改完代码要手动让它重新编译：

```bash
curl http://127.0.0.1:7456/asset-db/refresh      # → 200 success，等 1~2 秒再刷新预览页
```

判断预览跑的是不是最新代码：抓 `scripting/x/chunks/<hash>.js` grep 新代码里的特征字符串；**两次导航拿到同一个 chunk 哈希就说明没重编译**。

### H5 demo（看设计稿效果、给非技术同学试玩）

```bash
npm run demo:build      # 打包成单文件 demo/h5/index.html
npm run demo            # http://127.0.0.1:8090/ ，同时打印局域网地址（手机同 Wi-Fi 可开）
npm run demo:test       # Playwright 端到端：真实点击 / 拖动，45 项断言
```

复用 `cocos/assets/scripts/core`（规则 / 关卡 / 生成），只换了一层 Canvas2D 渲染，详见 `demo/h5/README.md`。

## 在 Cocos Creator 中挂载

1. Cocos Dashboard → 打开 `cocos/` 目录（Creator 3.8.x，首次打开会生成 `library/`、`temp/`，已被 gitignore）。
2. 场景 `assets/scenes/main.scene` 已提交且配置完毕：Canvas（UITransform 750×1334 + Widget 全屏对齐）→ 子节点 `Game`（UITransform 锚点 0.5/0.5 + `GameRoot` 组件，`seed` 填 0 表示每局随机）+ 子节点 `Camera`（UI 相机）。**GameRoot 必须挂在 Canvas 下**：Graphics/Label 等 UI 组件不在 Canvas 节点树里不会进入 2D 渲染管线（表现为纯色白屏）。
3. 项目设置 → 设计分辨率 750×1334，适配勾选「宽度优先」。
4. 设置启动场景（编辑器菜单里没有此项，在构建面板设置）：菜单 **项目 → 构建发布**，在「Included Scenes」里勾选 `assets/scenes/main.scene`，并将其拖到列表**第一位**——排最前的场景即「初始场景/启动场景」。

## 微信小游戏的构建与发布

- **构建不要走 `CocosCreator --build` CLI**：3.8.8 的 CLI 会丢弃 `build-options` 里的配置。正确通道是项目内置扩展 `extensions/auto-build`：`npm run build:wechat` 会向 `temp/auto-build/trigger.json` 写入 `{id, options}`（options 直接取 `build-options/wechatgame.json`），扩展调用 builder 的 `add-task` 执行构建，等同构建面板点「构建」。新机器首次需在「扩展管理器」里启用 auto-build 一次。
- **产物**：`cocos/build/wechatgame`，用微信开发者工具打开这个目录。构建脚本会校验主包体积（上限 4MB）并打印引擎是否被分离。
- **模块清单**在 `build-options/wechatgame.json`：默认开着 `base / gfx-webgl(2) / 2d / ui / graphics / affine-transform / tween / animation / audio / particle-2d / intersection-2d / mask / rich-text / ui-skew / profiler / custom-pipeline`，关着 3D、物理、Spine、DragonBones、terrain、tiled-map、video、webview、websocket。**要加新能力（Spine 角色、物理、3D）就把它打开**；打开后主包可能超过 4MB，那时要走**微信「引擎插件」**（引擎由平台作为共享插件下发，不计入代码包，7.0.7+）或把资源放分包——小游戏主包上限 4MB、**单个分包不限制大小**、代码包总大小上限 30MB。
- **启动页**：`build-templates/wechatgame/` 里放 `first-screen.js` + `splash-logo.png`(280×400) + `splash-slogan.png`(904×128)。
  `first-screen.js` 是**从官方构建产物逐字复制、只改三处常量**：背景色由引擎默认的近黑 `#04090A` 改成纸色 `#F1EBDD`（这是"启动页像黑屏"的直接原因），标题/副标题改读 `splash-logo.png` / `splash-slogan.png`（否则会被构建器用官方 logo 覆盖）。
  **`game.js` 绝对不要覆盖** —— 上一轮就是自定义 game.js 把启动页的 `end()` 挪到首帧之后，污染了引擎的 GL 状态缓存（详见下节第 4 条）。
  ⚠️ `overwriteProjectSettings.splashScreen` 和项目设置 `general.splashScreen` 都会被构建器忽略，启动页底色只能这样改。改完官方模板升级时，要重新从 `build/wechatgame/first-screen.js` 复制一份再改常量。
  ⚠️ 官方模板把 slogan 放在「logo 高度的 56.5%」处，所以 `splash-logo.png` 的内容必须收在上半部（约 y<230），否则标题会和 slogan 叠在一起。
- **发布**：体验版走 miniprogram-ci 无人值守通道 `node cocos/tools/upload-ci.cjs <version> [desc]`。密钥按 `--key <路径>` > 环境变量 `WX_PRIVATE_KEY_PATH` > `cocos/.secrets/private.*.key` 的顺序找（`*.key`、`.secrets/` 已在 `.gitignore` 里，**绝不入库**）。上传前会校验 `build/wechatgame/.mj-build-stamp.json` 构建戳（由 `rebuild-watch` 落盘）：产物不新鲜、体积/文件数与戳不符、或主包超 4MB 都会直接中止，确实要传就加 `--force`。不要用 wechatide 的 upload——它走界面通道，每次要人工点确认；wechatide 只用于预览、模拟器截图、控制台等自动化。
- 截图取证：`npm run verify`（`cocos/tools/devtools-verify.cjs`，可用 `MJ_PROJECT` 覆盖项目路径）。
- 真机读不到 console，所以 `GameRoot.onLoad` 把每一步写进 `globalThis.__mjBoot.stages`，出错时用 `wx.showModal` 把阶段和 `BOOT.macro` 摆到屏幕上，截图即可定位。

## 规则与交互要点

- 224 关 / 14 章：前 5 章教基础机制（障碍、叠层、锁轨、单向轨、连锁、冰系、目标与财神），第 6 章起进入麻将方言——将将胡（只有 2、5、8 能配）、断门（一门只能点消）、幺九（1、9 + 字牌）、清一色，再往后是集组目标（八花齐、三元齐、清龙）。方言关里配不上的牌是哑弹，**只剩哑弹也算通关**（通关判据是 `liveCount`，不是 `count`）。
- 关卡是固定谜题：每关钉死 `seed` 与盘面指纹 `hash`，重开看到同一盘；内容全部由 `npm run author:levels` 在构建期生成并验证，运行时不再"碰运气发牌"。
- 限步与限时都是**关卡属性**（不是模式）：限时关切后台停表，剩余秒数进存档。
- 打开就是牌桌，直接接着上一盘打（大厅保留，从牌桌左键的「对局菜单」进）。牌桌顶栏：**左＝对局菜单**（继续游戏 / 重新开始 / 返回首页 / 选择关卡），**右＝设置**（音效、背景音乐、震动、玩法说明）。
- 选关**一章一屏 4×4**（14 屏），带章名、页码、图例与总星数；未解锁的关画成灰卡但不给点。原来单独的「我的进度」弹框已并入这里。大厅左上角显示当前关与累计星数（★ n / 672）。通关最后一关不会循环回第一关，可以重玩冲星。
- 只能上下左右相邻配对；木块 `#`、空洞会截断滑轨，锁轨不能滑动。
- 点消、滑动各计一步；一次滑动的全部连消只计一步。限步与限时只在带该属性的关卡生效（138 关限步、24 关限时），其余关仍无倒计时、无强制步数失败；三星目标来自本局已验证的清台路线（不是最短步数的承诺）。
- 目标步数内、不用提示/洗牌清台得三星；目标的 1.5 倍步数内清台得两星，否则一星。辅助最多两星，撤销不限且不退还辅助次数。
- 每局 3 次免费提示、2 次免费洗牌；重复查看当前提示不扣次数，未找到提示不扣次数。重开重置限额，不接入广告。
- 拖动时按整格预览，显示方向和格数，并高亮「松手就会消」的牌；每过一格轻震一次；取消拖动不提交操作，多指触摸不抢占当前手势。
- 锁轨/木块方向上拖不动时不会偷偷换轴，而是提示并震动。
- 一次滑动及其全部连消算一步，撤销整体回退；提示区分「找到 / 搜索预算用完 / 确实死局」。
- **挑战模式**（首页第二排右按钮）：照砖了个砖做的独立玩法——**整行 / 整列循环滑动**（空格也一起走），两块同牌在同一行/列且中间没有别的牌就自动消除；**只允许会产生消除的滑动**。牌局在运行时生成，用的是**反向构造**：从空盘一次加一对牌，再验证「把这条线滑回去正好只消掉这一对、别的牌一张没动」，所以证书必定成立、不需要现场搜索。50 盘到顶：**第 1 盘 5×5 上手**，**从第 2 盘起直接就是 14 行 × 10 列大盘**（84 张），之后盘面尺寸不变、只涨占用率到约 **116 张（83% 满）** 和牌种——再加到 140 张全满时反向构造会在最后十几对卡住（实测），所以后期收在 58 对。牌面每盘现场随机生成，同一关重进也换一副。每盘 3 次提示、2 次洗牌；走死会免费重排；没有步数/时间失败。进度存在独立键 `majiang-xiaoxiao:challenge:v1`，不动主线 224 关。取证入口：`?screen=challenge&clevel=50` 直接开后期大盘。
- 关卡由生成器用真实规则重放验证可清台，优先选择初始直接对子较少的牌局；洗牌保持剩余牌面不变。
- 同一个存储键兼容旧版进度，新版保存当前棋盘、步数与辅助次数；损坏存档回退到安全开局。跨启动不保存撤销历史。

## 校验

`cd cocos && npm run test:all`（或根目录 `npm test`）覆盖：224 关每关都能由真实转换清台（方言关按 `liveCount` 判）、关卡两两不同、**每关 seed+hash 与当前引擎自洽（内容冻结的判据）**、章节结构与花色曲线不退坡、方言配额（纯方言章 ≥12/16、混合章 ≥8/16 真带方言，哑弹 ≤55%、有效面 ≥3 种）、限时由参考解推出（每步 1.8-3.6 秒）、**目标关的目标牌面一定上盘且本关给得出的量 ≥1**、**限步关抽样种子的参考解都进得了步数上限**、**牌面清单只留 core 一份**（视图不许再抄）、洗牌守恒且**百搭造成的奇数张照样能存档与重排**、辅助限额与重复查看不扣次、三星评级、续局存档与损坏存档安全回退、弹窗来源记忆、关卡分页与终关不循环，以及两条**源码扫描**（Node 测试发现不了、只有产物才发作的坑）——**禁止数组字面量展开**（构建器会把它转译成 `[].concat`）与**挂 Sprite 的节点必须带尺寸**（否则渲染尺寸 0×0，画面上什么都没有）。`npm run check:cocos` 是严格 TypeScript 检查（含 `GameRoot`）。另有 `npm run test:stress`（已并入 `test:all`：全表按钉死种子出关 + 方言证书重放、中途盘面提示不误报死局、洗牌守恒、消除过程牌数只减不增）与 `npm run export:table`（把逐关数据导成 `docs/关卡全量表.md`，文档不手抄）。挑战模式另有一组单测（`tests/challenge.test.cjs`）：同线隔空配对、整段推动、无效移动拒绝、50 盘证书重放（第 2 盘起都是 14×10）、重进同一关换牌、洗牌守恒、存档恢复与提示/洗牌次数。当前项目没有独立 lint 配置。

## 模拟器排障流程（微信开发者工具）

只在微信运行时出现的问题（启动黑屏、文字错乱、触摸无响应），不要靠编辑器里猜，按下面的取证链路走：

```bash
node cocos/tools/devtools-verify.cjs --clean --reopen --wait 110   # 清缓存→重开窗口→等启动→截图
```

产物落在 `cocos/temp/`：`sim-*.png`（模拟器画面）、`devwin-*.png`（工具窗口）、`*.ocr.txt`（OCR 文本）。

`cocos/tools/wxide.cjs` 把参数原样透传给开发者工具的 skill CLI（`debug_clear_cache` / `simulator_refresh` / `simulator_screenshot` / `open_project_window` …）。**不要直接调 `wechatide.cmd`**：Node 无 shell spawn 时不会给路径加引号，会报 `'D:\Program' 不是内部或外部命令`。

本机 devtools 2.02.2608040 实测的通道状态：

| 通道 | 状态 |
|------|------|
| skill CLI（清缓存/刷新/截图/开窗） | 可用，但会间接调 `reg.exe`，可能被安全策略拦（报 `PROGRAM BLOCKED BY SECURITY POLICY`） |
| `get_simulator_console` | **读不到游戏侧 `console.log`**（`grep -n .` 也只回基础库那几行）→ 游戏自查只能靠 `wx.showModal`（弹窗会出现在截图里）或画布上的自绘错误页 |
| CLI 的点击类工具 | **没有**（只有 screenshot/reload/refresh/open_page/console/network/clear_cache）→ **无法自动点进牌桌截图**，牌桌只能靠编辑器预览或真机确认 |
| `tools/devtools-window.ps1` | 可能报 `spawnSync powershell EBUSY`（沙箱限制） |

## Cocos 微信渲染链路的六条硬约束（改构建配置 / 启动页前必读）

这六条都是本项目实测踩出来的。**`build-templates/wechatgame/` 里只允许出现「官方产物 + 常量改动」的 `first-screen.js`，以及图片；`game.js` 一律不覆盖。**

1. **上下文类型**：一张画布只能有一种上下文。启动页必须先按 `useWebgl2` 试 `getContext('webgl2')`，失败才退 `webgl`。先用 WebGL1 会让引擎永远退回 WebGL1 老路径（「文字全变同一段/糊字、画面残缺」）。官方模板已经处理好了，别自己写。
2. **给引擎的标记**：建好上下文后官方模板会写 `window.WebGL2RenderingContext = true/false`。漏写、画布上又是 webgl2 上下文时，引擎会去要 `webgl`(1)，`getContext` 返回 null，抛 `Cannot read properties of null (reading 'getExtension')`。
3. **离屏画布**：自定义启动页画标题必须用 `wx.createOffscreenCanvas({type:'2d'})`，**绝不能用 `wx.createCanvas()`**——小游戏里第一次 `wx.createCanvas()` 返回主屏 canvas，改尺寸并请求 2d 上下文会让主画布的 WebGL 上下文失效。官方模板是直接 `new Image()` 加载 `logo.png`，更省事。
4. **启动页收尾顺序必须是 `init → end → start`**（官方 `game.ejs:66-68` 就是这个顺序）：`first-screen.js` 的 `end()` 会 `useProgram(null)` / `bindBuffer(ARRAY_BUFFER, null)` / `bindTexture(null)`，而引擎的 `WebGLDevice` 自带 GL 状态缓存（`glArrayBuffer`）。**引擎跑过一帧之后再解绑，缓存就和真实绑定脱节**——下一帧引擎按缓存认为「顶点缓冲还绑着」，`bufferSubData` 打在空绑定上，报 `bufferSubData: no buffer` + `0x502 Vertex buffer is not big enough for the draw call`。顶点数据永远传不上去：牌面挤成一列、最后绘制的文字（如「设置」）丢失、每帧报错把帧率拖死。**这就是不要覆盖 `game.js` 的原因。**
5. **顶点缓冲按块分配，别再用 Graphics 堆图元**：`MeshBuffer` 构造时就 `_allocateBuffer()`，一次按 `macro.BATCHER2D_MEM_INCREMENT` 分配满一整块 → **每个 `Graphics` 组件独占一份顶点缓冲**（一张 9 筒 ≈ 6804 顶点）。旧实现不得不按顶点预算手工分层（`LAYER_VERTS = 6500` 配 `macro = 256`，两者必须成对改），第 18 关曾切出 155 层 ≈ 178MB 显存把驱动干崩。**现视图层已彻底改成「启动时把牌面与 UI 烘焙成两张图集 + Sprite 合批」，一张牌只占 1 个四边形、全屏只剩个位数 draw call，`Graphics` 已不再使用。** 若日后要重新引入大量 Graphics，必须重新按顶点预算估显存。
6. **构建配置**：`gfx-webgl2` 要同时出现在顶层 `includeModules` 数组与 `overwriteProjectSettings.includeModules` 的 `"on"`（否则编辑器保存的构建任务 `profiles/v2/packages/builder.json` 会盖掉）；改完模块清单要清 `%LOCALAPPDATA%/Temp/CocosCreator/3.8.8/builder/engine` 再构建（引擎缓存按 options 哈希复用，命中缓存时改动不生效）。另外 `extensions/auto-build` 有竞态：如果扩展恰好在 `trigger.json` 写完之后才重新加载，`fs.watch` 收不到事件，构建永远不会启动（表现为 `npm run build:wechat` 十分钟超时）——删掉 `temp/auto-build/trigger.json` 再重跑。

## 已知环境问题

1. **微信开发者工具的编译+启动很慢**（本机 Intel Arc 140T 上 ANGLE/D3D11 编译着色器要几十秒到几分钟，历史记录 20~82s 甚至 2 分钟以上）。这是**工具侧**开销，真机快得多。引擎版在这段时间画布会停在启动页 —— 所以启动页底色必须是纸色（`build-options` 里 `splashScreen.background.color` 设成 `#F1EBDD`，并覆盖 `background.png`），否则用户看到的就是「黑屏十几秒」。
2. **主包上限 4MB**：当前模块清单约 1.9MB，安全。要加 Spine / 物理 / 3D 时主包可能超限，那时走**微信「引擎插件」**（引擎由平台作为共享插件下发，不计入代码包，7.0.7+，需在公众平台后台添加对应版本）或把资源放分包 —— 小游戏主包 4MB、**单个分包不限制大小**、代码包总大小上限 30MB。
3. **Label 不要用 `CacheMode.BITMAP`**：文字/字号/字体变了，缓存命中会拿到别的字号字体的字形。`widgets.makeLabel` 统一用 `CacheMode.NONE`，并且**先设 `fontSize` / `fontFamily` 再设 `string`**，否则会按旧字号先排一次。
4. **微信小游戏画布在第一帧绘制前是黑的**，这是平台行为。所以启动页要尽早画出来（官方模板 `start()` 之后立刻进入绘制循环），且底色用纸色。

**验证面**：日常迭代用 `npm test`（规则 / 存档 / 源码扫描 / 严格类型检查）+ `npm run demo`（浏览器里玩 H5 demo，同一套 core 与设计稿）；微信侧 `npm run build:wechat` + 开发者工具打开 `cocos/build/wechatgame` + `npm run verify` 截图取证；验收用真机调试或体验版 `npm run upload:ci -- <version>`。

