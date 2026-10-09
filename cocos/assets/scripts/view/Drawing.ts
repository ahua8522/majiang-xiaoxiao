export type Command =
  | { type: 'rect'; x: number; y: number; w: number; h: number; r: number; color: string; stroke?: string; lineWidth?: number }
  | { type: 'circle'; x: number; y: number; r: number; color: string; stroke?: string; lineWidth?: number }
  | { type: 'line'; points: { x: number; y: number }[]; color: string; lineWidth: number }
  | { type: 'text'; x: number; y: number; text: string; size: number; color: string; align: 'left' | 'center' | 'right'; bold?: boolean; font?: string };

export const colors = {
  table: '#F1EBDD', ink: '#254D41', muted: '#798375', paper: '#FFF9E9',
  cream: '#FAF5E9', orange: '#BE743D', orangeEdge: '#98542A', grass: '#81AF68',
  green: '#368568', blue: '#356B81', red: '#C95144', wood: '#E7BA80', woodEdge: '#95663F',
  clear: '#00000000', white: '#FFFFFF'
};

export const finite = (n: number, fallback = 0): number => Number.isFinite(n) ? n : fallback;
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, finite(n, lo)));

// Conservative em widths, deliberately independent of any canvas/font measurement API.
const em = (ch: string): number => (ch.codePointAt(0) || 0) < 128 ? 0.65 : 1;
export function textWidth(text: string, size: number): number {
  return Array.from(text).reduce((sum, ch) => sum + em(ch) * size, 0);
}
export function ellipsis(text: string, size: number, width: number): string {
  if (textWidth(text, size) <= width) return text;
  let out = '';
  for (const ch of text) {
    if (textWidth(out + ch + '…', size) > width) break;
    out += ch;
  }
  return out + '…';
}

/** Builds commands in 750-wide design units. All output coordinates, including text y,
 * are top-origin. Text y is the top of its em box, not an alphabetic baseline.
 * Commands paint in array order; stroke is centered, and lines use round joins/caps.
 */
export class Drawing {
  readonly commands: Command[] = [];
  constructor(readonly scale: number) {}

  rect(x: number, y: number, w: number, h: number, r: number, color: string, stroke?: string, lineWidth = 1): void {
    const s = this.scale;
    const command: Command = {type: 'rect', x: x * s, y: y * s, w: w * s, h: h * s, r: Math.min(r, w / 2, h / 2) * s, color};
    if (stroke) { command.stroke = stroke; command.lineWidth = lineWidth * s; }
    this.commands.push(command);
  }
  circle(x: number, y: number, r: number, color: string, stroke?: string, lineWidth = 1): void {
    const s = this.scale;
    const command: Command = {type: 'circle', x: x * s, y: y * s, r: r * s, color};
    if (stroke) { command.stroke = stroke; command.lineWidth = lineWidth * s; }
    this.commands.push(command);
  }
  line(points: number[][], color: string, lineWidth = 2): void {
    this.commands.push({type: 'line', points: points.map(([x, y]) => ({x: x * this.scale, y: y * this.scale})), color, lineWidth: lineWidth * this.scale});
  }
  text(text: string, x: number, y: number, size: number, color = colors.ink, align: 'left' | 'center' | 'right' = 'left', bold = false, width = Infinity, font = 'sans-serif'): void {
    this.commands.push({type: 'text', text: ellipsis(text.replace(/[\r\n\t]/g, ' '), size, width), x: x * this.scale, y: y * this.scale, size: size * this.scale, color, align, bold, font});
  }
  paragraph(text: string, x: number, y: number, width: number, size: number, maxLines: number, color = colors.ink, lineHeight = size * 1.4): void {
    let line = '', row = 0;
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (row === maxLines - 1) {
        this.text(line + chars.slice(i).join(''), x, y + row * lineHeight, size, color, 'left', false, width);
        return;
      }
      if (ch === '\n' || textWidth(line + ch, size) > width) {
        this.text(line, x, y + row * lineHeight, size, color);
        row++; line = ch === '\n' ? '' : ch;
      } else line += ch;
    }
    if (line) this.text(line, x, y + row * lineHeight, size, color);
  }
}
