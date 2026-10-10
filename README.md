# 麻将小茶馆 · 微信小游戏（Cocos Creator 3.8）

卡通偏实物风格的麻将「推一推，碰个对」消除小游戏：相邻同牌点一下就消；按住一行横拖、一列竖拖，整段循环滑动，滑完自动连消。

## 目录

```
cocos/                       Cocos Creator 3.8 工程（package.json 里的 creator.version）
  assets/scripts/core/       纯规则：Rules（滑动/配对/连消/提示搜索）、Generator（18关+清台证书）、Session（评级/辅助/续局存档）
  assets/scripts/view/       纯视图：Drawing（绘图指令）、GameView（render/hitTest/cellAt）、Input（拖动/点击控制器）
  assets/scripts/cocos/      GameRoot.ts：把 Frame 画到 Graphics + Label，接触摸、wx 存档/震动/分享
  build-templates/wechatgame/ 构建时覆盖模板：first-screen.js 茶馆风启动页
  preview/                   浏览器预览（同一套 core/view，Canvas2D 绘制）
  tests/                     node:test 用例
demo/                        早期 H5 demo（设计参考）
```

core / view 不依赖 `cc`，可以在 Node 里测试；只有 `cocos/GameRoot.ts` 依赖引擎。

## 开发

```bash
cd cocos
npm ci
npm run test:all     # 规则 + 视图 + 交互测试，并用 @cocos/creator-types 对 GameRoot 做类型检查
npm run preview      # http://127.0.0.1:8080 ，可加 ?level=0..17&seed=7（直接进入指定牌桌）
```

## 在 Cocos Creator 中挂载

1. Cocos Dashboard → 打开 `cocos/` 目录（Creator 3.8.x，首次打开会生成 `library/`、`temp/`，已被 gitignore）。
2. 场景 `assets/scenes/main.scene` 已提交且配置完毕：Canvas（UITransform 750×1334 + Widget 全屏对齐）→ 子节点 `Game`（UITransform 锚点 0.5/0.5 + `GameRoot` 组件，`seed` 填 0 表示每局随机）+ 子节点 `Camera`（UI 相机）。**GameRoot 必须挂在 Canvas 下**：Graphics/Label 等 UI 组件不在 Canvas 节点树里不会进入 2D 渲染管线（表现为纯色白屏）。
3. 项目设置 → 设计分辨率 750×1334，适配勾选「宽度优先」。
4. 设置启动场景（编辑器菜单里没有此项，在构建面板设置）：菜单 **项目 → 构建发布**，在「Included Scenes」里勾选 `assets/scenes/main.scene`，并将其拖到列表**第一位**——排最前的场景即「初始场景/启动场景」。之后编辑器内点 Play 会从当前打开的场景运行；构建产物则固定从列表第一位启动。
5. 构建发布 → 平台选「微信小游戏」，填 AppID，竖屏；用微信开发者工具打开 `build/wechatgame`。

## 包体与启动页

- 微信小游戏主包上限 4MB。引擎功能裁剪清单固化在 **`build-options/wechatgame.json`**（入库，含 `includeModules` 最小集：base/gfx-webgl/2d/graphics/ui/affine-transform/tween/custom-pipeline(-builtin-scripts) 与逐项 `off` 的裁剪映射）。裁剪后主包约 1.7MB。
- **构建不要走 `CocosCreator --build` CLI**：3.8.8 的 CLI 会丢弃裁剪配置，构建出完整引擎（>4MB）。正确通道是项目内置扩展 `extensions/auto-build`：编辑器打开本项目时，向 `temp/auto-build/trigger.json` 写入 `{id, options}`（options 直接取 `build-options/wechatgame.json`），扩展会调用 builder 的 `add-task` 消息执行构建（等同构建面板点「构建」）。新机器首次需在「扩展管理器」里启用 auto-build 一次。
- 启动页是微信小游戏的 first-screen 画布（不是小程序的 splash 配置）：`build-templates/wechatgame/first-screen.js` 会在构建时覆盖模板默认实现，绘制茶馆配色标题页 + 加载进度条；构建选项里 `useSplashScreen` 需保持开启，否则 game.js 不会调用 first-screen。
- 上传体验版走 **miniprogram-ci 无人值守通道**：`node tools/upload-ci.cjs <version> [desc]`（密钥在 `E:\Download\private.wx3d895529df5ec250.key`，不入库）。不要用 wechatide 的 upload——它走开发者工具界面通道，每次要人工点确认。wechatide 只用于预览、模拟器截图、控制台等自动化。

GameRoot 会按 `Frame` 自动分层（只有图形压到文字上时才新开一个 Graphics 层），所有节点复用对象池，只在状态变化或动画进行时重绘。

## 规则与交互要点

- 三章 18 关，不靠堆关数：茶馆初学（1–6）、庭院进阶（7–12）、掌柜试炼（13–18）。棋盘从 4×3 扩展为 4×4、6×4、6×5、6×6、8×6、8×7；后期加入双层/三层叠牌、分段轨道和横纵锁轨组合。
- 首页继续上次牌桌；章节地图逐关解锁，显示历史最佳星级。通关最后一关不会循环回第一关，可以重玩冲星。
- 只能上下左右相邻配对；木块 `#`、空洞会截断滑轨，锁轨不能滑动。
- 点消、滑动各计一步；一次滑动的全部连消只计一步。无倒计时、无强制步数失败，三星目标来自本局已验证的清台路线（不是最短步数的承诺）。
- 目标步数内、不用提示/洗牌清台得三星；目标的 1.5 倍步数内清台得两星，否则一星。辅助最多两星，撤销不限且不退还辅助次数。
- 每局 3 次免费提示、2 次免费洗牌；重复查看当前提示不扣次数，未找到提示不扣次数。重开重置限额，不接入广告。
- 拖动时按整格预览，显示方向和格数，并高亮「松手就会消」的牌；每过一格轻震一次；取消拖动不提交操作，多指触摸不抢占当前手势。
- 锁轨/木块方向上拖不动时不会偷偷换轴，而是提示并震动。
- 一次滑动及其全部连消算一步，撤销整体回退；提示区分「找到 / 搜索预算用完 / 确实死局」。
- 关卡由生成器用真实规则重放验证可清台，优先选择初始直接对子较少的牌局；洗牌保持剩余牌面不变。
- 同一个存储键兼容旧版进度，新版保存当前棋盘、步数与辅助次数；损坏存档回退到安全开局。跨启动不保存撤销历史。

## 校验

`npm run test:all` 覆盖 18 关多种子清台路线、洗牌守恒、辅助限额、三星评级、旧存档迁移、续局、章节分页、多屏幕几何和手势取消；`npm run check:cocos` 是严格 TypeScript 检查。当前项目没有独立 lint 配置。Windows 使用 `npm.cmd` 即可。
