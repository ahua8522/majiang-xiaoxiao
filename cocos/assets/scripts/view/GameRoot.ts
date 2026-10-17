/**
 * 场景根：装配所有界面、驱动 core/Session、接管触摸。
 *
 * 与旧实现的根本区别：
 *   - 不再每帧生成 `Command[]` 再逐条深比较；界面只在状态变化时重建（dirty 标志驱动），不是每帧重建。
 *   - 牌桌用 Sprite（图集）+ 节点池；拖动只改 position，消除走 tween。
 *   - 所有可点控件挂自己的 TOUCH_END，没有手工 hits[] 命中数组。
 *   - 布局坐标就是**可见区坐标**（`view.getVisibleSize()`，与 Canvas 的 UITransform 一致）：
 *     宽度优先适配下宽度恒为 750，高度随屏幕比例变化（20:9 屏约 1623）。
 *     所以纵向位置一律相对 `this.size.h` 算，**不能写死设计高 1334**，否则内容会缩在中间一条。
 *
 * core/ 完全不感知 cc；本文件是唯一的引擎适配层。
 */
import {_decorator, Component, Director, EventTouch, Game, game, Label, Node, Sprite, UIOpacity, UITransform, director, input, Input, sys, view} from 'cc';
import {Session, Platform} from '../core/Session';
import {LEVELS, levelAt} from '../core/Generator';
import {CHAPTER_NAMES} from '../core/levels';
import {count, Run} from '../core/Rules';
import {SceneAtlas, TileAtlas, UiAtlas, UiName} from './assets';
import {atlasReport, watchContext} from './atlas';
import {Board, Pos} from './Board';
import {palette} from './theme';
import {bindPress, clearChildren, fadeIn, hex, makeButton, makeIconButton, makeLabel, makeNode, makePanel, makePlate, makeSprite, makeStars, makeToggle} from './widgets';

const {ccclass, property} = _decorator;
const STORAGE_KEY = 'majiang-xiaoxiao:v1';
const SHARE_TITLE = '快乐推麻对对消：推一推，碰个对';
const DESIGN_W = 750;
const DESIGN_H = 1334;
/** 应用版本号：与 cocos/package.json 的 version、upload-ci 上传版本保持一致（提版时三处一起改）。 */
const APP_VERSION = '1.2.4';

/**
 * 「新玩法」说明卡的内容：每关首次出现某机制时，进关先弹这张卡（看完才开局）。
 * 文案里的操作描述必须与实现一致——改机制时记得同步这里。
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
  unlock: {title: '连锁解锁', lines: ['带数字的锁轨是暂时锁住的：', '每消一对就计数，凑够数字自动解锁。']},
  // 方言卡一律用白话，不写术语：「将将胡」三个字对上"只有 2、5、8 能消"这句人话，
  // 玩家才知道章节标题在说什么。也必须讲清哑弹不用管，否则玩家会对着消不掉的牌死推轨道。
  only258: {title: '将将胡', lines: ['这一关只有 2、5、8 能配成对。', '别的牌推不动局面，只能当滑块借道。', '剩下的牌不用管：能消的消光就通关。']},
  only19: {title: '幺九', lines: ['这一关只有 1 和 9 能配成对。', '中间的牌全当滑块用。', '能消的消光就通关，剩下的不用管。']},
  noSuit: {title: '断门', lines: ['这一门的牌只能轻点消除。', '滑动带不走它们。', '别的门照旧可以连着消。']},
  oneSuit: {title: '清一色', lines: ['只有一门的牌能配对，其余三门全是滑块。', '把它们推到相邻位置再轻点。', '能消的消光就通关。']},
  collect: {title: '集齐一组', lines: ['不用清台：把这一组各消掉一对就通关。', '顶栏显示已经集齐几种。']}
};

/** 微信小游戏全局；编辑器预览 / Web 构建里不存在。 */
const wx: any = (globalThis as any).wx;
function vibrate(kind: 'light' | 'medium'): void { try { wx?.vibrateShort?.({type: kind}); } catch { /* 可选 */ } }

/**
 * 按字符估一行文字的宽度（设计像素）：全角 1 em、数字与拉丁 0.56 em、空格 0.33 em。
 * HUD 同一行有三段文字（剩余 / 倒计时 / 步数），彼此不能压字，只能自己估——
 * Label 的 contentSize 要到渲染阶段才算得出来，同一帧读 `UITransform.width` 是 0。
 */
function textWidth(s: string, px: number): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c === 32 ? px * 0.33 : c > 0x2e80 ? px : px * 0.56;
  }
  return n;
}

/**
 * 这条滑轨是否被锁住（视图只读不改）。
 *
 * core 的 `runs` 定长且顺序稳定：锁轨也在数组里、只是 `locked:true`。
 * 命中判定必须跳过锁轨，否则手指按下去记下的轨道虽然下标一直有效，
 * 但推下去会被 `session.slide()` 拒掉——预览已经把牌画歪、松手又弹回去。
 * 锁标 / 箭头仍由关卡定义（`lockedRows/lockedCols/pendingUnlock`）决定，不从 runs 反推。
 */
function runLocked(run: Run): boolean {
  return !!run.locked;
}

/** 把进度写进 __mjBoot.stages，供 game.js 的失败弹窗显示（真机读不到 console）。 */
function mark(step: string): void {
  (globalThis as any).__mjStage = step;
  const boot: any = (globalThis as any).__mjBoot;
  if (boot?.stages) boot.stages.push('game:' + step);
  console.log('[game]', step);
}

const storage: Platform = {
  load: () => sys.localStorage.getItem(STORAGE_KEY),
  save: (data) => sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
  feedback: () => vibrate('medium')
};

type Screen = 'home' | 'levels' | 'board' | 'settings' | 'win' | 'lose' | 'pause' | 'help';

@ccclass('GameRoot')
export class GameRoot extends Component {
  @property({tooltip: '固定随机种子便于复现；0 表示每次随机'})
  seed = 0;

  private session!: Session;
  private ui!: UiAtlas;
  private tileAtlas: TileAtlas | null = null;
  private sceneAtlas: SceneAtlas | null = null;
  private sceneKey = '';
  private bgSprite: Sprite | null = null;
  private sceneReady = false;
  /** render() 抛过几次、最后一条是什么：真机（尤其鸿蒙）只能靠这个把故障带回桌面。 */
  private renderFailures = 0;
  private renderNote = '';
  /** 牌桌场景图自检结论（见 boardDiag），空串=没异常或还没测。 */
  private pxProbe = '';
  private frames = 0;
  /** 顶部安全区：微信胶囊按钮占掉的高度（设计单位）。顶栏整体下移这么多，避免被官方控件盖住。 */
  private safeTop = 0;

  private screen: Screen = 'home';
  private returnScreen: Screen = 'home';
  private screens!: {home: Node; board: Node; overlay: Node};
  private board!: Board;
  /** 牌桌的「外壳」（顶栏 / 工具条）挂这里，每次重绘只清它，绝不动 Board 自己的节点。 */
  private boardChrome!: Node;

  private dirty = true;
  private revision = -1;
  private firstPainted = false;
  private size = {w: DESIGN_W, h: DESIGN_H};
  /** 选关停在第几章（一章一屏 4×4，见 renderLevels）。 */
  private page = 0;
  /** 弹框画在大厅上还是牌桌上，由"从哪打开"决定（见 go()）。 */
  private dialogBase: 'home' | 'board' = 'home';
  private sound = true;
  private music = true;

  private press: {x: number; y: number; cell: Pos | null; blocked: boolean; axis: 'row' | 'col' | null} | null = null;
  private drag: {run: number; offset: number} | null = null;
  private dragAxis: 'row' | 'col' = 'row';
  private lastStep = 0;
  /** 牌桌横幅那行字（拖动中要改它，但不该为此整屏重建） */
  private dragLabel: Label | null = null;
  private touchId: number | null = null;
  onLoad(): void {
    try {
      const g = globalThis as any;
      const now = Date.now();
      const timing = {
        engineInitMs: g.__mjSplashStart && g.__mjSplashEnd ? g.__mjSplashEnd - g.__mjSplashStart : -1,
        sceneAndOnLoadMs: g.__mjSplashEnd ? now - g.__mjSplashEnd : -1,
        totalFromGameJsMs: g.__mjSplashStart ? now - g.__mjSplashStart : -1,
        at: new Date().toISOString()
      };
      try { wx?.setStorageSync?.('mj:bootTiming', timing); } catch { /* 不影响游戏 */ }
      console.log('[boot-timing]', JSON.stringify(timing));
      mark('A-onLoad');

      let raw = sys.localStorage.getItem(STORAGE_KEY);
      if (raw && raw.length > 262144) { try { sys.localStorage.removeItem(STORAGE_KEY); } catch { /* 清不掉也继续 */ } raw = null; }
      try { if (raw) JSON.parse(raw); } catch { try { sys.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } raw = null; }

      this.session = new Session(this.seed || (Date.now() >>> 0), {load: () => raw, save: storage.save, feedback: storage.feedback});
      // 体验版 / 开发版全解锁，方便测试直接选关；正式版（release）保持按进度解锁
      try {
        const env = wx?.getAccountInfoSync?.().miniProgram?.envVersion;
        this.session.unlockAll = env === 'trial' || env === 'develop';
        if (this.session.unlockAll) console.log('[game] 非正式版环境，选关全解锁 env=' + env);
      } catch { /* 编辑器预览 / Web 下没有该 API，保持默认 */ }
      const want = levelAt(this.session.levelIndex).map;
      const rows = this.session.grid.length, cols = (this.session.grid[0] || []).length;
      mark(`B-session ${rows}x${cols} level=${this.session.levelIndex} expect=${want.length}x${(want[0] || '').length}`);
      if (rows !== want.length || cols !== (want[0] || '').length) {
        console.error('[game] 棋盘尺寸与关卡定义不符', {got: `${rows}x${cols}`, want: `${want.length}x${want[0].length}`});
      }

      this.ui = new UiAtlas(1);
      mark('C-atlas-ui');
      this.safeTop = this.computeSafeTop();
      this.bgSprite = this.makeBackground();
      this.screens = {
        home: makeNode(this.node, {name: 'screen-home'}),
        board: makeNode(this.node, {name: 'screen-board'}),
        overlay: makeNode(this.node, {name: 'screen-overlay'})
      };
      this.board = new Board(this.screens.board, this.ui);
      this.boardChrome = makeNode(this.screens.board, {name: 'board-chrome'});
      this.boardChrome.setSiblingIndex(1); // 顶栏 / 工具条画在牌桌之上
      mark('D-nodes');

      const q = this.queryParam('screen') as Screen | null;
      const lv = Number(this.queryParam('level'));
      if (Number.isFinite(lv) && this.queryParam('level') !== null) this.session.reset(lv, false);
      // 大厅保留，但**不再当入口**：真机反馈是"每次进来先是一张海报页，还要再点一次开始游戏"。
      // 没有 ?screen= 就直接开局（继续上一盘）；截图与调试仍可用 ?screen=home 回到大厅。
      this.setScreen(q && this.isScreen(q) ? q : 'board');
      // 性能面板默认关掉（调试构建里它会盖住界面）；加 ?stats=1 打开，用于测 draw call / 顶点。
      try { const prof = (globalThis as any).cc?.profiler; if (this.queryParam('stats') === '1') prof?.showStats?.(); else prof?.hideStats?.(); } catch { /* 面板可选 */ }
      // 真机（尤其鸿蒙）摸不到控制台，就把图集/显存状态挂成全局函数并打一次日志：
      // 用户在 vConsole 里输 `__mjDiag()` 就能把确定证据读回来，而不是让我猜。
      watchContext();
      (globalThis as any).__mjDiag = () => atlasReport();
      console.log('[mj] atlas', JSON.stringify(atlasReport()));
      mark('E-screen');
    } catch (e) {
      const msg = `onLoad THREW ${String((e as Error)?.message || e).slice(0, 200)}`;
      mark(msg);
      const boot: any = (globalThis as any).__mjBoot;
      if (boot) boot.error = msg;
      console.error('[game]', msg, (e as Error)?.stack);
      try { wx?.showModal?.({title: 'onLoad 异常', content: msg, showCancel: false}); } catch { /* ignore */ }
    }
    (globalThis as any).__mj = () => ({
      size: this.size, screen: this.screen,
      board: this.board ? {cellW: this.board.cellW, cellH: this.board.cellH, origin: this.board.origin, rows: this.board.gridRows, cols: this.board.gridCols} : null,
      model: this.session ? {levelIndex: this.session.levelIndex, grid: this.session.grid, runs: this.session.runs, modal: this.session.modal,
        total: this.session.total, moves: this.session.moves, hintsLeft: this.session.hintsLeft, shufflesLeft: this.session.shufflesLeft,
        stars: this.session.stars, maxLevel: this.session.maxLevel, par: this.session.par,
        // 切图/真机取证要看这四格：关卡总数证明构建新不新，seed 证明钉死生效，
        // dialect + liveTotal 证明「只剩哑弹也算过」的判据，timeLeft 证明倒计时在走。
        levels: LEVELS.length, px: this.pxProbe, seed: this.session.pinnedSeed, dialect: !!this.session.def.dialect,
        liveTotal: this.session.liveTotal, timeLeft: Math.round(this.session.timeLeft * 10) / 10,
        atlas: atlasReport()} : null
    });
    (globalThis as any).__mjTap = (id: string) => this.activate(id);
    input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouch, this);
    input.on(Input.EventType.TOUCH_END, this.onTouch, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouch, this);
    try {
      wx?.showShareMenu?.({withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline']});
      wx?.onShareAppMessage?.(() => ({title: SHARE_TITLE}));
      wx?.onShareTimeline?.(() => ({title: SHARE_TITLE}));
    } catch { /* 分享可选 */ }
    // 限时关必须"看不见就不走表"。用 cc 的 game 事件而不是 wx.onHide：小游戏和 H5 同一套，
    // 接电话/切后台回来直接判负是要被投诉的那种错误。
    game.on(Game.EVENT_SHOW, this.onGameShow, this);
    // 牌桌自检要等真的画出来之后再做：EVENT_AFTER_DRAW 是最贴近「这一帧真的画了」的时机。
    director.on(Director.EVENT_AFTER_DRAW, this.onAfterDraw, this);
    game.on(Game.EVENT_HIDE, this.onGameHide, this);
    mark('Z-onLoad done');
  }

  private onGameHide(): void { this.session?.setPaused(true); }
  private onGameShow(): void { this.session?.setPaused(false); this.dirty = true; }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouch, this);
    input.off(Input.EventType.TOUCH_END, this.onTouch, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouch, this);
    // 生命周期监听要成对摘掉：场景重建时不摘就会重复订阅，一次切后台触发多次 setPaused。
    game.off(Game.EVENT_SHOW, this.onGameShow, this);
    game.off(Game.EVENT_HIDE, this.onGameHide, this);
    director.off(Director.EVENT_AFTER_DRAW, this.onAfterDraw, this);
    // 纹理是显存，节点销毁不会释放它：三张图集都要在这里显式 dispose
    //（微信小游戏切后台/重进场景时不释放就是下一次进来黑屏）。
    this.tileAtlas?.atlas.dispose();
    this.sceneAtlas?.atlas.dispose();
    this.ui?.atlas.dispose();
    this.tileAtlas = null;
    this.sceneAtlas = null;
    this.sceneKey = '';
  }

  /** 牌桌稳定 90 帧后自检一次（那时布局与三张图集都已就位），只测一遍不每帧读。 */
  private onAfterDraw(): void {
    if (this.pxProbe) return;
    this.frames++;
    if (this.frames < 90 || this.screen !== 'board') return;
    this.pxProbe = this.boardDiag();
    console.log('[mj] boardDiag "' + this.pxProbe + '" · atlas ' + JSON.stringify(atlasReport()));
  }

  update(dt: number): void {
    if (!this.session || !this.ui) return;
    // 倒计时必须每帧喂 dt，而且要在 `!dirty` 早退**之前**：跨过整秒时 session.revision 不变，
    // 放在早退之后就永远不会重绘，玩家看到的数字会停在原地。
    if (this.session.tick(dt)) this.dirty = true;
    const visible = view.getVisibleSize();
    if (!this.sceneReady || visible.width !== this.size.w || visible.height !== this.size.h) {
      this.size = {w: visible.width, h: visible.height};
      this.sceneReady = true;
      this.ensureScene();
      this.dirty = true;
    }
    if (this.session.revision !== this.revision) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.revision = this.session.revision;
    // 一帧画崩不能把整个游戏带走：以前 render() 里任何一处抛异常（最常见是图集缺帧），
    // 表现就是"屏幕上只剩文字"，而且下一帧继续抛，玩家什么也点不动。
    try {
      this.render();
      if (this.renderFailures) this.renderNote = '';
    } catch (e) {
      this.renderFailures++;
      const msg = String((e as Error)?.message || e);
      if (this.renderNote !== msg) {
        this.renderNote = msg;
        mark(`render error x${this.renderFailures}: ${msg}`);
      }
    }
    if (!this.firstPainted) { this.firstPainted = true; (globalThis as any).__mjFirstFrame = true; mark(`first frame screen=${this.screen}`); }
  }

  /* ── 屏幕状态机 ───────────────────────────────────────── */

  private isScreen(s: string): s is Screen {
    return ['home', 'levels', 'board', 'settings', 'win', 'lose', 'pause', 'help'].includes(s);
  }

  private setScreen(s: Screen): void {
    this.screen = s;
    // progress 弹框在 Session 侧复用 'settings' 弹窗态（Session 的 Modal 没有 progress）
    const overlay: Partial<Record<Screen, string>> = {settings: 'settings', levels: 'levels', win: 'win', help: 'help'};
    if (s === 'board') this.session.modal = 'none';
    else if (s === 'home') this.session.modal = 'home';
    else if (overlay[s]) this.session.modal = overlay[s] as any;
    if (s === 'levels') this.page = Math.floor(this.session.levelIndex / 16);
    this.dirty = true;
  }

  /**
   * 弹框关掉之后回哪一屏。
   * 规则很简单：**从牌桌（含牌桌菜单）打开的一律回牌桌**，其余回大厅；
   * 进度 / 玩法说明是"设置"的子页，永远回设置。
   */
  private dialogParent(): Screen {
    if (this.screen === 'help') return 'settings';
    return this.returnScreen === 'board' || this.returnScreen === 'pause' ? 'board' : 'home';
  }

  private go(s: Screen): void {
    // 弹框画在谁上面，取决于它是**从哪一屏打开的**：从牌桌开的就该继续看到牌桌，
    // 而不是被换成大厅（真机反馈：牌桌点设置"回到了首页"，关掉又跳回牌桌）。
    // 弹框之间跳转（设置→玩法说明）不动这个值，所以子页沿用父页的底图。
    if (this.screen === 'board' || this.screen === 'pause' || this.screen === 'win' || this.screen === 'lose') this.dialogBase = 'board';
    else if (this.screen === 'home' || this.screen === 'levels') this.dialogBase = 'home';
    this.returnScreen = this.screen; this.setScreen(s);
  }

  private activate(id: string): void {
    switch (id) {
      case 'home': this.go('home'); break;
      case 'start': this.startLevel(this.session.maxLevel); break;
      case 'levels': this.go('levels'); break;
      // 从对局菜单进选关：不动 returnScreen（go() 会把来源记成 'pause'，关掉就回不到牌桌了），
      // 但要明确底图仍是牌桌。
      case 'menu-levels': this.dialogBase = 'board'; this.setScreen('levels'); break;
      case 'settings': this.go('settings'); break;
      case 'about': this.go('help'); break;
      case 'back-home': case '__back': this.go(this.dialogParent()); break;
      case 'pause': this.returnScreen = 'board'; this.setScreen('pause'); break;
      case 'resume': this.setScreen('board'); break;
      case 'restart': case 'replay': this.session.reset(); this.setScreen('board'); break;
      case 'next': this.startLevel(Math.min(this.session.levelIndex + 1, LEVELS.length - 1)); break;
      case 'hint': this.session.command('hint'); this.afterAction(); break;
      case 'shuffle': this.session.command('shuffle'); this.afterAction(); break;
      case 'undo': this.session.command('undo'); this.afterAction(); break;
      case 'toggle-sound': this.sound = !this.sound; break;
      case 'toggle-music': this.music = !this.music; break;
      case 'toggle-vibration': this.session.command('toggle-vibration'); break;
      case 'page-prev': this.page = Math.max(0, this.page - 1); break;
      case 'page-next': {
        const shown = this.session.unlockAll ? LEVELS.length : this.session.maxLevel + 1;
        this.page = Math.min(Math.ceil(shown / 16) - 1, this.page + 1);
        break;
      }
      case 'undo-lose': if (this.session.undo()) this.setScreen('board'); break;
      case 'restart-lose': this.session.reset(); this.setScreen('board'); break;
      default: if (id.startsWith('level:')) this.startLevel(Number(id.slice(6)));
    }
    this.dirty = true;
  }

  private startLevel(i: number): void {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    this.session.reset(idx);
    this.returnScreen = 'home';
    this.setScreen('board');
  }

  /** 一次落子之后：播放消除动画、判定胜负。 */
  private afterAction(): void {
    // lastErased 是 Pair[]（含 face）：消除动画用幽灵牌按真牌面重画，不碰节点池
    const erased = this.session.lastErased;
    if (erased.length) this.board.playErase(erased);
    // 提示统一走顶部横幅（session.message 驱动 revision → 重绘），不再有第二条提示
    if (this.session.modal === 'win') this.setScreen('win');
    else if (this.session.modal === 'lose') { this.returnScreen = 'board'; this.screen = 'lose'; }   // 限步用尽
    else if (this.session.dead) { this.returnScreen = 'board'; this.screen = 'lose'; }               // 可靠死局判定
    this.dirty = true;
  }
  /* ── 渲染 ─────────────────────────────────────────────── */

  private render(): void {
    const show = (n: Node, on: boolean) => { if (n.active !== on) n.active = on; };
    // 弹框（设置 / 选关 / 玩法说明）画在谁上面：由 dialogBase 决定，而不是写死"永远大厅"。
    const dialog = this.screen === 'settings' || this.screen === 'levels' || this.screen === 'help';
    const homeFlow = this.screen === 'home' || (dialog && this.dialogBase !== 'board');
    show(this.screens.home, homeFlow);
    if (homeFlow) this.renderHome();
    const boardVisible = this.screen === 'board' || this.screen === 'win' || this.screen === 'lose' || this.screen === 'pause'
      || (dialog && this.dialogBase === 'board');
    show(this.screens.board, boardVisible);
    if (boardVisible) this.renderBoard();
    // 诊断行画在当前看得见的那块底图上（牌桌故障最需要它，而它偏偏不画在大厅）
    this.atlasDiag(boardVisible ? this.boardChrome : this.screens.home);

    clearChildren(this.screens.overlay);
    switch (this.screen) {
      case 'settings': this.renderSettings(); break;
      case 'levels': this.renderLevels(); break;
      case 'win': this.renderWin(); break;
      case 'lose': this.renderLose(); break;
      case 'pause': this.renderPause(); break;
      case 'help': this.renderHelp(); break;
    }
    // 「新玩法」说明卡：进关时 Session 给出待展示的 tip，看完（tip-ok）才开局
    if (this.session.introTip) this.renderTipCard();
  }

  /**
   * 「新玩法」说明卡：veil + 面板 + 标题匾额 + 文案 + 知道了。展示期间牌桌输入被 Session 屏蔽。
   *
   * 纵向排布一律「从面板顶边 py 往下减」（与 `renderHelp()` 同一个习惯）：
   * cc 的 +y 向上，Label 的 y 又是文字盒**顶部**，写成 `py + …` 会把正文画到面板外面、
   * 盖住遮罩和顶栏（第 1 关的教学卡就是这么露在牌桌上面的）。
   * 面板高度公式 `104 + 36 + 行数*54 + 26 + 96 + 30` 与这里的偏移一一对应：
   * 104 = 匾额区（匾额中心 py-66、高 72 → 底边 py-102）、36 = 匾额到第一行正文的留白、
   * 26 = 最后一行到按钮的留白、96 = 按钮高 92 + 4、30 = 底边留白。4 行正文（basic）占
   * py-140 … py-327，按钮占 py-384 … py-476，面板底 py-508：文字不会贴边也不会掉出面板。
   */
  private renderTipCard(): void {
    const root = this.screens.overlay;
    this.veil();
    const tip = this.session.introTip!;   // 只有 introTip 非空时才会走到这里（见 render()）
    const content = TIP_CONTENT[tip] || {title: '新玩法', lines: ['这一关出现了新机制，注意观察棋盘上的标识。']};
    const W = this.size.w;
    const lineH = 54;
    const ph = 104 + 36 + content.lines.length * lineH + 26 + 96 + 30;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 120, ph, 0, py - ph / 2);
    const plate = makePlate(root, this.ui, 320, 72, 0, py - 30 - 36);
    makeLabel(plate, content.title, {x: 0, y: 20, size: 34, color: '#FBF3DE', align: 'center', bold: true, serif: true});
    content.lines.forEach((ln, i) => {
      makeLabel(root, ln, {x: -(W - 120) / 2 + 56, y: py - 104 - 36 - i * lineH, size: 25, color: palette.ink, align: 'left'});
    });
    makeButton(root, this.ui, {x: 0, y: py - ph + 30 + 48, w: 340, h: 92, text: '知道了，开始', style: 'jade', size: 30, onTap: () => this.session.command('tip-ok')});
  }

  /* ── 首页 ─────────────────────────────────────────────── */

  private renderHome(): void {
    const root = this.screens.home;
    clearChildren(root);
    const W = this.size.w, H = this.size.h;
    const safe = this.safeTop;
    // 首页是一组「居中构图」，纵向位置必须跟着可见高度走。
    // 基线是设计高 1334（此时 R(v)===v，与定稿一致）；换成 20:9 这类更高的屏时整体按比例铺开，
    // 否则画面会缩在中间一条、上下各空一大块。
    const R = (v: number) => v * H / 1334;

    // 木桌：H5 稿首页的台面，铺在装饰牌与按钮之下
    const scene = this.sceneAtlas;
    if (scene) makeSprite(root, scene.frame('table'), W, Math.max(1, H - scene.tableTop), 0, -scene.tableTop / 2);

    // 左上角：头像 + 当前关 + 已获得星数（只显示拿到多少，不显示 672 这种总数——
    // 真机反馈是"总数让我焦虑，而且我根本不关心分母"）。
    // 两行文字要**按头像圆心垂直居中**：Label 的 y 是文字盒顶部，所以先算两行的总高，
    // 再从 `top + 总高/2` 往下排（以前第一行写 top+16、第二行 top-26，整块比头像低了约 18）。
    const top = H / 2 - 96 - safe;
    makeSprite(root, this.ui.frame('avatar'), 92, 92, -W / 2 + 76, top);
    const starTotal = Object.values(this.session.stars).reduce((n, v) => n + (Number(v) || 0), 0);
    const line1 = `第 ${Math.min(this.session.maxLevel + 1, LEVELS.length)} 关`;
    const line2 = `★ ${starTotal}`;
    const h1 = 27, h2 = 24, lead = 8;
    const blockTop = top + (h1 + lead + h2) / 2;
    makeLabel(root, line1, {x: -W / 2 + 132, y: blockTop, size: h1, color: palette.ink, align: 'left', bold: true});
    makeLabel(root, line2, {x: -W / 2 + 132, y: blockTop - h1 - lead, size: h2, color: palette.goldDeep, align: 'left', bold: true});

    // 标题簇：大字「快乐推麻」+ 右侧红色印章「对对消」（竖排三字）——两者连读即完整游戏名
    // 「快乐推麻对对消」，这也是备案要求的「游戏内出现完整游戏名称」的落点。
    // 纵向以「距屏顶的设计单位」表达（1334 基准），cc 的 +y 向上所以 y = H/2 - R(v)。
    // 大字与印章同一中线（470）、印章只略高于字面（h156），副标题紧跟其下（中点 576）。
    // 4 字大字（96px ≈ 384 宽）与印章（70 宽）按 24 间隙成组居中：大字中心 -47、印章中心 204。
    const titleTop = H / 2 - R(422);           // 文字盒顶部 = 中点 470 - 字高一半 48
    makeLabel(root, '快乐推麻', {x: -47, y: titleTop, size: 96, color: palette.jadeDeep, align: 'center', bold: true, serif: true});
    const seal = makeNode(root, {w: 70, h: 156, x: 204, y: H / 2 - R(470), name: 'seal'});
    makeSprite(seal, this.ui.frame('seal'), 70, 156, 0, 0, true, this.ui.inset('seal'));
    const sealChars = ['对', '对', '消'];
    sealChars.forEach((ch, i) => makeLabel(seal, ch, {x: 0, y: 72 - i * 50, size: 36, color: '#FFF3DE', align: 'center', bold: true, serif: true}));
    makeLabel(root, '推一推 · 碰个对', {x: 0, y: H / 2 - R(555), size: 34, color: palette.ink, align: 'center', bold: true, serif: true});

    // 三张装饰牌：萬 / 乐 / 筒 大字牌（加大一号），斜靠在木桌上沿。
    // 显示尺寸自己算比例：1 : 1.24（图集是固定基准格，靠 contentSize 缩放，不能把牌形拉变形）。
    const atlas = this.ensureTileAtlas();
    const deco = makeNode(root, {name: 'deco'});
    const decoW = 170, decoH = decoW * 1.24;
    const baseY = -H * .035;
    const put = (face: string, dx: number, dy: number, rot: number, scale = 1) => {
      const n = makeSprite(deco, atlas.face(face), decoW * scale, decoH * scale, dx, dy);
      n.node.angle = rot;
    };
    put('x1', -130, baseY, 9, .82);
    put('x2', -4, baseY - 30, 2);
    put('x3', 122, baseY + 4, -7);

    // 按钮：开始游戏（通栏）+ 关卡选择（通栏拉长）；「我的进度」收进设置弹框
    const bw = W - 168;
    makeButton(root, this.ui, {x: 0, y: R(-322), w: bw, h: 108, text: '开始游戏', style: 'jade', size: 42, icon: 'icon-play', onTap: () => this.activate('start')});
    makeButton(root, this.ui, {x: 0, y: R(-452), w: bw, h: 92, text: '关卡选择', style: 'cream', size: 32, onTap: () => this.activate('levels')});
    makeIconButton(root, this.ui, W / 2 - 76, H / 2 - 96 - safe, 68, 'gear', () => this.activate('settings'));
  }

  /**
   * 牌桌"只剩文字"的两种可能，用**场景图本身**就能分开，不需要 GL 回读：
   *   A. Sprite 节点没建出来 / 尺寸为 0 / layer 不在相机可见掩码里 → 场景图与布局问题；
   *   B. 节点都在、尺寸正常、掩码也对，却看不见 → 光栅化与显存层面的问题。
   *
   * 为什么不用 readPixels：桌面 headless 实测读到的是一条穿过牌区的**已清空**缓冲
   * （画面完全正常也报「色 1 · 有像素 0/96」），拿它当结论会把方向带反。
   * 所以只有异常才上屏 —— 真机上「没出现这一行」本身就是结论（说明是 B）。
   */
  private boardDiag(): string {
    try {
      let mask = -1;
      const findCam = (n: any): any => {
        if (!n) return null;
        for (const c of n._components || []) if (c && c.visibility !== undefined && c.camera) return c;
        for (const ch of n.children || []) { const r = findCam(ch); if (r) return r; }
        return null;
      };
      const cam: any = findCam(director.getScene() as any);
      if (cam) mask = cam.visibility;
      let sprites = 0, zero = 0, badLayer = 0, labels = 0;
      const walk = (n: any): void => {
        if (!n) return;
        for (const c of n._components || []) {
          if (c instanceof Sprite) {
            sprites++;
            const ui = n.getComponent(UITransform);
            if (!ui || ui.width <= 0 || ui.height <= 0) zero++;
            if (mask > 0 && !(n.layer & mask)) badLayer++;
          } else if (c instanceof Label) labels++;
        }
        for (const ch of n.children || []) walk(ch);
      };
      walk(this.screens.board);
      if (!sprites) return '牌桌一个 Sprite 都没有';
      if (zero || badLayer) return `牌桌 Sprite ${sprites}：零尺寸 ${zero} · 掩码不符 ${badLayer} · Label ${labels} · 相机掩码 ${mask}`;
      return '';
    } catch (e) { return '自检失败 ' + String((e as Error)?.message || e).slice(0, 30); }
  }

  /**
   * 素材出问题时**必须让玩家和作者都看出来**：鸿蒙真机那次是"Label 全在、贴图全不见"，
   * 画面看着像布局坏了，实际是图集/显存层面的故障，而 JS 侧一声不响——没有这一行就只能靠猜。
   *
   * 画在大厅与牌桌两处：出问题的往往正是牌桌（它才懒加载牌图集），只挂在大厅等于看不到。
   */
  private atlasDiag(root: Node): void {
    const rep = atlasReport();
    const broken = rep.atlases.filter((a) => !a.ok);
    if (!broken.length && !rep.misses.length && !this.renderFailures && !rep.contextLost && !rep.glError) return;
    const H = this.size.h;
    const lines = [
      broken.length ? `贴图未就绪：${broken.map((a) => `${a.name}${a.error ? `（${a.error}）` : ''}`).join('、')}` : '',
      rep.misses.length ? `缺素材：${rep.misses.slice(0, 4).join(' ')}${rep.misses.length > 4 ? ' …' : ''}` : '',
      rep.contextLost ? `WebGL 上下文丢失 ${rep.contextLost} 次` : '',
      rep.glError ? `GL ${rep.glError}` : '',
      this.pxProbe ? `牌桌自检：${this.pxProbe}` : '',
      this.renderFailures ? `绘制异常 ${this.renderFailures} 次：${this.renderNote}` : '',
    ].filter(Boolean).join(' · ');
    makeLabel(root, lines, {x: 0, y: -H / 2 + 150, size: 20, color: palette.red, align: 'center'});
    makeLabel(root, `画布 ${rep.impl} · 上限 ${rep.maxTexture} · ` + rep.atlases.map((a) => `${a.w}x${a.h}${a.ok ? '' : '×'}`).join(' '),
      {x: 0, y: -H / 2 + 122, size: 18, color: palette.inkSoft, align: 'center'});
  }
  /* ── 牌桌 ─────────────────────────────────────────────── */

  private renderBoard(): void {
    const root = this.boardChrome;
    clearChildren(root);
    this.dragLabel = null;
    const W = this.size.w, H = this.size.h;
    const S = this.session;
    const left = count(S.grid);

    const safe = this.safeTop;
    // 顶栏左右两颗：左＝对局菜单（继续 / 重开 / 回首页 / 选关，打开即停表，所以画暂停图标），
    // 右＝设置（音效、背景音乐、震动、玩法说明）。
    // 以前左键直接回大厅、右键进的是"已暂停"，玩家想改个音效要先回大厅再点齿轮，绕一整圈。
    makeIconButton(root, this.ui, -W / 2 + 60, H / 2 - 68 - safe, 68, 'pause', () => this.activate('pause'));
    const plate = makePlate(root, this.ui, 330, 76, 0, H / 2 - 68 - safe);
    makeLabel(plate, `第 ${S.levelIndex + 1} 关`, {x: 0, y: 22, size: 38, color: '#FBF3DE', align: 'center', bold: true, serif: true});
    makeIconButton(root, this.ui, W / 2 - 60, H / 2 - 68 - safe, 68, 'gear', () => this.activate('settings'));

    // 统计行 / 进度条 / 横幅 / 牌区 / 工具条的纵向位置，全部照 H5 的 drawBoard() 常数换算
    // （H5 的 text() 用 middle 基线，cc 的 Label 锚点是顶部，所以文字要再上移半个行高）
    // 统计行：目标关把左侧换成目标进度；限步关把右侧换成剩余步数
    const goal = S.goal;
    // 分母用 `S.goalNeed`（本关实际给得出的量），不是关卡表里的 `goal.count`
    const goalText = goal ? (goal.kind === 'face' ? `目标 ${Session.faceName(goal.face!)} ×${S.goalDone}/${S.goalNeed}`
      : goal.kind === 'collect' ? `集齐 ${S.goalDone}/${S.goalNeed} 种`
      : `目标 碎冰 ×${S.goalDone}/${S.goalNeed}`) : null;
    // 方言关的"剩余"必须数还能消的牌：哑弹永远消不掉，按 count 显示会让玩家对着一个到不了 0
    // 的数字反复推轨道。顺带把哑弹单独标出来，省得它被当成 bug。
    const duds = left - S.remaining;
    const restText = goalText ? goalText
      : duds > 0 ? `可消 ${S.remaining} / ${S.liveTotal} 张 · 哑弹 ${duds}`
      : `剩余 ${left} / ${S.total} 张`;
    makeLabel(root, restText, {x: -W / 2 + 40, y: H / 2 - 118 - safe, size: 25, color: goalText ? palette.jadeDeep : palette.ink, align: 'left', bold: true});
    const moveText = S.moveLimit ? `步数 ${S.moves}/${S.moveLimit}` : `${S.moves} 步 · 三星 ≤ ${S.par} 步`;
    makeLabel(root, moveText, {x: W / 2 - 40, y: H / 2 - 118 - safe, size: 25, color: S.moveLimit && S.movesLeft <= 3 ? palette.red : palette.ink, align: 'right', bold: true});
    // 秒数排在「步数 / 三星」左边。以前写死 x: W/2-150，第 70 关的文案「0 步 · 三星 ≤ 18 步」实测
    // 约 250 宽（左沿到 W/2-290），倒计时直接压在上面，切图糊成「时5时4秒星 ≤ 18 步」。
    // 宽度只能自己估：Label 的 contentSize 要到渲染阶段才算得出，同一帧读 UITransform.width 是 0
    // （第一版就是这么修的，重拍后照样叠字）。
    if (S.timeLimit) {
      // 留 28 而不是 16：实测这套估算比真实渲染窄约 9 设计像素（粗体中文字宽 >1 em），
      // 按 16 排完 CDP 量到的间距只有 7px，肉眼已经觉得挤。
      const gap = 28;
      const right = W / 2 - 40 - textWidth(moveText, 25) - gap;
      const minLeft = -W / 2 + 40 + textWidth(restText, 25) + gap;
      makeLabel(root, `时间 ${Math.ceil(S.timeLeft)} 秒`, {x: Math.max(right, minLeft), y: H / 2 - 118 - safe,
        size: 24, color: S.timeLeft <= 10 ? palette.red : palette.ink, align: 'right', bold: true});
    }
    const barW = W - 80;
    makeSprite(root, this.ui.frame('chip-light'), barW, 16, 0, H / 2 - 166 - safe, true, this.ui.inset('chip-light'));
    // 进度按"还能消的牌"算：哑弹不在分子也不该在分母里拖底。
    const done = S.liveTotal ? (S.liveTotal - S.remaining) / S.liveTotal : 0;
    if (done > 0) makeSprite(root, this.ui.frame('chip-dark'), Math.max(12, barW * done), 16, -barW / 2 + Math.max(12, barW * done) / 2, H / 2 - 166 - safe, true, this.ui.inset('chip-dark'));

    const banner = makeNode(root, {w: W - 68, h: 62, x: 0, y: H / 2 - 221 - safe, name: 'banner'});
    makeSprite(banner, this.ui.frame('banner'), W - 68, 62, 0, 0, true, this.ui.inset('banner'));
    // 左侧一道玉色竖条即可，不再套「!」圆形徽标——圆徽标是这套界面里最模板化的一处
    makeSprite(banner, this.ui.frame('chip-dark'), 6, 30, -(W - 68) / 2 + 24, 0, true, this.ui.inset('chip-dark'));
    // 提示统一走这一条横幅：拖动预览 > session.message > 默认文案。底部不再有第二条提示。
    const bannerText = this.drag ? this.dragLine() : (S.message || '轻点配对 / 横竖拖动整段');
    this.dragLabel = makeLabel(banner, bannerText, {x: -(W - 68) / 2 + 44, y: 12, size: 24, color: palette.ink, align: 'left'});

    const top = H / 2 - 270 - safe;
    const bottom = -H / 2 + 214;
    const availH = top - bottom;
    const rows = S.grid.length, cols = S.grid[0].length;
    /**
     * 牌桌自适应：尺寸跟着**屏幕**与**行列数**走，位置在这条带子里居中。
     *
     * 三条边界：
     *  - 横向：侧边留白带按列数收窄（3 列的盘不需要 54 的边距）；
     *  - 纵向：`availH/(rows+.4)/1.24` 里的 `.4` 是给木框留的（Board 的 pad = 牌高×.2，上下各一份），
     *    否则牌区刚好放得下、木框却会压到横幅或工具条；
     *  - 上限 156：牌图集按基准格 125×155、2 倍烘焙（每格 250 纹理像素）。在 390CSS / dsf3 的机器上
     *    1 设计单位 ≈ 1.56 物理像素，显示超过 ~160 设计单位就开始放大变糊，156 留一点余量。
     *
     * 以前这三条是「边距固定 54 + 上限写死 116 + 只允许往下挪 30」，于是第 5 关这种 3×4 小盘
     * 被钉在屏幕上半部、下半屏空掉近一半，单手拇指要伸到上面去拖牌。
     */
    const sidePad = cols <= 4 ? 34 : cols <= 6 ? 44 : 54;
    const cellW = Math.min((W - sidePad * 2) / cols, availH / (rows + .4) / 1.24, 156);
    const cellH = cellW * 1.24;
    const atlas = this.ensureTileAtlas();
    const bw = cellW * cols, bh = cellH * rows;
    // 纵向居中；放不下时（极端大盘）才退回贴顶。横向恒居中。
    const x = -bw / 2, y = top - Math.max(0, (availH - bh) / 2);

    // 锁定行 / 列 + 单向轨 + 仍锁着的连锁解锁轨（常驻标识，数据全部来自关卡定义）
    const def = levelAt(S.levelIndex);
    const tileable = (row: string) => row.split('').some((v) => v === '1' || v === '2' || v === '3');
    const lockedRows = def.lockR.filter((r) => r >= 0 && r < def.map.length && tileable(def.map[r]));
    const lockedCols = def.lockC.filter((c) => c >= 0 && c < (def.map[0] || '').length && def.map.some((row) => tileable(row[c] || '')));
    const pendingUnlock = (def.unlock || []).filter((u) => u.after > S.clearedPairs);

    this.board.build({
      grid: S.grid, runs: S.runs,
      selected: S.selected,
      hintCells: this.hintCells(),
      drag: this.drag,
      lockedRows, lockedCols,
      oneWay: def.oneWay || [],
      pendingUnlock
    }, atlas, x, y, cellW, cellH);

    const tools: {id: string; icon: UiName; label: string; sub: string}[] = [
      {id: 'hint', icon: 'icon-hint', label: '提示', sub: `免费 ${S.hintsLeft} 次`},
      {id: 'shuffle', icon: 'icon-shuffle', label: '洗牌', sub: S.shuffleBlocked ? '方言洗不开' : `免费 ${S.shufflesLeft} 次`},
      {id: 'undo', icon: 'icon-undo', label: '撤销', sub: '退回上一步'},
      {id: 'restart', icon: 'icon-restart', label: '重开', sub: '重来这一盘'}
    ];
    const tw = (W - 68 - 3 * 16) / 4;
    tools.forEach((t, i) => {
      const bx = -W / 2 + 34 + i * (tw + 16) + tw / 2;
      const n = makeNode(root, {w: tw, h: 116, x: bx, y: -H / 2 + 110, name: 'tool:' + t.id});
      makeSprite(n, this.ui.frame('btn-dark'), tw, 116, 0, 0, true, this.ui.inset('btn-dark'));
      // btn-dark 的按钮脸只画到 90% 高（脸底在本地 -46.4、脸顶 57.6）：图标/文字/副标题必须全部收在脸内。
      // Label 的 y 是**文字顶部**，所以文字占 [y-size, y]。三段的纵向区间：
      //   图标 38 高 @ y=34 → [15, 53]；主文字 26 高 @ y=8 → [-18, 8]；副文字 18 高 @ y=-24 → [-42, -24]。
      // 相邻两段各留 ≥6 的空隙 —— 以前图标 @14 与主文字 @-2 直接压在一起（真机反馈）。
      const ic = makeSprite(n, this.ui.frame(t.icon), 38, 38, 0, 34);
      ic.color = hex('#F3EAD2');
      makeLabel(n, t.label, {x: 0, y: 8, size: 26, color: '#FFFFFF', align: 'center', bold: true});
      // cc 的 Color.fromHEX 只认 #RGB/#RRGGBB/#RRGGBBAA；传 rgba(...) 会解析成 NaN → 全透明黑，文字直接看不见
      makeLabel(n, t.sub, {x: 0, y: -24, size: 18, color: '#F3EAD2BF', align: 'center'});
      bindPress(n, () => this.activate(t.id));
    });
  }

  /** 牌桌横幅那行字：拖动中显示方向与格数。 */
  private dragLine(): string {
    const d = this.drag;
    if (!d || !this.session.runs[d.run]) return '轻点配对 / 横竖拖动整段';
    // offset 的语义已与 h5/core 对齐（列方向 offset>0 = 向下推），文案两边同式；
    // cc 不再需要像以前那样「反过来写」——方向反转已在拖动几何里修正。
    const dir = this.dragAxis === 'row' ? (d.offset > 0 ? '右' : '左') : (d.offset > 0 ? '下' : '上');
    return `正在向${dir}推 ${Math.max(1, Math.abs(Math.round(d.offset)))} 格 · 松手消除碰起的对子`;
  }

  private hintCells(): Pos[] {
    const out: Pos[] = [];
    for (const a of this.session.hint) {
      if (a.kind === 'match') out.push(a.a, a.b);
      else { const run = this.session.runs[a.run]; if (run) for (const p of run.cells) out.push(p); }
    }
    return out;
  }

  /* ── 选关 / 设置 / 进度 ───────────────────────────────── */

  /* ── 选关 / 设置 / 进度 弹框几何 ─────────────────────────── */

  /**
   * 把一块 `contentH` 高的内容在「顶栏之下、屏幕底部之上」垂直居中，返回它的**顶边** y（cc 坐标）。
   *
   * 面板不要按屏高取比例撑大：屏一高（20:9 约 1623）面板会拉到 1300+，而里面的内容还是固定尺寸，
   * 结果就是「上面几行 + 下面一大片空面板」。按内容定高再居中，任何屏高下都成立。
   */
  private centeredTop(contentH: number, topInset = 118, bottomInset = 40): number {
    const H = this.size.h;
    const mid = ((H / 2 - topInset) + (-H / 2 + bottomInset)) / 2;
    return mid + contentH / 2;
  }

  /**
   * 选关：**一章一屏 4×4**，未解锁的关画成灰卡但占位不变。
   *
   * 以前是"按解锁进度每 16 个切一页"，玩家说不清自己卡在第几章；章节这个坐标当时只在
   * 「我的进度」弹框里有。按要求把两边合成一个界面：进度弹框撤掉，选关直接带章名、
   * 星级、图例与总星数。
   */
  private renderLevels(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w;
    const CH = 16, COLS = 4, gap = 18;
    const chapters = Math.max(1, Math.ceil(LEVELS.length / CH));
    this.page = Math.max(0, Math.min(this.page, chapters - 1));
    const pw = W - 68, px = -W / 2 + 34;
    const cw = (pw - 80 - gap * (COLS - 1)) / COLS, chh = 104;
    const gridH = 4 * chh + 3 * gap;
    const oHead = 30 + 72, oChapter = oHead + 30, oGrid = oChapter + 46;
    const oLegend = oGrid + gridH + 52;
    const oFoot = oLegend + 62;
    const ph = oFoot + 34 + 30;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, pw, ph, 0, py - ph / 2);

    const plate = makePlate(root, this.ui, 300, 72, -40, py - 30 - 36);
    makeLabel(plate, '选择关卡', {x: 0, y: 20, size: 32, color: '#FBF3DE', align: 'center', bold: true, serif: true});
    makeIconButton(root, this.ui, pw / 2 - 52, py - 30 - 36, 58, 'close', () => this.activate('__back'));

    const ci = this.page;
    makeLabel(root, `第 ${ci + 1} 章 · ${CHAPTER_NAMES[ci] || ''}（${ci * CH + 1}-${Math.min(LEVELS.length, (ci + 1) * CH)}）`,
      {x: px + 40, y: py - oChapter, size: 26, color: palette.ink, align: 'left', bold: true});
    makeLabel(root, `${ci + 1} / ${chapters}`, {x: px + pw - 40, y: py - oChapter + 2, size: 22, color: palette.inkSoft, align: 'right'});

    const gy = py - oGrid;
    for (let j = 0; j < CH; j++) {
      const idx = ci * CH + j;
      if (idx >= LEVELS.length) break;
      const col = j % COLS, row = Math.floor(j / COLS);
      const bx = px + 40 + col * (cw + gap) + cw / 2;
      const by = gy - row * (chh + gap) - chh / 2;
      const unlocked = idx <= this.session.maxLevel || this.session.unlockAll;
      const st = this.session.stars[String(idx)] || 0;
      const n = makeNode(root, {w: cw, h: chh, x: bx, y: by, name: 'level:' + idx});
      makeSprite(n, this.ui.frame(unlocked ? 'card-on' : 'card-off'), cw, chh, 0, 0, true, this.ui.inset(unlocked ? 'card-on' : 'card-off'));
      if (idx === this.session.levelIndex) makeSprite(n, this.ui.frame('hl-gold'), cw, chh, 0, 0, true, this.ui.inset('hl-gold'));
      makeLabel(n, String(idx + 1), {x: 0, y: chh * .3, size: 34, color: unlocked ? '#FFFFFF' : palette.inkFaint, align: 'center', bold: true});
      if (unlocked) {
        makeStars(n, this.ui, 0, -chh * .24, 22, st, 3, 2);
        bindPress(n, () => this.activate('level:' + idx));
      }
    }

    const ly = py - oLegend;
    const legend: [string, string][] = [['未解锁', '#D9D2BC'], ['0 星', '#FFFFFF'], ['1 星', '#BFE3B6'], ['2 星', '#7EC77F'], ['3 星', '#2E7D4F']];
    const lw = 100, lgap = 4;
    let lx = -(legend.length * lw + (legend.length - 1) * lgap) / 2;
    for (const [label, col] of legend) {
      makeSprite(root, this.ui.frame('white'), 18, 18, lx + 9, ly).color = hex(col);
      makeLabel(root, label, {x: lx + 26, y: ly + 12, size: 19, color: palette.inkSoft, align: 'left'});
      lx += lw + lgap;
    }

    const stars = this.session.stars;
    const got = Object.values(stars).reduce((n, v) => n + (Number(v) || 0), 0);
    const cleared = Object.keys(stars).length;
    // 只报"拿到多少 / 打通几关"，不写 ★ x / 672 这种分母（真机反馈：分母只会让人焦虑）。
    makeLabel(root, `★ ${got} · 已通关 ${cleared} / ${LEVELS.length} 关`,
      {x: 0, y: py - oFoot + 16, size: 23, color: palette.ink, align: 'center', bold: true});
    // 左右翻页必须是**同一颗按钮**：以前左边是圆形按钮、右边是一根裸箭头，
    // 看着像两种功能，玩家不敢确定右边那个能不能点。右侧用同一颗转 180°。
    const navY = py - oFoot;
    if (this.page > 0) makeIconButton(root, this.ui, px + 62, navY, 56, 'back', () => this.activate('page-prev'));
    if (this.page < chapters - 1) {
      const next = makeIconButton(root, this.ui, px + pw - 62, navY, 56, 'back', () => this.activate('page-next'));
      next.angle = 180;
      next.name = 'page-next';
    }
  }

  /** 设置弹框：veil + 居中面板 + 关闭钮。只留设置本身——「我的进度」已按要求撤掉，
   *  章节进度与星级改由「选择关卡」一章一屏直接承担。 */
  private renderSettings(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w;
    const rows: {id: string; icon: UiName; label: string; toggle?: boolean}[] = [
      {id: 'toggle-sound', icon: 'icon-sound', label: '音效', toggle: this.sound},
      {id: 'toggle-music', icon: 'icon-music', label: '背景音乐', toggle: this.music},
      {id: 'toggle-vibration', icon: 'icon-vibrate', label: '震动', toggle: this.session.vibration},
      {id: 'about', icon: 'icon-book', label: '玩法说明'}
    ];
    const rh = 104;
    // 面板高 = 顶部（匾额区 118）+ 行数×行高 + 底部留白 30 + 版本页脚 40。
    // 之前只算 rh*行数+68，比内容矮 ~76：最后一行（玩法说明）必然被面板下边缘裁掉一半。
    const ph = 118 + rh * rows.length + 30 + 40;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 80, ph, 0, py - ph / 2);
    const plate = makePlate(root, this.ui, 240, 66, -40, py - 28 - 33);
    makeLabel(plate, '设置', {x: 0, y: 18, size: 32, color: '#FBF3DE', align: 'center', bold: true, serif: true});
    makeIconButton(root, this.ui, (W - 80) / 2 - 52, py - 28 - 33, 58, 'close', () => this.activate('__back'));
    rows.forEach((r, i) => {
      const y = py - 34 - 66 - 18 - i * rh - (rh - 8) / 2;
      const row = makeNode(root, {w: W - 128, h: rh - 8, x: 0, y, name: 'setting:' + r.id});
      if (i % 2 === 0) makeSprite(row, this.ui.frame('chip-light'), W - 128, rh - 8, 0, 0, true, this.ui.inset('chip-light'));
      const ic = makeSprite(row, this.ui.frame(r.icon), 36, 36, -(W - 128) / 2 + 44, 0);
      ic.color = hex(palette.jade);
      makeLabel(row, r.label, {x: -(W - 128) / 2 + 78, y: 17, size: 27, color: palette.ink, align: 'left'});
      // 「这一行是不是开关」与「开关当前开没开」是两件事：以前只看 r.toggle 的值，
      // 于是音效/震动关掉之后整行退化成一条「>」箭头，看起来像进了二级页面（真机反馈）。
      const isToggle = r.id.startsWith('toggle-');
      if (isToggle) {
        makeToggle(row, this.ui, (W - 128) / 2 - 45, 0, 74, !!r.toggle, () => this.activate(r.id));
      } else {
        makeSprite(row, this.ui.frame('chevron'), 26, 26, (W - 128) / 2 - 20, 0);
        bindPress(row, () => this.activate(r.id));
      }
    });
    makeLabel(root, `版本 ${APP_VERSION}`, {x: 0, y: py - ph + 30 + 20, size: 22, color: palette.inkSoft, align: 'center'});
  }

  /* ── 弹窗 ─────────────────────────────────────────────── */

  /**
   * 弹窗遮罩：**必须挂一个吞掉的触摸监听器**，不然它就是块透明的画。
   *
   * Cocos 3.x 的节点触摸派发只把「挂了触摸监听器的节点」放进 `_pointerEventProcessorList`，
   * 命中测试从最上面一个开始、由它 swallow。以前这里只 addComponent(Sprite) + UIOpacity，
   * 遮罩不参与派发 → 点穿弹窗照样能打到底下的控件：首页「开始游戏」（静默 `session.reset()`
   * 把刚读回的牌局丢掉）、牌桌工具条四个道具、右上角齿轮。弹窗还挂在已经赢了的空盘上。
   *
   * 监听器是空函数，不套 `bindPress`（那会给遮罩加按钮按压反馈，缩放一下很怪）。
   * 遮罩在弹窗各控件**之前**创建（siblingIndex 更低），所以它只挡「没命中任何按钮」的触摸，
   * 弹窗自己的按钮照样点得动。
   */
  private veil(): Node {
    const n = makeNode(this.screens.overlay, {w: this.size.w, h: this.size.h, name: 'veil'});
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    // 用不透明白帧染色成纯色遮罩：直接用半透明的 chip-light 再染色，会把两处 alpha 相乘，
    // 实际只剩 ~16% 不透明度，底下的牌桌几乎压不住（H5 稿是 .55）。
    sp.spriteFrame = this.ui.frame('white');
    sp.color = hex('#12281A');
    const op = n.addComponent(UIOpacity);
    op.opacity = 150;
    const swallow = (e: EventTouch) => { e.propagationStopped = true; };
    n.on(Node.EventType.TOUCH_START, swallow, n);
    n.on(Node.EventType.TOUCH_MOVE, swallow, n);
    n.on(Node.EventType.TOUCH_END, swallow, n);
    n.on(Node.EventType.TOUCH_CANCEL, swallow, n);
    return n;
  }

  private renderWin(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w, S = this.session;
    // 面板按内容定高再居中；原来取 H*.56，屏一高中间就空一大块
    const oLevel = 76, oStars = 182, oR1 = 272, oR2 = 326, oNext = 424, oHome = 522;
    const ph = oHome + 38 + 42;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 156, ph, 0, py - ph / 2);
    const ban = makeNode(root, {w: 464, h: 100, x: 0, y: py + 54, name: 'banner'});
    makeSprite(ban, this.ui.frame('banner-win'), 464, 100, 0, 0, true, this.ui.inset('banner-win'));
    makeLabel(ban, '恭喜通关', {x: 0, y: 30, size: 50, color: '#F7DFA0', align: 'center', bold: true, serif: true});
    makeLabel(root, `第 ${S.levelIndex + 1} 关`, {x: 0, y: py - oLevel, size: 34, color: palette.ink, align: 'center', bold: true, serif: true});
    makeStars(root, this.ui, 0, py - oStars, 88, S.rating, 3, 6);
    // 两行数字都要「不撒谎」：Session 里没有历史最佳步数可用（stars 存的是 0-3 的星数，
    // 以前这里把星数当步数显示，第 1 关三星就写着「最佳记录 3 步」）。改成同屏可见的两个真值，
    // 与牌桌 HUD「N 步 · 三星 ≤ M 步」口径一致；面板布局与字号不动。
    makeLabel(root, '本局步数', {x: -(W - 156) / 2 + 70, y: py - oR1, size: 26, color: palette.inkSoft, align: 'left'});
    makeLabel(root, `${S.moves} 步`, {x: (W - 156) / 2 - 70, y: py - oR1, size: 26, color: palette.ink, align: 'right', bold: true});
    makeLabel(root, '三星门槛', {x: -(W - 156) / 2 + 70, y: py - oR2, size: 26, color: palette.inkSoft, align: 'left'});
    makeLabel(root, `${S.par} 步`, {x: (W - 156) / 2 - 70, y: py - oR2, size: 26, color: palette.ink, align: 'right', bold: true});
    makeButton(root, this.ui, {x: 0, y: py - oNext, w: W - 248, h: 92, text: '下一关', style: 'jade', size: 36, icon: 'icon-play', onTap: () => this.activate('next')});
    makeButton(root, this.ui, {x: 0, y: py - oHome, w: W - 248, h: 76, text: '返回首页', style: 'cream', size: 30, onTap: () => this.activate('home')});
    fadeIn(root);
  }

  private renderLose(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w, S = this.session;
    const oSub = 76, oTile = 188, oLevel = 298, oLeft = 340, oMoves = 376, oBtn = 490, oFoot = 566;
    const ph = oFoot + 30 + 40;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 168, ph, 0, py - ph / 2);
    const ban = makeNode(root, {w: 428, h: 96, x: 0, y: py + 50, name: 'banner'});
    makeSprite(ban, this.ui.frame('banner-lose'), 428, 96, 0, 0, true, this.ui.inset('banner-lose'));
    makeLabel(ban, '很遗憾', {x: 0, y: 28, size: 48, color: '#F7DFA0', align: 'center', bold: true, serif: true});
    // 失败原因：限步用尽用 Session 的文案；死局用固定文案
    const reason = S.modal === 'lose' ? S.message : '牌走死了：剩下的牌凑不出可消的组合。';
    makeLabel(root, reason, {x: 0, y: py - oSub, size: 28, color: palette.inkSoft, align: 'center', bold: true, serif: true});
    const atlas = this.ensureTileAtlas();
    // 同样是 1:1.24，只是这里按失败页的版面缩小显示
    makeSprite(root, atlas.face('z5'), 116, 116 * 1.24, 0, py - oTile);
    makeLabel(root, `第 ${S.levelIndex + 1} 关`, {x: 0, y: py - oLevel, size: 30, color: palette.ink, align: 'center', bold: true});
    makeLabel(root, `剩余 ${count(S.grid)} / ${S.total} 张`, {x: 0, y: py - oLeft, size: 25, color: palette.inkSoft, align: 'center'});
    makeLabel(root, `${S.moves} 步 · 三星 ≤ ${S.par} 步`, {x: 0, y: py - oMoves, size: 25, color: palette.inkSoft, align: 'center'});
    const half = (W - 168 - 116) / 2;
    makeButton(root, this.ui, {x: -(half + 46) / 2, y: py - oBtn, w: half, h: 84, text: '撤销一步', style: 'cream', size: 28, onTap: () => this.activate('undo-lose')});
    makeButton(root, this.ui, {x: (half + 46) / 2, y: py - oBtn, w: half, h: 84, text: '重新开始', style: 'jade', size: 28, onTap: () => this.activate('restart-lose')});
    makeLabel(root, '再接再厉，下一次一定！', {x: 0, y: py - oFoot, size: 26, color: palette.inkSoft, align: 'center', bold: true});
    fadeIn(root);
  }

  /** 牌桌左按钮打开的对局菜单：继续 / 重开 / 回首页 / 选关四件事都在这里。 */
  private renderPause(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w;
    const items: {id: string; icon: UiName; label: string; style: 'jade' | 'cream'}[] = [
      {id: 'resume', icon: 'icon-play', label: '继续游戏', style: 'jade'},
      {id: 'restart', icon: 'icon-restart', label: '重新开始', style: 'cream'},
      {id: 'home', icon: 'icon-home', label: '返回首页', style: 'cream'},
      {id: 'menu-levels', icon: 'icon-progress', label: '选择关卡', style: 'cream'}
    ];
    // 标题样式与其它弹框统一：匾额**嵌在面板顶部的匾额区里**（30+72），关闭钮同高在右。
    // 以前这块匾额画在 `py + 42`（面板上方外面），四个弹框两种标题长相。
    const pw = W - 192;
    const oHead = 30 + 72;
    const oStart = oHead + 56, step = 100;
    const ph = oStart + (items.length - 1) * step + 41 + 34;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, pw, ph, 0, py - ph / 2);
    const plate = makePlate(root, this.ui, 300, 72, -40, py - 30 - 36);
    makeLabel(plate, '已暂停', {x: 0, y: 20, size: 32, color: '#FBF3DE', align: 'center', bold: true, serif: true});
    makeIconButton(root, this.ui, pw / 2 - 52, py - 30 - 36, 58, 'close', () => this.activate('resume'));
    items.forEach((it, i) => {
      makeButton(root, this.ui, {x: 0, y: py - oStart - i * step, w: pw - 88, h: 82, text: it.label, style: it.style, size: 30, icon: it.icon, onTap: () => this.activate(it.id)});
    });
    fadeIn(root);
  }

  private renderHelp(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w;
    const lines = [
      '轻点两张相邻的同牌，即可消除。',
      '按住一行横拖、一列竖拖，整段循环滑动。',
      '滑动松手后会自动消除碰起的对子，可连消。',
      '木块与空洞会截断滑轨；锁住的行 / 列推不动。',
      '冰面牌要消两次：第一下碎冰，第二下收牌。',
      '提示 / 洗牌各有限量，用辅助最多两星。'
    ];
    const oLines = 124, lstep = 54;
    const oBtn = oLines + (lines.length - 1) * lstep + 31 + 43 + 40;
    const ph = oBtn + 43 + 40;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, W - 140, ph, 0, py - ph / 2);
    makeLabel(root, '玩法', {x: 0, y: py - 44, size: 42, color: palette.jadeDeep, align: 'center', bold: true, serif: true});
    lines.forEach((s, i) => makeLabel(root, s, {x: -(W - 140) / 2 + 56, y: py - oLines - i * lstep, size: 25, color: palette.ink, align: 'left'}));
    makeButton(root, this.ui, {x: 0, y: py - oBtn, w: 340, h: 86, text: '知道了', style: 'jade', size: 30, onTap: () => this.activate('back-home')});
    fadeIn(root);
  }

  /* ── 场景背景 / 安全区 ─────────────────────────────────── */

  /** 建整屏背景节点（最先加入 → 在最底层）。 */
  private makeBackground(): Sprite {
    const n = makeNode(this.node, {w: DESIGN_W, h: DESIGN_H, name: 'garden'});
    n.setSiblingIndex(0);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    return sp;
  }

  /** 按当前屏幕尺寸（重新）烘焙庭院背景 + 木桌，并把背景铺满整屏。 */
  private ensureScene(): void {
    const w = this.size.w, h = this.size.h;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (!this.sceneAtlas || this.sceneKey !== key) {
      // 场景图集是**唯一**允许换纹理的地方（屏幕尺寸真变了），所以旧的必须先 dispose：
      // Texture2D 占的是显存，引用置空不等于释放，一次屏幕尺寸变化就多挂一张全屏图。
      this.sceneAtlas?.atlas.dispose();
      this.sceneAtlas = new SceneAtlas(w, h);
      this.sceneKey = key;
      mark(`atlas-scene ${key}`);
    }
    if (this.bgSprite) {
      this.bgSprite.spriteFrame = this.sceneAtlas.frame('garden');
      const ui = this.bgSprite.node.getComponent(UITransform);
      if (ui) ui.setContentSize(w, h);
      this.bgSprite.node.setPosition(0, 0, 0);
    }
  }

  /**
   * 量出微信胶囊按钮占掉多高，换算成设计单位；顶栏整体下移这么多，
   * 否则右上角的齿轮会被官方胶囊盖住。编辑器预览 / 浏览器没有胶囊，返回 0。
   */
  private computeSafeTop(): number {
    try {
      const g = globalThis as any;
      const rect = g.wx?.getMenuButtonBoundingClientRect?.();
      const info = g.wx?.getWindowInfo?.();
      const winW: number = info?.windowWidth || 0;
      if (rect && winW > 0 && rect.bottom > 0) {
        return Math.max(0, Math.round(rect.bottom * (DESIGN_W / winW) + 12 - 34));
      }
    } catch { /* 非小游戏环境 */ }
    return 0;
  }

  /* ── 图集 ─────────────────────────────────────────────── */

  /**
   * 牌图集：**没有就烘一次，之后永远复用**。
   *
   * 以前按 key（格子尺寸）重建：首页装饰牌 170×215 + 倍率 2 → 单格 340×430，8 列 6 行 =
   * 2720×2580（7.0 MPixel ≈ 28MB 显存），而且牌桌每次格子变化、每次失败页都再烘一张新的、
   * 旧的一张都不释放。低配安卓机纹理上限常是 2048，显存吃紧时就是黑屏 / 只画出部分牌 /
   * 约一分钟后能进但牌桌只剩一列叠牌。现在恒定一张 2000×1860，界面各自缩放 contentSize。
   */
  private ensureTileAtlas(): TileAtlas {
    if (!this.tileAtlas) {
      this.tileAtlas = new TileAtlas();
      mark(`atlas-tile ${this.tileAtlas.atlas.width}x${this.tileAtlas.atlas.height}`);
    }
    return this.tileAtlas;
  }

  private queryParam(name: string): string | null {
    try {
      const g = globalThis as any;
      const search: string = (g.location?.search) || '';
      if (!search) return null;
      return new URLSearchParams(search).get(name);
    } catch { return null; }
  }

  /* ── 触摸 ─────────────────────────────────────────────── */

  /**
   * 屏幕坐标（左下原点）→ 本节点坐标（以可见区中心为原点）。
   *
   * `getUILocation()` 返回的**已经**是 UI 空间（即 `view.getVisibleSize()` 那套坐标），
   * 所以这里只需要平移到中心，**不能再按设计分辨率缩放**。
   * 之前用 `DESIGN_H / visible.height` 缩放，在 750×1623 这类比设计稿更高的屏上
   * 会把 y 压成 0.82 倍，导致点牌点不准。
   */
  private toDesign(e: EventTouch): {x: number; y: number} {
    const p = e.getUILocation();
    const visible = view.getVisibleSize();
    return {x: p.x - visible.width / 2, y: p.y - visible.height / 2};
  }

  /**
   * 全局触摸只负责**棋盘手势**（点击配对 / 拖动整段）。
   *
   * 按钮一律交给各自节点的 TOUCH_END（`widgets.bindPress`），两套机制互不重叠：
   * 只有落在棋盘格子上的触摸才开启手势，而按钮永远不在棋盘格范围内
   * （顶栏与工具条都在牌区之外），所以不需要任何手工命中数组。
   */
  private onTouch(e: EventTouch): void {
    if (!this.session) return;
    const id = e.getID();
    if (e.type === Input.EventType.TOUCH_START) {
      if (this.touchId !== null) return; // 多指：不抢占已在进行的手势
      if (this.screen !== 'board') return; // 弹窗 / 其它屏的按钮各自处理
      const {x, y} = this.toDesign(e);
      const cell = this.board.cellAt(x, y);
      if (!cell) return; // 没落在棋盘上 → 交给节点触摸事件
      this.touchId = id;
      this.press = {x, y, cell, blocked: false, axis: null};
      this.drag = null;
      this.dragAxis = 'row';
      this.lastStep = 0;
      return;
    }
    if (id !== this.touchId) return;
    if (e.type === Input.EventType.TOUCH_MOVE) {
      const {x, y} = this.toDesign(e);
      this.onMove(x, y);
      return;
    }
    this.touchId = null;
    if (!this.press) return;
    if (e.type === Input.EventType.TOUCH_CANCEL) {
      this.press = null;
      this.drag = null;
      this.dirty = true;
      return;
    }
    const {x, y} = this.toDesign(e);
    this.onUp(x, y);
  }

  private onMove(x: number, y: number): void {
    const p = this.press;
    if (!p || !p.cell || p.blocked || this.screen !== 'board') return;
    const dx = x - p.x, dy = y - p.y;
    const cw = this.board.cellW, chh = this.board.cellH;
    if (!p.axis) {
      const slop = Math.max(8, Math.min(cw, chh) * .22);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
      p.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
      const run = this.runAt(p.cell, p.axis);
      if (run < 0) {
        p.blocked = true;
        // notice 会清选中并触发一次重绘；不要在 move 里逐帧调用（原来每帧刷一条横幅）
        this.session.notice(this.blockedLine(p.cell, p.axis));
        return;
      }
      this.drag = {run, offset: 0};
      this.dragAxis = p.axis;
    }
    if (!this.drag) return;
    // 轨道可能被别处换掉（重开 / 洗牌）：拿不到就当作这次手势结束，不能直接 .cells.length
    const dragRun = this.session.runs[this.drag.run];
    const len = dragRun ? dragRun.cells.length : 0;
    if (!dragRun || !len) { this.endGesture(); return; }
    // cc 的 +y 向上（h5 的 y 向下）：列方向取负后，offset 的语义与 h5 / core 的 rotate 一致——
    // offset>0 = 把整段牌向屏幕下方推（内容移向 cells 的高索引）。之前没取负，
    // 预览跟着手指、松手后却排到反方向，整段牌跳位。
    const raw = this.dragAxis === 'row' ? dx / cw : -dy / chh;
    this.drag = {run: this.drag.run, offset: Math.max(-len, Math.min(len, raw))};
    // 位置**每次 move 都跟手**：只改被拖行节点的 position，不触发整屏重建。
    // （原来这里有个 `if (step !== lastStep)` 门槛，牌只在整数格变化时才动 → 一格一跳，看着就是掉帧）
    this.board.setDrag(this.drag);
    const step = Math.round(this.drag.offset);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (this.session.vibration) vibrate('light');
      if (this.dragLabel) this.dragLabel.string = this.dragLine();
    }
  }

  private onUp(x: number, y: number): void {
    const drag = this.drag;
    const p = this.press;
    this.drag = null;
    this.press = null;
    if (!p) { this.dirty = true; return; }
    if (drag) {
      // 同 onMove：轨道拿不到就当作这一下没推动，绝不能抛（一帧异常会让牌桌停在半张状态）
      const run = this.session.runs[drag.run];
      const len = run ? run.cells.length : 0;
      if (!run || !len) { this.dirty = true; return; }
      const k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) {
        const before = this.session.revision;
        this.session.slide(drag.run, k > len / 2 ? k - len : k);
        if (this.session.revision !== before) { this.afterAction(); return; }
      }
      this.dirty = true;
      return;
    }
    if (p.cell && !p.blocked && !p.axis) {
      const end = this.board.cellAt(x, y);
      if (end && end.r === p.cell.r && end.c === p.cell.c) {
        const before = this.session.revision;
        this.session.tap(p.cell);
        if (this.session.revision !== before) { this.afterAction(); return; }
      }
    }
    this.dirty = true;
  }

  /**
   * 命中「可以推的那条轨」。返回 runs 数组下标，-1 = 这一格推不动。
   *
   * 新契约：`runs` 定长且顺序稳定，**被锁的轨道也在数组里，只是 `locked:true`**。
   * 命中判定必须跳过它们——`session.slide()` 自己会拒，但拖动预览已经把牌画歪了，
   * 松手又弹回去，看着就像「拖动会动到别的牌」。锁标/箭头仍由 `lockedRows/lockedCols/pendingUnlock`
   * 决定（那是关卡定义，不从 runs 反推）。
   */
  private runAt(cell: Pos, axis: 'row' | 'col'): number {
    const runs = this.session.runs;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.axis !== axis || runLocked(r)) continue;
      if (r.cells.some((q) => q.r === cell.r && q.c === cell.c)) return i;
    }
    return -1;
  }

  /** 结束当前手势（轨道没了 / 被别处改盘时使用）：只置空并安排一次重绘。 */
  private endGesture(): void {
    this.drag = null;
    this.press = null;
    this.dirty = true;
  }

  /**
   * 「推不动」的分化文案。原来 runAt 返回 -1 一律播报「这一行被锁住推不动」，
   * 而 -1 其实有四种原因（锁轨 / 空洞 / 木桩 / 只剩一张牌），新玩家被误导得最狠的一处。
   */
  private blockedLine(cell: Pos, axis: 'row' | 'col'): string {
    const S = this.session;
    const word = axis === 'row' ? '行' : '列';
    const idx = axis === 'row' ? cell.r : cell.c;
    const lockMsg = axis === 'row' ? '这一行被锁住推不动；试试竖着拖。' : '这一列被锁住推不动；试试横着拖。';
    // ① 锁轨：新结构里锁轨也在 runs 里（locked:true）
    for (const r of S.runs) {
      if (r.axis === axis && runLocked(r) && r.cells.some((q) => q.r === cell.r && q.c === cell.c)) return lockMsg;
    }
    // ② 关卡定义兜底（锁轨没进 runs 时同样要说「锁住」，别让它掉到下面的空洞文案）
    const def = levelAt(S.levelIndex);
    if ((axis === 'row' ? def.lockR : def.lockC).includes(idx)) return lockMsg;
    const pend = (def.unlock || []).find((u) => u.axis === axis && u.index === idx && u.after > S.clearedPairs);
    if (pend) return `这条${word}还要再消 ${pend.after - S.clearedPairs} 对才解锁。`;
    // ③ 空洞 / 木桩：两者都不在滑轨里，但原因不同，分开说
    const v = S.grid[cell.r] ? S.grid[cell.r][cell.c] : null;
    if (v === '#') return '木桩把这一趟滑轨截断了：按住木桩之外的那段牌。';
    if (!Array.isArray(v)) return '这一格是空位，没有牌可推：按住有牌的那一格。';
    // ④ 一张孤牌：滑轨至少要有两张才成立（段头/段尾被空格切断）
    return `这一${word}里这一段只有它一张牌，推不动；直接点它找搭子，或换个方向。`;
  }
}