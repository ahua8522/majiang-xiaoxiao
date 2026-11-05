/**
 * 庭院背景与首页木桌：与 H5 设计稿（`demo/h5/src/bg.ts` + `app.table()`）同一套画法。
 *
 * 这两样都是**整屏静态大图**，所以不走「每帧画图元」的老路：
 * 启动时（以及屏幕尺寸变化时）画进离屏画布，由 `assets.ts` 烘焙成一张纹理，
 * 之后整屏背景就是 1 个 Sprite、1 次 draw call。
 *
 * 本文件不依赖 cc，也不依赖 DOM——只要求调用方给一个「长得像 2D context」的对象，
 * 这样画法可以在 node 里用假 context 单测。
 */
import {Ctx2D, linear} from './art';
import {palette} from './theme';

/** 旋转的椭圆色块。 */
function blob(ctx: Ctx2D, x: number, y: number, rx: number, ry: number, col: string, rot = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

/** 一簇叶子（5 片扇形排开），边框枝叶的基本单元。 */
function leafCluster(ctx: Ctx2D, x: number, y: number, s: number, rot: number, col: string, deep: string): void {
  for (let i = 0; i < 5; i++) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot + i * 1.05);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * .55, -s * .5, s * 1.25, 0);
    ctx.quadraticCurveTo(s * .55, s * .5, 0, 0);
    ctx.fillStyle = i % 2 ? col : deep; ctx.fill();
    ctx.restore();
  }
}

/** 一重远山（两条正弦叠加出起伏）。 */
function mountain(ctx: Ctx2D, w: number, h: number, baseY: number, amp: number, col: string, seed: number): void {
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 48) {
    const t = x / w;
    const y = baseY - Math.sin(t * 3.1 + seed) * amp - Math.sin(t * 8.3 + seed * 2.7) * amp * .32;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

/** 五瓣小花。 */
function blossom(ctx: Ctx2D, x: number, y: number, r: number): void {
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    blob(ctx, x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .52, r * .52, '#FFFFFF');
  }
  blob(ctx, x, y, r * .42, r * .42, '#F6D46B');
}

/**
 * 整屏庭院背景：天空渐变 → 太阳光晕 → 三重远山 → 亭子剪影 → 地面 → 四周枝叶边框 → 花朵 → 暗角。
 * `w/h` 是设计单位；调用方负责按倍率缩放上下文。
 */
export function drawGarden(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
    [0, palette.sky1], [.34, palette.sky2], [.62, '#E7F2DE'], [1, palette.sky3]
  ]);
  ctx.fillRect(0, 0, w, h);

  // 太阳光晕
  const glow = ctx.createRadialGradient(w * .74, h * .12, 0, w * .74, h * .12, w * .6);
  glow.addColorStop(0, 'rgba(255,255,235,.85)');
  glow.addColorStop(1, 'rgba(255,255,235,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  mountain(ctx, w, h, h * .52, h * .1, '#D5E5D0', .4);
  mountain(ctx, w, h, h * .60, h * .08, '#C6DBBC', 2.1);
  mountain(ctx, w, h, h * .68, h * .06, '#B5D0A5', 4.3);

  // Sunlit flower beds stay at the edges so the mahjong remains the focal point.
  for(let i=0;i<8;i++){
    const x=i%2?w*.95:w*.05,y=h*(.18+i*.095);
    ctx.save();ctx.globalAlpha=.65;
    blossom(ctx,x,y,w*(.018+(i%3)*.005));ctx.restore();
  }

  // 地面
  ctx.fillStyle = linear(ctx, 0, h * .82, 0, h, [
    [0, 'rgba(160,196,124,0)'], [.4, 'rgba(143,182,95,.75)'], [1, palette.gardenDark]
  ]);
  ctx.fillRect(0, h * .8, w, h * .2);

  // 四周枝叶边框：左 9 / 右 8 / 下 7 / 上 6
  const edge = Math.min(w, h);
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    leafCluster(ctx, -edge * .04 + Math.sin(i * 1.7) * edge * .05, h * (.06 + t * .95), edge * (.07 + (i % 3) * .015), t * 3 + i, palette.leaf, palette.leafDark);
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    leafCluster(ctx, w + edge * .04 - Math.sin(i * 1.3) * edge * .05, h * (.02 + t * .9), edge * (.06 + (i % 3) * .014), -t * 3 - i, palette.leaf, palette.leafDark);
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    leafCluster(ctx, w * (.05 + t * .95), h * 1.02, edge * (.055 + (i % 3) * .012), Math.PI * .5 + t * 2 + i, palette.leafDark, palette.gardenDark);
  }
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    leafCluster(ctx, w * (.08 + t * .9), -edge * .02, edge * (.05 + (i % 2) * .013), -Math.PI * .5 + t * 2 + i, palette.leafLight, palette.leaf);
  }
  ctx.restore();

  // 边框上的几朵花
  ctx.save();
  ctx.globalAlpha = .92;
  blossom(ctx, w * .90, h * .07, edge * .045);
  blossom(ctx, w * .05, h * .30, edge * .035);
  blossom(ctx, w * .95, h * .62, edge * .032);
  ctx.restore();

  // 轻暗角，让上面的卡片读得出来
  const vig = ctx.createRadialGradient(w * .5, h * .48, Math.min(w, h) * .28, w * .5, h * .5, Math.max(w, h) * .78);
  vig.addColorStop(0, 'rgba(255,255,255,.28)');
  vig.addColorStop(1, 'rgba(30,60,40,.14)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 首页木桌：木纹台面 + 前沿高光。从 `y` 一直铺到 `h`（超出画布的部分自然裁掉）。
 * 宽高由调用方给（要覆盖整屏宽，并在底部多留一点）。
 */
export function drawTable(ctx: Ctx2D, w: number, y: number, h: number): void {
  const th = h - y + 20;
  ctx.fillStyle = linear(ctx, 0, y, 0, y + th, [
    [0, '#ECDDC1'], [.16, '#DDC79E'], [1, '#C2AA81']
  ]);
  ctx.fillRect(-20, y, w + 40, th);

  // 木纹
  ctx.save();
  ctx.globalAlpha = .16; ctx.strokeStyle = '#5A3714'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const gy = y + 10 + i * (th / 26);
    ctx.beginPath(); ctx.moveTo(-20, gy);
    ctx.bezierCurveTo(w * .3, gy + 5, w * .7, gy - 5, w + 20, gy + 2);
    ctx.stroke();
  }
  ctx.restore();

  // 前沿高光
  ctx.save();
  ctx.globalAlpha = .35;
  ctx.fillStyle = '#F0C892';
  ctx.fillRect(-20, y, w + 40, 14);
  ctx.restore();
}
