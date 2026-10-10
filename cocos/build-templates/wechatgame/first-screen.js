// 茶馆风启动页：替换 Cocos 默认 logo/slogan 的 first-screen。
// 接口与构建模板一致：{ start, setProgress, end }，game.js 依此驱动加载进度。
'use strict';

const PAPER = [241 / 255, 235 / 255, 221 / 255, 1];
const TEA = [36 / 255, 89 / 255, 78 / 255, 1];
const TRACK = [224 / 255, 214 / 255, 194 / 255, 1];

let gl = null;
let texProgram = null;
let solidProgram = null;
let titleTexture = null;
let titleQuad = null;
let barQuad = null;
let progress = 0;
let shown = 0;
let running = false;
let rafHandle = null;

const VS = `
attribute vec2 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() {
    gl_Position = vec4(a_Position, 0.0, 1.0);
    v_TexCoord = a_TexCoord;
}`;

const FS_TEX = `
precision mediump float;
uniform sampler2D u_Sampler;
varying vec2 v_TexCoord;
void main() {
    gl_FragColor = texture2D(u_Sampler, v_TexCoord);
}`;

const FS_SOLID = `
precision mediump float;
uniform vec4 u_Color;
void main() {
    gl_FragColor = u_Color;
}`;

function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function link(fsSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function makeQuad() {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(16), gl.DYNAMIC_DRAW);
    return buffer;
}

// x0,y0,x1,y1 为裁剪坐标（-1..1），写入四边形顶点（位置+UV）
function fillQuad(buffer, x0, y0, x1, y1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([
        x0, y0, 0, 0,
        x1, y0, 1, 0,
        x0, y1, 0, 1,
        x1, y1, 1, 1,
    ]));
}

function bindQuad(buffer, program) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const pos = gl.getAttribLocation(program, 'a_Position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
    const uv = gl.getAttribLocation(program, 'a_TexCoord');
    if (uv >= 0) {
        gl.enableVertexAttribArray(uv);
        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    }
}

function drawSolid(buffer, color, x0, y0, x1, y1) {
    fillQuad(buffer, x0, y0, x1, y1);
    gl.useProgram(solidProgram);
    bindQuad(buffer, solidProgram);
    gl.uniform4fv(gl.getUniformLocation(solidProgram, 'u_Color'), color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// 离屏 2D canvas 画出标题牌面，转成 GL 纹理
function makeTitleImage() {
    const off = wx.createCanvas();
    const w = 640, h = 520;
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('no 2d context on offscreen canvas');
    ctx.clearRect(0, 0, w, h);

    // 三张麻将牌
    const tiles = [
        {x: 110, rot: -0.12, mark: 'tea'},
        {x: 260, rot: 0, mark: 'wan'},
        {x: 410, rot: 0.12, mark: 'tong'},
    ];
    for (const t of tiles) {
        ctx.save();
        ctx.translate(t.x + 60, 150);
        ctx.rotate(t.rot);
        ctx.fillStyle = '#FFF9E9';
        ctx.strokeStyle = '#BA9263';
        ctx.lineWidth = 5;
        roundRect(ctx, -60, -80, 120, 160, 14);
        ctx.fill();
        ctx.stroke();
        if (t.mark === 'wan') {
            ctx.fillStyle = '#24594E';
            ctx.font = 'bold 72px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('萬', 0, 4);
        } else if (t.mark === 'tong') {
            ctx.fillStyle = '#C95144';
            for (const [dx, dy] of [[-26, -30], [26, -30], [0, 26]]) {
                ctx.beginPath();
                ctx.arc(dx, dy, 18, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#24594E';
            ctx.font = 'bold 64px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('茶', 0, 4);
        }
        ctx.restore();
    }

    ctx.fillStyle = '#24594E';
    ctx.font = 'bold 92px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('麻将小茶馆', w / 2, 330);

    ctx.fillStyle = '#8A6D4F';
    ctx.font = '40px sans-serif';
    ctx.fillText('推一推 · 碰个对', w / 2, 420);

    ctx.fillStyle = '#B6A98F';
    ctx.font = '30px sans-serif';
    ctx.fillText('正在烧水备茶…', w / 2, 480);
    return off;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function uploadTitle(off) {
    // 直接用离屏 canvas 作为纹理源：dataURL→Image 的 onload 在模拟器里不触发，会卡死启动页
    try {
        titleTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, titleTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        titleRatio = off.width / off.height;
    } catch (e) {
        titleTexture = null;
    }
    return Promise.resolve();
}

let titleRatio = 640 / 520;

function draw() {
    if (!gl || !solidProgram) return;
    gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (titleTexture && texProgram) {
        const h = 0.62;
        const w = h * titleRatio * (canvas.height / canvas.width);
        fillQuad(titleQuad, -w / 2, -h / 2 + 0.18, w / 2, h / 2 + 0.18);
        gl.useProgram(texProgram);
        bindQuad(titleQuad, texProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, titleTexture);
        gl.uniform1i(gl.getUniformLocation(texProgram, 'u_Sampler'), 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const barY = -0.82, barH = 0.012, barW = 0.6;
    // 显示值向目标插值，避免长时间停在某一刻度显得卡死
    shown += (Math.min(progress, 1) - shown) * 0.06;
    const p = shown > 0.002 ? shown : 0;
    drawSolid(barQuad, TRACK, -barW / 2, barY - barH, barW / 2, barY + barH);
    if (p > 0) {
        drawSolid(barQuad, TEA, -barW / 2, barY - barH, -barW / 2 + barW * p, barY + barH);
    }
}

function tick() {
    try {
        draw();
    } catch (e) {
        running = false;
        return;
    }
    if (running) rafHandle = requestAnimationFrame(tick);
}

function start() {
    gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        depth: true,
        stencil: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
    });
    if (!gl) return Promise.resolve();
    texProgram = link(FS_TEX);
    solidProgram = link(FS_SOLID);
    titleQuad = makeQuad();
    barQuad = makeQuad();
    running = true;
    tick();
    let ready;
    try {
        ready = uploadTitle(makeTitleImage());
    } catch (e) {
        console.warn('[first-screen] title skipped:', e);
        ready = Promise.resolve();
    }
    // 看门狗：任何环节卡住都不能把 game.js 的加载链掐断
    return Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]).then(() => {
        draw();
    });
}

function setProgress(val) {
    if (!running) return Promise.resolve();
    progress = val;
    draw();
    return Promise.resolve();
}

function end() {
    running = false;
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    draw();
    return Promise.resolve();
}

module.exports = {start, end, setProgress};
