/**
 * 微信加载页素材生成探针：在浏览器里用「与游戏内同一套画法」画启动页 PNG。
 *
 * 为什么走浏览器：drawTile / faceArt 依赖 Canvas2D，node 里没有真 context；
 * 用 esbuild 打包本文件 → Playwright addScriptTag 注入 → toDataURL 拿图 → omitBackground 截图落盘（保透明通道）。
 *
 * 产物（写入 cocos/build-templates/wechatgame/）：
 *   - splash-logo.png   280×400：三张 萬/乐/筒 大字牌（大厅装饰牌同款），内容收在上半部（y<230，
 *                       官方模板把 slogan 放在 logo 高度 56.5% 处）。不再出现「麻将小茶馆」文案。
 *   - splash-slogan.png 904×128：游戏内同款玉色衬线「推一推 · 碰个对」。
 */
import {drawTile} from '../assets/scripts/view/art';

const SERIF = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif CJK SC",serif';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

/** 三张 萬/乐/筒 大字牌，微微斜靠，内容收在上半部。 */
function drawLogo(): string {
  const [c, ctx] = canvas(280, 400);
  const tiles: [string, number, number, number, number][] = [
    // [face, 中心x, 中心y, 旋转, 缩放]
    ['x1', 66, 118, -0.16, 0.82],
    ['x2', 140, 106, -0.04, 1],
    ['x3', 214, 120, 0.13, 0.95]
  ];
  for (const [face, cx, cy, rot, scale] of tiles) {
    const w = 92 * scale, h = 116 * scale;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot);
    drawTile(ctx, face, -w / 2, -h / 2, {w, h});
    ctx.restore();
  }
  return c.toDataURL('image/png');
}

/** 玉色衬线标语，单行居中（去掉旧版的「游戏加载中」与「麻将小茶馆」）。 */
function drawSlogan(): string {
  const [c, ctx] = canvas(904, 128);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 62px ${SERIF}`;
  ctx.fillStyle = '#1C5B37';
  ctx.fillText('推一推 · 碰个对', 452, 70);
  return c.toDataURL('image/png');
}

(window as any).__mjSplash = {logo: drawLogo, slogan: drawSlogan};
// 供排查用：把 drawTile 暴露给页面（牌面 contact sheet 探针）
(window as any).__mjDrawTile = drawTile;
