/* 防回归：core / view 里禁止在数组字面量里使用展开运算符（`[...x]`）。
 *
 * 原因：Cocos 的构建器会把 `[...x]` 转译成 `[].concat(x)`。对数组这是对的，但对**字符串**和**迭代器**
 * 就错了 —— `[].concat('1111')` 得到的是 `['1111']`（长度 1），`[].concat(map.values())` 得到的是
 * `[iterator]`。产物里的实际样子：
 *     r.map.map(function(r){ return [].concat(r).map(...) })     // 本该是 row.split('')
 * 后果是 `levelAt` 给出 3 行 × 4 字符的关卡定义，`empty()` 却把每行塌成 1 列 → 棋盘变成一列、
 * 所有牌挤在同一列叠起来（"关卡只显示一列"）。
 *
 * 这个坑 **Node 测试永远发现不了**：测试跑的是源码，Node 的原生展开对字符串是正确的。
 * 只有构建产物才会发作，所以只能靠源码扫描兜住。
 *
 * 正确写法：字符串用 `row.split('')`，迭代器用 `Array.from(it)`，数组合并用 `a.concat(b)`。
 * 函数调用里的展开（`push(...arr)`）不受影响，允许。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'assets', 'scripts');
const DIRS = ['core', 'view'];

function sources() {
    const out = [];
    for (const dir of DIRS) {
        const full = path.join(ROOT, dir);
        for (const f of fs.readdirSync(full)) {
            if (f.endsWith('.ts')) out.push(path.join(full, f));
        }
    }
    return out;
}

test('core / view 不允许在数组字面量里用展开运算符（会被构建器转译成 [].concat）', () => {
    const bad = [];
    for (const file of sources()) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            // 去掉行注释后再匹配，避免注释里的示例代码误报
            const code = line.replace(/\/\/.*$/, '');
            if (/\[\s*\.\.\./.test(code)) {
                bad.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
            }
        });
    }
    assert.deepStrictEqual(bad, [],
        '发现数组字面量展开，构建后会变成 [].concat(x)：\n' + bad.join('\n') +
        '\n字符串改用 x.split(\'\')，迭代器改用 Array.from(x)。');
});
