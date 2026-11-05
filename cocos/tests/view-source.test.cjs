/* 防回归：view/ 里凡是挂了 Sprite 的节点，必须同时给出真实尺寸。
 *
 * 为什么只能靠源码扫描：这个坑在 Node 里测不出来（要测就得把整个 cc 都 stub 掉），
 * 但发作时的现象极难定位 —— Sprite 用 SizeMode.CUSTOM 渲染时，渲染尺寸就是
 * UITransform.contentSize，而 `makeNode(parent, {name})` 默认给的是 **0×0**。
 * 于是「节点建出来了、spriteFrame 也设了、active 也是 true」，画面上却一个像素都没有。
 *
 * 牌桌曾经就是这样：木框、槽位、金色高亮框都在，就是**没有牌**。
 * 所以：每个 addComponent(Sprite) 附近必须能看到 makeNode({w, h}) 或 setContentSize()。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const VIEW = path.join(__dirname, '..', 'assets', 'scripts', 'view');

/** 对象字面量里出现 w / h 作为键（支持 `w: 1` 与 `{w, h}` 简写）。 */
const hasW = (s) => /[{,]\s*w\s*[:,}]/.test(s);
const hasH = (s) => /[{,]\s*h\s*[:,}]/.test(s);

test('view/ 里挂 Sprite 的节点必须带真实尺寸（makeNode 的 w/h 或 setContentSize）', () => {
    const bad = [];
    for (const f of fs.readdirSync(VIEW)) {
        if (!f.endsWith('.ts')) continue;
        const lines = fs.readFileSync(path.join(VIEW, f), 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const t = line.trim();
            // 注释里引用旧代码（如「以前这里只 addComponent(Sprite) + UIOpacity」）不是调用点，
            // 不排除的话文档注释会把扫描顶成误报。
            if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
            if (!/addComponent\(\s*Sprite\s*\)/.test(line)) return;
            // 往前 3 行找建节点的语句，往后 3 行找补设尺寸的语句
            const before = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
            const after = lines.slice(i + 1, i + 4).join('\n');
            const node = before.match(/makeNode\([\s\S]*$/);
            const sized = (node && hasW(node[0]) && hasH(node[0])) || /setContentSize\(/.test(before + after);
            if (!sized) bad.push(`${f}:${i + 1}  ${line.trim()}`);
        });
    }
    assert.deepStrictEqual(bad, [],
        '这些 Sprite 节点没有尺寸，渲染尺寸会是 0×0（画面上什么都看不到）：\n' + bad.join('\n') +
        '\n给 makeNode 传 {w, h}，或显式 setContentSize()。');
});

/* 防回归：牌面后缀（冰层 `~`、百搭 `*`）必须在解析与图集查帧时被剥掉。
 *
 * 两处都是**静默**渲染 bug，画面只剩叠加层或问号，肉眼很难归因：
 *  ① parseFace 只剥一层 `~` → `5s~~`（厚冰）与 `f3*`（百搭）序号解析成 NaN → 牌面画成 '?'；
 *  ② TileAtlas.face 直接按带后缀的名字查帧 → 查不到 → 牌面整张不画，
 *     只剩霜层叠加，看起来像「白色空框」（体验版实测）。
 */
test('牌面后缀必须在 parseFace 里一次剥净（多层冰 `~~` 与百搭 `*`）', () => {
    const files = [
        path.join(VIEW, 'art.ts'),
        path.join(__dirname, '..', '..', 'demo', 'h5', 'src', 'tile.ts')
    ];
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        // 注意：签名里有返回类型 {suit; n}，不能按第一个 '}' 切；取签名后的一段窗口即可
        const at = src.indexOf('export function parseFace');
        const body = src.slice(at, at + 400);
        assert.match(body, /replace\(\s*\/\[~\*\]\+\$\/\s*,\s*''\s*\)/,
            `${path.basename(f)} 的 parseFace 必须用 replace(/[~*]+$/, '') 一次剥净后缀`);
        assert.ok(!/endsWith\('~'\)\s*\?\s*face\.slice\(0,\s*-1\)/.test(body),
            `${path.basename(f)} 的 parseFace 不能只剥一层 ~`);
    }
});

test('牌图集查帧必须容忍牌面后缀（否则冰牌/百搭牌整张不画）', () => {
    const src = fs.readFileSync(path.join(VIEW, 'assets.ts'), 'utf8');
    const line = src.split(/\r?\n/).find((l) => /face\(name: string\)/.test(l));
    assert.ok(line, 'TileAtlas.face 必须存在');
    // 用普通字符串包含判断（正则里的 / 和 $ 转义太容易写错）
    assert.ok(line.includes("name.replace(/[~*]+$/, '')"), 'TileAtlas.face 必须先剥 [~*] 后缀再查帧（Atlas.frame 查不到是抛异常，|| 兜底无效）');
});

/* 防回归：教学屏的四条结构约束。
 *
 * 都是"在 Node 里测不出来、发作时又极难归因"的那一类，和这个文件开头那条同一血统：
 *  ① 教学 Board 挂进 overlay → `render()` 每帧 clearChildren(overlay) 会把节点池连锅端掉，
 *     下一帧就是野指针（Board 的 tilesRoot/ghostRoot 是它长期持有的，见 widgets.clearChildren 的警告）；
 *  ② 新 Screen 漏登记 SCREEN_MODAL → 编译期就会红，但这条断言守的是"别偷偷改成 modal 停表"，
 *     停表/挡输入只该由 Session.tip 负责，两处都停就变成"到底谁停的表"（commit e82ec48）；
 *  ③ 回跳必须认 tutFrom：那时 screen 已经是 'tutorial'，dialogParent() 的第一条分支不成立，
 *     会把"从玩法说明进来重放"甩回牌桌（commit e82ec48 修过的同一类问题）；
 *  ④ 降级要集中成一个出口：散在各处 catch 里的"顺手 setScreen('board')"会让教学坏掉时挡住进关。
 */
test('教学屏：Board 不挂 overlay、modal 不双停、回跳认来源、降级只有一个出口', () => {
    const src = fs.readFileSync(path.join(VIEW, 'GameRoot.ts'), 'utf8');
    assert.match(src, /this\.tutBoard = new Board\(this\.screens\.tutorial/, '教学 Board 必须只建一次并挂在 screen-tutorial 下');
    assert.match(src, /tutorial: 'none'/, 'SCREEN_MODAL 必须登记 tutorial，且映射到 none（停表由 tip 负责）');
    assert.match(src, /case 'tutorial-close': this\.tut = null; this\.setScreen\(this\.tutFrom\)/, '回跳必须认 tutFrom');
    assert.match(src, /private tutorialFail\(\)/, '降级必须集中成一个出口');
    assert.match(src, /if \(s === 'board' && this\.session\.introTutorial\)/, '进牌桌这一个口子统一拦，不许在四个调用点各写一遍');
});

/* 防回归：玩法机制改成章首弹框后，旧的小盘回放列表必须退场。
 *
 * 说明数据集中在 CHAPTER_TIPS；帮助页只解释触发点，不再列 14 条 tutorial 入口。
 */
test('玩法说明：章首说明由弹框负责，不再列小盘回放入口', () => {
    const src = fs.readFileSync(path.join(VIEW, 'GameRoot.ts'), 'utf8');
    assert.match(src, /const CHAPTER_TIPS: string\[\]\[\]/, '14 章说明必须以数据表存在');
    assert.match(src, /每章首次进入有说明/, '玩法说明要解释弹框触发点');
    assert.doesNotMatch(src, /CHAPTER_TUTORIALS\.filter/, '小盘回放列表必须退场');
    assert.doesNotMatch(src, /help:.*tutorial/, '玩法列表不再挂 tutorial 重放入口');
});
