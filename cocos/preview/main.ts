// Browser harness: same Session/GameView/Controller as the Cocos build, painted with Canvas2D.
import {Session} from '../assets/scripts/core/Session';
import {Command} from '../assets/scripts/view/Drawing';
import {Frame, render} from '../assets/scripts/view/GameView';
import {Controller} from '../assets/scripts/view/Input';

const KEY = 'majiang-xiaoxiao:v1';
const params = new URLSearchParams(location.search);
const session = new Session(Number(params.get('seed')) || (Date.now() >>> 0), {
  load: () => localStorage.getItem(KEY),
  save: data => localStorage.setItem(KEY, JSON.stringify(data)),
  feedback: () => navigator.vibrate?.(18)
});
if (params.has('level')) session.reset(Number(params.get('level')), false);
const controller = new Controller(session, {tick: () => navigator.vibrate?.(6)});
(window as any).game = {session, controller, frame: () => frame};

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
let frame: Frame | null = null, dirty = true, revision = -1, last = performance.now();

function paint(commands: Command[]): void {
  for (const c of commands) {
    ctx.beginPath();
    if (c.type === 'text') {
      ctx.font = `${c.bold ? 'bold ' : ''}${c.size}px ${c.font === 'serif' ? '"Songti SC","Noto Serif CJK SC",serif' : '"PingFang SC","Noto Sans CJK SC",sans-serif'}`;
      ctx.textAlign = c.align; ctx.textBaseline = 'top'; ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      continue;
    }
    if (c.type === 'line') {
      ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = c.lineWidth; ctx.strokeStyle = c.color;
      c.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
      continue;
    }
    if (c.type === 'rect') ctx.roundRect(c.x, c.y, c.w, c.h, c.r); else ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = c.color; ctx.fill();
    if (c.stroke) { ctx.lineWidth = c.lineWidth ?? 1; ctx.strokeStyle = c.stroke; ctx.stroke(); }
  }
}

function size(): {w: number; h: number} {
  const h = innerHeight, w = Math.min(innerWidth, Math.round(h * 0.5625));
  return {w, h};
}
function loop(now: number): void {
  if (controller.update((now - last) / 1000)) dirty = true;
  last = now;
  if (session.revision !== revision) dirty = true;
  if (dirty) {
    dirty = false; revision = session.revision;
    const {w, h} = size(), dpr = devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    frame = render(controller.model(), w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    paint(frame.commands);
  }
  requestAnimationFrame(loop);
}
const at = (e: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener('pointerdown', e => { if (!frame) return; canvas.setPointerCapture(e.pointerId); controller.down(frame, ...at(e)); dirty = true; });
canvas.addEventListener('pointermove', e => { if (!frame || !e.buttons) return; controller.move(frame, ...at(e)); dirty = true; });
canvas.addEventListener('pointerup', e => { if (!frame) return; controller.up(frame, ...at(e)); dirty = true; });
canvas.addEventListener('pointercancel', () => { controller.cancel(); dirty = true; });
addEventListener('resize', () => { dirty = true; });
requestAnimationFrame(loop);
