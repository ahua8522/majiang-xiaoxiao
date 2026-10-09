# 麻将小茶馆 · 微信小游戏（Cocos Creator 3.8）

卡通偏实物风格的麻将「推一推，碰个对」消除小游戏：相邻同牌点一下就消；按住一行横拖、一列竖拖，整段循环滑动，滑完自动连消。

## 目录

```
cocos/                       Cocos Creator 3.8 工程（package.json 里的 creator.version）
  assets/scripts/core/       纯规则：Rules（滑动/配对/连消/提示搜索）、Generator（可解关卡+证书）、Session（撤销/洗牌/存档）
  assets/scripts/view/       纯视图：Drawing（绘图指令）、GameView（render/hitTest/cellAt）、Input（拖动/点击控制器）
  assets/scripts/cocos/      GameRoot.ts：把 Frame 画到 Graphics + Label，接触摸、wx 存档/震动/分享
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
npm run preview      # http://127.0.0.1:8080 ，可加 ?level=0..4&seed=7
```

## 在 Cocos Creator 中挂载

1. Cocos Dashboard → 打开 `cocos/` 目录（Creator 3.8.x，首次打开会生成 `library/`、`temp/`，已被 gitignore）。
2. 新建场景 `assets/scenes/main.scene`，在 Canvas 下新建空节点 `Game`（UITransform 锚点 0.5/0.5，位置 0,0）。
3. 给 `Game` 添加组件 `GameRoot`；`seed` 填 0 表示每局随机。
4. 项目设置 → 设计分辨率 750×1334，适配「宽度优先」；把 `main.scene` 设为启动场景。
5. 构建发布 → 平台选「微信小游戏」，填 AppID，竖屏；用微信开发者工具打开 `build/wechatgame`。

GameRoot 会按 `Frame` 自动分层（只有图形压到文字上时才新开一个 Graphics 层），所有节点复用对象池，只在状态变化或动画进行时重绘。

## 规则与交互要点

- 只能上下左右相邻配对；木块 `#`、空洞会截断滑轨，锁轨不能滑动。
- 拖动时按整格预览，并高亮「松手就会消」的牌；每过一格轻震一次。
- 锁轨/木块方向上拖不动时不会偷偷换轴，而是提示并震动。
- 一次滑动及其全部连消算一步，撤销整体回退；提示区分「找到 / 搜索预算用完 / 确实死局」。
- 关卡由生成器用真实规则重放验证可清台；洗牌保持剩余牌面不变。
