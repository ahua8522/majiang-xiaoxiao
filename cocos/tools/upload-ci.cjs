// 无人值守上传体验版：miniprogram-ci + 上传密钥，绕开开发者工具的确认弹窗。
// 用法：node tools/upload-ci.cjs <version> [desc]
'use strict';
const path = require('path');
const ci = require('miniprogram-ci');

const [version, ...descParts] = process.argv.slice(2);
if (!version) {
    console.error('usage: node tools/upload-ci.cjs <version> [desc]');
    process.exit(1);
}
const desc = descParts.join(' ') || 'auto upload';

const project = new ci.Project({
    appid: 'wx3d895529df5ec250',
    type: 'game',
    projectPath: path.join(__dirname, '..', 'build', 'wechatgame'),
    privateKeyPath: 'E:\\Download\\private.wx3d895529df5ec250.key',
    ignores: ['node_modules/**/*'],
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
