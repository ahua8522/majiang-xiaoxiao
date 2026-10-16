/* Type-checks the H5 demo (and the shared core it imports) in strict mode.
   Usage: node demo/h5/check.cjs */
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const tsc = path.join(ROOT, 'cocos', 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const res = spawnSync(tsc, ['-p', path.join(__dirname, 'tsconfig.json')], {stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32'});
if (res.status === 0) console.log('demo/h5 type-check passed');
process.exit(res.status ?? 1);