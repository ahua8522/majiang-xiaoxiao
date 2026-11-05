/**
 * 单色矢量图标。
 *
 * 之前这些位置用的是 emoji（🔊 🎵 📳 💡 🔀 ↩ ⟳ ▶ ⌂ …）——在「绿玉庭院」这套配色里，
 * 彩色 emoji 是整屏最跳的东西，也是「一眼 AI 生成」的来源：它的字形由系统字体决定，
 * 每个平台都不一样，颜色也压不住。
 *
 * 这里全部改成**用同一种墨色描边画出来的线图标**：笔画粗细、圆角、留白都和界面一致，
 * 想换色只要传一个颜色参数。所有图标都画在边长 `s` 的方框里，以 (cx, cy) 为中心。
 *
 * 本文件不依赖任何其它模块（自己带一个圆角矩形），避免和 ui.ts 互相 import。
 */

export type IconName =
  | 'sound' | 'music' | 'vibrate' | 'book'
  | 'hint' | 'shuffle' | 'undo' | 'restart'
  | 'play' | 'home' | 'progress';

function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** 实心箭头（画在 (x,y)，指向 `ang` 弧度）。 */
function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(-s * .72, s * .64); ctx.lineTo(-s * .72, -s * .64);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * 每个图标的「墨迹」包围盒（比例值，相对边长 s，中心 0.5）——用浏览器实测得到。
 *
 * 为什么需要这张表：直接按同一个 `s` 画，各图标的视觉大小能差近一倍
 * （灯泡带光芒 0.891s，撤销的弧只有 0.508s），垂直中心也差 ±0.06s。
 * 单独看没事，**排成一行就明显高矮不齐**（工具条四个按钮就是这么暴露的）。
 */
const INK: Record<IconName, {w: number; h: number; cx: number; cy: number}> = {
  sound: {w: .840, h: .859, cx: .078, cy: -.002},
  music: {w: .727, h: .832, cx: -.037, cy: -.035},
  vibrate: {w: 1.000, h: .781, cx: -.002, cy: -.002},
  book: {w: .938, h: .676, cx: -.002, cy: -.031},
  hint: {w: 1.000, h: .891, cx: -.002, cy: -.057},
  shuffle: {w: .949, h: .664, cx: .023, cy: -.002},
  undo: {w: .832, h: .508, cx: -.027, cy: .033},
  restart: {w: .742, h: .738, cx: -.002, cy: 0},
  play: {w: .523, h: .602, cx: .037, cy: -.002},
  home: {w: .938, h: .801, cx: -.002, cy: -.012},
  progress: {w: .880, h: .800, cx: -.002, cy: .002}
};
const TARGET_H = .74, MAX_W = .92;

/**
 * 画一个图标。(cx, cy) 是中心，`s` 是图标外接方框边长，`col` 是线色。
 * `weight` 可选，默认按 `s` 推一个和字号相称的线宽。
 */
export function icon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, cy: number, s: number, col: string, weight?: number): void {
  const ink = INK[name];
  // 把墨迹缩放到统一视觉高度、中心对到方框中心；线宽除回去，保证各图标线粗一致
  const k = Math.min(TARGET_H / ink.h, MAX_W / ink.w);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-ink.cx * s, -ink.cy * s);
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = (weight ?? Math.max(1.6, s * .095)) / k;

  switch (name) {
    // 喇叭 + 声波
    case 'sound': {
      ctx.beginPath();
      ctx.moveTo(-s * .34, -s * .16); ctx.lineTo(-s * .14, -s * .16); ctx.lineTo(s * .08, -s * .4);
      ctx.lineTo(s * .08, s * .4); ctx.lineTo(-s * .14, s * .16); ctx.lineTo(-s * .34, s * .16);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .1, 0, s * .24, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * .1, 0, s * .44, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      break;
    }
    // 双联音符
    case 'music': {
      ctx.beginPath(); ctx.ellipse(-s * .24, s * .26, s * .16, s * .115, -.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * .14, s * .16, s * .16, s * .115, -.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * .1, s * .22); ctx.lineTo(-s * .1, -s * .3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .28, s * .12); ctx.lineTo(s * .28, -s * .4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .1, -s * .3); ctx.lineTo(s * .28, -s * .4); ctx.stroke();
      break;
    }
    // 手机 + 两侧震动波纹
    case 'vibrate': {
      rrPath(ctx, -s * .21, -s * .34, s * .42, s * .68, s * .1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .34, -s * .12); ctx.lineTo(-s * .34, s * .12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .45, -s * .24); ctx.lineTo(-s * .45, s * .24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .34, -s * .12); ctx.lineTo(s * .34, s * .12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .45, -s * .24); ctx.lineTo(s * .45, s * .24); ctx.stroke();
      break;
    }
    // 摊开的书
    case 'book': {
      ctx.beginPath();
      ctx.moveTo(0, -s * .26);
      ctx.bezierCurveTo(-s * .14, -s * .35, -s * .3, -s * .33, -s * .42, -s * .26);
      ctx.lineTo(-s * .42, s * .24);
      ctx.bezierCurveTo(-s * .3, s * .18, -s * .14, s * .16, 0, s * .26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * .26);
      ctx.bezierCurveTo(s * .14, -s * .35, s * .3, -s * .33, s * .42, -s * .26);
      ctx.lineTo(s * .42, s * .24);
      ctx.bezierCurveTo(s * .3, s * .18, s * .14, s * .16, 0, s * .26);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * .26); ctx.lineTo(0, s * .26); ctx.stroke();
      break;
    }
    // 灯泡 + 光芒（球体下缘留口，接灯座；不留口会读成「棒棒糖」）
    case 'hint': {
      ctx.beginPath(); ctx.arc(0, -s * .12, s * .3, Math.PI * .7, Math.PI * .3, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .14, s * .05); ctx.lineTo(-s * .14, s * .2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * .14, s * .05); ctx.lineTo(s * .14, s * .2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .17, s * .22); ctx.lineTo(s * .17, s * .22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .12, s * .34); ctx.lineTo(s * .12, s * .34); ctx.stroke();
      for (const a of [-Math.PI * .8, -Math.PI * .2, Math.PI * 1.2, Math.PI * 1.8]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * .44, -s * .12 + Math.sin(a) * s * .44);
        ctx.lineTo(Math.cos(a) * s * .56, -s * .12 + Math.sin(a) * s * .56);
        ctx.stroke();
      }
      break;
    }
    // 两条交叉箭头
    case 'shuffle': {
      ctx.beginPath();
      ctx.moveTo(-s * .4, s * .26);
      ctx.bezierCurveTo(-s * .12, s * .26, s * .12, -s * .26, s * .3, -s * .26);
      ctx.stroke();
      arrowHead(ctx, s * .42, -s * .26, -Math.PI * .16, s * .17);
      ctx.beginPath();
      ctx.moveTo(-s * .4, -s * .26);
      ctx.bezierCurveTo(-s * .12, -s * .26, s * .12, s * .26, s * .3, s * .26);
      ctx.stroke();
      arrowHead(ctx, s * .42, s * .26, Math.PI * .16, s * .17);
      break;
    }
    // 回退箭头
    case 'undo': {
      ctx.beginPath();
      ctx.moveTo(s * .34, s * .24);
      ctx.bezierCurveTo(s * .34, -s * .26, -s * .2, -s * .28, -s * .26, s * .06);
      ctx.stroke();
      arrowHead(ctx, -s * .3, s * .1, Math.PI * .78, s * .18);
      break;
    }
    // 环形刷新箭头
    case 'restart': {
      const r = s * .32, a0 = -Math.PI * .32, a1 = Math.PI * 1.36;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
      const ex = Math.cos(a1) * r, ey = Math.sin(a1) * r;
      arrowHead(ctx, ex, ey, a1 + Math.PI / 2, s * .18);
      break;
    }
    // 播放三角
    case 'play': {
      ctx.beginPath();
      ctx.moveTo(-s * .22, -s * .3); ctx.lineTo(s * .3, 0); ctx.lineTo(-s * .22, s * .3);
      ctx.closePath(); ctx.fill();
      break;
    }
    // 房子
    case 'home': {
      ctx.beginPath(); ctx.moveTo(-s * .42, s * .02); ctx.lineTo(0, -s * .36); ctx.lineTo(s * .42, s * .02); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * .3, -s * .04); ctx.lineTo(-s * .3, s * .34);
      ctx.lineTo(s * .3, s * .34); ctx.lineTo(s * .3, -s * .04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * .08, s * .34); ctx.lineTo(-s * .08, s * .12);
      ctx.lineTo(s * .08, s * .12); ctx.lineTo(s * .08, s * .34);
      ctx.stroke();
      break;
    }
    // 三根上升的柱 + 顶部一颗星位圆点：进度概览
    case 'progress': {
      const bars: [number, number][] = [[-s * .26, .30], [0, .48], [s * .26, .68]];
      for (const [bx, bh] of bars) {
        ctx.beginPath();
        ctx.moveTo(bx - s * .11, s * .34); ctx.lineTo(bx - s * .11, s * .34 - bh * s);
        ctx.lineTo(bx + s * .11, s * .34 - bh * s); ctx.lineTo(bx + s * .11, s * .34);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(s * .26, s * .34 - .68 * s - s * .12, s * .075, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
