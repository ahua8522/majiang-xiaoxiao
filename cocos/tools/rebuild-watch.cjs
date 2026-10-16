// 一键重建验证（引擎插件版）：等 Creator 编辑器就绪 → 触发 auto-build → 等构建完成 → 验证主包体积与引擎分离
// 用法：node tools/rebuild-watch.cjs
// 前提：扩展管理器已启用 auto-build；引擎缓存目录已清空（Temp/CocosCreator/3.8.8/builder/engine）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'temp', 'auto-build');
const HEARTBEAT = path.join(DIR, 'heartbeat.json');
const TRIGGER = path.join(DIR, 'trigger.json');
const RESULT = path.join(DIR, 'result.json');
const OUT = path.join(ROOT, 'build', 'wechatgame');
const STAMP = path.join(OUT, '.mj-build-stamp.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dirSize(p) {
    if (!fs.existsSync(p)) return 0;
    let total = 0;
    for (const f of fs.readdirSync(p)) {
        const fp = path.join(p, f);
        const st = fs.statSync(fp);
        total += st.isDirectory() ? dirSize(fp) : st.size;
    }
    return total;
}

function countFiles(p) {
    if (!fs.existsSync(p)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(p)) {
        const fp = path.join(p, f);
        if (fs.statSync(fp).isDirectory()) n += countFiles(fp);
        else n += 1;
    }
    return n;
}

(async () => {
    // 1. 等扩展就绪：心跳存在即可（编辑器长开时心跳不刷新）；若写 trigger 后被 load 清掉（刚启动竞态）则重写
    console.log('[1/4] 检查 auto-build 扩展状态…');
    let ready = fs.existsSync(HEARTBEAT);
    for (let i = 0; !ready && i < 120; i++) {
        ready = fs.existsSync(HEARTBEAT);
        if (!ready) await sleep(5000);
    }
    if (!ready) { console.error('超时：扩展未加载。请确认已打开 Creator 项目且扩展管理器里 auto-build 已启用。'); process.exit(1); }
    console.log('[2/4] 扩展已就绪，写入 trigger.json 触发构建…');
    const options = JSON.parse(fs.readFileSync(path.join(ROOT, 'build-options', 'wechatgame.json'), 'utf8'));
    const id = 'rebuild-' + Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
        fs.writeFileSync(TRIGGER, JSON.stringify({id, options}));
        await sleep(5000); // 若扩展恰在重载（load 会 unlink trigger），5 秒后触发文件会消失
        if (fs.existsSync(TRIGGER)) break;
    }
    if (!fs.existsSync(TRIGGER)) { console.error('trigger.json 反复被清除，扩展可能在反复重载，请检查编辑器。'); process.exit(1); }
    // 2. 等构建结果
    const oldResult = fs.existsSync(RESULT) ? fs.readFileSync(RESULT, 'utf8') : '';
    console.log('[3/4] 等待构建完成（清缓存后首次会重建引擎，约 1-3 分钟）…');
    let result = null;
    for (let i = 0; i < 120; i++) {
        if (fs.existsSync(RESULT)) {
            const txt = fs.readFileSync(RESULT, 'utf8');
            if (txt !== oldResult && txt.includes(id)) { result = JSON.parse(txt); break; }
        }
        await sleep(5000);
    }
    if (!result) { console.error('超时：未看到构建结果。检查 result.json 与编辑器构建队列。'); process.exit(1); }
    console.log('[4/4] 构建结果:', JSON.stringify(result));
    if (!result.ok) {
        if (String(result.error || '').includes('build queue busy')) {
            console.error('\n✗ 构建队列被占用：编辑器里有卡住/进行中的构建任务。');
            console.error('  处理：编辑器菜单 项目→构建发布，在任务列表里取消旧任务后重跑本脚本；');
            console.error('  若取消无效，直接重启 Cocos Creator 再重跑本脚本。');
        }
        process.exit(2);
    }
    // 3. 验证产物：主包体积 + 引擎分离形态
    // 先把上一次的戳删掉再统计：否则 mainPkg/fileCount 会把旧戳算进基数，而上传侧统计时排除戳，
    // 两边对不上就会误报「产物被改动过」。
    try { fs.unlinkSync(STAMP); } catch (e) { /* 首次构建没有戳，正常 */ }
    const mainPkg = dirSize(OUT);
    const engineDir = path.join(OUT, 'cocos-js');
    const engineSize = dirSize(engineDir);
    const gameJson = fs.existsSync(path.join(OUT, 'game.json')) ? fs.readFileSync(path.join(OUT, 'game.json'), 'utf8') : '(game.json 不存在)';
    console.log('\n=== 产物验证 ===');
    console.log('主包总字节:', mainPkg, `(${(mainPkg / 1048576).toFixed(2)} MB)`, mainPkg < 4 * 1048576 ? '✓ < 4MB' : '✗ 超出微信主包上限！');
    console.log('cocos-js(引擎) 字节:', engineSize, engineSize === 0 ? '(不在主包，已分离 ✓)' : `(仍在主包，${(engineSize / 1048576).toFixed(2)} MB)`);
    console.log('game.json:', gameJson);
    if (mainPkg >= 4 * 1048576) process.exit(3);
    // 写构建戳（upload-ci.cjs 的唯一凭据）：本仓库只能走编辑器构建，没有脚本能把 build:wechat
    // 串到 upload:ci 前面，所以「产物是不是刚构建的 + 之后有没有被手工改过」只能靠这里落盘的戳。
    // 只统计不含戳自身的体积/文件数，上传侧同样排除戳文件，两边才对得上。
    fs.writeFileSync(STAMP, JSON.stringify({
        builtAt: Date.now(),
        buildId: id,
        appVersion: (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch (e) { return null; } })(),
        mainPkgBytes: mainPkg,
        fileCount: countFiles(OUT),
        engineSeparated: engineSize === 0,
    }, null, 2));
    console.log('\n✓ 已写构建戳 build/wechatgame/.mj-build-stamp.json（upload:ci 靠它判断产物新鲜度）');
    console.log('\n✓ 构建完成。请到微信开发者工具：确认项目路径为 cocos/build/wechatgame → 工具菜单清除缓存 → 编译验证；');
    console.log('  若模拟器报引擎插件未授权/版本不存在，需要到微信公众平台后台添加对应版本的 Cocos Creator 引擎插件。');
    console.log('  启动页品牌化只能换图（build-templates/wechatgame/*.png），不要覆盖 first-screen.js / game.js。');
})();
