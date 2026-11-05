/** Procedural Chinese-garden background: sky, misty mountains, pavilion, foliage frame. */
import {T} from './theme';

const cache = new Map<string, HTMLCanvasElement>();

function make(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d')!;
  paint(ctx, c.width, c.height);
  return c;
}

/** Returns a cached background sized to (w, h); callers blit it at 0,0. */
export function gardenBg(w: number, h: number): HTMLCanvasElement {
  const key = Math.round(w) + 'x' + Math.round(h);
  let hit = cache.get(key);
  if (!hit) { hit = make(w, h); cache.set(key, hit); if (cache.size > 6) cache.delete(cache.keys().next().value!); }
  return hit;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string, rot = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

function leafCluster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, col: string, deep: string): void {
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 1.05;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * .55, -s * .5, s * 1.25, 0);
    ctx.quadraticCurveTo(s * .55, s * .5, 0, 0);
    ctx.fillStyle = i % 2 ? col : deep; ctx.fill();
    ctx.restore();
  }
}

function mountain(ctx: CanvasRenderingContext2D, w: number, h: number, baseY: number, amp: number, col: string, seed: number): void {
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 48) {
    const t = x / w;
    const y = baseY - Math.sin(t * 3.1 + seed) * amp - Math.sin(t * 8.3 + seed * 2.7) * amp * .32;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, T.sky1); sky.addColorStop(.34, T.sky2); sky.addColorStop(.62, '#E7F2DE'); sky.addColorStop(1, T.sky3);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  // sun glow
  const glow = ctx.createRadialGradient(w * .74, h * .12, 0, w * .74, h * .12, w * .6);
  glow.addColorStop(0, 'rgba(255,255,235,.85)'); glow.addColorStop(1, 'rgba(255,255,235,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  mountain(ctx, w, h, h * .52, h * .1, '#B6D6C9', .4);
  mountain(ctx, w, h, h * .60, h * .08, '#9CC4B4', 2.1);
  mountain(ctx, w, h, h * .68, h * .06, '#84B29A', 4.3);

  // pavilion silhouette on the left
  ctx.save(); ctx.translate(w * .12, h * .70); const s = Math.min(w, h) * .11;
  ctx.fillStyle = 'rgba(120,86,60,.42)';
  ctx.beginPath(); ctx.moveTo(-s * 1.5, 0); ctx.lineTo(-s * .85, -s * .5); ctx.lineTo(s * .85, -s * .5); ctx.lineTo(s * 1.5, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 1.05, 0); ctx.lineTo(-s * .55, -s * .42); ctx.lineTo(s * .55, -s * .42); ctx.lineTo(s * 1.05, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(-s * .72, 0, s * .14, s * .95); ctx.fillRect(s * .58, 0, s * .14, s * .95);
  ctx.fillRect(-s * .6, s * .78, s * 1.2, s * .16);
  ctx.beginPath(); ctx.moveTo(-s * .5, s * .95); ctx.lineTo(-s * .5, s * 1.5); ctx.lineTo(s * .5, s * 1.5); ctx.lineTo(s * .5, s * .95); ctx.closePath();
  ctx.fillStyle = 'rgba(110,78,52,.32)'; ctx.fill();
  ctx.restore();

  // ground
  const ground = ctx.createLinearGradient(0, h * .82, 0, h);
  ground.addColorStop(0, 'rgba(160,196,124,0)'); ground.addColorStop(.4, 'rgba(143,182,95,.75)'); ground.addColorStop(1, T.gardenDark);
  ctx.fillStyle = ground; ctx.fillRect(0, h * .8, w, h * .2);

  // foliage frame
  const edge = Math.min(w, h);
  ctx.save();
  const spread = (n: number, f: (i: number) => void) => { for (let i = 0; i < n; i++) f(i); };
  spread(9, i => {
    const t = i / 8;
    leafCluster(ctx, -edge * .04 + Math.sin(i * 1.7) * edge * .05, h * (.06 + t * .95), edge * (.07 + (i % 3) * .015), t * 3 + i, T.leaf, T.leafDark);
  });
  spread(8, i => {
    const t = i / 7;
    leafCluster(ctx, w + edge * .04 - Math.sin(i * 1.3) * edge * .05, h * (.02 + t * .9), edge * (.06 + (i % 3) * .014), -t * 3 - i, T.leaf, T.leafDark);
  });
  spread(7, i => {
    const t = i / 6;
    leafCluster(ctx, w * (.05 + t * .95), h * 1.02, edge * (.055 + (i % 3) * .012), Math.PI * .5 + t * 2 + i, T.leafDark, T.gardenDark);
  });
  spread(6, i => {
    const t = i / 5;
    leafCluster(ctx, w * (.08 + t * .9), -edge * .02, edge * (.05 + (i % 2) * .013), -Math.PI * .5 + t * 2 + i, T.leafLight, T.leaf);
  });
  ctx.restore();

  // a few blossoms on the frame, matching the reference art
  const blossom = (x: number, y: number, r: number) => {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      blob(ctx, x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .52, r * .52, '#FFFFFF');
    }
    blob(ctx, x, y, r * .42, r * .42, '#F6D46B');
  };
  ctx.save(); ctx.globalAlpha = .92;
  blossom(w * .90, h * .07, edge * .045);
  blossom(w * .05, h * .30, edge * .035);
  blossom(w * .95, h * .62, edge * .032);
  ctx.restore();

  // soft vignette so panels read on top
  const vig = ctx.createRadialGradient(w * .5, h * .48, Math.min(w, h) * .28, w * .5, h * .5, Math.max(w, h) * .78);
  vig.addColorStop(0, 'rgba(255,255,255,.28)'); vig.addColorStop(1, 'rgba(30,60,40,.14)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
}

export {blob};