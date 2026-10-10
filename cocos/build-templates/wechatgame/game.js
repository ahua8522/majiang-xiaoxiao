// 覆盖构建模板的 game.js：启动链分步计时 + 失败可见。
// 真机上读不到 console，所以每一步失败都用系统弹窗摆到屏幕上，并把启动页留在原位（纸色），不留黑屏。
const BOOT = {t0: Date.now(), stages: [], geo: '', env: '', error: ''};
globalThis.__mjBoot = BOOT;

function bootStage(name) {
    BOOT.stages.push(name + '(+' + (Date.now() - BOOT.t0) + 'ms)');
    console.log('[boot]', name, '+' + (Date.now() - BOOT.t0) + 'ms');
}
function bootGeometry(tag) {
    try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        BOOT.geo = tag + ' canvas=' + (typeof canvas === 'undefined' ? '?' : canvas.width + 'x' + canvas.height) +
            ' win=' + info.windowWidth + 'x' + info.windowHeight +
            ' scr=' + info.screenWidth + 'x' + info.screenHeight +
            ' dpr=' + info.pixelRatio;
    } catch (e) {
        BOOT.geo = tag + ' geometry error: ' + e;
    }
}
function bootFail(name, err) {
    BOOT.error = name + ': ' + String((err && (err.message || err.errMsg)) || err).slice(0, 240);
    bootStage('FAIL ' + name);
    try {
        wx.showModal({
            title: '启动失败 ' + BOOT.env,
            content: BOOT.error + '\n' + BOOT.geo + '\n' + BOOT.stages.slice(-6).join('\n'),
            showCancel: false,
        });
    } catch (e) { /* 弹窗也起不来就只能靠日志了 */ }
}
try {
    const app = wx.getAccountInfoSync().miniProgram;
    BOOT.env = app.envVersion + ' ' + (app.version || 'dev');
} catch (e) { /* 开发者工具里可能拿不到 */ }
// 无条件看门狗：启动链某一步永不 settle（挂起）时，也要把已走到的阶段暴露出来，不能静默停在启动页
setTimeout(() => {
    if (globalThis.__mjFirstFrame || BOOT.error) return;
    bootFail('stalled', {message: '停在 ' + (BOOT.stages[BOOT.stages.length - 1] || '最早期') + ' 之后'});
}, 15000);
try {
    wx.onError((err) => { bootFail('runtime', err); });
} catch (e) { /* 老基础库无 onError */ }

function __initApp () {  // init app
globalThis.__wxRequire = require;  // FIX: require cannot work in separate engine
require('./web-adapter');
const firstScreen = require('./first-screen');


// Polyfills bundle.
require("src/polyfills.bundle.js");

// SystemJS support.
require("src/system.bundle.js");


// Adapt for IOS, swap if opposite
const info = wx.getSystemInfoSync();
if (canvas){
    var _w = canvas.width;
    var _h = canvas.height;
    if (info.screenWidth < info.screenHeight) {
        if (canvas.width > canvas.height) {
            _w = canvas.height;
            _h = canvas.width;
        }
    } else {
        if (canvas.width < canvas.height) {
            _w = canvas.height;
            _h = canvas.width;
        }
    }
    canvas.width = _w;
    canvas.height = _h;
}
// Adjust initial canvas size
if (canvas && window.devicePixelRatio >= 2) {canvas.width *= info.devicePixelRatio; canvas.height *= info.devicePixelRatio;}
bootGeometry('after-adapt');
bootStage('adapter');

const importMap = require("src/import-map.js").default;
System.warmup({
    importMap,
    importMapUrl: 'src/import-map.js',
    defaultHandler: (urlNoSchema) => {
        require('.' + urlNoSchema);
    },
    handlers: {
        'plugin:': (urlNoSchema) => {
            requirePlugin(urlNoSchema);
        },
        'project:': (urlNoSchema) => {
            require(urlNoSchema);
        },
    },
});

// 进度条：每个阶段只抬高上限，由定时器缓慢逼近，避免长时间停在某一刻度
let cap = 0.15, cur = 0, ended = false;
const creep = setInterval(() => {
    if (ended) return;
    cur = Math.min(cap, cur + (cap - cur) * 0.12 + 0.004);
    firstScreen.setProgress(cur);
}, 300);
function finishSplash() {
    if (ended) return Promise.resolve();
    ended = true;
    clearInterval(creep);
    return firstScreen.setProgress(1).then(() => firstScreen.end());
}
// 等游戏真正画出第一帧再撤启动页，避免引擎清屏造成的黑屏空窗
function waitForFirstFrame(deadline) {
    if (globalThis.__mjFirstFrame || BOOT.error || Date.now() > deadline) return Promise.resolve();
    return new Promise((r) => setTimeout(() => r(waitForFirstFrame(deadline)), 200));
}

bootStage('init');
firstScreen.start('default', 'default', 'false').then(() => {
    bootStage('splash');
    cap = 0.3;
    return System.import('./application.js');
}).then((module) => {
    bootStage('application');
    cap = 0.4;
    return module;
}).then(({ Application }) => {
    bootStage('app-class');
    cap = 0.48;
    return new Application();
}).then((application) => {
    bootStage('app-new');
    cap = 0.55;
    return onApplicationCreated(application);
}).catch((err) => {
    bootFail('boot', err);
}).then(() => {
    cap = 0.96;
    return waitForFirstFrame(Date.now() + 10000);
}).then(() => {
    // 出过错误或一直等不到首帧时保留启动页：黑屏没有信息量，纸色启动页 + 弹窗才有
    if (BOOT.error) return undefined;
    if (globalThis.__mjFirstFrame) return finishSplash();
    bootFail('no-first-frame', {message: '10s 内引擎没有画出第一帧'});
    return undefined;
}).catch((err) => { bootFail('splash', err); });

function onApplicationCreated(application) {
    return System.import('cc').then((module) => {
        bootStage('cc');
        cap = 0.75;
        return module;
    }).then((cc) => {
        require('./engine-adapter');
        bootStage('engine-adapter');
        cap = 0.82;
        return application.init(cc);
    }).then(() => {
        bootStage('app-init');
        cap = 0.92;
        // 先让游戏跑起来出首帧，再撤启动页，避免引擎清屏造成的黑屏窗口
        return application.start();
    }).then(() => {
        bootStage('app-start');
    });
}

}  // init app

// NOTE: on WeChat Android end, we can only get the correct screen size at the second tick of game.
var sysInfo = wx.getSystemInfoSync();
if (sysInfo.platform.toLocaleLowerCase() === 'android') {
    GameGlobal.requestAnimationFrame (__initApp);
} else {
    __initApp();
}
