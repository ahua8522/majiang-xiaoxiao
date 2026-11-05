/** Shared Canvas2D widgets: rounded panels, jade/cream buttons, pills, toggles, stars. */
import {FONT_SANS, FONT_SERIF, T} from './theme';
import {IconName, icon} from './icons';

export interface Box {x: number; y: number; w: number; h: number}
export interface Hit extends Box {id: string; enabled: boolean}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRR(ctx: CanvasRenderingContext2D, b: Box, r: number, fill: string | CanvasGradient): void {
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.fillStyle = fill; ctx.fill();
}
export function strokeRR(ctx: CanvasRenderingContext2D, b: Box, r: number, col: string, lw: number): void {
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number,
  color: string, align: CanvasTextAlign = 'center', bold = false, serif = false, baseline: CanvasTextBaseline = 'middle'): void {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${serif ? FONT_SERIF : FONT_SANS}`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Truncates a string to fit `maxW` at `size`, adding an ellipsis. */
export function fit(ctx: CanvasRenderingContext2D, str: string, size: number, maxW: number, bold = false, serif = false): string {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${serif ? FONT_SERIF : FONT_SANS}`;
  if (ctx.measureText(str).width <= maxW) return str;
  let out = '';
  for (const ch of str) {
    if (ctx.measureText(out + ch + '…').width > maxW) break;
    out += ch;
  }
  return out + '…';
}

export interface PanelOpts {r?: number; fill?: string; stroke?: string; lw?: number; inner?: boolean}
/** Cream card with a gold double border and a subtle inner hairline. */
export function panel(ctx: CanvasRenderingContext2D, b: Box, o: PanelOpts = {}): void {
  const r = o.r ?? Math.min(b.w, b.h) * .09;
  ctx.save();
  ctx.globalAlpha = .22; fillRR(ctx, {x: b.x, y: b.y + b.h * .012, w: b.w, h: b.h}, r, '#3B2A12'); ctx.restore();
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, o.fill ?? '#FFFBF0'); g.addColorStop(1, o.fill ? o.fill : T.creamDeep);
  fillRR(ctx, b, r, g);
  strokeRR(ctx, b, r, o.stroke ?? T.gold, o.lw ?? Math.max(2, b.w * .006));
  if (o.inner !== false) strokeRR(ctx, {x: b.x + b.w * .022, y: b.y + b.h * .016, w: b.w * .956, h: b.h * .968}, r * .9, 'rgba(216,169,78,.5)', 1.5);
}

export interface BtnOpts {size?: number; kind?: 'jade' | 'cream' | 'gold' | 'dark' | 'disabled'; icon?: IconName; r?: number; sub?: string; pressed?: boolean}
export const KIND = {
  jade: {top: '#5FBE72', bottom: '#2E7D4F', edge: '#1C5B37', ink: '#FFFFFF'},
  cream: {top: '#FFFDF6', bottom: '#F1E4C4', edge: '#D8B872', ink: '#3E5A3A'},
  gold: {top: '#F5D27A', bottom: '#D8A94E', edge: '#A87C2C', ink: '#5A3F0E'},
  dark: {top: '#4A6B4A', bottom: '#2E4A32', edge: '#20361F', ink: '#F3EAD2'},
  disabled: {top: '#EFE8D6', bottom: '#E0D6BE', edge: '#CBBE9E', ink: '#A79B7E'}
} as const;

/** Draws a thick game button and returns its box for hit-testing. */
export function button(ctx: CanvasRenderingContext2D, b: Box, label: string, o: BtnOpts = {}): Box {
  const k = KIND[o.kind ?? 'jade'];
  const r = o.r ?? b.h * .34;
  const dy = o.pressed ? b.h * .06 : 0;
  const body = {x: b.x, y: b.y + b.h * .05, w: b.w, h: b.h * .95};
  fillRR(ctx, body, r, k.edge);
  const face = {x: b.x, y: b.y + dy, w: b.w, h: b.h * .9};
  const g = ctx.createLinearGradient(face.x, face.y, face.x, face.y + face.h);
  g.addColorStop(0, k.top); g.addColorStop(1, k.bottom);
  fillRR(ctx, face, r, g);
  // top gloss
  ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#FFFFFF';
  fillRR(ctx, {x: face.x + face.w * .06, y: face.y + face.h * .09, w: face.w * .88, h: face.h * .2}, r * .6, '#FFFFFF'); ctx.restore();
  strokeRR(ctx, face, r, k.edge, Math.max(1.5, b.h * .022));
  // gold corner studs
  ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = o.kind === 'jade' ? T.goldLight : T.gold;
  for (const sx of [face.x + face.w * .07, face.x + face.w * .93]) {
    ctx.beginPath(); ctx.arc(sx, face.y + face.h * .5, b.h * .045, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const size = o.size ?? b.h * .4;
  const labelY = o.sub ? face.y + face.h * .36 : face.y + face.h * .5;
  if (o.icon) {
    // 图标 + 文字作为一个整体居中，而不是各占一个固定比例位——否则长短标题的间距会飘。
    ctx.font = `700 ${size}px ${FONT_SANS}`;
    const lw = ctx.measureText(label).width;
    const gap = size * .44;
    const total = size * 1.05 + gap + lw;
    const x0 = face.x + face.w / 2 - total / 2;
    icon(ctx, o.icon, x0 + size * .52, labelY, size * 1.05, k.ink, Math.max(2, size * .1));
    text(ctx, label, x0 + size * 1.05 + gap, labelY, size, k.ink, 'left', true);
  } else {
    text(ctx, label, face.x + face.w / 2, labelY, size, k.ink, 'center', true);
  }
  if (o.sub) text(ctx, o.sub, face.x + face.w / 2, face.y + face.h * .74, size * .62, k.ink, 'center', false);
  return face;
}

/** Dark jade pill with a gold rim, used for headers and stat chips. */
export function pill(ctx: CanvasRenderingContext2D, b: Box, label: string, o: {size?: number; ink?: string; fill?: string; edge?: string; r?: number; serif?: boolean} = {}): void {
  const r = o.r ?? b.h / 2;
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, o.fill ?? '#3E7A48'); g.addColorStop(1, o.fill ? o.fill : '#22552F');
  fillRR(ctx, b, r, g);
  strokeRR(ctx, {x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2}, r, o.edge ?? T.gold, Math.max(1.5, b.h * .05));
  text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, o.size ?? b.h * .46, o.ink ?? '#FBF3DE', 'center', true, o.serif);
}

/** Star row; `got` filled gold, the rest pale. */
export function stars(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, got: number, total = 3, gap = 0): void {
  const step = r * 2.35 + gap;
  const x0 = cx - step * (total - 1) / 2;
  for (let i = 0; i < total; i++) star(ctx, x0 + i * step, cy, r, i < got);
}
export function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .47 : r;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  if (filled) { g.addColorStop(0, '#FFE27A'); g.addColorStop(1, '#E8A526'); }
  else { g.addColorStop(0, '#DCD3BC'); g.addColorStop(1, '#C2B79C'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * .1); ctx.strokeStyle = filled ? '#B8851A' : '#AFA489'; ctx.stroke();
}

/** iOS-style switch; returns the drawn box. */
export function toggle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, on: boolean): Box {
  const h = w * .58, b = {x, y: y - h / 2, w, h};
  const r = h / 2;
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + h);
  if (on) { g.addColorStop(0, '#4FA46A'); g.addColorStop(1, '#2E7D4F'); }
  else { g.addColorStop(0, '#D9D2C0'); g.addColorStop(1, '#C3BAA4'); }
  fillRR(ctx, b, r, g);
  ctx.beginPath(); ctx.arc(on ? b.x + w - r : b.x + r, y, r * .82, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.stroke();
  return b;
}

/** Chevron pointing right (menu affordance). */
export function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, lw: number): void {
  ctx.beginPath(); ctx.moveTo(x - s * .3, y - s * .5); ctx.lineTo(x + s * .3, y); ctx.lineTo(x - s * .3, y + s * .5);
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.stroke();
}
export function backChevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, lw: number): void {
  ctx.beginPath(); ctx.moveTo(x + s * .28, y - s * .5); ctx.lineTo(x - s * .3, y); ctx.lineTo(x + s * .28, y + s * .5);
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.stroke();
}