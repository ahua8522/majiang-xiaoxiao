/** H5 and Cocos share the same physical mahjong tile art. */
import {drawTile as drawPhysicalTile, faceArt, iceLayers as layers, rr} from '../../../cocos/assets/scripts/view/art';
import {suit, suitColor} from '../../../cocos/assets/scripts/view/theme';
export type Face = string;
export const SUIT_COLOR = suit;
export function parseFace(face: Face): {suit: string; n: number} {
  const f = face.replace(/[~*]+$/, '');
  const lead = /[a-z]/i.test(f[0] || '');
  return {suit: lead ? f[0] : f[1] || '', n: Number(lead ? f.slice(1) : f[0])};
}
export const footColor = suitColor;
export const iceLayers = layers;
export const drawFaceArt = faceArt;
export interface TileOpts {face: Face; w: number; h: number; lift?: number; scale?: number; glow?: boolean}
/** Existing callers use center coordinates; the shared renderer uses top-left. */
export function drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, o: TileOpts): void {
  const {w,h} = o, x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  drawPhysicalTile(ctx, o.face, x, y, o);
  if (o.glow) {
    rr(ctx, x - w * .04, y - h * .04, w * 1.08, h * 1.02, Math.min(w,h) * .15);
    ctx.lineWidth = Math.max(2, w * .06); ctx.strokeStyle = '#FFD84D'; ctx.stroke();
  }
  ctx.restore();
}
