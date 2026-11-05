# 麻将小游戏 · 重构实施计划

依赖顺序：core 收尾 → theme（已完成）→ 视图模块 → 装配 → 清理 → 文档。
每个任务都能独立验证：core 用 `node --test`，cc 代码用 `npm run check:cocos`。

---

## 阶段 0 · 已完成

- [x] **T0.1** 关卡数据体系：新增 `assets/scripts/core/levels.ts`（`LevelDef` + 100 关数据）
- [x] **T0.2** `Generator.ts` 改为消费 `LevelDef`（`construct(def, seed, tokens)`）
- [x] **T0.3** `Session.ts` 去掉 `levelName` / `chapter` / `levelNames`，`difficulty` 改为按序号推导，页大小抽成 `PAGE_SIZE`
- [x] **T0.4** `tools/author-levels.cjs`：生成 100 关并逐关验证（可清台 / 偶奇等量 / 完美匹配 / 机制齐备 / 两两不同）
- [x] **T0.5** `theme.ts`：方案 A「糖果卡通」设计令牌
- [x] **T0.6** 测试改造，`node --test` 24/24 通过

---

## 阶段 1 · core 收尾

- [ ] **T1.1** `Session.ts` 暴露 `returnModal` 只读属性，供视图决定弹窗底图画哪一屏
  - 验证：`node --test tests/session.test.cjs`
- [ ] **T1.2** 新增测试：从首页打开设置时 `returnModal==='home'`；从牌桌打开时为 `'none'`
  - 验证：新用例通过

## 阶段 2 · 视图模块（可并行）

- [ ] **T2.1** `view/TileArt.ts`：牌面绘制
  - 导出 `createTile(parent, face, w, h): Node`；牌身按 `theme.depth.tile` 画实心投影
  - 牌背用 `suitColor(face)`，牌面按花色画（筒 = 圆点阵 / 条 = 竖条 / 万 = 数字 + 萬 / 字 = 汉字）
  - 导出 `setFace(node, face)` 支持节点复用
  - 验证：`npm run check:cocos`
- [ ] **T2.2** `view/Board.ts`：牌桌
  - `Board extends Component`，`build(model)` 用节点池按行列摆放；`cellAt(x, y)` 用 `UITransform` 反算
  - 拖动预览：改被拖行/列的节点 `position`，不重建
  - 消除动画：`tween` 缩放 + 淡出
  - 验证：`npm run check:cocos`
- [ ] **T2.3** `view/Hud.ts`：顶栏 + 底部工具条
  - 每个按钮是独立 `Node`，挂 `Node.EventType.TOUCH_END` 回调
  - 显示：剩余牌数 / 步数 / 提示次数 / 洗牌次数；**不显示关卡总数**
  - 验证：`npm run check:cocos`
- [ ] **T2.4** `view/Overlay.ts`：弹窗
  - 设置 / 玩法 / 重开确认 / 胜利 / 选关（扁平网格 + `ScrollView`）
  - 弹出用 `tween` 做缩放淡入；底图由 `GameRoot` 根据 `returnModal` 决定
  - 验证：`npm run check:cocos`
- [ ] **T2.5** `view/Home.ts`：首页
  - logo = 三张牌（萬 / 乐 / 筒）+ `Label` 字形，无装饰文案
  - 入口：继续 / 选关 / 设置
  - 验证：`npm run check:cocos`

## 阶段 3 · 装配

- [ ] **T3.1** `view/GameRoot.ts` 重写：持有 `Session`，按 `modal` 切换 Home / Board / Overlay，转发触摸
  - 保留 `wx` 存档 / 震动 / 分享与启动阶段日志（`__mjBoot.stages`）
  - 验证：`npm run check:cocos`
- [ ] **T3.2** 更新 `assets/scenes/main.scene` 挂载点（如需要）
  - 验证：编辑器预览

## 阶段 4 · 清理

- [ ] **T4.1** 删除 `assets/scripts/view/Drawing.ts` / `GameView.ts` / `Input.ts` 及其 `.meta`
- [ ] **T4.2** 删除 `preview/`、`tests/view.test.cjs`、`tests/input.test.cjs`
- [ ] **T4.3** `package.json` 去掉 `build:view` / `preview*`，`test:all` 改为 `test` + `check:cocos`
- [ ] **T4.4** 启动页：`build-templates/wechatgame/splash-logo.png` 与 `splash-slogan.png` 不再需要
  - 决策：启动页只保留暖色底（避免黑屏），logo 由 cc 首页绘制，**不引入图片资源**
  - 验证：`npm run build:wechat` 后开发者工具截图

## 阶段 5 · 文档与验收

- [ ] **T5.1** 更新 `README.md`（架构、命令、验证面、已知问题）
- [ ] **T5.2** 全量验收：`npm run test` + `npm run check:cocos` + `npm run build:wechat`
- [ ] **T5.3** 微信开发者工具截图取证（首页 / 牌桌 / 设置 / 选关）

---

## 风险与对策

| 风险 | 对策 |
|---|---|
| cc 代码无法本地编译验证 | 全程用 `npm run check:cocos` 做类型校验；产物验证交开发者工具 |
| 100 关数据被手改后不可解 | `author:levels` 会重新校验；README 注明「改 map 必须重跑」 |
| 重写期间仓库不可运行 | 分阶段提交，每阶段结束时 `check:cocos` 必须为 0 报错 |
| 启动页 logo 需图片而项目零美术资源 | 启动页只留纯色底，logo 在引擎起来后的首页绘制 |
