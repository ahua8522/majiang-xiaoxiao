/**
 * H5 demo shell: drives the real core/Session through the UI reference design.
 *
 * Rules, levels and generation come from cocos/assets/scripts/core (no cc dependency),
 * so this demo and the WeChat build share one source of truth.
 */
import {Session, starLines, chapterOf} from '../../../cocos/assets/scripts/core/Session';
import {count, bare} from '../../../cocos/assets/scripts/core/Rules';
import {LEVELS, levelAt} from '../../../cocos/assets/scripts/core/Generator';
import {CHAPTER_NAMES} from '../../../cocos/assets/scripts/core/levels';
import {CHAPTER_LENGTH,CHAPTERS} from '../../../cocos/assets/scripts/core/Campaign';
import {mechanicLocks} from '../../../cocos/assets/scripts/core/Mechanics';
import {SoundStudy} from '../../../docs/redesign-2026-11/sound';
import {gardenBg} from './bg';
import {drawTile} from './tile';
import {IconName, icon} from './icons';
import {FONT_SANS, T} from './theme';
import {Box, Hit, KIND, backChevron, button, chevron, fillRR, fit, panel, pill, rr, star, stars, strokeRR, text, toggle} from './ui';

export const DW = 750;
/** 应用版本号：与 upload-ci.cjs 上传时传的版本保持一致（提版时手动同步）。 */
export const APP_VERSION = '1.4.0';

/**
 * 「新玩法」说明卡的内容（与 cocos GameRoot 的 TIP_CONTENT 同文案）：
 * 每关首次出现某机制时，进关先弹这张卡，看完才开局。
 */
const TIP_CONTENT: Record<string, {title: string; lines: string[]}> = {
  basic: {title: '怎么玩', lines: ['按住任意一行或一列拖动，整段牌会循环滑动；', '松手时，碰在一起的同牌自动消除。', '也可以直接点两张相邻的同牌，立刻消除。', '把牌全部消完就通关，遇到困难用下面的道具。']},
  stack: {title: '叠起来的牌', lines: ['一格上叠着两张牌时，要消两次才能清空这一格。', '牌面右上角的数字就是叠了几层。']},
  lockRow: {title: '锁住的行', lines: ['带木条和锁标的行不能左右推。', '只能竖着推，或直接点消。']},
  moveLimit: {title: '限步关', lines: ['本关有步数上限（右上角实时显示）。', '步数用尽还没清台，这一关就失败了。']},
  oneWay: {title: '单向轨', lines: ['两端带箭头的轨只能朝箭头方向推。', '反方向是推不动的。']},
  lockCol: {title: '锁住的列', lines: ['带木条和锁标的列不能上下推。', '只能横着推，或直接点消。']},
  goal: {title: '目标关', lines: ['不必清空棋盘：先达成左上角的目标就通关。', '进度会实时显示在左上角。']},
  ice: {title: '冰面牌', lines: ['覆着霜面的牌要消两次：', '第一下碎冰露出牌面，第二下才收走。']},
  flower: {title: '花牌', lines: ['春夏秋冬、梅兰竹菊八张花牌加入牌池。', '配对规则不变：同牌相邻，两两消。']},
  wild: {title: '花牌百搭', lines: ['这一关的花牌是百搭：可以和任何牌配对。', '卡住的时候，用它们解围。']},
  stack3: {title: '三层牌', lines: ['一格叠三层：要连消三次才能清空。', '右上角数字就是层数。']},
  ice2: {title: '厚冰', lines: ['双圈厚霜的牌要碎两次冰、再消一次。', '一共三步才能收走。']},
  bomb: {title: '鞭炮牌', lines: ['鞭炮配对时，会把全场同款冰面一次震碎。', '冰面关里的破冰好帮手。']},
  unlock: {title: '连锁解锁', lines: ['带数字的锁轨是暂时锁住的：', '每消一对就计数，凑够数字自动解锁。']}
};

export type Screen = 'home' | 'levels' | 'board' | 'settings' | 'progress' | 'win' | 'lose' | 'pause' | 'help';

export interface Ctx2D extends CanvasRenderingContext2D {}

export class App {
  readonly session: Session;
  readonly audio=new SoundStudy();
  screen: Screen = 'home';
  /** Screen the current overlay was opened from, so closing returns correctly. */
  private returnScreen: Screen = 'home';
  hits: Hit[] = [];
  private pressed: string | null = null;
  private page = 0;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx2D;
  private s = 1;
  private W = DW;
  private H = 1334;
  private raf = 0;
  private needsPaint = true;
  /** 提示动画的起点 / 终点（毫秒）。提示箭头要「依次亮起」，这段时间内必须逐帧重绘。 */
  private pulseStart = 0;
  private pulseUntil = 0;

  // drag state
  private drag: {run: number; axis: 'row' | 'col'; offset: number; cellW: number; cellH: number; x: number; y: number; cell: {r: number; c: number}} | null = null;
  private press: {x: number; y: number; cell: {r: number; c: number} | null; id: string | null; blocked: boolean; axis: 'row' | 'col' | null} | null = null;
  private boardBox: Box | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const KEY = 'majiang-xiaoxiao:h5';
    this.session = new Session(Date.now() >>> 0, {
      load: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
      save: (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* quota */ } },
      feedback: () => { try { (navigator as any).vibrate?.(16); } catch { /* unsupported */ } }
    });
    this.page = Math.floor(this.session.levelIndex / CHAPTER_LENGTH);
    try{const p=JSON.parse(localStorage.getItem('majiang-xiaoxiao:h5:audio')||'{}');this.music=p.music!==false;this.sound=p.sound!==false;}catch{}
    this.audio.configure(this.music,this.sound);
    document.addEventListener('visibilitychange',()=>this.audio.visibility(document.hidden));
    const q = new URLSearchParams(location.search);
    this.session.unlockAll=q.get('preview')==='1';
    const lv = Number(q.get('level'));
    if (Number.isFinite(lv) && q.has('level')) this.session.reset(lv, false);
    const scr = q.get('screen') as Screen | null;
    const valid: Screen[] = ['home', 'levels', 'board', 'settings', 'progress', 'win', 'lose', 'pause', 'help'];
    this.setScreen(scr && valid.includes(scr) ? scr : 'home');
    this.bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  /* ── frame loop ─────────────────────────────────────────── */

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    // 提示箭头是分帧淡入的，这段时间要强制重绘（h5 平时是脏标记 + 按需绘制）
    if (Date.now() < this.pulseUntil) this.needsPaint = true;
    if (!this.needsPaint) return;
    this.needsPaint = false;
    this.draw();
  };
  invalidate(): void { this.needsPaint = true; }

  private resize(): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = Math.min(window.innerWidth, Math.round(window.innerHeight * 0.62));
    const cssH = window.innerHeight;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.s = cssW / DW;
    this.W = DW;
    this.H = cssH / this.s;
    this.invalidate();
  }

  /* ── input ──────────────────────────────────────────────── */

  private bindEvents(): void {
    const at = (e: PointerEvent): {x: number; y: number} => {
      const r = this.canvas.getBoundingClientRect();
      return {x: (e.clientX - r.left) / this.s, y: (e.clientY - r.top) / this.s};
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();this.audio.unlock();
      const {x, y} = at(e);
      this.canvas.setPointerCapture(e.pointerId);
      this.onDown(x, y);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const {x, y} = at(e);
      this.onMove(x, y);
    });
    const up = (e: PointerEvent) => { const {x, y} = at(e); this.onUp(x, y); };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', () => this.onCancel());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private hitAt(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  private onDown(x: number, y: number): void {
    const hit = this.hitAt(x, y);
    this.pressed = hit ? hit.id : null;
    this.invalidate();
    if (hit) { this.press = null; this.drag = null; return; }
    if (this.screen !== 'board') { this.press = null; return; }
    const cell = this.cellAt(x, y);
    this.press = {x, y, cell, id: null, blocked: false, axis: null};
    this.drag = null;
  }

  private onMove(x: number, y: number): void {
    const p = this.press;
    if (!p || !p.cell || p.blocked) return;
    const dx = x - p.x, dy = y - p.y;
    const b = this.boardBox;
    if (!b) return;
    const cellW = b.w / this.cols(), cellH = b.h / this.rows();
    if (!p.axis) {
      const slop = Math.max(8, Math.min(cellW, cellH) * 0.22);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
      p.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
      const run = this.runAt(p.cell, p.axis);
      if (run < 0) {
        p.blocked = true;
        // 锁轨提示统一走顶部横幅（session.notice → revision → 重绘一次）
        this.session.notice(p.axis === 'row' ? '这一行被锁住推不动；试试竖着拖。' : '这一列被锁住推不动；试试横着拖。');
        this.invalidate();
        return;
      }
      this.drag = {run, axis: p.axis, offset: 0, cellW, cellH, x: p.x, y: p.y, cell: p.cell};
    }
    if (!this.drag) return;
    const len = this.session.runs[this.drag.run].cells.length;
    const raw = this.drag.axis === 'row' ? dx / cellW : dy / cellH;
    this.drag = {...this.drag, offset: Math.max(-len, Math.min(len, raw))};
    this.invalidate();
  }

  private onUp(x: number, y: number): void {
    const hit = this.hitAt(x, y);
    const wasPressed = this.pressed;
    this.pressed = null;
    const drag = this.drag;
    this.drag = null;
    const p = this.press;
    this.press = null;
    if (hit && hit.id === wasPressed && hit.enabled) { this.activate(hit.id); return; }
    if (!p) { this.invalidate(); return; }
    if (drag) {
      const len = this.session.runs[drag.run].cells.length;
      const k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) this.act(() => this.session.slide(drag.run, k > len / 2 ? k - len : k));
      else this.invalidate();
      return;
    }
    if (p.cell && !p.blocked && !p.axis) {
      const end = this.cellAt(x, y);
      if (end && end.r === p.cell.r && end.c === p.cell.c) this.act(() => this.session.tap(p.cell!));
      else this.invalidate();
      return;
    }
    this.invalidate();
  }

  private onCancel(): void { this.press = null; this.drag = null; this.pressed = null; this.invalidate(); }

  /** Runs a session mutation and refreshes derived demo state. */
  private act(fn: () => void): void {
    const before=this.session.modal,oldMoves=this.session.moves,oldMarks=this.session.mechanics.marks.join(),oldCharge=this.session.mechanics.charge;
    fn();
    const S=this.session;if(S.moves>oldMoves){this.audio.play(S.lastErased.some(p=>p.face.includes('~')||p.other.includes('~'))?'ice':S.lastChain>1?'combo':S.lastErased.length?'match':'slide');if(S.mechanics.marks.join()!==oldMarks)this.audio.play('bloom');if(S.mechanics.charge>=4&&oldCharge<4)this.audio.play('charge');}
    // 提示统一走顶部横幅（drawBoard 里读 session.message），底部不再有第二条提示
    if (this.session.modal === 'win') this.setScreen('win');
    else if (this.session.modal === 'lose') { this.returnScreen = 'board'; this.setScreen('lose'); }   // 限步用尽
    else if (this.session.modal === 'none' && before === 'none' && this.session.dead) { this.session.finishDead(); this.returnScreen = 'board'; this.setScreen('lose'); }  // 可靠死局判定
    this.invalidate();
  }
  /* ── actions ────────────────────────────────────────────── */

  private go(scr: Screen): void {
    this.returnScreen = this.screen;
    this.setScreen(scr);
    this.invalidate();
  }

  /** Keeps Session.modal aligned with the visible screen so Session.command() stays valid. */
  private setScreen(scr: Screen): void {
    if(scr!==this.screen&&(scr==='win'||scr==='lose'))this.audio.play(scr);
    this.audio.setScene(['board','win','lose','pause'].includes(scr)?'board':'home');this.audio.duck(['win','lose','pause'].includes(scr));
    this.screen = scr;
    // progress 弹框在 Session 侧复用 'settings' 弹窗态（Session 的 Modal 没有 progress）
    const overlay: Partial<Record<Screen, string>> = {settings: 'settings', levels: 'levels', win: 'win', help: 'help', progress: 'settings', pause:'pause', lose:'lose'};
    if (scr === 'board') this.session.modal = 'none';
    else if (scr === 'home') this.session.modal = 'home';
    else if (overlay[scr]) this.session.modal = overlay[scr] as any;
    if (scr === 'levels') this.page = Math.floor(this.session.levelIndex / CHAPTER_LENGTH);
  }

  /** 弹框的固定父级：关闭时回哪一屏。选关/设置从首页打开，进度/玩法说明从设置打开。 */
  private dialogParent(): Screen {
    switch (this.screen) {
      case 'progress': case 'help': return 'settings';
      default: return 'home';
    }
  }

  private activate(id: string): void {
    this.audio.unlock();this.audio.play(id==='undo'?'undo':'ui');
    switch (id) {
      case 'home': this.go('home'); break;
      case 'start': this.session.command('continue'); this.setScreen('board'); break;
      case 'levels': this.go('levels'); break;
      case 'progress': this.go('progress'); break;
      case 'settings': this.go('settings'); break;
      case 'back-home': case '__back': this.go(this.dialogParent()); break;
      case 'about': this.go('help'); break;
      case 'pause': this.returnScreen = 'board'; this.setScreen('pause'); break;
      case 'resume': this.setScreen('board'); break;
      case 'restart': case 'replay': this.act(() => { this.session.reset(); this.setScreen('board'); }); break;
      // 失败页的出路（A3）：复活回牌桌 / 死局免费重排。旧版那颗免费「撤销一步」已删。
      case 'revive': this.act(() => { if (this.session.revive()) this.setScreen('board'); }); break;
      case 'rescue': this.act(() => { if (this.session.rescueShuffle()) this.setScreen('board'); }); break;
      case 'tip-ok': this.act(() => this.session.command('tip-ok')); break;
      case 'next': this.startLevel(Math.min(this.session.levelIndex + 1, LEVELS.length - 1)); break;
      // 提示是分步计划：点一次给一段（K 步），推对一步自动前进。箭头流要逐帧亮起。
      case 'hint': this.act(() => {
        this.session.command('hint');if(this.session.hint.length)this.audio.play('hint');
        this.pulseStart = performance.now();
        this.pulseUntil = Date.now() + 900;
      }); break;
      case 'shuffle': this.setScreen('board'); this.act(() => this.session.command('shuffle')); break;
      case 'undo': this.act(() => {if(this.session.undo())this.setScreen('board');}); break;
      case 'toggle-music': this.music = !this.music; this.persist(); break;
      case 'toggle-sound': this.sound = !this.sound; this.persist(); break;
      case 'toggle-vibration': this.act(() => this.session.command('toggle-vibration')); break;
      case 'page-prev': this.page = Math.max(0, this.page - 1); break;
      case 'page-next': {
        // 翻页按「全部章节」算，不按解锁进度：章节门槛要靠翻到下一页才看得见。
        this.page = Math.min(Math.ceil(LEVELS.length / CHAPTER_LENGTH) - 1, this.page + 1);
        break;
      }
      default:
        if (id.startsWith('level:')) this.startLevel(Number(id.slice(6)));
    }
    this.invalidate();
  }

  private startLevel(i: number): void {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    // 章节门槛（B2）：进不去的关一律不开局，否则门槛在 h5 稿里就是假的
    if (!this.session.canEnter(idx)) return;
    this.act(() => { this.session.reset(idx); });
    this.returnScreen = 'home';
    this.setScreen('board');
  }

  private music = true;
  private sound = true;
  private persist(): void {this.audio.configure(this.music,this.sound);try{localStorage.setItem('majiang-xiaoxiao:h5:audio',JSON.stringify({music:this.music,sound:this.sound}));}catch{}this.invalidate();}

  /* ── board geometry ─────────────────────────────────────── */

  private rows(): number { return this.session.grid.length; }
  private cols(): number { return this.session.grid[0]?.length ?? 0; }

  private cellAt(x: number, y: number): {r: number; c: number} | null {
    const b = this.boardBox;
    if (!b || x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return null;
    const c = Math.floor((x - b.x) / (b.w / this.cols()));
    const r = Math.floor((y - b.y) / (b.h / this.rows()));
    return r >= 0 && r < this.rows() && c >= 0 && c < this.cols() ? {r, c} : null;
  }

  private runAt(cell: {r: number; c: number}, axis: 'row' | 'col'): number {
    return this.session.runs.findIndex((run) => run.axis === axis && run.cells.some((q) => q.r === cell.r && q.c === cell.c));
  }

  /* ── draw ───────────────────────────────────────────────── */

  private draw(): void {
    const ctx = this.ctx;
    const dpr = this.canvas.width / (this.W * this.s);
    ctx.setTransform(this.s * dpr, 0, 0, this.s * dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    this.hits = [];
    const bg = gardenBg(this.W, this.H);
    ctx.drawImage(bg, 0, 0, this.W, this.H);
    switch (this.screen) {
      case 'home': this.drawHome(ctx); break;
      // 设置 / 选关 / 进度 / 玩法说明都是「首页上的弹框」：底图仍是首页，上面盖遮罩 + 面板
      case 'levels': this.drawHome(ctx); this.drawLevels(ctx); break;
      case 'settings': this.drawHome(ctx); this.drawSettings(ctx); break;
      case 'progress': this.drawHome(ctx); this.drawProgress(ctx); break;
      case 'board': this.drawBoard(ctx); break;
      case 'win': this.drawBoard(ctx); this.drawWin(ctx); break;
      case 'lose': this.drawBoard(ctx); this.drawLose(ctx); break;
      case 'pause': this.drawBoard(ctx); this.drawPause(ctx); break;
      case 'help': this.drawHome(ctx); this.drawHelp(ctx); break;
    }
    // 「新玩法」说明卡：进关时 Session 给出待展示的 tip，看完（tip-ok）才开局
    if (this.screen==='board'&&this.session.introTip) this.drawTipCard(ctx);
  }

  /** 「新玩法」说明卡：遮罩 + 面板 + 匾额标题 + 文案 + 知道了。展示期间牌桌输入被 Session 屏蔽。 */
  private drawTipCard(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const tip = this.session.introTip!;
    const ch=CHAPTERS[Number(tip.split(':')[1])];
    const content=tip.startsWith('ctip:')&&ch?{title:ch[0],lines:[ch[2],ch[3]]}:TIP_CONTENT[tip]||TIP_CONTENT.basic;
    const lineH = 54, padTop = 104;
    const ph = padTop + 36 + content.lines.length * lineH + 26 + 96 + 30;
    const py = this.centeredTop(ph);
    const b: Box = {x: 60, y: py, w: W - 120, h: ph};
    panel(ctx, b, {r: 34});
    pill(ctx, {x: W / 2 - 160, y: py + 34, w: 320, h: 72}, content.title, {size: 34, serif: true});
    content.lines.forEach((ln, i) => text(ctx, ln, b.x + 56, py + padTop + 36 + i * lineH, 25, T.ink, 'left'));
    const btn: Box = {x: W / 2 - 170, y: py + ph - 30 - 96, w: 340, h: 92};
    this.push('tip-ok', btn);
    button(ctx, btn, '知道了，开始', {kind: 'jade', size: 30, pressed: this.isPressed('tip-ok')});
  }

  private push(id: string, b: Box, enabled = true): void { this.hits.push({id, x: b.x, y: b.y, w: b.w, h: b.h, enabled}); }
  private isPressed(id: string): boolean { return this.pressed === id; }

  /* ══ HOME ══════════════════════════════════════════════ */

  private drawHome(ctx: Ctx2D): void {
    const W = this.W, H = this.H;
    // 左上角：头像 + 当前关（不给总星数 / 总关数，保持后面的神秘感）
    const av = 46, ax = 30 + av / 2, ay = 74;
    ctx.beginPath(); ctx.arc(ax, ay, av / 2 + 4, 0, Math.PI * 2); ctx.fillStyle = T.jadeDeep; ctx.fill();
    ctx.beginPath(); ctx.arc(ax, ay, av / 2, 0, Math.PI * 2);
    const ag = ctx.createLinearGradient(ax, ay - av / 2, ax, ay + av / 2);
    ag.addColorStop(0, '#F7E9C4'); ag.addColorStop(1, '#E2C68C'); ctx.fillStyle = ag; ctx.fill();
    this.faceIcon(ctx, ax, ay, av * .62);
    text(ctx, `第 ${Math.min(this.session.maxLevel + 1, LEVELS.length)} 关`, 30 + av + 16, ay, 27, T.ink, 'left', true);
    const gear: Box = {x: W - 108, y: 44, w: 66, h: 66};
    this.gearButton(ctx, gear, 'settings');

    // 标题簇：大字「快乐推麻」+ 右侧红印章「对对消」（竖排三字）——连读即完整游戏名。
    // 纵向与 cocos 同一套设计单位（1334 基准，按屏高比例）：大字与印章同一中线（470）、
    // 印章只略高于字面（h156），副标题紧跟其下（中点 576）。
    // 4 字大字（96px ≈ 384 宽）+ 印章（70 宽）按 24 间隙成组居中：大字中心 -47、印章中心 204。
    const ty = H * .352, subY = H * .432;
    text(ctx, '快乐推麻', W / 2 - 47, ty, 96, T.jadeDeep, 'center', true, true);
    const seal: Box = {x: W / 2 + 204 - 35, y: ty - 78, w: 70, h: 156};
    fillRR(ctx, seal, 16, '#C0392B');
    strokeRR(ctx, seal, 16, '#8C2318', 3);
    ['对', '对', '消'].forEach((ch, i) => text(ctx, ch, seal.x + seal.w / 2, ty - 50 + i * 50, 36, '#FFF3DE', 'center', true, true));
    text(ctx, '推一推 · 碰个对', W / 2, subY, 34, T.ink, 'center', true, true);

    // wooden table + decorative tiles（萬 / 乐 / 筒 大字牌，加大一号）
    this.table(ctx, H * .655);
    const baseY = H * .585, tw = 170, th = 215;
    ctx.save();
    ctx.translate(W / 2 - 130, baseY); ctx.rotate(-.16);
    drawTile(ctx, 0, 0, {face: 'x1', w: tw * .82, h: th * .82});
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 - 4, baseY - 30); ctx.rotate(-.04);
    drawTile(ctx, 0, 0, {face: 'x2', w: tw, h: th});
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 + 122, baseY + 4); ctx.rotate(.13);
    drawTile(ctx, 0, 0, {face: 'x3', w: tw, h: th});
    ctx.restore();

    // buttons：开始游戏（通栏）+ 关卡选择（通栏拉长）；「我的进度」收进设置弹框
    const bw = W - 168, bx = (W - bw) / 2;
    const start: Box = {x: bx, y: H * .735, w: bw, h: 104};
    this.push('start', start);
    button(ctx, start, '开始游戏', {kind: 'jade', size: 42, icon: 'play', pressed: this.isPressed('start')});
    const lv: Box = {x: bx, y: start.y + 128, w: bw, h: 92};
    this.push('levels', lv);
    button(ctx, lv, '关卡选择', {kind: 'cream', size: 32, pressed: this.isPressed('levels')});
  }

  private faceIcon(ctx: Ctx2D, cx: number, cy: number, r: number): void {
    ctx.beginPath(); ctx.arc(cx, cy, r * .5, 0, Math.PI * 2); ctx.fillStyle = '#8FBF62'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - r * .16, r * .3, 0, Math.PI * 2); ctx.fillStyle = '#F2D9A8'; ctx.fill();
    ctx.fillStyle = '#2B3A28';
    ctx.beginPath(); ctx.arc(cx - r * .12, cy - r * .2, r * .045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * .12, cy - r * .2, r * .045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + r * .0, r * .09, .15 * Math.PI, .85 * Math.PI); ctx.fill();
  }

  private gearButton(ctx: Ctx2D, b: Box, id: string): void {
    this.push(id, b);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#3E7A48'); g.addColorStop(1, '#1F4F2C'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = T.gold; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#F3EAD2';
    for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-r * .09, -r * .62, r * .18, r * .26); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, r * .42, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(0, 0, r * .17, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ══ LEVELS（首页上的弹框） ═══════════════════════════ */

  private drawLevels(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const PER = CHAPTER_LENGTH, COLS = 4, gap = 20;
    // 一章一屏 4×4：与 cocos 选关页同构，也让章节门槛（B2）有地方落。
    const pages = Math.max(1, Math.ceil(LEVELS.length / PER));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const count = Math.max(0, Math.min(PER, LEVELS.length - this.page * PER));
    const rows = Math.max(1, Math.ceil(count / COLS));
    const pw = W - 68;
    const cw = (pw - 80 - gap * (COLS - 1)) / COLS, chh = 110;
    const gridH = rows * chh + (rows - 1) * gap;
    const ph = 30 + 72 + 24 + 40 + gridH + 38 + 56 + 34 + 30;
    const py = this.centeredTop(ph);
    const b: Box = {x: 34, y: py, w: pw, h: ph};
    panel(ctx, b, {r: 30});
    const cur: Box = {x: 34 + 40, y: py + 30, w: 300, h: 72};
    pill(ctx, cur, '选择关卡', {size: 32, fill: '#2E6B3A', edge: T.gold, r: 36, serif: true});
    const close: Box = {x: b.x + b.w - 96, y: py + 30, w: 58, h: 58};
    this.push('__back', close); this.circleBtn(ctx, close, 'close');

    // 章名行：与 cocos 选关页同一套信息（第 N 章 · 章名（起-止）），否则两边看起来是两种设计
    const full = this.session.chapterStars(this.page) >= CHAPTER_LENGTH * 3;
    text(ctx, `第 ${this.page + 1} 章 · ${CHAPTER_NAMES[this.page] || ''}（${this.page * PER + 1}-${Math.min(LEVELS.length, (this.page + 1) * PER)}）`,
      b.x + 40, py + 30 + 72 + 24, 24, T.ink, 'left', true);
    if (full) text(ctx, '全三星', b.x + b.w - 44, py + 30 + 72 + 24, 21, '#B4442F', 'right', true);

    // 本章被上一章门槛挡住 → 整页灰化。**本章内部不设卡**，卡点只在跨章。
    const gateBlocked = !this.session.canEnterChapter(this.page);
    const gy = py + 30 + 72 + 24 + 40;
    for (let i = 0; i < count; i++) {
      const idx = this.page * PER + i;
      const col = i % COLS, row = Math.floor(i / COLS);
      const bx = b.x + 40 + col * (cw + gap), by = gy + row * (chh + gap);
      const isCur = idx === this.session.levelIndex;
      const st = this.session.stars[String(idx)] || 0;
      const box: Box = {x: bx, y: by, w: cw, h: chh};
      const unlocked = !gateBlocked && this.session.canEnter(idx);
      if (!unlocked) {
        // 灰卡也要占位，否则玩家看不出"这一章有 16 关、只是还没开"
        fillRR(ctx, box, 18, 'rgba(222,216,198,.55)');
        strokeRR(ctx, box, 18, 'rgba(190,180,158,.5)', 2);
        text(ctx, String(idx + 1), bx + cw / 2, by + chh * .42, 36, '#B3A98F', 'center', true);
        continue;
      }
      this.push('level:' + idx, box);
      const g = ctx.createLinearGradient(bx, by, bx, by + chh);
      g.addColorStop(0, '#6FC46F'); g.addColorStop(1, '#2E7D4F');
      fillRR(ctx, {x: bx, y: by + 4, w: cw, h: chh - 4}, 18, '#1C5B37');
      fillRR(ctx, box, 18, g);
      strokeRR(ctx, box, 18, isCur ? '#FFD84D' : 'rgba(255,255,255,.35)', isCur ? 4 : 2);
      text(ctx, String(idx + 1), bx + cw / 2, by + chh * .32, 36, '#FFFFFF', 'center', true);
      stars(ctx, bx + cw / 2, by + chh * .72, 12, st);
      // 刷星导航：已通关、未满星、差得不远时给「差 N 步」。
      // 放在关号同一行的右端——放右上角会压住关号（实测 1-9 号关字更大，直接糊在一起）。
      const bm = this.session.bestMoves[String(idx)] || 0;
      const par = this.session.pars[String(idx)] || 0;
      if (bm && par && st > 0 && st < 3) {
        const line = starLines(par);
        const diff = bm - (st === 1 ? line.two : line.three);
        if (diff > 0 && diff <= 9) text(ctx, `差${diff}步`, bx + cw - 8, by + chh * .30, 13, '#8C3A2E', 'right', true);
      }
    }
    // 门槛提示：必须给具体数字，否则玩家以为是 bug
    if (gateBlocked) {
      text(ctx, '完成前面的关卡，即可来到这里',
        W / 2, py + ph - 92, 21, '#B4442F', 'center', true);
    }
    // pager
    const pyy = py + ph - 58;
    const prev: Box = {x: b.x + 40, y: pyy - 26, w: 70, h: 52};
    const next: Box = {x: b.x + b.w - 110, y: pyy - 26, w: 70, h: 52};
    if (this.page > 0) { this.push('page-prev', prev); backChevron(ctx, prev.x + 35, pyy, 30, T.ink, 5); }
    if (this.page < pages - 1) { this.push('page-next', next); chevron(ctx, next.x + 35, pyy, 30, T.ink, 5); }
    text(ctx, `${this.page+1} / ${pages}`, W/2, pyy, 24, T.ink, 'center', true);

  }

  private lockIcon(ctx: Ctx2D, cx: number, cy: number, r: number, col: string): void {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r * .22);
    ctx.beginPath(); ctx.arc(cx, cy - r * .35, r * .45, Math.PI, 0); ctx.stroke();
    fillRR(ctx, {x: cx - r * .75, y: cy - r * .3, w: r * 1.5, h: r * 1.15}, r * .25, col);
  }

  /** 连锁解锁的数字徽标（消够这个数就解锁）。 */
  private badge(ctx: Ctx2D, cx: number, cy: number, r: number, num: number): void {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#C0392B'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * .18); ctx.strokeStyle = 'rgba(255,240,210,.85)'; ctx.stroke();
    text(ctx, String(num), cx, cy, Math.max(12, r * .95), '#FFFFFF', 'center', true);
  }

  /** 单向轨的箭头（画在木框边带上，方向 = 允许推动的方向）。 */
  private railArrow(ctx: Ctx2D, cx: number, cy: number, size: number, dir: 1 | -1, axis: 'row' | 'col'): void {
    ctx.save();
    ctx.translate(cx, cy);
    const angle = axis === 'row' ? (dir === 1 ? 0 : Math.PI) : (dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    ctx.rotate(angle);
    ctx.strokeStyle = '#E8C56B'; ctx.lineWidth = Math.max(2, size * .3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * .45, -size * .55); ctx.lineTo(size * .45, 0); ctx.lineTo(-size * .45, size * .55);
    ctx.stroke();
    ctx.restore();
  }

  /* ══ BOARD ═════════════════════════════════════════════ */

  private drawBoard(ctx: Ctx2D): void {
    const W = this.W, H = this.H;
    const S = this.session;
    // header
    const back: Box = {x: 26, y: 34, w: 68, h: 68};
    this.push('back-home', back); this.circleBtn(ctx, back, 'back');
    const title: Box = {x: W / 2 - 165, y: 30, w: 330, h: 76};
    pill(ctx, title, `第 ${S.levelIndex + 1} 关`, {size: 38, fill: '#2E6B3A', edge: T.gold, serif: true});
    const gear: Box = {x: W - 94, y: 34, w: 68, h: 68};
    this.gearButton(ctx, gear, 'pause');

    // stats：目标关把左侧换成目标进度；限步关把右侧换成剩余步数
    const left = S.total ? count(S.grid) : 0;
    const goal = S.goal;
    text(ctx, S.objectiveText, 40, 134, 25, goal ? T.jadeDeep : T.ink, 'left', true);
    const moveText = S.moveLimit ? `剩 ${S.movesLeft} 步` : `${S.moves} 步`;
    text(ctx, moveText, W-40,134,25,S.moveLimit&&S.movesLeft<=3?'#B4442F':T.ink,'right',true);
    const targets=goal?.kind==='collect'?goal.faces||[]:goal?.kind==='face'?[goal.face!]:[];
    targets.forEach((f,i)=>{const x=62+i*68;drawTile(ctx,x,193,{face:f,w:32,h:40});text(ctx,(S.mechanics.collected[bare(f)]||0)>=2?'✓':'2',x+22,191,17,T.jadeDeep,'left',true);});
    if(S.def.energy)text(ctx,`灵感 ${S.mechanics.charge}/4`,W-40,193,19,T.jadeDeep,'right',true);
    const pbar: Box = {x: 40, y: 158, w: W - 80, h: 16};
    fillRR(ctx, pbar, 8, 'rgba(60,90,50,.3)');
    const done = goal&&S.goalNeed?S.goalDone/S.goalNeed:S.total?(S.total-left)/S.total:0;
    if (done > 0) {
      const g = ctx.createLinearGradient(pbar.x, pbar.y, pbar.x + pbar.w, pbar.y);
      g.addColorStop(0, '#8FD98F'); g.addColorStop(1, '#4FA46A');
      fillRR(ctx, {x: pbar.x, y: pbar.y, w: Math.max(12, pbar.w * done), h: pbar.h}, 8, g);
    }

    // message banner
    const msg: Box = {x: 34, y: 218, w: W - 68, h: 62};
    const mg = ctx.createLinearGradient(msg.x, msg.y, msg.x, msg.y + msg.h);
    mg.addColorStop(0, '#FFF9E6'); mg.addColorStop(1, '#F6EBCB');
    fillRR(ctx, msg, 31, mg); strokeRR(ctx, msg, 31, T.creamEdge, 2);
    // 左侧一道玉色竖条即可，不再套一个「!」圆形徽标——圆徽标是这套界面里最模板化的一处。
    fillRR(ctx, {x: msg.x + 22, y: msg.y + 16, w: 6, h: msg.h - 32}, 3, T.jade);
    const line = this.drag
      ? (() => { const r = S.runs[this.drag!.run]; return `正在向${this.drag!.axis === 'row' ? (this.drag!.offset > 0 ? '右' : '左') : (this.drag!.offset > 0 ? '下' : '上')}推 ${Math.max(1, Math.abs(Math.round(this.drag!.offset)))} 格 · 松手消除碰起的对子`; })()
      : (S.message || '轻点配对 / 横竖拖动整段');
    text(ctx, fit(ctx, line, 24, msg.w - 76), msg.x + 42, msg.y + msg.h / 2, 24, T.ink, 'left', false);

    // board frame
    const top = msg.y + msg.h + 18;
    const rows=this.rows(),cols=this.cols(),availH=H-154-top,sidePad=cols<=4?34:44;
    const cellW=Math.min((W-sidePad*2)/cols,availH/(rows+.4)/1.24,156),cellH=cellW*1.24;
    const bw=cellW*cols,bh=cellH*rows,pad=cellH*.2;
    const bx=(W-bw)/2,by=top+Math.max(0,(availH-bh)/2);
    this.boardBox = {x: bx, y: by, w: bw, h: bh};
    const frame: Box = {x: bx - pad, y: by - pad, w: bw + pad * 2, h: bh + pad * 2};
    this.woodFrame(ctx, frame);
    // 拖动时牌沿滑轨循环移动，端头会短暂探出木框；裁到木框内，别让它飞到场外
    ctx.save();
    rr(ctx, frame.x, frame.y, frame.w, frame.h, 26);
    ctx.clip();

    // slots + tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = bx + c * cellW, y0 = by + r * cellH;
        const cell = S.grid[r][c];
        const slot: Box = {x: x0 + cellW * .07, y: y0 + cellH * .07, w: cellW * .86, h: cellH * .86};
        // 木桩与空洞统一：木栓底 + 深描边 + 斜十字，一眼读出「此格不通」
        if (cell === '#' || cell === null) {
          fillRR(ctx, slot, 12, 'rgba(96,64,28,.42)');
          strokeRR(ctx, slot, 12, 'rgba(60,38,14,.55)', 2.5);
          ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, slot.w * .06); ctx.strokeStyle = 'rgba(60,38,14,.4)';
          ctx.beginPath();
          ctx.moveTo(slot.x + slot.w * .3, slot.y + slot.h * .3); ctx.lineTo(slot.x + slot.w * .7, slot.y + slot.h * .7);
          ctx.moveTo(slot.x + slot.w * .7, slot.y + slot.h * .3); ctx.lineTo(slot.x + slot.w * .3, slot.y + slot.h * .7);
          ctx.stroke(); ctx.restore();
        }
      }
    }
    // 锁定轨常驻标识：轨底一条方角木条 + 木框边带里的锁标——拖之前就知道这条轨推不动
    const def = levelAt(S.levelIndex);
    const tileable = (row: string) => !!row && row.split('').some((v) => v === '1' || v === '2' || v === '3');
    const railBar = (x: number, y: number, w: number, h: number) => {
      fillRR(ctx, {x, y, w, h}, 5, 'rgba(96,64,28,.30)');
      strokeRR(ctx, {x: x + 1, y: y + 1, w: w - 2, h: h - 2}, 5, 'rgba(60,38,14,.35)', 2);
    };
    const locks=mechanicLocks(def,S.clearedPairs,S.mechanics);
    for (const r of locks.lockR) {
      if (r < 0 || r >= rows || !tileable(def.map[r])) continue;
      const cy = by + r * cellH + cellH / 2;
      railBar(bx, cy - cellH * .46, bw, cellH * .92);
      this.lockIcon(ctx, bx - pad * .45, cy, pad * .34, '#5A3F14');
    }
    for (const c of locks.lockC) {
      if (c < 0 || c >= cols || !def.map.some((row) => tileable(row[c] || ''))) continue;
      const cx = bx + c * cellW + cellW / 2;
      railBar(cx - cellW * .46, by, cellW * .92, bh);
      this.lockIcon(ctx, cx, by - pad * .45, pad * .34, '#5A3F14');
    }
    // 连锁解锁：仍锁着时画锁 + 数字徽标（消够 after 对自动解锁）
    for (const u of (def.unlock||[]).map(u=>({...u,after:u.after-S.clearedPairs})).concat((def.keyLocks||[]).map(k=>({axis:k.axis,index:k.index,after:k.count-(S.mechanics.collected[k.face]||0)})))) {
      if (u.after <= 0) continue;
      if (u.axis === 'row') {
        if (u.index < 0 || u.index >= rows || !tileable(def.map[u.index])) continue;
        const cy = by + u.index * cellH + cellH / 2;
        railBar(bx, cy - cellH * .46, bw, cellH * .92);
        this.lockIcon(ctx, bx - pad * .45, cy, pad * .3, '#5A3F14');
        this.badge(ctx, bx - pad * 1.15, cy, pad * .34, u.after);
      } else {
        if (u.index < 0 || u.index >= cols) continue;
        const cx = bx + u.index * cellW + cellW / 2;
        railBar(cx - cellW * .46, by, cellW * .92, bh);
        this.lockIcon(ctx, cx, by - pad * .45, pad * .3, '#5A3F14');
        this.badge(ctx, cx, by - pad * 1.15, pad * .34, u.after);
      }
    }
    // 单向轨：轨端画箭头（方向 = 允许推动的方向）
    for (const o of def.oneWay || []) {
      if (o.axis === 'row') {
        if (o.index < 0 || o.index >= rows || !tileable(def.map[o.index])) continue;
        const cy = by + o.index * cellH + cellH / 2;
        railBar(bx, cy - cellH * .46, bw, cellH * .92);
        this.railArrow(ctx, bx - pad * .45, cy, pad * .4, o.dir, 'row');
        this.railArrow(ctx, bx + bw + pad * .45, cy, pad * .4, o.dir, 'row');
      } else {
        if (o.index < 0 || o.index >= cols) continue;
        const cx = bx + o.index * cellW + cellW / 2;
        railBar(cx - cellW * .46, by, cellW * .92, bh);
        this.railArrow(ctx, cx, by - pad * .45, pad * .4, o.dir, 'col');
        this.railArrow(ctx, cx, by + bh + pad * .45, pad * .4, o.dir, 'col');
      }
    }
    const dragRun = this.drag ? S.runs[this.drag.run] : null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = S.grid[r][c];
        if (!Array.isArray(cell) || !cell.length) continue;
        let x0 = bx + c * cellW, y0 = by + r * cellH;
        if (dragRun && dragRun.cells.some((p) => p.r === r && p.c === c)) {
          const i = dragRun.cells.findIndex((p) => p.r === r && p.c === c);
          const step = this.drag!.axis === 'row' ? cellW : cellH;
          let off = i + this.drag!.offset;
          const len = dragRun.cells.length;
          while (off > len - 1 + .5) off -= len;
          while (off < -.5) off += len;
          const delta = off - i;
          if (this.drag!.axis === 'row') x0 += delta * step; else y0 += delta * step;
        }
        const visible = Math.min(cell.length, 3);
        const liftY = cellH * .05;
        for (let k = 0; k < visible; k++) {
          const depth = (visible - 1 - k);
          const tw = cellW * .84, th = cellH * .84;
          const isTop = k === visible - 1;
          const cx = x0 + cellW / 2, cy = y0 + cellH * .5 - depth * liftY;
          drawTile(ctx, cx, cy, {face: cell[k], w: tw, h: th, lift: th * .08});
          if (isTop && cell.length > 1) this.countBadge(ctx, cx + tw * .42, cy - th * .38, cell.length);
        }
      }
    }
    // Floor markers stay fixed while tiles slide; corner badges keep faces readable.
    (def.floors||[]).forEach((f,i)=>{
      const x=bx+f.c*cellW,y=by+f.r*cellH,n=S.mechanics.marks[i]||0,done=n>=f.need;
      const color=done?'#4D9965':f.kind==='dew'?'#4B95B5':'#CE6D8A';
      strokeRR(ctx,{x:x+2,y:y+2,w:cellW-4,h:cellH-4},8,color,3);
      fillRR(ctx,{x:x+1,y:y+cellH-24,w:f.kind==='bud'?43:24,h:24},7,'#FFF9EA');
      text(ctx,done?'✓':f.kind==='dew'?'滴':f.kind==='bud'?`${n}/2`:'花',x+12,y+cellH-12,17,color,'center',true);
    });
    const keys=(def.keyLocks||[]).filter(k=>(S.mechanics.collected[k.face]||0)<k.count).map(k=>k.face);
    if(!this.drag)S.grid.forEach((row,r)=>row.forEach((cell,c)=>{if(Array.isArray(cell)&&cell.length&&keys.includes(bare(cell[cell.length-1]))){
      const x=bx+(c+.14)*cellW,y=by+(r+.17)*cellH;
      ctx.strokeStyle='#C89630';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.moveTo(x+5,y);ctx.lineTo(x+18,y);ctx.lineTo(x+18,y+5);ctx.stroke();
    }}));
    // highlights：选中（橙）+ 提示（蓝框 + 方向箭头流）
    const hl = (p: {r: number; c: number}, col: string) => {
      const x0 = bx + p.c * cellW, y0 = by + p.r * cellH;
      ctx.save(); ctx.globalAlpha = .85; ctx.lineWidth = 5; ctx.strokeStyle = col;
      rr(ctx, x0 + cellW * .04, y0 + cellH * .04, cellW * .92, cellH * .92, 14); ctx.stroke(); ctx.restore();
    };
    if (S.selected) hl(S.selected, '#FF8A3D');
    // 只画**队首那一步**：整段计划全标出来会让盘面糊成一片，反而看不出先做哪一步。
    const step0 = S.hint[0];
    if (step0) {
      if (step0.kind === 'match') {
        // 点消：两张牌金框，跟着提示脉冲一起呼吸
        const pulse = .55 + .45 * Math.sin((performance.now() - this.pulseStart) / 180);
        ctx.save(); ctx.globalAlpha = Math.max(.4, pulse);
        hl(step0.a, '#FFD84D'); hl(step0.b, '#FFD84D');
        ctx.restore();
      } else {
        const run = S.runs[step0.run];
        if (run) {
          for (const p of run.cells) hl(p, 'rgba(126,227,255,.55)');
          // 方向箭头流：从推力的上游依次亮起，一眼看出「这一整排往那边滑」
          const dir = step0.step > 0 ? 1 : -1;
          const cells = dir > 0 ? run.cells : run.cells.slice().reverse();
          const ang = run.axis === 'row' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          const elapsed = (performance.now() - this.pulseStart) / 1000;
          cells.forEach((p, i) => {
            const a = Math.max(0, Math.min(1, (elapsed - i * .06) / .18));
            if (a <= 0) return;
            const cx = bx + p.c * cellW + cellW / 2, cy = by + p.r * cellH + cellH / 2;
            const rad = Math.min(cellW, cellH) * .28;
            ctx.save(); ctx.globalAlpha = a;
            // 深色圆底 + 亮色箭头：直接画箭头会和牌面图案（条子的斜线、九萬的撇）糊在一起，
            // 玩家分不清哪个是提示。做成「徽章」之后一眼可辨；透明度压到 ~55%，
            // 因为玩家还要能看清这一行是什么牌（不然不知道推完会消什么）。
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16,44,34,.55)'; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(126,227,255,.85)'; ctx.stroke();
            ctx.translate(cx, cy); ctx.rotate(ang);
            chevron(ctx, 0, 0, rad * 1.35, '#9FEBFF', 5);
            ctx.restore();
          });
        }
      }
    }
    ctx.restore(); // 结束牌区裁剪

    const tools:{id:string;icon:IconName;label:string}[]=[{id:'hint',icon:'hint',label:'提示'},{id:'undo',icon:'undo',label:'撤销'},{id:'restart',icon:'restart',label:'重开'}];
    const tw=(W-68)/3,ty=H-132;
    fillRR(ctx,{x:34,y:ty,w:W-68,h:96},22,'#F9F3DF');
    strokeRR(ctx,{x:34,y:ty,w:W-68,h:96},22,'#CCCFAD',2);
    tools.forEach((t,i)=>{const b={x:34+i*tw,y:ty+4,w:tw,h:88};this.push(t.id,b);icon(ctx,t.icon,b.x+tw/2-40,ty+48,28,T.jadeDeep);text(ctx,t.label,b.x+tw/2+18,ty+48,26,T.jadeDeep,'center',true);});

  }

  private circleBtn(ctx: Ctx2D, b: Box, kind: 'back' | 'close'): void {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#3E7A48'); g.addColorStop(1, '#1F4F2C'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = T.gold; ctx.stroke();
    if (kind === 'back') backChevron(ctx, cx + 2, cy, r * .85, '#F3EAD2', 5);
    else {
      ctx.beginPath(); ctx.moveTo(cx - r * .34, cy - r * .34); ctx.lineTo(cx + r * .34, cy + r * .34);
      ctx.moveTo(cx + r * .34, cy - r * .34); ctx.lineTo(cx - r * .34, cy + r * .34);
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = '#F3EAD2'; ctx.stroke();
    }
  }

  /** Wooden table surface with grain and a front apron, for the home screen. */
  private table(ctx: Ctx2D, y: number): void {
    const W = this.W, H = this.H;
    const h = H - y + 20;
    const b: Box = {x: -20, y, w: W + 40, h};
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ECDDC1'); g.addColorStop(.16, '#DDC79E'); g.addColorStop(1, '#C2AA81');
    fillRR(ctx, b, 0, g);
    ctx.save();
    ctx.globalAlpha = .16; ctx.strokeStyle = '#5A3714'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const gy = y + 10 + i * (h / 26);
      ctx.beginPath(); ctx.moveTo(-20, gy);
      ctx.bezierCurveTo(W * .3, gy + 5, W * .7, gy - 5, W + 20, gy + 2); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .35; fillRR(ctx, {x: -20, y, w: W + 40, h: 14}, 0, '#F0C892'); ctx.restore();
  }

  private woodFrame(ctx: Ctx2D, b: Box): void {
    ctx.save(); ctx.globalAlpha = .3; fillRR(ctx, {x: b.x + 4, y: b.y + 8, w: b.w, h: b.h}, 26, '#20361F'); ctx.restore();
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, T.woodLight); g.addColorStop(.5, T.wood); g.addColorStop(1, T.woodDeep);
    fillRR(ctx, b, 26, g);
    strokeRR(ctx, b, 26, '#A38F68', 5);
    const inner: Box = {x: b.x + 12, y: b.y + 12, w: b.w - 24, h: b.h - 24};
    fillRR(ctx, inner, 18, '#A7C8AA');
    strokeRR(ctx, inner, 18, 'rgba(30,50,20,.5)', 3);
  }

  private countBadge(ctx: Ctx2D, cx: number, cy: number, n: number): void {
    const r = 15;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#E8873B'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    text(ctx, String(n), cx, cy + 1, 20, '#FFFFFF', 'center', true);
  }

  private toolButton(ctx: Ctx2D, b: Box, ic: IconName, label: string, sub: string, pressed: boolean): void {
    const dy = pressed ? 3 : 0;
    fillRR(ctx, {x: b.x, y: b.y + 6, w: b.w, h: b.h}, 20, '#1B3A22');
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, '#3E7A48'); g.addColorStop(1, '#245530');
    fillRR(ctx, {x: b.x, y: b.y + dy, w: b.w, h: b.h - 6}, 20, g);
    strokeRR(ctx, {x: b.x, y: b.y + dy, w: b.w, h: b.h - 6}, 20, 'rgba(216,169,78,.55)', 2);
    icon(ctx, ic, b.x + b.w / 2, b.y + 36 + dy, 34, '#F3EAD2', 3.2);
    text(ctx, label, b.x + b.w / 2, b.y + 74 + dy, 26, '#FFFFFF', 'center', true);
    text(ctx, sub, b.x + b.w / 2, b.y + 98 + dy, 18, 'rgba(243,234,210,.75)', 'center');
  }

  /**
   * 把一块 `contentH` 高的内容在「顶栏之下、屏幕底部之上」垂直居中，返回它的顶边 y。
   *
   * 面板不要按屏高取比例撑大：屏一高面板会拉到很高，而里面的内容还是固定尺寸，
   * 结果就是「上面几行 + 下面一大片空面板」。按内容定高再居中，任何屏高下都成立。
   */
  private centeredTop(contentH: number, topInset = 118, bottomInset = 40): number {
    return (topInset + (this.H - bottomInset)) / 2 - contentH / 2;
  }

  /* ══ SETTINGS（首页上的弹框） ══════════════════════════ */

  private drawSettings(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const rows: {id: string; icon: IconName; label: string; value?: string; toggle?: boolean}[] = [
      {id: 'progress', icon: 'progress', label: '我的进度'},
      {id: 'toggle-sound', icon: 'sound', label: '音效', toggle: this.sound},
      {id: 'toggle-music', icon: 'music', label: '背景音乐', toggle: this.music},
      {id: 'toggle-vibration', icon: 'vibrate', label: '震动', toggle: this.session.vibration},
      {id: 'about', icon: 'book', label: '玩法说明'}
    ];
    const rh = 104;
    const ph = 94 + rh * rows.length + 34 + 40;   // +40：版本号页脚
    const py = this.centeredTop(ph);
    const b: Box = {x: 40, y: py, w: W - 80, h: ph};
    panel(ctx, b, {r: 28});
    pill(ctx, {x: b.x + 40, y: py + 28, w: 240, h: 66}, '设置', {size: 32, fill: '#2E6B3A', edge: T.gold, r: 33, serif: true});
    const close: Box = {x: b.x + b.w - 98, y: py + 28, w: 58, h: 58};
    this.push('__back', close); this.circleBtn(ctx, close, 'close');
    rows.forEach((r, i) => {
      const y = py + 94 + i * rh;
      const box: Box = {x: b.x + 24, y, w: b.w - 48, h: rh - 8};
      if (i % 2 === 0) fillRR(ctx, box, 16, 'rgba(255,255,255,.5)');
      icon(ctx, r.icon, box.x + 42, y + rh / 2 - 4, 34, T.jade, 3);
      text(ctx, r.label, box.x + 82, y + rh / 2 - 4, 27, T.ink, 'left');
      if (r.toggle) {
        const tw2 = 74;
        const tb = toggle(ctx, box.x + box.w - tw2 - 8, y + rh / 2 - 4, tw2, !!r.toggle);
        this.push(r.id, tb, true);
      } else {
        chevron(ctx, box.x + box.w - 20, y + rh / 2 - 4, 26, T.inkFaint, 3);
        this.push(r.id, box);
      }
    });
    text(ctx, `版本 ${APP_VERSION}`, W / 2, py + ph - 34, 22, T.inkSoft, 'center');
  }

  /* ══ PROGRESS（设置里的弹框） ══════════════════════════ */

  private drawProgress(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);

    const total = LEVELS.length;
    const starsMap = this.session.stars;
    const got = Object.values(starsMap).reduce((n, v) => n + v, 0);
    const cleared = Object.keys(starsMap).length;

    const COLS = 5, gap = 12;
    const cw = (W - 160 - gap * (COLS - 1)) / COLS;
    const gridH = Math.ceil(CHAPTERS.length/COLS) * (cw + gap) - gap;
    // 各段相对面板顶的偏移（顶部 94 给匾额行）；面板按内容定高再居中
    const oTitle = 124, oNum = 170, oBar = 214, oMap = 262, oGrid = 296;
    const oLegend = oGrid + gridH + 30;
    const oFoot = oLegend + 52;
    const ph = oFoot + 15 + 34;
    const py = this.centeredTop(ph);
    const b: Box = {x: 40, y: py, w: W - 80, h: ph};
    panel(ctx, b, {r: 28});
    pill(ctx, {x: b.x + 40, y: py + 28, w: 240, h: 66}, '我的进度', {size: 32, fill: '#2E6B3A', edge: T.gold, r: 33, serif: true});
    const close: Box = {x: b.x + b.w - 98, y: py + 28, w: 58, h: 58};
    this.push('__back', close); this.circleBtn(ctx, close, 'close');

    // 总星数
    text(ctx, '总星数', b.x + 40, b.y + oTitle, 26, T.inkSoft, 'left', true);
    text(ctx, String(got), b.x + 40, b.y + oNum, 46, T.jadeDeep, 'left', true);
    // 宽度必须按「大字」的字号量，否则 /300 会压到数字上
    ctx.font = `700 46px ${FONT_SANS}`;
    const nw = ctx.measureText(String(got)).width;
    text(ctx, `/ ${total * 3}`, b.x + 44 + nw, b.y + oNum + 10, 24, T.inkFaint, 'left', true);
    star(ctx, b.x + b.w - 62, b.y + oNum - 16, 20, true);

    const bar: Box = {x: b.x + 40, y: b.y + oBar - 10, w: b.w - 80, h: 20};
    fillRR(ctx, bar, 10, 'rgba(60,90,50,.22)');
    fillRR(ctx, {x: bar.x, y: bar.y, w: Math.max(10, bar.w * Math.min(1, got / (total * 3))), h: bar.h}, 10, '#4FA46A');

    // 星图：100 关一格，颜色越深星越多；已解锁的格子点一下直接开这一关。
    text(ctx, '章节进度', b.x + 40, b.y + oMap, 27, T.ink, 'left', true);
    const gy = b.y + oGrid;
    for (let i = 0; i < CHAPTERS.length; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cell: Box = {x: b.x + 40 + col * (cw + gap), y: gy + row * (cw + gap), w: cw, h: cw};
      const st = Math.min(3,Math.floor(this.session.chapterStars(i)/20));
      const unlocked = this.session.canEnterChapter(i);
      const fill = !unlocked ? 'rgba(222,216,198,.6)'
        : st === 0 ? 'rgba(255,255,255,.66)'
        : st === 1 ? '#BFE3B6' : st === 2 ? '#7EC77F' : '#2E7D4F';
      fillRR(ctx, cell, 9, fill);
      strokeRR(ctx, cell, 9, unlocked ? 'rgba(196,176,136,.65)' : 'rgba(190,180,158,.45)', 1.2);
      text(ctx, String(i + 1), cell.x + cw / 2, cell.y + cw / 2 + 1, Math.round(cw * .34),
        !unlocked ? '#B3A98F' : st >= 2 ? '#FFFFFF' : T.inkSoft, 'center', st >= 2);
      if (unlocked) this.push('level:' + i*CHAPTER_LENGTH, cell);
    }

    // 图例 + 汇总：每项要放得下「18 色块 + 8 间距 + 3 个字（19px ≈ 57）」，每项至少 100，否则文字会挤在一起
    const ly = b.y + oLegend;
    const legend: [string, string][] = [['未解锁', 'rgba(222,216,198,.6)'], ['0 星', 'rgba(255,255,255,.66)'], ['1 星', '#BFE3B6'], ['2 星', '#7EC77F'], ['3 星', '#2E7D4F']];
    const lw = 100, lgap = 4;
    let lx = W / 2 - (legend.length * lw + (legend.length - 1) * lgap) / 2;
    for (const [label, col] of legend) {
      fillRR(ctx, {x: lx, y: ly - 9, w: 18, h: 18}, 5, col);
      strokeRR(ctx, {x: lx, y: ly - 9, w: 18, h: 18}, 5, 'rgba(150,140,116,.5)', 1);
      text(ctx, label, lx + 26, ly, 19, T.inkSoft, 'left');
      lx += lw + lgap;
    }
    text(ctx, `已通关 ${cleared} / ${total} 关`, W / 2, b.y + oFoot, 24, T.ink, 'center', true);
  }

  /* ══ OVERLAYS ══════════════════════════════════════════ */

  private veil(ctx: Ctx2D): void {
    this.hits=[];
    ctx.fillStyle = 'rgba(18,40,22,.55)';
    ctx.fillRect(0, 0, this.W, this.H);
  }

  private drawWin(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const S = this.session;
    // 面板按内容定高再居中；原来取 H*.56，屏一高中间就空一大块
    const oLevel = 76, oStars = 182, oR1 = 268, oR2 = 318, oR3 = 368, oR4 = 418, oNext = 512, oHome = 610;
    const ph = oHome + 38 + 42;
    const py = this.centeredTop(ph);
    const b: Box = {x: 78, y: py, w: W - 156, h: ph};
    panel(ctx, b, {r: 34});
    // banner
    const ban: Box = {x: W / 2 - 232, y: py - 54, w: 464, h: 100};
    const bg = ctx.createLinearGradient(ban.x, ban.y, ban.x, ban.y + ban.h);
    bg.addColorStop(0, '#B4763C'); bg.addColorStop(1, '#7C4A1E');
    fillRR(ctx, ban, 26, bg);
    strokeRR(ctx, ban, 26, '#5A3714', 5);
    text(ctx, '恭喜通关', W / 2, ban.y + ban.h / 2, 50, '#F7DFA0', 'center', true, true);
    text(ctx, `第 ${S.levelIndex + 1} 关`, W / 2, py + oLevel, 34, T.ink, 'center', true, true);
    stars(ctx, W / 2, py + oStars, 44, S.rating);
    // 四个数都必须是真值：`starLines.three` 是 3 星线（par+8%），不是 par
    const row = (y: number, k: string, v: string) => {
      text(ctx, k, b.x + 70, py + y, 26, T.inkSoft, 'left');
      text(ctx, v, b.x + b.w - 70, py + y, 26, T.ink, 'right', true);
    };
    row(oR1, '本局步数', `${S.moves} 步`);
    row(oR2, '三星线', `${S.starLines.three} 步`);
    row(oR3, '本局得分', `${S.score}`);
    const bestNow = S.best[String(S.levelIndex)] || 0;
    row(oR4, '历史最高', `${bestNow}`);
    if (S.score > 0 && S.score >= bestNow) text(ctx, '新纪录', b.x + b.w - 70, py + oR3 - 30, 20, '#B4442F', 'right', true);
    const nb: Box = {x: b.x + 46, y: py + oNext - 46, w: b.w - 92, h: 92};
    const nextIdx = S.levelIndex + 1;
    const last = nextIdx >= LEVELS.length;
    const blocked = !last && !S.canEnter(nextIdx);
    if (blocked) {
      // 门槛没过时不许写「下一关」：点不动的按钮比不给按钮更糟
      this.push('levels', nb);
      button(ctx, nb, '选择关卡', {kind: 'jade', size: 30, pressed: this.isPressed('levels')});
    } else {
      this.push('next', nb);
      button(ctx, nb, last ? '再玩一次' : '下一关', {kind: 'jade', size: 36, icon: 'play', pressed: this.isPressed('next')});
    }
    const hb: Box = {x: b.x + 46, y: py + oHome - 38, w: b.w - 92, h: 76};
    this.push('home', hb);
    button(ctx, hb, '返回首页', {kind: 'cream', size: 30, pressed: this.isPressed('home')});
  }

  private drawLose(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const S = this.session;
    const oSub = 76, oTile = 188, oLevel = 298, oLeft = 340, oMoves = 376, oPrimary = 486, oRow = 586, oFoot = 660;
    const ph = oFoot + 30 + 40;
    const py = this.centeredTop(ph);
    const b: Box = {x: 84, y: py, w: W - 168, h: ph};
    panel(ctx, b, {r: 34});
    const ban: Box = {x: W / 2 - 214, y: py - 50, w: 428, h: 96};
    const bg = ctx.createLinearGradient(ban.x, ban.y, ban.x, ban.y + ban.h);
    bg.addColorStop(0, '#A83B32'); bg.addColorStop(1, '#6E211B');
    fillRR(ctx, ban, 24, bg);
    strokeRR(ctx, ban, 24, '#5A1913', 5);
    text(ctx, '很遗憾', W / 2, ban.y + ban.h / 2, 48, '#F7DFA0', 'center', true, true);
    // 原因只写短语：横幅上已经有完整句子，弹窗里再抄一遍就是啰嗦
    const reasonText = S.failReason === 'time' ? '时间到' : S.failReason === 'dead' ? '牌走死了' : '步数用尽';
    text(ctx, reasonText, W / 2, py + oSub, 28, T.inkSoft, 'center', true, true);
    drawTile(ctx, W / 2, py + oTile, {face: '5z', w: 116, h: 144});
    text(ctx, `第 ${S.levelIndex + 1} 关`, W / 2, py + oLevel, 30, T.ink, 'center', true);
    text(ctx, `剩余 ${S.remaining} / ${S.liveTotal} 张`, W / 2, py + oLeft, 25, T.inkSoft, 'center');
    text(ctx, `${S.moves} 步 · 三星 ≤ ${S.starLines.three} 步`, W / 2, py + oMoves, 25, T.inkSoft, 'center');

    // 主出路按失败原因分岔（A3）：死局免费重排，其余补步数 / 补时间。
    // 旧版那颗免费「撤销一步」被删了——撤销不退步数，在步数用尽的盘上撤完立刻又判负。
    const dead = S.failReason === 'dead';
    const left = Math.max(0, 2 - S.revivesUsed);
    const primary: Box = {x: b.x + 58, y: py + oPrimary - 46, w: b.w - 116, h: 92};
    const primaryOk = dead || S.canRevive;
    const primaryText = dead ? (S.shuffleBlocked?(S.canUndo?'撤销一步':'重新开始'):'重排这盘牌') : S.failReason === 'time' ? '补 30 秒' : `补 ${S.reviveBonus} 步`;
    const pid = dead ? (S.shuffleBlocked?(S.canUndo?'undo':'restart'):'rescue') : 'revive';
    if (primaryOk) {
      this.push(pid, primary);
      button(ctx, primary, primaryText, {kind: 'jade', size: 32, pressed: this.isPressed(pid)});
    } else {
      button(ctx, primary, '复活次数已用完', {kind: 'disabled', size: 32});
    }
    if (!dead) text(ctx, `本关还剩 ${left} 次`, W / 2, py + oPrimary - 74, 22, T.inkSoft, 'center');

    const half = (b.w - 116) / 2;
    const restart: Box = {x: b.x + 58, y: py + oRow - 40, w: half, h: 80};
    const home: Box = {x: b.x + 58 + half + 0, y: py + oRow - 40, w: half, h: 80};
    this.push('restart', restart); this.push('home', home);
    button(ctx, restart, '重新开始', {kind: 'cream', size: 28, pressed: this.isPressed('restart')});
    button(ctx, home, '返回首页', {kind: 'cream', size: 28, pressed: this.isPressed('home')});
    // 原来这句浮在暗遮罩上所以用奶白；现在移进了奶色面板，必须换成深色
    text(ctx, dead ? (S.shuffleBlocked?'换一条路线，完成目标格。':'试试重排，或从头再来。') : '歇一会，再试试。', W / 2, py + oFoot, 24, T.inkSoft, 'center', true);
  }

  private drawPause(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const items: {id: string; icon: IconName; label: string; kind: 'jade' | 'cream'}[] = [
      {id: 'resume', icon: 'play', label: '继续游戏', kind: 'jade'},
      {id: 'restart', icon: 'restart', label: '重新开始', kind: 'cream'},
      {id: 'home', icon: 'home', label: '返回首页', kind: 'cream'}
    ];
    if(!this.session.shuffleBlocked)items.splice(1,0,{id:'shuffle',icon:'shuffle',label:`洗牌 · ${this.session.shufflesLeft}`,kind:'cream'});
    const oStart = 83, step = 100;
    const ph = oStart + (items.length - 1) * step + 41 + 42;
    const py = this.centeredTop(ph);
    const b: Box = {x: 96, y: py, w: W - 192, h: ph};
    panel(ctx, b, {r: 30});
    const ban: Box = {x: W / 2 - 150, y: py - 42, w: 300, h: 84};
    pill(ctx, ban, '已暂停', {size: 40, fill: '#2E6B3A', edge: T.gold, serif: true});
    const close: Box = {x: b.x + b.w - 52, y: py - 30, w: 62, h: 62};
    this.push('resume', close); this.circleBtn(ctx, close, 'close');
    items.forEach((it, i) => {
      const bb: Box = {x: b.x + 44, y: py + oStart + i * step - 41, w: b.w - 88, h: 82};
      this.push(it.id, bb);
      button(ctx, bb, it.label, {kind: it.kind, size: 30, icon: it.icon, pressed: this.isPressed(it.id)});
    });
  }

  private drawHelp(ctx: Ctx2D): void {
    const W = this.W;
    this.veil(ctx);
    const lines = ['轻点两张相邻的同牌，即可消除。', '按住一行横拖、一列竖拖，整段循环滑动。', '滑动松手后会自动消除碰起的对子，可连消。', '木块与空洞会截断滑轨；锁住的行 / 列推不动。', '冰面牌要消两次：第一下碎冰，第二下收牌。', '重开恢复免费道具；用提示也可拿三星。'];
    const oLines = 150, lstep = 54;
    const oBtn = oLines + (lines.length - 1) * lstep + 16 + 40 + 43;
    const ph = oBtn + 43 + 40;
    const py = this.centeredTop(ph);
    const b: Box = {x: 70, y: py, w: W - 140, h: ph};
    panel(ctx, b, {r: 30});
    text(ctx, '玩法', W / 2, py + 70, 42, T.jadeDeep, 'center', true, true);
    lines.forEach((s, i) => text(ctx, s, b.x + 56, py + oLines + i * lstep, 25, T.ink, 'left'));
    const ok: Box = {x: W / 2 - 170, y: py + oBtn - 43, w: 340, h: 86};
    this.push('back-home', ok);
    button(ctx, ok, '知道了', {kind: 'jade', size: 30, pressed: this.isPressed('back-home')});
  }
}
