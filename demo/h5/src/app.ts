import {BOARD_PAD,SunnyState,sunnyHome,sunnyMap,sunnyWorkshop,sunnyAlbum,sunnyBoard,sunnyWin,sunnySettings,sunnyPause,sunnyLose,sunnyIntro,sunnyRestart,WORKSHOP,totalStars} from '../../../cocos/assets/scripts/view/sunnyLayout';
import {drawSunnyTable,TableTheme,TABLE_THEMES} from '../../../cocos/assets/scripts/view/sunnyArt';
import {renderSunny} from './sunny';
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
export const APP_VERSION = '1.4.3';

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

export type Screen = 'restart' | 'workshop' | 'album' | 'home' | 'levels' | 'board' | 'settings' | 'progress' | 'win' | 'lose' | 'pause' | 'help';

export interface Ctx2D extends CanvasRenderingContext2D {}

export class App {
  session: Session;
  private mainSession:Session|null=null;
  private theme:TableTheme='jade';
  readonly audio=new SoundStudy();
  screen: Screen = 'home';
  /** Screen the current overlay was opened from, so closing returns correctly. */
  private returnScreen: Screen = 'home';
  private dialogBase:Screen='home';
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
    try{const t=localStorage.getItem('mj:sunny-theme');if(TABLE_THEMES.some(x=>x.id===t))this.theme=t as TableTheme;}catch{}
    this.audio.configure(this.music,this.sound);
    document.addEventListener('visibilitychange',()=>this.audio.visibility(document.hidden));
    const q = new URLSearchParams(location.search);
    this.session.setEnvironment(q.get('preview')==='1'?'develop':'release');
    const lv = Number(q.get('level'));
    if (Number.isFinite(lv) && q.has('level')) this.session.reset(lv, false);
    const scr = q.get('screen') as Screen | null;
    const valid: Screen[] = ['workshop','album','home', 'levels', 'board', 'settings', 'progress', 'win', 'lose', 'pause', 'help'];
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

  private panelBase: 'home' | 'board' = 'home';

  private go(scr: Screen): void {
    if(['levels','workshop','album'].includes(scr)&&!['levels','workshop','album','settings','help'].includes(this.screen))this.panelBase=scr==='levels'&&['board','pause','restart','win','lose'].includes(this.screen)?'board':'home';
    if(['home','levels','board','workshop','album'].includes(this.screen))this.dialogBase=this.screen;
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
    const overlay: Partial<Record<Screen, string>> = {restart:'restart',workshop:'home',album:'home',settings: 'settings', levels: 'levels', win: 'win', help: 'help', progress: 'settings', pause:'pause', lose:'lose'};
    if (scr === 'board') this.session.modal = 'none';
    else if (scr === 'home') this.session.modal = 'home';
    else if (overlay[scr]) this.session.modal = overlay[scr] as any;
    if (scr === 'levels') this.page = Math.floor(this.session.levelIndex / CHAPTER_LENGTH);
  }

  /** 弹框的固定父级：关闭时回哪一屏。选关/设置从首页打开，进度/玩法说明从设置打开。 */
  private dialogParent(): Screen {
    switch (this.screen) {
      case 'progress': case 'help': return 'settings';
      default: return this.dialogBase;
    }
  }

  private activate(id: string): void {
    if(id==='energy-hint')id='hint';
    if(['home','levels','workshop','album'].includes(id)&&this.mainSession){this.session=this.mainSession;this.mainSession=null;this.drag=null;this.press=null;}
    if(id.startsWith('practice:')){const m=WORKSHOP[Number(id.slice(9))];if(!m)return;if(!this.mainSession)this.mainSession=this.session;this.session=new Session(520);this.session.unlockAll=true;this.session.reset(m.level,false,true);this.setScreen('board');this.invalidate();return;}
    if(id.startsWith('theme:')){const t=TABLE_THEMES.find(t=>t.id===id.slice(6));if(t&&totalStars(this.session)>=t.stars){this.theme=t.id;try{localStorage.setItem('mj:sunny-theme',t.id);}catch{}}this.invalidate();return;}

    this.audio.unlock();this.audio.play(id==='undo'?'undo':'ui');
    switch (id) {
      case 'panel-close': this.setScreen(this.panelBase); break;
      case 'home': this.go('home'); break;
      case 'workshop':case 'album':this.go(id);break;
      case 'start': this.session.command('continue'); this.setScreen('board'); break;
      case 'levels': this.go('levels'); break;
      case 'progress': this.go('progress'); break;
      case 'settings': this.go('settings'); break;
      case 'back-home': case '__back': this.go(this.dialogParent()); break;
      case 'about': this.go('help'); break;
      case 'pause': this.returnScreen = 'board'; this.setScreen('pause'); break;
      case 'resume': this.setScreen('board'); break;
      case 'restart':this.setScreen('restart');break;
      case 'confirm-restart':case 'restart-lose':case 'replay': this.act(() => { this.session.reset(); this.setScreen('board'); }); break;
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
      case 'workshop': {const items=sunnyWorkshop(this.sunnyState());items.forEach(i=>{if(i.id==='challenge')i.id='about';if(i.text==='独立挑战')i.text='玩法说明';});renderSunny(ctx,items,this.hits);break;}
      case 'album':renderSunny(ctx,sunnyAlbum(this.sunnyState()),this.hits);break;
      // 设置 / 选关 / 进度 / 玩法说明都是「首页上的弹框」：底图仍是首页，上面盖遮罩 + 面板
      case 'levels': this.drawLevels(ctx); break;
      case 'settings':this.drawDialogBase(ctx);this.drawSettings(ctx);break;
      case 'progress': this.drawHome(ctx); this.drawProgress(ctx); break;
      case 'board': this.drawBoard(ctx); break;
      case 'win': this.drawBoard(ctx); this.drawWin(ctx); break;
      case 'restart':this.drawBoard(ctx);this.veil(ctx);renderSunny(ctx,sunnyRestart(this.sunnyState()),this.hits);break;
      case 'lose': this.drawBoard(ctx); this.drawLose(ctx); break;
      case 'pause': this.drawBoard(ctx); this.drawPause(ctx); break;
      case 'help':this.drawDialogBase(ctx);this.drawHelp(ctx);break;
    }
    // 「新玩法」说明卡：进关时 Session 给出待展示的 tip，看完（tip-ok）才开局
    if (this.screen==='board'&&this.session.introTip) this.drawTipCard(ctx);
  }

  /** 「新玩法」说明卡：遮罩 + 面板 + 匾额标题 + 文案 + 知道了。展示期间牌桌输入被 Session 屏蔽。 */
  private drawDialogBase(ctx:Ctx2D):void{
    if(this.dialogBase==='board')this.drawBoard(ctx);
    else if(this.dialogBase==='levels')this.drawLevels(ctx);
    else if(this.dialogBase==='workshop')renderSunny(ctx,sunnyWorkshop(this.sunnyState()),this.hits);
    else if(this.dialogBase==='album')renderSunny(ctx,sunnyAlbum(this.sunnyState()),this.hits);
    else this.drawHome(ctx);
  }

  private drawTipCard(ctx:Ctx2D):void{this.veil(ctx);renderSunny(ctx,sunnyIntro(this.sunnyState()),this.hits);}

  private push(id: string, b: Box, enabled = true): void { this.hits.push({id, x: b.x, y: b.y, w: b.w, h: b.h, enabled}); }
  private isPressed(id: string): boolean { return this.pressed === id; }

  /* ══ HOME ══════════════════════════════════════════════ */

  private sunnyState():SunnyState{return {w:this.W,h:this.H,safe:0,s:this.session,page:this.page,theme:this.theme,practice:!!this.mainSession,cssScale:this.s};}
  private drawHome(ctx:Ctx2D):void{renderSunny(ctx,sunnyHome(this.sunnyState()),this.hits);}

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

  private drawLevels(ctx:Ctx2D):void{this.page=Math.max(0,Math.min(25,this.page));renderSunny(ctx,sunnyMap(this.sunnyState()),this.hits);}

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
    const line=this.drag?'拖动整行或整列，松手配对':S.message||'同牌相邻，轻点或推移';
    const layout=sunnyBoard(this.sunnyState(),line);renderSunny(ctx,layout.items,this.hits);
    const rows=this.rows(),cols=this.cols(),cellW=layout.cellW,cellH=layout.cellH,bw=cellW*cols,bh=cellH*rows,pad=BOARD_PAD,bx=layout.x,by=layout.y;
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
          const tw = cellW * .90, th = cellH * .90;
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

  private woodFrame(ctx:Ctx2D,b:Box):void{drawSunnyTable(ctx,b.x,b.y,b.w,b.h,this.theme);}

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

  private drawSettings(ctx:Ctx2D):void{this.veil(ctx);renderSunny(ctx,sunnySettings(this.sunnyState(),this.music,this.sound,APP_VERSION),this.hits);}

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

  private drawWin(ctx:Ctx2D):void{this.veil(ctx);renderSunny(ctx,sunnyWin(this.sunnyState()),this.hits);}

  private drawLose(ctx:Ctx2D):void{this.veil(ctx);renderSunny(ctx,sunnyLose(this.sunnyState()),this.hits);}

  private drawPause(ctx:Ctx2D):void{this.veil(ctx);renderSunny(ctx,sunnyPause(this.sunnyState()),this.hits);}

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
