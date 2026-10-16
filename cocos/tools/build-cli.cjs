/**
 * ⛔ 已封死的入口：不要用它构建微信小游戏，运行时直接报错退出。
 *
 * 为什么（本机 3.8.8 实测，见 README「微信小游戏的构建与发布」）：
 *   1) `CocosCreator --build` 的 CLI 不读 `build-options/wechatgame.json`，只吃 `--build k=v;k=v`
 *      这一串参数。本项目的模块裁剪（关 3D/物理/Spine/粒子……）、启动页配置、场景列表全在这个
 *      json 里，走 CLI 会**静默退回默认全量模块**：主包从 ~2MB 涨到远超微信 4MB 上限，或者
 *      丢启动页美术 —— 构建「成功」，产物却是错的，比直接失败更危险。
 *   2) 唯一正确通道是编辑器内置扩展 `cocos/extensions/auto-build`：
 *      `npm run build:wechat`（= tools/rebuild-watch.cjs）→ 写 temp/auto-build/trigger.json
 *      （options 直接取 build-options）→ 扩展调 builder 的 add-task → 构建完还会校验主包体积、
 *      引擎是否分离，并写 `.mj-build-stamp.json` 构建戳（upload-ci.cjs 靠它判断产物新鲜度）。
 *      CLI 构建没有戳，产物也就传不上去。
 *   3) 文件保留是因为怕别处有引用断链（已 `grep -rn "build-cli"` 确认仓库内无引用）；
 *      web-mobile 那条历史用途也已随旧 Canvas2D 视图层一并作废（看效果统一走 demo/h5）。
 *
 * 历史原文（保留备查）—— Headless build via the Creator CLI — no editor window, no auto-build extension.
 *
 *   node tools/build-cli.cjs web-mobile [--out temp/webverify] [--debug]
 *   node tools/build-cli.cjs wechatgame
 *
 * Notes:
 * - The CLI takes a `key=value;key=value` build string. Booleans must be real
 *   booleans or the builder silently falls back to its default.
 * - `web-mobile` output is a plain web app: serve it and drive it with a browser,
 *   which is how we verify the real engine runtime without the WeChat devtools.
 */
'use strict';

// 封死：任何调用方（人或脚本）都在这里拿到明确失败，而不是一个"看起来成功"的错产物。
console.error('✗ tools/build-cli.cjs 已停用：Cocos 3.8.8 的 `--build` CLI 会丢弃 build-options/wechatgame.json');
console.error('  （模块裁剪 / 启动页 / 场景列表都在那个文件里），产物会静默变成默认全量构建。');
console.error('  请改用：npm run build:wechat');
console.error('  （= node cocos/tools/rebuild-watch.cjs，走编辑器 + extensions/auto-build，带产物校验与构建戳）');
process.exit(1);

// —— 以下为封禁前的历史实现，保留备查，永远不会执行 ——
const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');

const ROOT = path.join(__dirname, '..');
const CREATOR = process.env.COCOS_CREATOR || 'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const platform = process.argv[2];
if (!['web-mobile', 'wechatgame'].includes(platform)) {
  console.error('usage: node tools/build-cli.cjs <web-mobile|wechatgame> [--out DIR] [--debug]');
  process.exit(2);
}

const debug = process.argv.includes('--debug');
const outDir = path.resolve(arg('--out', platform === 'web-mobile' ? path.join(ROOT, 'temp', 'webverify') : path.join(ROOT, 'build')));
const logDir = path.join(ROOT, 'temp', 'cli-build');
fs.mkdirSync(logDir, {recursive: true});
const log = path.join(logDir, `${platform}.log`);
const errLog = path.join(logDir, `${platform}.err.log`);

// A buildPath that already contains the platform folder is what the builder expects.
const buildString = [
  `platform=${platform}`,
  `debug=${debug}`,
  `buildPath=${outDir}`,
  platform === 'wechatgame' ? 'outputName=wechatgame' : 'outputName=web-mobile'
].join(';');

console.log(`[build] ${platform} -> ${outDir}`);
const started = Date.now();
const child = spawn(CREATOR, ['--project', ROOT, '--build', buildString], {stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(errLog, 'w')]});

const timer = setTimeout(() => { console.error('[build] timed out after 10min'); child.kill(); process.exit(1); }, 600000);
child.on('exit', (code) => {
  clearTimeout(timer);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const text = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const finished = /build Task \([^)]+\) Finished/.test(text);
  const errored = /execute-task .* failed with code|error: Error:/i.test(fs.existsSync(errLog) ? fs.readFileSync(errLog, 'utf8') : '');
  const out = path.join(outDir, platform === 'wechatgame' ? 'wechatgame' : 'web-mobile');
  const hasIndex = fs.existsSync(path.join(out, 'index.html'));
  const hasGameJs = fs.existsSync(path.join(out, 'game.js'));
  console.log(`[build] exit=${code} ${secs}s finished=${finished} errored=${errored}`);
  console.log(`[build] output: ${out}  index.html=${hasIndex} game.js=${hasGameJs}`);
  if (!finished || errored) {
    console.error('[build] failed — see ' + log + ' and ' + errLog);
    process.exit(1);
  }
  console.log('[build] ok');
});