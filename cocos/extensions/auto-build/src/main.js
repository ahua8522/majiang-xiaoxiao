// 监听 <项目>/temp/auto-build/trigger.json：
// { id, options: IBuildTaskOption } → 等构建队列空闲后调 builder add-task 执行，
// 轮询 query-task 直到终态，把结果写回同目录 result.json 并删除触发文件。
// 供外部自动化流程驱动；用 globalThis 守卫防止多次启用产生多份监听实例。
'use strict';

const fs = require('fs');
const path = require('path');

if (globalThis.__autoBuildLoaded) {
    console.log('[auto-build] already loaded in this process, skip duplicate');
    exports.load = function () {};
    exports.unload = function () {};
} else {
    globalThis.__autoBuildLoaded = true;

    // <项目>/extensions/auto-build/src/main.js → 向上三级即项目根目录
    const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
    const DIR = path.join(PROJECT_ROOT, 'temp', 'auto-build');
    const TRIGGER = path.join(DIR, 'trigger.json');
    const RESULT = path.join(DIR, 'result.json');

    let watcher = null;
    let busy = false;
    let pendingRead = null;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    exports.load = function () {
        fs.mkdirSync(DIR, {recursive: true});
        for (const f of [TRIGGER, RESULT]) { try { fs.unlinkSync(path.join(DIR, f)); } catch (e) { /* 不存在即可 */ } }
        watcher = fs.watch(DIR, (evt, file) => {
            if (file !== 'trigger.json') return;
            clearTimeout(pendingRead);
            pendingRead = setTimeout(runTrigger, 600);
        });
        console.log('[auto-build]', 'watching', DIR);
        try {
            fs.writeFileSync(path.join(DIR, 'heartbeat.json'), JSON.stringify({loadedAt: new Date().toISOString()}));
        } catch (e) { /* 心跳仅用于诊断 */ }
    };

    exports.unload = function () {
        clearTimeout(pendingRead);
        if (watcher) { try { watcher.close(); } catch (e) { /* 已关闭 */ } }
        watcher = null;
        globalThis.__autoBuildLoaded = false;
    };

    async function waitQueueFree(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const info = await Editor.Message.request('builder', 'query-tasks-info');
                const queue = info && info.queue;
                if (!queue || Object.keys(queue).length === 0) return true;
                const running = Object.values(queue).some((t) => t.state === 'processing' || t.state === 'waiting');
                if (!running) return true;
            } catch (e) {
                return true;
            }
            await sleep(3000);
        }
        return false;
    }


    async function waitQueueDrain(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        await sleep(3000);
        while (Date.now() < deadline) {
            try {
                const info = await Editor.Message.request('builder', 'query-tasks-info');
                const queue = (info && info.queue) || {};
                const busyTasks = Object.values(queue).filter((t) => t.state === 'processing' || t.state === 'waiting');
                if (busyTasks.length === 0) return {state: 'success'};
            } catch (e) { /* 查询失败继续等 */ }
            await sleep(4000);
        }
        return null;
    }

    async function runTrigger() {
        if (busy) return;
        let req;
        try {
            req = JSON.parse(fs.readFileSync(TRIGGER, 'utf8'));
        } catch (e) {
            return; // 还没写完或已消费
        }
        busy = true;
        const out = {id: req.id, startedAt: new Date().toISOString()};
        try {
            if (!req.options) throw new Error('trigger.options is required');
            if (!(await waitQueueFree(10 * 60 * 1000))) throw new Error('build queue busy, retry later');
            const added = await Editor.Message.request('builder', 'add-task', req.options, true);
            out.added = added;
            // 数字返回值是任务序号而非 UUID，统一改为等队列排空
            const settled = await waitQueueDrain(15 * 60 * 1000);
            out.state = settled ? settled.state : 'timeout';
            out.ok = !!settled && settled.state === 'success';
        } catch (err) {
            out.ok = false;
            out.error = String((err && err.stack) || err);
        }
        out.finishedAt = new Date().toISOString();
        try {
            fs.writeFileSync(RESULT, JSON.stringify(out, null, 2));
            fs.unlinkSync(TRIGGER);
        } catch (e) {
            console.error('[auto-build]', 'write result failed', e);
        }
        busy = false;
    }
}
