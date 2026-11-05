/* 直连微信开发者工具内置 skill CLI（skill-index.js）。
   绕过 wechatide.cmd：从 cmd 调用会踩 Node spawn 引号坑，这里直接以 ELECTRON_RUN_AS_NODE 起 Electron 跑 CLI。
   用法：node tools/wxide.cjs <toolName> [flags...]   例：node tools/wxide.cjs get_simulator_console --project <abs> --command "grep -n ." */
const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = process.env.WXIDE_DIR || 'D:\\Program Files (x86)\\Tencent\\微信web开发者工具';
const CLI = path.join(DIR, 'resources', 'app.asar.unpacked', 'js', 'common', 'cli', 'skill-index.js');
const BOOTSTRAP = "const e=process.argv[1],a=process.argv.slice(2).filter(function(x){return x!=='--electron'});" +
    "if(!process.env.cwd)process.env.cwd=process.cwd();process.argv=[process.execPath,e,'--electron'].concat(a);require(e)";

function findElectron() {
    const skip = /^(node|node-18|wxfilewatcher|wxfilewatcher_x64|notification_helper|wechatdevtools|卸载.*)\.exe$/i;
    let best = '';
    for (const name of fs.readdirSync(DIR)) {
        if (!name.toLowerCase().endsWith('.exe') || skip.test(name)) continue;
        const size = fs.statSync(path.join(DIR, name)).size;
        if (size > 50e6 && size > (best ? fs.statSync(best).size : 0)) best = path.join(DIR, name);
    }
    return best;
}

const electron = findElectron();
if (!electron) { console.error('找不到 Electron 可执行文件：' + DIR); process.exit(1); }

const client = process.env.WXIDE_CLIENT || 'Qoder';
const args = process.argv.slice(2);
if (!args.length) { console.error('用法：node tools/wxide.cjs <toolName> [flags...]'); process.exit(1); }
const clientArgs = args.some(a => a === '-c' || a === '--client') ? [] : ['-c', client];
const token = process.env.WXIDE_TOKEN ? ['--token', process.env.WXIDE_TOKEN] : [];

const child = spawn(electron, ['-e', BOOTSTRAP, CLI, ...clientArgs, ...token, ...args], {
    env: {...process.env, ELECTRON_RUN_AS_NODE: '1', cwd: process.env.cwd || process.cwd()},
    stdio: 'inherit',
    windowsHide: true
});
child.on('exit', (code) => process.exit(code === null ? 1 : code));
