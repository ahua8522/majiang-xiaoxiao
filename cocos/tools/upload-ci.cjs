// 无人值守上传体验版：miniprogram-ci + 上传密钥，绕开开发者工具的确认弹窗。
// 用法：node tools/upload-ci.cjs <version> [desc] [--key <路径>] [--force]
//
// 密钥路径按 `--key` > 环境变量 `WX_PRIVATE_KEY_PATH` > `cocos/.secrets/private.*.key`
// > 本机旧位置 的顺序找。密钥文件本身绝不入库（`.gitignore` 已挡 `*.key` / `*.pem` /
// `.secrets/`）；以前这里把某台机器的绝对路径写死在**已入库**的脚本里，换机器或上 CI 直接失败。
//
// 上传前先验构建戳：本仓库只能走编辑器构建（CLI 构建会丢 build-options），没有脚本能把
// `build:wechat` 串到 `upload:ci` 前面 —— 所以"产物是不是刚构建的、之后有没有被动过"
// 只能靠 `rebuild-watch` 落盘的 `.mj-build-stamp.json` 来证明。
'use strict';
const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'wechatgame');
const STAMP = path.join(OUT, '.mj-build-stamp.json');
const MAX_AGE_MS = 60 * 60 * 1000;      // 戳超过 1 小时就当它不是"刚构建的"
const FALLBACK_KEY = 'E:\\Download\\private.wx3d895529df5ec250.key';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return '';
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : '';
};
const force = args.includes('--force');
if (force) args.splice(args.indexOf('--force'), 1);
const [version, ...descParts] = args;
if (!version) {
  console.error('usage: node tools/upload-ci.cjs <version> [desc] [--key <路径>] [--force]');
  process.exit(1);
}
const desc = descParts.join(' ') || 'auto upload';

function useKey(p, from) {
  if (!fs.existsSync(p)) return null;
  if (from === '本机兜底路径')
    console.warn('[upload] ⚠ 正在用本机兜底密钥路径，这只对这台机器有效。请改用 --key 或环境变量 WX_PRIVATE_KEY_PATH');
  else console.log('[upload] 密钥：' + from);
  return p;
}
function resolveKey() {
  const cli = flag('--key');
  const secrets = path.join(ROOT, '.secrets');
  const inSecrets = fs.existsSync(secrets)
    ? fs.readdirSync(secrets).find((n) => /^private\..*\.key$/.test(n)) : null;
  return (cli && useKey(cli, '--key'))
    || (process.env.WX_PRIVATE_KEY_PATH && useKey(process.env.WX_PRIVATE_KEY_PATH, '环境变量 WX_PRIVATE_KEY_PATH'))
    || (inSecrets && useKey(path.join(secrets, inSecrets), 'cocos/.secrets/'))
    || useKey(FALLBACK_KEY, '本机兜底路径')
    || null;
}
/** 主包体积与文件数（都不算戳自己，两边口径才对得上）。 */
function measure(dir) {
  let bytes = 0, files = 0;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const s = measure(p); bytes += s.bytes; files += s.files; }
    else if (e.name !== '.mj-build-stamp.json') { bytes += fs.statSync(p).size; files++; }
  }
  return {bytes, files};
}
function checkFresh() {
  if (!fs.existsSync(OUT)) return ['构建产物不存在：' + OUT + '（先在编辑器里走 auto-build 构建）'];
  if (!fs.existsSync(STAMP)) return ['缺少构建戳 .mj-build-stamp.json —— 不知道这份产物是什么时候构建的，不敢直接上传'];
  let stamp = null;
  try { stamp = JSON.parse(fs.readFileSync(STAMP, 'utf8')); } catch (e) { return ['构建戳读不出来：' + e.message]; }
  const now = measure(OUT), problems = [];
  const ageMin = Math.round((Date.now() - Number(stamp.builtAt)) / 60000);
  if (!Number.isInteger(stamp.mainPkgBytes) || !Number.isInteger(stamp.fileCount)) problems.push('构建戳字段不完整（mainPkgBytes / fileCount）');
  else if (stamp.mainPkgBytes !== now.bytes) problems.push(`产物体积与戳不符：戳记 ${stamp.mainPkgBytes}，实际 ${now.bytes} —— 构建后产物被改过`);
  else if (stamp.fileCount !== now.files) problems.push(`产物文件数与戳不符：戳记 ${stamp.fileCount}，实际 ${now.files} —— 构建后产物被改过`);
  if (ageMin > MAX_AGE_MS / 60000) problems.push(`构建戳已经 ${Math.round(ageMin / 60)} 分钟旧（上限 1 小时），请重新构建`);
  if (now.bytes >= 4 * 1048576) problems.push(`主包 ${(now.bytes / 1048576).toFixed(2)} MB ≥ 微信 4MB 上限`);
  // 引擎在不在主包不是硬错误：本项目的既定策略就是 separateEngine:false（引擎进主包 + 模块裁剪），
  // 实测主包 2.15MB。只有当体积已经逼近上限时，"引擎没分离"才值得提醒一句。
  if (stamp.engineSeparated === false && now.bytes > 3 * 1048576)
    console.warn(`[upload] ⚠ 引擎仍在主包且主包已达 ${(now.bytes / 1048576).toFixed(2)} MB，接近 4MB 上限，考虑开引擎分离或分包`);
  problems.forEach((p) => console.error('[upload] ✗ ' + p));
  return problems;
}

const privateKeyPath = resolveKey();
if (!privateKeyPath) {
  console.error('[upload] 找不到上传密钥。三种给法任选其一：');
  console.error('  1) node tools/upload-ci.cjs <version> --key <路径>');
  console.error('  2) set WX_PRIVATE_KEY_PATH=<路径>（PowerShell: $env:WX_PRIVATE_KEY_PATH=<路径>）');
  console.error('  3) 把 private.wx….key 放到 ' + path.join(ROOT, '.secrets') + '/（该目录已在 .gitignore 里）');
  process.exit(1);
}
const problems = checkFresh();
if (problems.length) {
  if (!force) { console.error('[upload] 产物没通过新鲜度校验，已中止。确认要传这份产物就加 --force（会打印警告）。'); process.exit(2); }
  console.warn('[upload] ⚠⚠ --force 跳过了 ' + problems.length + ' 条新鲜度校验，上传的可能是旧包或被改过的包。');
}
const pkgVersion = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch (e) { return null; } })();
if (pkgVersion) console.log(`[upload] cocos/package.json version=${pkgVersion}，本次上传 version=${version}（提版时两处与 GameRoot.APP_VERSION 一起同步）`);

console.log('[upload] 开始上传 version=' + version + ' desc=' + desc);
const project = new ci.Project({
  appid: 'wx3d895529df5ec250',
  type: 'game',
  projectPath: OUT,
  privateKeyPath,
  // 构建戳是本地新鲜度凭据，不该进包
  ignores: ['node_modules/**/*', '.mj-build-stamp.json'],
});

ci.upload({
  project,
  version,
  desc,
  setting: {
    es6: false,
    es7: false,
    minifyJS: false,
    minifyWXSS: false,
    autoPrefixWXSS: false,
  },
  onProgressUpdate: (info) => {
    if (info && info._status) console.log('[upload]', info._status, info._message || '');
  },
}).then((res) => {
  console.log('[upload] success', JSON.stringify(res || {}));
}).catch((err) => {
  console.error('[upload] failed', err && err.message ? err.message : err);
  process.exit(2);
});
