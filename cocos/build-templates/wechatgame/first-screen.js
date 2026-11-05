// 这份文件是从官方构建产物 first-screen.js 复制而来，只改了几处常量：
//   1) bgColor 由引擎默认的近黑色 #04090A 改成庭院天空色 #CFE9E6 —— 启动页不再像黑屏，
//      且与游戏内的绿玉庭院背景同一色系（构建选项里的 splashScreen 会被构建器忽略，只能改这里）；
//   2) 进度条由官方青色改成玉色，底色改成浅灰绿，与游戏配色一致；
//   3) 标题/副标题改读 splash-logo.png / splash-slogan.png，避免被构建器用官方 logo 覆盖。
// 其余逻辑与官方模板逐字一致，尤其是 end() 里的 GL 清理和 game.js 的 init→end→start 顺序：
// 上一轮 0x502 那串问题就是因为自定义 game.js 把 end() 挪到了首帧之后。**不要动 game.js**。
//
// 在本仓库上又加了两处（都是"起不来时不能永远纸色屏"的兜底，改动严格限制在不碰时序）：
//   A) 素材缺失降级（loadImage / loadSlogan / loadBackground 永不 reject）：
//      默认 game.js 对 start() 的 rejected promise 只有 console.error，于是 end()/start() 之后的
//      链路一起废掉，画面永远停在纸色底 —— 等于白屏。splash-logo.png / splash-slogan.png 目前只由
//      tools/make-splash.ts 手工生成（没接进任何 npm script），漏跑就是 404，必须有兜底。
//   B) 被动看门狗（watchdogFire）：超时后只做三件事 —— 写字段、可选画一层错误文字、把进度条变红。
//      绝不调 end()/start()、绝不改它们的时序、绝不在引擎接管画布之后碰 GL。
const VS_LOGO = `
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() {
    gl_Position = a_Position;  
    v_TexCoord = a_TexCoord;
}`;

const FS_LOGO = `
precision mediump float;
uniform sampler2D u_Sampler;
varying vec2 v_TexCoord;
void main() {
    gl_FragColor = texture2D(u_Sampler, v_TexCoord);
}`;

const VS_BG = `
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() {
    gl_Position = a_Position;  
    v_TexCoord = a_TexCoord;
}`;

const FS_BG = `
precision mediump float;
uniform sampler2D u_Sampler;
uniform float u_flip;
varying vec2 v_TexCoord;
void main() {
    vec2 texCoord = v_TexCoord;
    if(u_flip > 0.5) {
        texCoord.y = 1.0 - texCoord.y;
    }
    gl_FragColor = texture2D(u_Sampler, texCoord);
}`;

const VS_PROGRESSBAR = `
precision mediump float;
attribute vec4 a_Position;
attribute float a_Progress;
varying float v_Progress;
void main() {
    gl_Position = a_Position;  
    v_Progress = a_Progress;
}`;

const FS_PROGRESSBAR = `
precision mediump float;
uniform float u_CurrentProgress;
varying float v_Progress;
uniform vec4 u_ProgressBarColor;
uniform vec4 u_ProgressBackground;
void main() {
    gl_FragColor = v_Progress <= u_CurrentProgress ? u_ProgressBarColor : u_ProgressBackground;
}`;

const options = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
};

let gl = null;
let image = null;
let slogan = null;
let bg = null;
let program = null;
let programBg = null;
let programProgress = null;
let rafHandle = null;
// 进度条平滑推进用的状态：官方 game.js 只在几个阶段调 setProgress(0.2/0.4/0.6)，
// 中间整段是静止的，看起来像"进度条没用"。下面用定时器让显示值持续逼近阶段上限。
let splashCap = 0;      // 当前阶段允许到达的上限
let splashShown = 0;    // 实际显示的进度（缓动逼近 cap）
let splashCreep = null; // 定时器句柄
let logoTexture = null;
let sloganTexture = null;
let bgTexture = null;
let vertexBuffer = null;
let sloganVertexBuffer = null;
let bgVertexBuffer = null;
let vertexBufferProgress = null;
let progress = 0.0;
let progressBarColor = [46 / 255, 125 / 255, 79 / 255, 1];        // 玉 #2E7D4F
let progressBackground = [168 / 255, 192 / 255, 184 / 255, 1];    // 浅灰绿 #A8C0B8
let afterTick = null;
let backgroundFilp = 1.0; // set 0 to not flip
let displayRatio = 1;
let bgColor = [0.8117647058823529, 0.9137254901960784, 0.9019607843137255, 1]; // 庭院天空 #CFE9E6
let useCustomBg = false;
let useLogo = true;
let useDefaultLogo = true;
let logoName = 'splash-logo.png';
let bgName = 'background.png';
let fitWidth = true;
let fitHeight = false;

// ---- 看门狗状态（纯被动；见文件头注释 B）----------------------------------------------
// 软提醒 20s：微信开发者工具编译 + 着色器编译在本机就要 20~82s（README「已知环境问题」第 1 条），
//   所以 20s 只能"提示还在加载"，不能判失败，否则模拟器里天天误报。
// 判失败 60s：超过它才写 __mjBoot.error / storage，让用户重启。
// 可用 globalThis.__mjSplashWatchdogMs = {softMs, failMs} 提前覆盖（低配机型 / 慢网络时放宽）。
const WD_DEFAULT = { softMs: 20000, failMs: 60000 };
let watchdog = null;             // {soft, fail} 两个定时器句柄
let failOverlayTex = null;       // 错误文字纹理（仅在启动页仍拥有 GL 时创建）
let failOverlayVb = null;
let programFail = null;
let failOverlay = null;          // 离屏 2D 画布（错误文字）；null = 不画

// ---- 素材缺失计数（用于写进 __mjBoot.stages，真机只能靠这些字段定位）--------------------
const missingAssets = [];

/**
 * 沿用 GameRoot.ts mark() 的 __mjBoot 约定：boot.stages 是阶段数组、boot.error 是失败文本。
 * 真机 / 模拟器都读不到 console，出问题时只有这些字段 + 自绘文字能被看到。
 */
function bootMark(stage) {
    try {
        const g = globalThis;
        if (!g.__mjBoot) g.__mjBoot = { stages: [] };
        if (!g.__mjBoot.stages) g.__mjBoot.stages = [];
        g.__mjBoot.stages.push('splash:' + stage);
        return g.__mjBoot;
    } catch (e) { return null; }
}

function markAssetMissing(name) {
    missingAssets.push(name);
    bootMark('asset-missing:' + name);
}

/**
 * 用系统字体在离屏 2D 画布上画错误文字。
 * 只能 wx.createOffscreenCanvas({type:'2d'})：小游戏里第一次 wx.createCanvas() 返回的是主画布，
 * 改尺寸并请求 2d 上下文会让主画布的 WebGL 上下文失效（README「硬约束」第 3 条）。
 * 宽高取 4 的倍数：WebGL 默认 UNPACK_ALIGNMENT=4，非 4 倍行宽会让 texImage2D 错位，
 * 而这里不去动 pixelStorei（多一次 GL 状态改动就多一分风险）。
 */
function createTextCanvas(width, height, lines) {
    try {
        let c = null;
        if (typeof wx !== 'undefined' && wx.createOffscreenCanvas) {
            try { c = wx.createOffscreenCanvas({type: '2d', width, height}); }
            catch (e) { c = wx.createOffscreenCanvas(); }
        } else if (typeof document !== 'undefined' && document.createElement) {
            c = document.createElement('canvas');
        }
        if (!c) return null;
        c.width = width; c.height = height;
        const ctx = c.getContext && c.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = 'rgba(241,235,221,0.92)';   // 纸色 #F1EBDD，和游戏内一致
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 44px sans-serif';          // 系统字体，不依赖任何字体素材
        ctx.fillStyle = '#8C2B12';                 // 朱砂红，可读且与中式配色一致
        const step = height / (lines.length + 1);
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], width / 2, step * (i + 1));
        return c;
    } catch (e) {
        return null;   // 兜底的兜底：连画布都造不出来，就只保留红色进度条信号
    }
}

/**
 * 看门狗到点。soft=只提示（不写 error），fail=判定启动失败并落盘给下一次启动/游戏侧读取。
 * 关键约束：__mjSplashEnd 一旦被设置，说明 end() 已经跑过、引擎正在用这张画布出帧，
 * 此时任何 GL 调用（哪怕只是绑个缓冲）都会让引擎的 WebGLDevice 状态缓存与真实绑定脱节 ——
 * 那就是 0x502「Vertex buffer is not big enough」的成因。所以那种情况下只写字段，绝不碰 GL。
 */
function watchdogFire(level) {
    if (globalThis.__mjSplashEnd) {
        // 启动页已经交棒，画布归引擎：这里一个字节的 GL 都不动。
        if (level === 'fail') bootMark('watchdog-fail(no-gl)');
        return;
    }
    const elapsed = Math.round((Date.now() - (globalThis.__mjSplashStart || Date.now())) / 1000);
    const stage = globalThis.__mjStage || 'engine-init';
    if (level === 'soft') {
        bootMark('watchdog-soft-' + elapsed + 's');
        failOverlay = createTextCanvas(640, 96, ['加载较慢，请稍候…']);
        return;
    }
    // 判失败：写字段 + 写 storage（下次启动/游戏侧的失败弹窗能读到），并提示用户重启。
    const msg = `启动页超时 ${elapsed}s 未完成，停在 ${stage}。请退出小游戏后重新进入。`;
    const boot = bootMark('watchdog-fail-' + elapsed + 's');
    if (boot) boot.error = msg;
    try {
        if (typeof wx !== 'undefined' && wx.setStorageSync) {
            wx.setStorageSync('__mjSplashBootFail', JSON.stringify({
                at: Date.now(), elapsedSec: elapsed, stage, msg, missingAssets,
            }));
        }
    } catch (e) { /* storage 在部分环境会抛，不能让它把兜底本身弄挂 */ }
    console.error('[first-screen]', msg, 'missing assets:', missingAssets);
    // 只用"已经在每帧跑"的那条绘制路径改颜色：不新建 GL 对象。
    progressBarColor = [0.72, 0.16, 0.13, 1];       // 朱砂红，一眼看出卡住
    failOverlay = createTextCanvas(640, 128, ['启动超时，请重新进入', '（已记录：' + stage + '）']);
    if (!failOverlay || !gl || !program) return;    // 画不出文字就只留红色进度条
    try {
        programFail = programFail || initShaders(VS_LOGO, FS_LOGO);
        if (!programFail) return;
        if (!failOverlayTex) failOverlayTex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, failOverlayTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, failOverlay);
        if (!failOverlayVb) failOverlayVb = gl.createBuffer();
        const wr = Math.min(1, failOverlay.width / canvas.width * 1.1);
        const hr = failOverlay.height / canvas.height * 1.1;
        const yOff = -0.35;                          // 落在进度条上方、logo 下方的空档
        const verts = new Float32Array([
            wr, yOff - hr, 1.0, 1.0,
            wr, yOff + hr, 1.0, 0.0,
            -wr, yOff - hr, 0.0, 1.0,
            -wr, yOff + hr, 0.0, 0.0,
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, failOverlayVb);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    } catch (e) {
        console.error('[first-screen] 看门狗画错误页失败，仅保留红色进度条', e);
    }
    // rAF 循环根本没起来（start() 早期就抛了）时补画一次；正常启动路径到不了这里。
    if (failOverlay && failOverlayTex && failOverlayVb && programFail && rafHandle === null) {
        try { draw(); } catch (e) { /* 画不出来也至少有 storage 里的失败记录 */ }
    }
}

function disarmWatchdog() {
    if (!watchdog) return;
    clearTimeout(watchdog.soft);
    clearTimeout(watchdog.fail);
    watchdog = null;
}

function armWatchdog() {
    disarmWatchdog();
    const cfg = Object.assign({}, WD_DEFAULT, globalThis.__mjSplashWatchdogMs || {});
    // 看门狗是"只读"的兜底：它不 cancelAnimationFrame、不调 end()、不改 start() 的 promise 链，
    // 所以正常启动时它的唯一副作用就是被 disarmWatchdog() 取消掉。
    watchdog = {
        soft: setTimeout(() => { try { watchdogFire('soft'); } catch (e) { console.error(e); } }, cfg.softMs),
        fail: setTimeout(() => { try { watchdogFire('fail'); } catch (e) { console.error(e); } }, cfg.failMs),
    };
}

function initShaders(vshader, fshader) {
    return createProgram(vshader, fshader);
}

function createProgram(vshader, fshader) {
    var vertexShader = loadShader(gl.VERTEX_SHADER, vshader);
    var fragmentShader = loadShader(gl.FRAGMENT_SHADER, fshader);
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        var error = gl.getProgramInfoLog(program);
        console.log('Failed to link program: ' + error);
        gl.deleteProgram(program);
        program = null;
    }
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    return program;
}

function loadShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        var error = gl.getShaderInfoLog(shader);
        console.log('Failed to compile shader: ' + error);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initVertexBuffer() {
    const widthRatio = 2 / canvas.width;
    const heightRatio = 2 / canvas.height;
    const heightOffset = 0.225;
    const vertices = new Float32Array([
        widthRatio,heightRatio + heightOffset, 1.0, 1.0,
        widthRatio, heightRatio + heightOffset, 1.0, 0.0,
        -widthRatio, heightRatio + heightOffset, 0.0, 1.0,
        -widthRatio, heightRatio + heightOffset, 0.0, 0.0,
    ]);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function initSloganVertexBuffer() {
    const widthRatio = 2 / canvas.width;
    const heightRatio = 2 / canvas.height;
    const vertices = new Float32Array([
        widthRatio, heightRatio, 1.0, 1.0,
        widthRatio, heightRatio, 1.0, 0.0,
        -widthRatio, heightRatio, 0.0, 1.0,
        -widthRatio, heightRatio, 0.0, 0.0,
    ]);
    sloganVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sloganVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function initBgVertexBuffer() {
    const vertices = new Float32Array([
        1.0, 1.0, 1.0, 1.0,
        1.0, 0.0, 1.0, 0.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 0.0, 0.0, 0.0,
    ]);
    bgVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function initProgressVertexBuffer() {
    // the ratio value may be adjusted according to the image pixels
    const widthRatio = 0.5;
    const heightRatio = (window.devicePixelRatio >= 2 ? 6 : 3) / canvas.height * 1.35;
    const heightOffset = -0.8;
    const vertices = new Float32Array([
        widthRatio, heightOffset - heightRatio, 1,
        widthRatio, heightOffset + heightRatio, 1,
        -widthRatio, heightOffset - heightRatio, 0,
        -widthRatio, heightOffset + heightRatio, 0,
    ]);
    vertexBufferProgress = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferProgress);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

/**
 * 启动页 logo 的放大倍率（真机反馈：图标偏小）。
 * logo 四边形与副标题的落点**必须共用这一个系数**：官方模板里两处用的是不同的算式
 * （logo 用 0.185×displayRatio，副标题用 image.height/canvas.height×1.35），
 * 只放大一边就会互相压住。
 */
const SPLASH_LOGO_SCALE = 1.4;

function updateVertexBuffer() {
    const heightRatio = 1.0 * 0.185 * displayRatio * SPLASH_LOGO_SCALE;
    const widthRatio = image.width * (canvas.height * 0.185 / image.height) / canvas.width * displayRatio * SPLASH_LOGO_SCALE;
    
    const vertices = new Float32Array([
        widthRatio, -heightRatio, 1.0, 1.0,
        widthRatio, heightRatio, 1.0, 0.0,
        -widthRatio, -heightRatio, 0.0, 1.0,
        -widthRatio, heightRatio, 0.0, 0.0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function updateSloganVertexBuffer() {
    // the ratio value may be adjusted according to the image pixels
    const widthRatio = slogan.width / canvas.width * 0.75;
    const heightRatio = slogan.height / canvas.height * 0.75;
    const logoHeightRatio = image.height / canvas.height * 1.35 * displayRatio * SPLASH_LOGO_SCALE;
    const heightOffset = (5/12 + logoHeightRatio * 1/2 + heightRatio * 3/2)  * (-2) + 1; // 5/12 is ui design layout for logo
    const vertices = new Float32Array([
        widthRatio, heightOffset - heightRatio, 1.0, 1.0,
        widthRatio, heightOffset + heightRatio, 1.0, 0.0,
        -widthRatio, heightOffset - heightRatio, 0.0, 1.0,
        -widthRatio, heightOffset + heightRatio, 0.0, 0.0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, sloganVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function updateBgVertexBuffer() {
    let widthRatio = 1;
    let heightRatio = 1;
    if(fitWidth && !fitHeight) {
        widthRatio = canvas.width;
        heightRatio = (canvas.width / bg.width) * bg.height;
    } else if(!fitWidth && fitHeight) {
        widthRatio = (canvas.height / bg.height) * bg.width;
        heightRatio = canvas.height;
    } else if(fitWidth && fitHeight) {
        if ((bg.width / bg.height) > (canvas.width / canvas.height)) {
            widthRatio = canvas.width;
            heightRatio = (canvas.width / bg.width) * bg.height;
        } else {
            widthRatio = (canvas.height / bg.height) * bg.width;
            heightRatio = canvas.height;
        }
    } else if(!fitWidth && !fitHeight) {
        if ((bg.width / bg.height) > (canvas.width / canvas.height)) {
            widthRatio = (canvas.height / bg.height) * bg.width;
            heightRatio = canvas.height;
        } else {
            widthRatio = canvas.width;
            heightRatio = (canvas.width / bg.width) * bg.height;
        }
    } else {
        widthRatio = canvas.width;
        heightRatio = canvas.height;
    }
    widthRatio /= canvas.width;
    heightRatio /= canvas.height;

    const vertices = new Float32Array([
        widthRatio, heightRatio, 1.0, 1.0,
        widthRatio, -heightRatio, 1.0, 0.0,
        -widthRatio, heightRatio, 0.0, 1.0,
        -widthRatio, -heightRatio, 0.0, 0.0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

/**
 * 三个素材加载器统一改成「永不 reject」：
 * onerror（文件缺失 / 404）与 8s 超时（个别基础库版本对不存在的文件既不回 load 也不回 error）
 * 都 resolve(null) 并记一笔 __mjBoot.stages。start() 的 Promise.all 因此不可能变成 rejected
 * —— 一旦 reject，默认 game.js 只 console.error 就吞了，end() 不被调，画面永久停在纸色底。
 * 调用方拿到 null 时用 createTextCanvas 造纯色/系统字体的替代素材（见 start()）。
 */
function loadImageSafe(imgPath, setter, label) {
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;                       // 先声明再给 done 用，避免同步 onerror 触发 TDZ 让 promise 反被 reject
        const done = (ok) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (ok) resolve(setter(img));
            else { setter(null); markAssetMissing(label); resolve(null); }
        };
        // 连 new Image() 都抛的话（极老基础库 / 非小游戏环境），也必须按"素材缺失"降级，
        // 否则 start() 的 promise 一旦 rejected，默认 game.js 只 console.error 吞掉 → 永久纸色屏。
        let img = null;
        try {
            img = new Image();
            img.premultiplyAlpha = false;
            img.onload = function () {
                // 有些环境 onerror 不触发但 onload 回来的是 0×0 空图，同样按缺失处理。
                done(img.width > 0 && img.height > 0);
            };
            img.onerror = function () { done(false); };
            timer = setTimeout(() => done(false), 8000);
            img.src = imgPath.replace('#', '%23');
        } catch (e) {
            done(false);
        }
    });
}

function loadBackground(bgPath) {
    return loadImageSafe(bgPath, (v) => { bg = v; }, 'background.png');
}

function loadImage(imgPath) {
    return loadImageSafe(imgPath, (v) => { image = v; }, 'splash-logo.png');
}

function loadSlogan(sloganPath) {
    return loadImageSafe(sloganPath, (v) => { slogan = v; }, 'splash-slogan.png');
}


function initLogoTexture() {
    logoTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, logoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]));
}

function initSloganTexture() {
    sloganTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sloganTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]));
}

function initBgTexture() {
    bgTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]));
}

function updateLogoTexture() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, logoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

function updateSloganTexture() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sloganTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, slogan);
}

function updateBgTexture() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);
}

function drawTexture(gl, program, texture, vertexBuffer, vertexFormatLength) {
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    var uSampler = gl.getUniformLocation(program, 'u_Sampler');
    gl.uniform1i(uSampler, 0);
    var uFlip = gl.getUniformLocation(program, 'u_flip');
    gl.uniform1f(uFlip, backgroundFilp);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var aPosition = gl.getAttribLocation(program, 'a_Position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, vertexFormatLength * 4, 0);
    var aTexCoord = gl.getAttribLocation(program, 'a_TexCoord');
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, vertexFormatLength * 4, vertexFormatLength * 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function drawProgressBar(gl, program, vertexBuffer, vertexFormatLength, progress, progressBarColor, progressBackground) {
    gl.useProgram(program);
    var uCurrentProgress = gl.getUniformLocation(program, 'u_CurrentProgress');
    gl.uniform1f(uCurrentProgress, progress);
    var uProgressBarColor = gl.getUniformLocation(program, 'u_ProgressBarColor');
    gl.uniform4fv(uProgressBarColor, progressBarColor);
    var uProgressBackground = gl.getUniformLocation(program, 'u_ProgressBackground');
    gl.uniform4fv(uProgressBackground, progressBackground);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var aPosition = gl.getAttribLocation(program, 'a_Position');
    gl.enableVertexAttribArray(aPosition);
    var vertexFormatLength = 4;
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, vertexFormatLength * 3, 0);
    var aProgress = gl.getAttribLocation(program, 'a_Progress');
    gl.enableVertexAttribArray(aProgress);
    gl.vertexAttribPointer(aProgress, 1, gl.FLOAT, false, vertexFormatLength * 3, vertexFormatLength * 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function draw() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // draw background
    useCustomBg && drawTexture(gl, programBg, bgTexture, bgVertexBuffer, 4);
    // draw logo
    useLogo && drawTexture(gl, program, logoTexture, vertexBuffer, 4);
    // draw slogan
    useLogo && useDefaultLogo && drawTexture(gl, program, sloganTexture, sloganVertexBuffer, 4);
    // draw progress bar
    drawProgressBar(gl, programProgress, vertexBufferProgress, 3, progress, progressBarColor, progressBackground);
    // 看门狗兜底页：只有 failOverlay 已备好且纹理/缓冲建起来时才画一层，走的是上面同一张画布、
    // 同一个 rAF 循环 —— 不新建循环、不碰 end()/start()，所以不会引入新的 GL 时序风险。
    if (failOverlay && failOverlayTex && failOverlayVb && programFail) {
        drawTexture(gl, programFail, failOverlayTex, failOverlayVb, 4);
    }
}

function tick() {
    rafHandle = requestAnimationFrame(() => {
        draw();
        tick();
        if (afterTick) {
            afterTick();
            afterTick = null;
        }
    });
}

function end() {
    // end() 是官方 game.js 在 application.init(cc) 之后、application.start() 之前调的，
    // 所以 __mjSplashEnd - __mjSplashStart 就是「引擎初始化」耗时，与我们的游戏代码无关。
    globalThis.__mjSplashEnd = Date.now();
    // 引擎已经跑完 init、马上要接管画布 → 看门狗到此为止（它之后再碰 GL 就是 0x502 的成因）。
    disarmWatchdog();
    // 先停掉爬进度的定时器，否则它会和下面的 setProgress(1) 抢同一个 progress。
    if (splashCreep !== null) {
        clearInterval(splashCreep);
        splashCreep = null;
    }
    return setProgress(1).then(() => {
        cancelAnimationFrame(rafHandle);
        gl.useProgram(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        useLogo && gl.deleteTexture(logoTexture);
        useLogo && useDefaultLogo && gl.deleteTexture(sloganTexture);
        useCustomBg && gl.deleteTexture(bgTexture);
        gl.deleteBuffer(vertexBuffer);
        useCustomBg && gl.deleteBuffer(bgVertexBuffer);
        useLogo && useDefaultLogo && gl.deleteBuffer(sloganVertexBuffer);
        gl.deleteBuffer(vertexBufferProgress);
        // 看门狗兜底页的对象只在超时时才存在，正常启动路径这里是 null，不删。
        failOverlayTex && gl.deleteTexture(failOverlayTex);
        failOverlayVb && gl.deleteBuffer(failOverlayVb);
        programFail && gl.deleteProgram(programFail);
        gl.deleteProgram(program);
        gl.deleteProgram(programBg);
        gl.deleteProgram(programProgress);
    });
}

function setProgress(val) {
    // 官方语义：立刻把显示值设成 val（首次是 0，之后是 0.2/0.4/0.6/1）；
    // 同时抬高阶段上限，让定时器从这一格继续平滑往上爬。
    progress = val;
    splashCap = Math.max(splashCap, val);
    splashShown = val;
    return new Promise((resolve, reject) => {
        afterTick = () => {
            resolve();
        };
    });
}

function start(alpha, antialias, useWebgl2) {
    globalThis.__mjSplashStart = Date.now();
    // 看门狗在动 GL 之前就挂上：这样 getContext 失败 / 着色器编译炸了这类"早期崩"也能被记下来。
    armWatchdog();
    bootMark('start');
    options.alpha = alpha === 'true' ? true : false;
    options.antialias = antialias === 'false' ? false : true;
    if (useWebgl2 === 'true') {
        gl = window.canvas.getContext("webgl2", options);
    }
    // TODO: this is a hack method to detect whether WebGL2RenderingContext is supported
    if (gl) {
        window.WebGL2RenderingContext = true;
    } else {
        window.WebGL2RenderingContext = false;
        gl = window.canvas.getContext("webgl", options);
    }
    initVertexBuffer();
    useCustomBg && initBgVertexBuffer();
    useLogo && useDefaultLogo && initSloganVertexBuffer();
    initProgressVertexBuffer();

    initLogoTexture();
    useCustomBg && initBgTexture();
    useLogo && useDefaultLogo && initSloganTexture();

    if (useLogo) {
        program = initShaders(VS_LOGO, FS_LOGO);
    }
    if (useCustomBg) {
        programBg = initShaders(VS_BG, FS_BG);
    }
    programProgress = initShaders(VS_PROGRESSBAR, FS_PROGRESSBAR);
    tick();
    
    return Promise.all([
        //logo should be loaded earlier than slogan
        useLogo && loadImage(logoName).then(() => {
            // 缺 splash-logo.png（404 / 未生成）→ 用系统字体画一张同尺寸替代图，继续启动。
            // 这两个 PNG 目前只由 tools/make-splash.ts 手工产出，没接进任何 npm script，漏跑是常态，
            // 所以这里绝不能 throw：一旦 throw，start() 变 rejected，end() 不被调 → 永久纸色屏。
            if (!image) image = createTextCanvas(280, 400, ['快乐推麻', '对对消']);
            if (image) { updateVertexBuffer(); updateLogoTexture(); }
            else { useLogo = false; useDefaultLogo = false; bootMark('degraded:logo-skip'); }
        }).then(() => {
            if (!(useLogo && useDefaultLogo)) return;   // image 都没有时 slogan 的顶点算不出来（要除 image.height）
            return loadSlogan('splash-slogan.png').then(() => {
                if (!slogan) slogan = createTextCanvas(904, 128, ['推一推 · 碰个对']);
                if (slogan) { updateSloganVertexBuffer(); updateSloganTexture(); }
                else { useDefaultLogo = false; bootMark('degraded:slogan-skip'); }
            });
        }),
        useCustomBg && loadBackground(bgName).then(() => {
            // useCustomBg 当前是 false（见文件头常量），这条分支不执行；保留兜底是为了以后打开背景图时
            // 也不会因为 background.png 缺失而卡死 —— 缺图就退回纯色底（bgColor 已是纸色）。
            if (!bg) bg = createTextCanvas(64, 64, ['']);
            if (bg) { updateBgVertexBuffer(); updateBgTexture(); }
            else { useCustomBg = false; bootMark('degraded:bg-skip'); }
        })
    ]).then(() => {
        // 图片就绪后再开始爬进度：上限最多到 0.95（真到 100% 只有 end() 才给），
        // 这样进度条一直在动，但不会假装"已经加载完"。
        if (splashCreep === null) {
            splashCreep = setInterval(() => {
                const target = Math.min(splashCap, 0.95);
                splashShown = Math.min(target, splashShown + (target - splashShown) * 0.08 + 0.002);
                progress = splashShown;
            }, 120);
        }
        return setProgress(0);
    }).catch((err) => {
        // 最后一道闸：上面任何一步意外抛了（比如 texImage2D 在异常上下文里炸），也只记一笔并让
        // start() 正常 resolve —— 素材问题不该演变成"永远起不来"。
        bootMark('asset-load-error:' + String((err && err.message) || err).slice(0, 120));
        console.error('[first-screen] 启动页素材/绘制降级继续', err);
    });
}
module.exports = { start, end, setProgress };
