// 微信开发者工具模拟器取证脚本：清缓存 → 重开窗口 → 等启动 → 截图 + OCR（画面）与 OCR（开发者工具窗口 console）
// 用法：
//   node tools/devtools-verify.cjs                    # 只截图取证（假定窗口已开）
//   node tools/devtools-verify.cjs --clean --reopen   # 先清全部缓存并重开项目窗口，再取证
//   node tools/devtools-verify.cjs --wait 90          # 启动等待秒数（本机模拟器启动可能被工具编译阻塞 25-40s）
// 输出：temp/sim-<ts>.png（模拟器画面）、temp/devwin-<ts>.png（工具窗口）、temp/*.ocr.txt（OCR 结果），并打印摘要
'use strict';
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMP = path.join(ROOT, 'temp');
const PROJECT = process.env.MJ_PROJECT || path.join(ROOT, 'build', 'wechatgame');
const WXIDE = path.join(__dirname, 'wxide.cjs');
const PS = 'powershell';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : d; };
const WAIT = num('--wait', 75);

function wxide(args) {
    return execFileSync(process.execPath, [WXIDE, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
}
function psFile(script, args) {
    return execFileSync(PS, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, script), ...args], {encoding: 'utf8'});
}
function ocr(img, scale) {
    try { return psFile('ocr.ps1', ['-Path', img, '-Scale', String(scale)]); }
    catch (e) { return 'OCR 失败: ' + (e.stdout || e.message); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const sim = path.join(TEMP, `sim-${ts}.png`);
    const win = path.join(TEMP, `devwin-${ts}.png`);

    if (has('--clean')) { console.log('[1] 清理全部缓存…'); console.log(wxide(['debug_clear_cache', '--project', PROJECT, '--action', 'cleanAll']).trim()); }
    if (has('--reopen')) {
        console.log('[2] 关闭并重开项目窗口…');
        try { wxide(['close_project_window', '--project', PROJECT]); } catch (e) { /* 未开着就算了 */ }
        await sleep(2000);
        console.log(wxide(['open_project_window', '--project', PROJECT, '--window-mode', 'liteMode']).trim());
    }
    console.log(`[3] 等待 ${WAIT}s 让模拟器编译+启动…`);
    await sleep(WAIT * 1000);

    console.log('[4] 截模拟器画面…');
    console.log(JSON.parse(wxide(['simulator_screenshot', '--project', PROJECT, '--path', sim, '--optimize', 'false']).replace(/^[\s\S]*?\{/, '{')).result ? sim : sim);

    console.log('[5] 抓开发者工具窗口（console 是唯一能读到游戏日志的通道）…');
    try { console.log(psFile('devtools-window.ps1', ['-Out', win]).trim()); } catch (e) { console.log('窗口抓取失败: ' + (e.stdout || e.message)); }

    console.log('\n=== 模拟器画面 OCR ===');
    const simOcr = ocr(sim, 2);
    fs.writeFileSync(path.join(TEMP, `sim-${ts}.ocr.txt`), simOcr);
    process.stdout.write(simOcr);

    console.log('\n=== 开发者工具窗口 OCR（只看 console 行）===');
    const winOcr = ocr(win, 1);
    fs.writeFileSync(path.join(TEMP, `devwin-${ts}.ocr.txt`), winOcr);
    const lines = winOcr.split(/\r?\n/).filter((l) => /\[|boot|Boot|BOOT|error|Error|LOAD|diag|paint|stage|view=/.test(l));
    console.log(lines.length ? lines.join('\n') : '(未识别到日志行——可能窗口被遮挡/面板未打开)');

    console.log('\n提示判据：模拟器画面若只剩纯纸色/纯白且 OCR 无文字 → 启动页仍在（未出首帧）；');
    console.log('        若有文字但内容与预期不符（例如按钮显示别的按钮文案）→ 文本渲染异常，需真机对照。');
})();
