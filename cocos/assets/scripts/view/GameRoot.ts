import {SunnyView} from './SunnyView';
import {SunnyItem,SunnyState,sunnyHome,sunnyMap,sunnyWorkshop,sunnyAlbum,sunnyBoard,sunnyWin,sunnySettings,sunnyPause,sunnyLose,sunnyIntro,sunnyRestart,sunnyChallenge,sunnyChallengeResult,WORKSHOP,totalStars} from './sunnyLayout';
import {TableTheme,TABLE_THEMES} from './sunnyArt';
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
import {Modal, Session, Platform, starLines, chapterOf} from '../core/Session';
import {LEVELS, levelAt} from '../core/Generator';
import {CHAPTER_NAMES} from '../core/levels';
import {CHAPTERS,CHAPTER_LENGTH} from '../core/Campaign';
import {mechanicLocks} from '../core/Mechanics';
import {Tutorial, tutorialFor} from '../core/tutorials';
import {TutorialRun} from '../core/Tutorial';
import {coachFocusCells} from '../core/coach';
import {Action, count, Run} from '../core/Rules';
import {ChallengeSession, ChallengePlatform} from '../core/ChallengeSession';
import {Axis, applyRotate, cellFace} from '../core/Challenge';
import {SceneAtlas, TileAtlas, UiAtlas, UiName} from './assets';
import {atlasReport, watchContext} from './atlas';
import {Board, BoardModel, Pos} from './Board';
import {AudioBus} from './AudioBus';
import {palette} from './theme';
import {bindPress, clearChildren, fadeIn, hex, makeButton, makeIconButton, makeLabel, makeNode, makePanel, makePlate, makeSprite, makeStars, makeToggle} from './widgets';

const {ccclass, property} = _decorator;
const STORAGE_KEY = 'majiang-xiaoxiao:v1';
/** 挑战模式独立存档：不动主线的 520 关进度与道具账本。 */
const CHALLENGE_KEY = 'majiang-xiaoxiao:challenge:v1';
const SHARE_TITLE = '快乐推麻对对消：推一推，碰个对';
/** 整线滑动的方向文案：行看左右、列看上下，符号跟 `Rotate.step` 一致。 */
const dirLabel = (axis: Axis, step: number): string => axis === 'row' ? (step > 0 ? '右' : '左') : (step > 0 ? '下' : '上');
const DESIGN_W = 750;
const DESIGN_H = 1334;
/** 应用版本号：与 cocos/package.json 的 version、upload-ci 上传版本保持一致（提版时三处一起改）。 */
const APP_VERSION = '1.4.2';

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
  bomb: {title: '鞭炮牌', lines: ['鞭炮震碎相邻冰牌，并带动全桌同款碎一层。', '冰面关里的破冰好帮手。']},
  unlock: {title: '连锁解锁', lines: ['带数字的锁轨是暂时锁住的：', '每消一对就计数，凑够数字自动解锁。']},
  // 收集清单只描述目标，不限制其他牌的配对。
  collect: {title: '集齐一组', lines: ['不用清台：把这一组各消掉一对就通关。', '顶栏显示已经集齐几种。']}
};

/**
 * 章首说明框：每章第一次进入时弹一次，关掉即自由玩。
 * 不再按机制首现弹卡、也不再进独立小盘教学；26 章各一段，标题由章号 + CHAPTER_NAMES 生成。
 * 行数控制在 3~4 行、每行 ≤22 个汉字，面板高度才放得下（Label 不折行）。
 */
const CHAPTER_TIPS: string[][] = CHAPTERS.map(c=>[c[2],c[3]]);

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
 * 按估算字宽把一句文案折行。
 *
 * `makeLabel` 的 overflow 是 NONE（不换行不缩放），而教学的 `say` 是一整句长文案——
 * 27 号字 28 个字符就顶到 750 的屏宽，不折行会直接画到屏幕外面去。
 * 折行宽度沿用 textWidth 那套估算：Label 的 contentSize 要到渲染阶段才算得出来。
 */
/** 不能出现在行首的中文字符（避头点）：句号被甩到下一行行首，读起来就是"话没说完"。 */
const NO_LINE_HEAD = new Set(['。', '，', '、', '：', '；', '！', '？', '）', '》', '」', '』', '…', '·']);

/** 按估算字宽截断一行，尾部加省略号。横幅 overflow = NONE，宁可截也不能画到屏外。 */
function clipText(s: string, px: number, maxW: number): string {
  if (textWidth(s, px) <= maxW) return s;
  let out = '';
  for (const ch of s) {
    if (textWidth(out + ch + '…', px) > maxW) break;
    out += ch;
  }
  return out + '…';
}

function wrapText(s: string, px: number, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const ch of s) {
    if (line && textWidth(line + ch, px) > maxW) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  // 断点落在避头点前面时，把上一个字符一起带下来：宁可少一个字，也不让标点开头。
  for (let i = 1; i < out.length; i++) {
    if (NO_LINE_HEAD.has(out[i][0]) && out[i - 1].length > 1) {
      const carry = out[i - 1].slice(-1);
      out[i - 1] = out[i - 1].slice(0, -1);
      out[i] = carry + out[i];
    }
  }
  return out;
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
const challengeStorage: ChallengePlatform = {
  load: () => sys.localStorage.getItem(CHALLENGE_KEY),
  save: (data) => sys.localStorage.setItem(CHALLENGE_KEY, JSON.stringify(data)),
  feedback: () => vibrate('medium')
};

type Screen = 'workshop' | 'album' | 'home' | 'levels' | 'board' | 'settings' | 'win' | 'lose' | 'pause' | 'help' | 'restart' | 'tutorial' | 'challenge';

/**
 * 每一屏对应 Session 的哪一态。**必须穷举所有 Screen**（`Record` 少一行就编译不过）：
 * 漏登记的那一屏开着时 `modal` 仍是 `'none'`，于是限时关继续每秒 `tick` → 视图每秒判定
 * 「跨过了整秒」→ 遮罩整块重建 → 入场动画每秒从 opacity 0 重播。第 224 关（限时 74 秒）
 * 打开暂停弹框「一闪一闪」就是这么来的——不是渲染坏了，是停表没停住。
 */
const SCREEN_MODAL: Record<Screen, Modal> = {
  workshop:'home',album:'home',home: 'home', board: 'none', settings: 'settings', levels: 'levels', win: 'win', lose: 'lose',
  help: 'help', pause: 'pause', restart: 'restart',
  // 教学屏也映射 'none'：停表与挡输入已经由 Session.tip 非空负责（tick/apply/tap/notice/command 五处）。
  // 这里再造一个 modal 只会让"到底谁停的表"变成两处逻辑——而 tip 那五处是真机验证过的。
  tutorial: 'none',
  // 挑战模式没有主线 Session 的弹窗态；它的清台/走死由 overlay 自己画。
  challenge: 'none'
};

/**
 * 从这一屏打开弹框时，弹框画在哪一屏上、关掉又回哪一屏。
 * 弹框自己（settings / levels / help）不在这张表里 → 弹框之间跳转时**继承**上一次的值，
 * 所以「牌桌→设置→玩法说明→关掉」一路都还记得来源是牌桌。
 */
const DIALOG_ORIGIN: Partial<Record<Screen, 'home' | 'board' | 'levels' | 'workshop' | 'album'>> = {
  levels:'levels',workshop:'workshop',album:'album',home: 'home', board: 'board', pause: 'board', restart: 'board', win: 'board', lose: 'board'
};

@ccclass('GameRoot')
export class GameRoot extends Component {
  @property({tooltip: '固定随机种子便于复现；0 表示每次随机'})
  seed = 0;

  private session!: Session;
  /** 挑战模式会话：首次进入才创建，主线和它的存档互不影响。 */
  private cs: ChallengeSession | null = null;
  private chRevision = -1;
  private chPress: {x: number; y: number; cell: Pos} | null = null;
  private chDrag: {run: number; offset: number; axis: Axis; index: number; len: number} | null = null;
  private chPeek: Pos[] = [];
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
  /**
   * 重绘触发源留痕（见 `noteRender`）。真机摸不到控制台，"画面为什么在自己重画"这类问题
   * 只能靠设备自己把证据读回来：vConsole 里 `__mjRender()` 给出总次数、按触发源分类的计数
   * 和最近 14 次现场（毫秒 + 触发源 + 当时在哪一屏）。
   */
  private renders: {total: number; by: Record<string, number>; last: string[]} = {total: 0, by: {}, last: []};
  private bootAt = Date.now();
  /** 顶部安全区：微信胶囊按钮占掉的高度（设计单位）。顶栏整体下移这么多，避免被官方控件盖住。 */
  private safeTop = 0;

  private screen: Screen = 'home';
  /** 入场动画放到哪一屏了：同一屏的重绘不能再重播（见 animateIn）。 */
  private overlayAnimated = '';
  private screens!: {home: Node; board: Node; overlay: Node; tutorial: Node};
  private board!: Board;
  /** 牌桌的「外壳」（顶栏 / 工具条）挂这里，每次重绘只清它，绝不动 Board 自己的节点。 */
  private boardChrome!: Node;
  /** 教学牌桌：Board 的第二个实例。显存代价≈0——牌图集只烘一张基准格，显示尺寸靠 contentSize 缩放，
   *  多一份只有节点池（十来个 Sprite）。但"≈0"是推理不是证据：验收要用 __mjDiag() 的 atlasReport
   *  在真机预览里读一次实际纹理占用（spec §十）。 */
  private tutBoard!: Board;
  /** 教学屏的一次性 UI（匾额 / 文案 / 按钮）：每帧清它，绝不动 tutBoard 的池。 */
  private tutChrome!: Node;
  private tut: TutorialRun | null = null;
  /** 教学是从哪一屏进来的：看完/跳过之后回它（不能用 dialogParent()，那时 screen 已经是 'tutorial'）。 */
  private tutFrom: Screen = 'board';
  /** 自动演示的节拍（dt 累加，和限时关同一个 update 入口，不新增 cc.schedule）。 */
  private tutWait = 0;
  private tutCell: {cellW: number; cellH: number} | null = null;
  private tutHint = '';
  private tutSel: Pos | null = null;
  private tutPress: {x: number; y: number; cell: Pos | null; blocked: boolean; axis: 'row' | 'col' | null} | null = null;
  private tutDrag: {run: number; offset: number} | null = null;

  private dirty = true;
  private revision = -1;
  private firstPainted = false;
  private size = {w: DESIGN_W, h: DESIGN_H};
  /** 选关停在第几章（一章一屏 4×5，见 renderLevels）。 */
  private page = 0;
  /** 这一串弹框是从哪一屏打开的：既决定弹框画在大厅还是牌桌上，也决定关掉之后回哪一屏（见 go() / dialogParent()）。 */
  private dialogBase: 'home' | 'board' | 'levels' | 'workshop' | 'album' = 'home';
  private audio:AudioBus|null=null;
  private sunny:SunnyView|null=null;
  private theme:TableTheme='jade';
  private mainSession:Session|null=null;
  private sound = true;
  private music = true;

  private press: {x: number; y: number; cell: Pos | null; blocked: boolean; axis: 'row' | 'col' | null; coachRun?: number} | null = null;
  private drag: {run: number; offset: number} | null = null;
  private dragAxis: 'row' | 'col' = 'row';
  private lastStep = 0;
  /** 牌桌横幅那行字（拖动中要改它，但不该为此整屏重建） */
  private dragLabel: Label | null = null;
  private touchId: number | null = null;
  onLoad(): void {
    try {
      const g = globalThis as any;
      try{const t=sys.localStorage.getItem('mj:sunny-theme');if(TABLE_THEMES.some(x=>x.id===t))this.theme=t as TableTheme;}catch{}
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
      this.audio=new AudioBus(this.node);this.sound=this.audio.sound;this.music=this.audio.music;this.audio.baseline(this.session);
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
        overlay: makeNode(this.node, {name: 'screen-overlay'}),
        // 教学屏必须**独立于 overlay**：render() 每帧 clearChildren(overlay) 会连节点池一起销毁，
        // 而 Board 的 tilesRoot/ghostRoot 是它长期持有的（widgets.clearChildren 的注释里就写着这条警告）。
        tutorial: makeNode(this.node, {name: 'screen-tutorial'})
      };
      this.board = new Board(this.screens.board, this.ui);
      this.boardChrome = makeNode(this.screens.board, {name: 'board-chrome'});
      this.boardChrome.setSiblingIndex(1); // 顶栏 / 工具条画在牌桌之上
      this.tutBoard = new Board(this.screens.tutorial, this.ui);
      this.tutChrome = makeNode(this.screens.tutorial, {name: 'tutorial-chrome'});
      this.tutChrome.setSiblingIndex(1);   // 匾额 / 文案 / 按钮画在教学牌桌之上
      mark('D-nodes');

      const q = this.queryParam('screen') as Screen | null;
      const lv = Number(this.queryParam('level'));
      if (Number.isFinite(lv) && this.queryParam('level') !== null) this.session.reset(lv, false, true);
      if (q === 'challenge') {
        this.ensureChallenge();
        // 取证/试玩用：?screen=challenge&clevel=50 直接开第 50 盘（后期 14×10 近满盘）
        const cl = Number(this.queryParam('clevel'));
        if (Number.isFinite(cl) && cl >= 1) this.cs?.startAt(cl);
      }
      // 大厅保留，但**不再当入口**：真机反馈是"每次进来先是一张海报页，还要再点一次开始游戏"。
      // 没有 ?screen= 就直接开局（继续上一盘）；截图与调试仍可用 ?screen=home 回到大厅。
      this.setScreen(q && this.isScreen(q) ? q : 'home');
      // 性能面板默认关掉（调试构建里它会盖住界面）；加 ?stats=1 打开，用于测 draw call / 顶点。
      try { const prof = (globalThis as any).cc?.profiler; if (this.queryParam('stats') === '1') prof?.showStats?.(); else prof?.hideStats?.(); } catch { /* 面板可选 */ }
      // 真机（尤其鸿蒙）摸不到控制台，就把图集/显存状态挂成全局函数并打一次日志：
      // 用户在 vConsole 里输 `__mjDiag()` 就能把确定证据读回来，而不是让我猜。
      watchContext();
      (globalThis as any).__mjDiag = () => atlasReport();
      (globalThis as any).__mjRender = () => this.renders;
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
      audio:this.audio?.state,theme:this.theme,practice:!!this.mainSession,
      size: this.size, screen: this.screen, render: this.renders,
      board: this.board ? {cellW: this.board.cellW, cellH: this.board.cellH, origin: this.board.origin, rows: this.board.gridRows, cols: this.board.gridCols} : null,
      // 教学屏取证：真机读不到 console，"这一步到底走没走"必须是个能读回来的数字。
      // tip 非空 = 还没释放（牌桌输入仍被挡着）；failed=true = 这一段已经降级进关。
      tutorial: this.tut ? {chapter: this.tut.chapterIndex, step: this.tut.index, done: this.tut.done, failed: this.tut.failed,
        watch: this.tut.watchMode, cellW: this.tutCell ? this.tutCell.cellW : 0,
        runs: this.tut.runsText, hint: this.tutHint,
        rows: this.tutBoard.gridRows, cols: this.tutBoard.gridCols, origin: this.tutBoard.origin, tip: this.session.introTip} : null,
      // 真盘机制引导的取证：跑到第几步、有没有做错、目标动作是哪一条。
      coach: this.session.coach ? {key: this.session.coach.text.key, total: this.session.coach.total,
        index: this.session.coach.index, hint: this.session.coach.hint,
        want: this.session.solution[0] || null, bounceRun: this.session.coachBounceRun()} : null,
      model: this.session ? {levelIndex: this.session.levelIndex, grid: this.session.grid, runs: this.session.runs, modal: this.session.modal,
        mechanics:this.session.mechanics,objective:this.session.objectiveText,solution:this.session.solution,hint:this.session.hint,
        total: this.session.total, moves: this.session.moves, hintsLeft: this.session.hintsLeft, shufflesLeft: this.session.shufflesLeft,
        stars: this.session.stars, maxLevel: this.session.maxLevel, par: this.session.par,
        // 切图/真机取证要看这四格：关卡总数证明构建新不新，seed 证明钉死生效，
        // dialect + liveTotal 证明「只剩哑弹也算过」的判据，timeLeft 证明倒计时在走。
        levels: LEVELS.length, px: this.pxProbe, seed: this.session.pinnedSeed, dialect: !!this.session.def.dialect,
        liveTotal: this.session.liveTotal, timeLeft: Math.round(this.session.timeLeft * 10) / 10,
        atlas: atlasReport()} : null,
      challenge: this.cs ? {level: this.cs.level, cleared: this.cs.cleared, rows: this.cs.rows, cols: this.cs.cols,
        tiles: this.cs.remaining, total: this.cs.total, moves: this.cs.moves, won: this.cs.won, stuck: this.cs.stuck,
        hintsLeft: this.cs.hintsLeft, shufflesLeft: this.cs.shufflesLeft,
        hint: this.cs.hint, message: this.cs.message, solution: this.cs.solution.slice()} : null
    });
    (globalThis as any).__mjTap = (id: string) => this.activate(id);
    /** 挑战模式的 headless 取证：直接喂一次整线滑动，绕开桌面构建里不发的全局触摸。 */
    (globalThis as any).__mjChallenge = (axis: Axis, index: number, step: number) => {
      const C = this.cs;
      if (!C || this.screen !== 'challenge') return null;
      const res = C.rotate(axis, index, step);
      if (res) this.board.playErase(res.erased);
      this.dirty = true;
      return {ok: !!res, won: C.won, stuck: C.stuck, left: C.remaining, message: C.message};
    };
    /**
     * 教学取证：把 `onTutorialTouch` 松手之后要提交的那个 Action 直接喂进状态机。
     *
     * 为什么需要它：Cocos 在桌面构建里（`cc.sys.isMobile === false`）不把 DOM 触摸转成全局
     * `Input.EventType.TOUCH_*`，所以**牌桌拖轨在这个 headless 环境里本来就推不动**——
     * 这是既有的环境限制，不是教学引入的。于是这里把「状态机 + 渲染 + 释放进真关」这段
     * 能自动验的全验掉；`__mjTutHit` 再把「页面坐标 → 格子」这段换算单独量一次。
     * ⚠️ 真机/开发者工具里仍然必须手动推一次轨道（spec §十 未验项）。
     */
    (globalThis as any).__mjTut = (action: any) => {
      if (this.screen !== 'tutorial' || !this.tut) return null;
      this.commitTutorial(action);
      const t = this.tut;
      return {step: t.index, done: t.done, failed: t.failed, screen: this.screen, tip: this.session.introTip};
    };
    (globalThis as any).__mjTutHit = (x: number, y: number) => this.tutBoard.cellAt(x, y);
    /** 真盘引导取证：headless 推不动牌桌轨道，直接把目标 Action 喂给状态机。 */
    (globalThis as any).__mjCoach = (action: any) => this.session.feed(action);
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

  private onGameHide(): void { this.session?.setPaused(true);this.audio?.visibility(true); }
  private onGameShow(): void { this.session?.setPaused(false);this.audio?.visibility(false); this.dirty = true; }

  onDestroy(): void {
    this.audio?.dispose();
    this.sunny?.dispose();
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
    if (this.frames < 90 || (this.screen !== 'board' && this.screen !== 'challenge')) return;
    this.pxProbe = this.boardDiag();
    console.log('[mj] boardDiag "' + this.pxProbe + '" · atlas ' + JSON.stringify(atlasReport()));
  }

  update(dt: number): void {
    if (!this.session || !this.ui) return;
    let why = '';
    // 倒计时必须每帧喂 dt，而且要在 `!dirty` 早退**之前**：跨过整秒时 session.revision 不变，
    // 放在早退之后就永远不会重绘，玩家看到的数字会停在原地。
    // 挑战模式没有主线 Session 的计时；这里不挡的话，主线限时盘会在后台继续走表。
    if (this.screen !== 'challenge' && this.session.tick(dt)) {
      why = 'tick';
      this.dirty = true;
      // 时间到是 `tick()` 里判的，不会经过 `afterAction()`。以前这里只置 dirty：
      // 画面停在牌桌、输入被 modal 挡住、倒计时永远显示 0 秒——玩家只会以为游戏卡死了。
      if (this.session.modal === 'lose' && this.screen === 'board') {
        this.setScreen('lose');
      }
    }
    const visible = view.getVisibleSize();
    // 尺寸先取整再比：真机的可见区是 750×1623.0769… 这种小数，逐帧比原值会因为浮点抖动
    // 判成"尺寸又变了"→ 每帧整屏重建（弹框开着就是每秒几十次销毁重建）。布局不需要亚像素
    // 精度，`ensureScene` 的图集键本来就是四舍五入的。
    const vw = Math.round(visible.width), vh = Math.round(visible.height);
    if (!this.sceneReady || vw !== this.size.w || vh !== this.size.h) {
      if (this.sceneReady) why += (why ? '+' : '') + 'size';
      this.size = {w: vw, h: vh};
      this.sceneReady = true;
      this.ensureScene();
      this.dirty = true;
    }
    if (this.session.revision !== this.revision) { why += (why ? '+' : '') + 'rev'; this.dirty = true; }
    if (this.cs && this.cs.revision !== this.chRevision) { why += (why ? '+' : '') + 'ch'; this.dirty = true; }
    /**
     * 教学屏的自动演示节拍：走 dt 累加，和限时关同一个 update 入口，不新增 cc.schedule。
     * 切后台掉帧时 dt 会很大，所以钳到 0.25——演示是给人看的，一次跳过三步就成了闪屏。
     * 间隔比"看"长一点（1.6 秒）：这一步的效果（对子碰头、消掉）要留在眼里，才谈得上教学。
     */
    if (this.screen === 'tutorial' && this.tut && !this.tut.failed) {
      const st = this.tut.step;
      if (st && (!st.need || this.tut.watchMode)) {
        this.tutWait += Math.min(Math.max(dt, 0), 0.25);
        if (this.tutWait >= (this.tut.watchMode ? 1.2 : 1.6)) {
          this.tutWait = 0;
          const r = this.tut.advance(this.tut.canonical());
          if (this.tut.failed) { this.tutorialFail(); }
          else { if (r.erased.length) this.tutBoard.playErase(r.erased); this.dirty = true; }
        }
      } else this.tutWait = 0;
    }
    if (!this.dirty) return;
    // 三个源都没动却重绘了 = 视图自己安排的（点按钮 / 手势 / 开关弹框）
    this.noteRender(why || 'act');
    this.dirty = false;
    this.revision = this.session.revision;
    this.chRevision = this.cs ? this.cs.revision : -1;
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

  /**
   * 记一次"为什么重绘"。闪烁这类问题在真机上只能靠设备自报：
   * `tick` = 限时关跨整秒，`size` = 可见区尺寸变了，`rev` = Session 状态变了，
   * `act` = 视图自己安排的（点按钮 / 手势 / 开关弹框）。
   */
  private noteRender(why: string): void {
    const r = this.renders;
    r.total++;
    r.by[why] = (r.by[why] || 0) + 1;
    r.last.push(`${Date.now() - this.bootAt}ms ${why} ${this.screen}`);
    if (r.last.length > 14) r.last.shift();
  }

  /* ── 屏幕状态机 ───────────────────────────────────────── */

  private isScreen(s: string): s is Screen {
    return ['workshop','album','home', 'levels', 'board', 'settings', 'win', 'lose', 'pause', 'help', 'restart', 'challenge'].includes(s);
  }

  private setScreen(s: Screen): void {
    // 首见教学插在进牌桌之前：只在「进牌桌」这一个口子上拦，
    // 别在冷启动 / 选关 / 下一关 / 继续四个调用点各写一遍（漏一个就是"有的进关路径不教学"）。
    if (s === 'board' && this.session.introTutorial) {
      s = 'tutorial';
      this.startTutorial(this.session.introTutorial, 'board');
    }
    // 离开教学屏就丢掉控制器：下一次进关必须由 Session 重新决定该展示什么。
    if (s !== 'tutorial') this.tut = null;
    if(s!==this.screen&&(s==='win'||s==='lose'))this.audio?.play(s);
    this.audio?.setScene(s);this.audio?.baseline(this.session);
    this.screen = s;
    this.session.modal = SCREEN_MODAL[s];
    if (s === 'levels') this.page = Math.floor(this.session.levelIndex / CHAPTER_LENGTH);
    this.dirty = true;
  }

  /**
   * 开一段教学。`from` 记下关掉之后回哪一屏：进关前拦截 = 'board'，玩法说明重放 = 'help'。
   * 构造函数里 parseBoard 会抛（字面量写错、行宽不一致），所以整块包起来——教学坏了不许带崩界面。
   */
  private startTutorial(t: Tutorial, from: Screen): void {
    try {
      this.tut = new TutorialRun(t, from === 'help');
      this.tutFrom = from;
      this.tutWait = 0;
      this.tutHint = '';
      this.tutSel = null;
      this.tutDrag = null;
      this.tutPress = null;
      this.tutCell = null;
    } catch (e) {
      console.error('[tutorial] 这一段起不来，直接进关', {title: t.title, err: String((e as Error)?.message || e)});
      this.tut = null;
      this.tutorialFail();
    }
  }

  /**
   * 降级：教学是加法，任何不对劲都立刻释放 tip 进真关，行为退化成今天的文字卡。
   * 真机读不到 console，所以"教学坏了玩家照样能开局"必须是设计承诺（spec §5.6），不是 try-catch 的心情。
   */
  private tutorialFail(): void {
    if (this.session.introTutorial) this.session.command('tip-ok');
    this.tut = null;
    this.setScreen(this.tutFrom === 'help' ? 'help' : 'board');
  }

  /**
   * 弹框关掉之后回哪一屏。
   * 只看**这一串弹框是从哪一屏打开的**（`dialogBase`），不能看「上一个屏是谁」：
   * 玩法说明是设置的子页，从说明关掉回到设置时上一个屏是 'help'，按上一个屏判就会
   * 把玩家甩回大厅（真机反馈：牌桌→设置→玩法说明→关掉→关掉，回到了大厅）。
   */
  private dialogParent(): Screen {
    if (this.screen === 'help') return 'settings';
    return this.dialogBase;
  }

  private go(s: Screen): void {
    // 弹框画在谁上面，取决于它是**从哪一屏打开的**：从牌桌开的就该继续看到牌桌，
    // 而不是被换成大厅（真机反馈：牌桌点设置"回到了首页"，关掉又跳回牌桌）。
    // 弹框之间跳转（设置→玩法说明）在这张表里没有条目，所以子页沿用父页的底图与来源。
    const origin = DIALOG_ORIGIN[this.screen];
    if (origin) this.dialogBase = origin;
    this.setScreen(s);
  }

  private activate(id: string): void {
    if(id==='energy-hint')id='hint';
    this.audio?.unlock();
    if(['home','levels','workshop','album','challenge'].includes(id)&&this.mainSession){this.session=this.mainSession;this.mainSession=null;this.press=null;this.drag=null;}
    if(id.startsWith('practice:')){
      const m=WORKSHOP[Number(id.slice(9))];if(!m)return;
      if(!this.mainSession)this.mainSession=this.session;
      this.session=new Session(520);this.session.unlockAll=true;this.session.reset(m.level,false,true);
      this.press=null;this.drag=null;this.setScreen('board');return;
    }
    if(id.startsWith('theme:')){const t=TABLE_THEMES.find(t=>t.id===id.slice(6));if(t&&totalStars(this.session)>=t.stars){this.theme=t.id;try{sys.localStorage.setItem('mj:sunny-theme',t.id);}catch{}}this.dirty=true;return;}
    if(id!=='hint'&&id!=='undo')this.audio?.play('ui');
    switch (id) {
      case 'tip-ok': this.session.dismissTip(); break;
      case 'home': this.go('home'); break;
      case 'workshop':case 'album':this.go(id);break;
      case 'challenge': this.startChallenge(); break;
      case 'challenge-home': this.setScreen('home'); break;
      case 'challenge-next': if (this.cs?.next()) this.dirty = true; break;
      case 'challenge-hint': if (this.cs) { this.cs.requestHint(); this.dirty = true; } break;
      case 'challenge-shuffle': if (this.cs) { this.cs.shuffle(); this.dirty = true; } break;
      case 'challenge-restart': if (this.cs) { this.cs.restart(); this.dirty = true; } break;
      // 大厅「开始游戏」= 继续上一盘，而不是重开：以前无条件 `reset(maxLevel)`，
      // 从对局菜单回大厅再点开始，当前这一盘的进度就被悄悄丢掉了。
      case 'start': this.session.command('continue'); this.setScreen('board'); break;
      case 'levels': this.go('levels'); break;
      // 从对局菜单进选关：来源本来就是牌桌（DIALOG_ORIGIN 里 pause/restart 都记成 'board'），
      // 所以和大厅的「关卡选择」走同一条 go()，关掉照样回牌桌。
      case 'menu-levels': this.go('levels'); break;
      case 'settings': this.go('settings'); break;
      case 'about': this.go('help'); break;
      case 'back-home': case '__back': this.go(this.dialogParent()); break;
      case 'pause': this.setScreen('pause'); break;
      case 'resume': this.setScreen('board'); break;
      // 重开是破坏性操作，先确认（Session 侧 modal='restart' 同时把牌桌输入与倒计时一起停住）。
      case 'restart': this.setScreen('restart'); break;
      case 'confirm-restart': this.session.command('confirm-restart'); this.setScreen('board'); break;
      case 'replay': this.session.reset(); this.setScreen('board'); break;
      // 通关下一页：同章不重复弹章首说明，换章才弹。
      case 'next': this.startLevel(Math.min(this.session.levelIndex + 1, LEVELS.length - 1), false); break;
      case 'hint': this.session.command('hint'); if(this.session.hint.length)this.audio?.play('hint'); this.afterAction(); break;
      case 'coach-skip': this.session.command('coach-skip'); break;
      case 'shuffle': if(this.screen==='pause')this.setScreen('board'); this.session.command('shuffle'); this.afterAction(); break;
      case 'undo': if(this.session.undo()){this.audio?.play('undo');this.setScreen('board');} this.afterAction(); break;
      case 'toggle-sound': this.sound = !this.sound; this.audio?.configure(this.music,this.sound); break;
      case 'toggle-music': this.music = !this.music; this.audio?.configure(this.music,this.sound); break;
      case 'toggle-vibration': this.session.command('toggle-vibration'); break;
      case 'page-prev': this.page = Math.max(0, this.page - 1); break;
      case 'page-next': {
        const shown = this.session.unlockAll ? LEVELS.length : this.session.maxLevel + 1;
        this.page = Math.min(Math.ceil(LEVELS.length / CHAPTER_LENGTH) - 1, this.page + 1);
        break;
      }
      // 失败页的出路（A3）：复活回到牌桌 / 死局免费重排。
      // 失败时 `revive()` 返回 false（次数用完或原因不符）就什么都不做——
      // 按钮那时是 disabled，正常点不到，这里只是兜底。
      case 'revive': if (this.session.revive()) this.setScreen('board'); break;
      case 'rescue': if (this.session.rescueShuffle()) this.setScreen('board'); break;
      case 'restart-lose': this.session.reset(); this.setScreen('board'); break;
      // ── 教学屏 ──
      case 'tutorial-skip': this.session.command('tip-ok'); this.setScreen('board'); break;
      // 回跳只认 tutFrom（从哪一屏进来的）。不能用 dialogParent()：那时 screen 已经是 'tutorial'，
      // 它的第一条分支不成立，会把「从玩法说明进来重放」甩回牌桌——就是 commit e82ec48 修过的同一类错。
      case 'tutorial-close': this.tut = null; this.setScreen(this.tutFrom); break;
      case 'tutorial-ok':
        if (this.tut && !this.tut.failed) { this.session.command('tip-ok'); this.setScreen('board'); }
        else this.tutorialFail();
        break;
      default:
        if (id.startsWith('level:')) this.startLevel(Number(id.slice(6)));
        else if (id.startsWith('tutorial:')) {
          // 不依赖玩家进度：CDP 截图与玩法说明的重放都走这个口子（体验版可以从 ?level= 之后直接点）
          const n = Number(id.slice(9)), t = tutorialFor(n), from = this.screen;
          if (t) { this.setScreen('tutorial'); this.startTutorial(t, from); }
          else this.tutorialFail();
        }
    }
    this.dirty = true;
  }

  private ensureChallenge(): ChallengeSession {
    if (!this.cs) this.cs = new ChallengeSession(this.seed || (Date.now() >>> 0), challengeStorage);
    return this.cs;
  }

  private startChallenge(): void {
    this.ensureChallenge();
    // 切模式时把主线的拖动/选中状态清掉，避免回到牌桌时还挂着上一屏的手势。
    this.drag = null;
    this.press = null;
    this.chDrag = null;
    this.chPress = null;
    this.chPeek = [];
    this.setScreen('challenge');
  }

  private startLevel(i: number, chapterEntry = true): void {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    // 章节门槛（B2）：进不去的关一律不开局。选关页本来就不给锁着的卡片挂点击，
    // 这里兜的是「通关页的下一关」这类程序化入口——不兜就会绕过门槛。
    if (!this.session.canEnter(idx)) return;
    this.session.reset(idx, true, chapterEntry);
    this.setScreen('board');
  }

  /** 一次落子之后：播放消除动画、判定胜负。 */
  private afterAction(): void {
    this.audio?.observe(this.session);
    // lastErased 是 Pair[]（含 face）：消除动画用幽灵牌按真牌面重画，不碰节点池
    const erased = this.session.lastErased;
    if (erased.length) this.board.playErase(erased);
    // 提示统一走顶部横幅（session.message 驱动 revision → 重绘），不再有第二条提示
    if (this.session.modal === 'win') this.setScreen('win');
    else if (this.session.modal === 'lose') this.setScreen('lose');                                       // 限步用尽 / 时间到
    else if (this.session.dead) {                                                                      // 可靠死局判定
      // 必须让 Session 也进入失败态：只切视图的话，限时关会继续走表（失败原因被改写成"时间到"），
      // 死盘还会被写进存档，冷启动后落在一个走不动的牌桌上。
      this.session.finishDead();
      this.setScreen('lose');
    }
    this.dirty = true;
  }
  /* ── 渲染 ─────────────────────────────────────────────── */

  private render(): void {
    const show = (n: Node, on: boolean) => { if (n.active !== on) n.active = on; };
    // 弹框（设置 / 选关 / 玩法说明）画在谁上面：由 dialogBase 决定，而不是写死"永远大厅"。
    const dialog = this.screen === 'settings' || this.screen === 'levels' || this.screen === 'help';
    const homeFlow = ['home','workshop','album'].includes(this.screen) || (dialog && this.dialogBase !== 'board');
    show(this.screens.home, homeFlow);
    if(homeFlow){const base=dialog?this.dialogBase:this.screen;clearChildren(this.screens.home);this.renderSunny(this.screens.home,base==='workshop'?sunnyWorkshop(this.sunnyState()):base==='album'?sunnyAlbum(this.sunnyState()):base==='levels'?sunnyMap(this.sunnyState()):sunnyHome(this.sunnyState()));}
    const boardVisible = this.screen === 'board' || this.screen === 'win' || this.screen === 'lose' || this.screen === 'pause'
      || this.screen === 'restart' || (dialog && this.dialogBase === 'board');
    const challengeVisible = this.screen === 'challenge';
    show(this.screens.board, boardVisible || challengeVisible);
    if (challengeVisible) this.renderChallenge();
    else if (boardVisible) this.renderBoard();
    // 教学屏与牌桌互斥：screen='tutorial' 时真牌桌整块不画（9×9 的盘白建一次池子不值）
    const tutVisible = this.screen === 'tutorial';
    show(this.screens.tutorial, tutVisible);
    if (tutVisible) this.renderTutorial();
    // 诊断行画在当前看得见的那块底图上（牌桌故障最需要它，而它偏偏不画在大厅）
    this.atlasDiag(challengeVisible ? this.boardChrome : tutVisible ? this.tutChrome : boardVisible ? this.boardChrome : this.screens.home);

    clearChildren(this.screens.overlay);
    switch (this.screen) {
      case 'settings': this.renderSettings(); break;
      case 'levels': this.renderLevels(); break;
      case 'win': this.renderWin(); break;
      case 'lose': this.renderLose(); break;
      case 'pause': this.renderPause(); break;
      case 'restart': this.renderRestart(); break;
      case 'help': this.renderHelp(); break;
    }
    if (challengeVisible && this.cs?.won) this.renderChallengeWin();
    else if (challengeVisible && this.cs?.stuck) this.renderChallengeStuck();
    // 「新玩法」说明卡：进关时 Session 给出待展示的 tip，看完（tip-ok）才开局。
    // 挑战模式不显示主线遗留的说明卡（从牌桌切过来时 tip 可能还在）。
    if (this.screen === 'board' && this.session.introTip) this.renderTipCard();
    // 记下来这一屏已经画过：同一屏的下一次重绘不再重播入场动画（见 animateIn）
    this.overlayAnimated = this.screen;
  }

  /**
   * 弹框入场动画只在**这一屏第一次画**的时候放一次。
   *
   * 每次重绘都会把遮罩整块 `clearChildren` 重建，`fadeIn` 又把 opacity 打回 0、缩放打回 0.92
   * 再飞 0.18 秒。限时关每秒跨整秒都要重绘（跨秒时 `session.revision` 不变，只能靠 tick 的返回值
   * 判 dirty），于是每秒重播一次淡入——玩家看到的不是淡入，是一闪一闪（真机反馈：第 224 关
   * 打开暂停弹框）。停表这件事由 SCREEN_MODAL 保证，这里补的是第二层：**就算同一屏反复重绘，
   * 画面也不该自己抖**。
   */
  private animateIn(): void {
    if (this.overlayAnimated === this.screen) return;
    fadeIn(this.screens.overlay);
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
  private renderTipCard():void{this.veil();this.renderSunny(this.screens.overlay,sunnyIntro(this.sunnyState()));}

  private renderTutorial(): void {
    const run = this.tut;
    // 没有控制器 = 这一屏不该开着（tip 已释放 / 上一步刚降级）。直接降级，别画半张屏：
    // "画面只剩文字"这类事故都是从兜底分支随手画了个面板开始的。
    if (!run) { this.tutorialFail(); return; }
    if (run.failed) { this.tutorialFail(); return; }

    const W = this.size.w, H = this.size.h, safe = this.safeTop;
    clearChildren(this.tutChrome);
    const root = this.tutChrome;

    const rows = run.grid.length, cols = (run.grid[0] || []).length;
    const top = H / 2 - 200 - safe;
    const bottom = -H / 2 + 200;
    const availH = top - bottom;
    const sidePad = cols <= 4 ? 34 : 44;
    const cellW = Math.min((W - sidePad * 2) / cols, availH / (rows + .4) / 1.24, 156);
    const cellH = cellW * 1.24;
    const bw = cellW * cols, bh = cellH * rows;
    this.tutCell = {cellW, cellH};
    const st = run.step;
    // 教学与正式提示共用同一套视觉：整条轨标蓝 + 方向箭头流 / 两张牌金框脉冲。
    // 以前教学只画蓝框，玩家看得出"动这一行"，看不出"往哪边推"——和旧提示是同一个毛病。
    const tutAction: BoardModel['hintAction'] = (() => {
      if (!st) return null;
      if (st.on.tap) return {kind: 'match', a: st.on.tap[0], b: st.on.tap[1]};
      const want = st.on.slide;
      if (!want) return null;
      const ri = run.runs.findIndex((r) => r.axis === want.axis && r.index === want.index && !r.locked);
      return ri < 0 ? null : {kind: 'slide', run: ri, step: st.step ?? 1};
    })();
    this.tutBoard.build({
      grid: run.grid, runs: run.runs, selected: this.tutSel,
      hintCells: run.targetCells().length && st?.on.slide ? run.targetCells() : [],
      hintAction: tutAction, drag: this.tutDrag,
      lockedRows: [], lockedCols: [], oneWay: [], pendingUnlock: []
    }, this.ensureTileAtlas(), -bw / 2, top - Math.max(0, (availH - bh) / 2), cellW, cellH);

    const plate = makePlate(root, this.ui, 360, 72, 0, H / 2 - 66 - safe);
    makeLabel(plate, run.watchMode ? `${run.title} · 回看` : `${run.title} · 怎么玩`, {x: 0, y: 20, size: 32, color: '#FBF3DE', align: 'center', bold: true, serif: true});

    const text = st ? st.say : run.closing;
    const lineH = 40;
    wrapText(text, 25, W - 110).forEach((ln, i) => {
      makeLabel(root, ln, {x: -(W - 110) / 2, y: H / 2 - 132 - safe - i * lineH, size: 25, color: palette.ink, align: 'left'});
    });
    if (this.tutHint) {
      makeLabel(root, this.tutHint, {x: -(W - 110) / 2, y: -H / 2 + 250, size: 24, color: palette.jadeDeep, align: 'left', bold: true});
    }

    // 进度：让玩家知道这是一段有始有终的东西，不是无休无止的打断
    const total = run.watchMode ? 1 : 2;
    if (!st) {
      makeButton(root, this.ui, {x: 0, y: -H / 2 + 150, w: 340, h: 92, text: run.watchMode ? '看完了' : '明白了，开始', style: 'jade', size: 30,
        onTap: () => this.activate(run.watchMode ? 'tutorial-close' : 'tutorial-ok')});
    } else {
      const interactive = !!st.need && !run.watchMode;
      if (interactive) {
        // 要动手的那一步：底部只留「跳过」，把整块牌区让给手势（按钮在牌区之外，见约束①）
        makeButton(root, this.ui, {x: 0, y: -H / 2 + 150, w: 240, h: 80, text: `跳过（${Math.min(run.index + 1, total)}/${total} 步）`, style: 'cream', size: 24,
          onTap: () => this.activate('tutorial-skip')});
      } else {
        makeButton(root, this.ui, {x: 0, y: -H / 2 + 150, w: 240, h: 80, text: '跳过教学', style: 'cream', size: 24,
          onTap: () => this.activate('tutorial-skip')});
      }
    }
  }

  /* ── 首页 ─────────────────────────────────────────────── */

  private sunnyState():SunnyState{return {w:this.size.w,h:this.size.h,safe:this.safeTop,s:this.session,page:this.page,theme:this.theme,practice:!!this.mainSession,cssScale:view.getFrameSize().width/this.size.w};}
  private renderSunny(root:Node,items:SunnyItem[]):Label|null{if(!this.sunny)this.sunny=new SunnyView();return this.sunny.render(root,items,this.size.w,this.size.h,this.ensureTileAtlas(),id=>this.activate(id));}
  private renderHome():void{clearChildren(this.screens.home);this.renderSunny(this.screens.home,sunnyHome(this.sunnyState()));}

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

  private renderBoard():void{
    const root=this.boardChrome;clearChildren(root);const S=this.session,W=this.size.w,H=this.size.h;
    const coach=S.coach;const message=this.drag?this.dragLine():coach?(coach.hint||coach.text.say[Math.min(coach.index,coach.text.say.length-1)]):(S.message||'同牌相邻，轻点或推移');
    const layout=sunnyBoard(this.sunnyState(),message);this.dragLabel=this.renderSunny(root,layout.items);
    if(coach){const n=makeNode(root,{x:W/2-60,y:-H/2+175,w:85,h:56,name:'coach-skip'});makeLabel(n,'跳过',{x:0,y:15,size:21,color:palette.jadeDeep,align:'center'});bindPress(n,()=>this.activate('coach-skip'));}
    const x=layout.x-W/2,y=H/2-layout.y,cellW=layout.cellW,cellH=layout.cellH,atlas=this.ensureTileAtlas();
    const def = levelAt(S.levelIndex);
    const tileable = (row: string) => row.split('').some((v) => v === '1' || v === '2' || v === '3');
    const locks=mechanicLocks(def,S.clearedPairs,S.mechanics);
    const lockedRows = locks.lockR.filter((r) => r >= 0 && r < def.map.length && tileable(def.map[r]));
    const lockedCols = locks.lockC.filter((c) => c >= 0 && c < (def.map[0] || '').length && def.map.some((row) => tileable(row[c] || '')));
    const pendingUnlock = (def.unlock || []).filter((u) => u.after > S.clearedPairs).map(u=>({...u,after:u.after-S.clearedPairs})).concat((def.keyLocks||[]).filter(k=>(S.mechanics.collected[k.face]||0)<k.count).map(k=>({axis:k.axis,index:k.index,after:k.count-(S.mechanics.collected[k.face]||0)})));

    this.board.build({
      grid: S.grid, runs: S.runs,theme:this.theme,
      floors:(def.floors||[]).map((f,i)=>({...f,progress:S.mechanics.marks[i]||0})),
      keyFaces:(def.keyLocks||[]).filter(k=>(S.mechanics.collected[k.face]||0)<k.count).map(k=>k.face),
      selected: S.selected,
      hintCells: this.hintCells(),
      hintAction: this.hintAction(),
      focusCells: this.focusCells(),
      drag: this.drag,
      lockedRows, lockedCols,
      oneWay: def.oneWay || [],
      pendingUnlock
    }, atlas, x, y, cellW, cellH);

  }

  /* ── 挑战模式牌桌 ─────────────────────────────────────── */

  /**
   * 挑战牌桌：单层盘、拖动一张牌推动整段、同线同牌自动消。
   * 与主线共用 Board 实例和节点池，但不共用 Session / runs。
   */
  private renderChallenge(): void {
    const C = this.cs;
    if (!C) return;
    const root = this.boardChrome;
    clearChildren(root);
    this.dragLabel = null;
    const W = this.size.w, H = this.size.h, safe = this.safeTop;

    const layout=sunnyChallenge(this.sunnyState(),C);this.dragLabel=this.renderSunny(root,layout.items);
    const x=layout.x-W/2,y=H/2-layout.y,cellW=layout.cellW,cellH=layout.cellH,atlas=this.ensureTileAtlas();
    const grid = C.grid;
    const hint = C.hint;
    const hintRun = hint ? C.runIndex(hint.axis, hint.index) : -1;
    // 蓝框只框这条线上真实存在的牌；空格靠流向箭头表达「整条线都会走」。
    const hintCells = hint && hintRun >= 0 ? C.runs[hintRun].cells.filter((p) => !!cellFace(C.grid, p)) : [];
    let focus: Pos[] = this.chPeek.slice();
    if (hint) {
      const res = applyRotate(C.grid, hint);
      // erased 是**滑完之后**的坐标；被滑走的那张牌在原盘上已经不在那个格子，
      // 只给盘上真实存在的搭子画金框，被滑的牌由蓝色整线高亮 + 流向箭头负责。
      if (res.changed) for (const p of res.erased) {
        if (cellFace(C.grid, p.a)) focus.push(p.a);
        if (cellFace(C.grid, p.b)) focus.push(p.b);
      }
    }
    const seen = new Set<string>();
    focus = focus.filter((p) => { const k = p.r + ',' + p.c; if (seen.has(k)) return false; seen.add(k); return true; });

    this.board.build({
      grid, runs: C.runs,theme:this.theme, selected: null, hintCells,
      hintAction: hint ? {kind: 'slide', run: hintRun, step: hint.step} : null,
      focusCells: focus,
      drag: this.chDrag ? {run: this.chDrag.run, offset: this.chDrag.offset} : null,
      showSlots: false,
      lockedRows: [], lockedCols: [], oneWay: [], pendingUnlock: []
    }, atlas, x, y, cellW, cellH);

  }

  private renderChallengeWin():void{if(!this.cs)return;this.veil();this.renderSunny(this.screens.overlay,sunnyChallengeResult(this.sunnyState(),this.cs));this.animateIn();}
  private renderChallengeStuck():void{if(!this.cs)return;this.veil();this.renderSunny(this.screens.overlay,sunnyChallengeResult(this.sunnyState(),this.cs));this.animateIn();}

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
    // 机制引导优先：试错步只亮目标锁轨/单向轨；正常步亮 solution[0] 的整条轨。
    const coach = this.session.coach;
    if (coach) {
      const bounce = this.session.coachBounceRun();
      const a = bounce >= 0 ? {kind: 'slide' as const, run: bounce} : this.session.solution[0];
      if (a && a.kind === 'slide') {
        const run = this.session.runs[a.run];
        if (run) for (const p of run.cells) out.push(p);
      }
      return out;
    }
    // 只标**队首那一步**：整段计划（K 步）全标出来会让盘面糊成一片蓝，
    // 反而看不出「先做哪一步」——分步提示的前提是每一步都有明确焦点。
    const a = this.session.hint[0];
    if (a && a.kind === 'slide') {
      const run = this.session.runs[a.run];
      if (run) for (const p of run.cells) out.push(p);
    }
    return out;
  }

  /** 机制引导的金色聚焦框：冰面 / 百搭 / 鞭炮 / 目标牌等；纯展示，不参与判定。 */
  private focusCells(): Pos[] {
    const coach = this.session.coach;
    if (!coach) return [];
    try {
      return coachFocusCells(levelAt(this.session.levelIndex), this.session.grid, coach.text.key);
    } catch {
      return [];
    }
  }

  /**
   * 提示的**方向信息**：推哪条轨往哪边、推几格；或者点哪两张。
   *
   * 与 `hintCells` 的分工：前者标「哪一条」，后者标「往哪去」。
   * 只有前者时，玩家看得出该动哪一行，但看不出往左还是往右——这正是旧提示最差的地方。
   */
  private hintAction(): BoardModel['hintAction'] {
    const coach = this.session.coach;
    if (coach) {
      // 试错步只亮轨，不画“能推”的箭头——反了会自相矛盾。
      if (this.session.coachBounceRun() >= 0) return null;
      const a = this.session.solution[0];
      if (!a) return null;
      if (a.kind === 'match') return {kind: 'match', a: a.a, b: a.b};
      return {kind: 'slide', run: a.run, step: a.step};
    }
    const a = this.session.hint[0];
    if (!a) return null;
    if (a.kind === 'match') return {kind: 'match', a: a.a, b: a.b};
    return {kind: 'slide', run: a.run, step: a.step};
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
   * 选关：**一章一屏 4×5**，未解锁的关画成灰卡但占位不变。
   *
   * 以前是"按解锁进度每 16 个切一页"，玩家说不清自己卡在第几章；章节这个坐标当时只在
   * 「我的进度」弹框里有。按要求把两边合成一个界面：进度弹框撤掉，选关直接带章名、
   * 星级、图例与总星数。
   */
  private renderLevels():void{
    const root=this.screens.overlay;this.veil();
    const bg=makeSprite(root,this.sceneAtlas!.frame('garden'),this.size.w,this.size.h);bg.node.name='map-background';
    this.page=Math.max(0,Math.min(25,this.page));this.renderSunny(root,sunnyMap(this.sunnyState()));
  }

  private renderSettings():void{this.veil();this.renderSunny(this.screens.overlay,sunnySettings(this.sunnyState(),this.music,this.sound,APP_VERSION));}

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

  private renderWin():void{this.veil();this.renderSunny(this.screens.overlay,sunnyWin(this.sunnyState()));this.animateIn();}

  /**
   * 失败页：**按失败原因给不同的出路**（`docs/玩法深度与变现设计.md` A3）。
   *
   * 旧版这里是一颗免费「撤销一步」。它有两个问题：撤销不退步数（A1）之后，
   * 在步数用尽的盘上撤完立刻又判负；而且它是免费无限续命的后门，
   * 把「复活」这个最值钱的点位直接占了。
   *
   * 现在：
   * - 步数用尽 → 补步（每关 2 次，第一次 +3、第二次 +1）
   * - 时间到   → 补 30 秒
   * - 牌走死   → 免费重排（**刻意不给付费点位**：死局的痛点是「这盘无解」，
   *              卖广告解决不了根本问题，只会让玩家觉得被敲诈）
   *
   * 广告还没接，所以按钮直接给奖励；次数上限（2 次）是当前的节流手段。
   * 接 C1/C2 时把 `activate('revive')` 包进激励视频回调即可，界面不用动。
   */
  private renderLose():void{this.veil();this.renderSunny(this.screens.overlay,sunnyLose(this.sunnyState()));this.animateIn();}

  private renderPause():void{this.veil();this.renderSunny(this.screens.overlay,sunnyPause(this.sunnyState()));}

  private renderRestart():void{this.veil();this.renderSunny(this.screens.overlay,sunnyRestart(this.sunnyState()));}

  private renderHelp(): void {
    const root = this.screens.overlay;
    this.veil();
    const W = this.size.w, pw = W - 140;
    const basics = [
      '按住一行一列拖动，松手自动连消。',
      '轻点两张相邻的同牌，直接收走。',
      '先看本关目标；重开恢复免费道具。'
    ];
    const oBasics = 106, bStep = 44, oNote = oBasics + basics.length * bStep + 28;
    const ph = oNote + 70 + 126;
    const py = this.centeredTop(ph);
    makePanel(root, this.ui, pw, ph, 0, py - ph / 2);
    makeLabel(root, '玩法', {x: 0, y: py - 44, size: 42, color: palette.jadeDeep, align: 'center', bold: true, serif: true});
    basics.forEach((s, i) => makeLabel(root, s, {x: -pw / 2 + 50, y: py - oBasics - i * bStep, size: 23, color: palette.ink, align: 'left'}));
    makeLabel(root, '26 章 · 520 关，每章首次进入有说明。', {x: -pw / 2 + 50, y: py - oNote, size: 22, color: palette.jadeDeep, align: 'left', bold: true});
    makeLabel(root, '弹框可直接跳过；关掉即可自由玩。', {x: -pw / 2 + 50, y: py - oNote - 32, size: 22, color: palette.inkSoft, align: 'left'});
    makeButton(root, this.ui, {x: 0, y: py - ph + 63, w: 340, h: 86, text: '知道了', style: 'jade', size: 30, onTap: () => this.activate('back-home')});
    this.animateIn();
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
    if(e.type===Input.EventType.TOUCH_START)this.audio?.unlock();
    const id = e.getID();
    // 教学屏的手势自成一套路（盘面、滑轨、提交判据都在 TutorialRun 里），别掉进牌桌那套
    if (this.screen === 'tutorial') { this.onTutorialTouch(e); return; }
    // 挑战模式的动作是「拖一张牌推整段」，与主线的滑轨手势完全不同，必须分叉。
    if (this.screen === 'challenge') { this.onChallengeTouch(e); return; }
    if (e.type === Input.EventType.TOUCH_START) {
      if (this.touchId !== null) return; // 多指：不抢占已在进行的手势
      if (this.screen !== 'board') return; // 弹窗 / 其它屏的按钮各自处理
      const {x, y} = this.toDesign(e);
      const cell = this.board.cellAt(x, y);
      if (!cell) return; // 没落在棋盘上 → 交给节点触摸事件
      this.audio?.play('tap');
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
      if (this.session.coach) {
        const bounce = this.session.coachBounceRun();
        if (bounce >= 0 && run === bounce) {
          // 试错步不生成拖动预览：手指还没松，牌不该先动起来。
          // 只记下“推过”，松手时交给 Session 播一句“推不动”并进入下一步。
          p.blocked = true;
          p.coachRun = run;
          this.dirty = true;
          return;
        }
        if (!this.session.coachAllowsSlide(run)) {
          p.blocked = true;
          this.session.coachNote(this.session.coachDragHint());
          return;
        }
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
    // 引导的试错步：玩家在锁轨/单向轨上拖了一下，牌不动；提交一次“推不动”让状态机前进。
    if (typeof p.coachRun === 'number') {
      const r = this.session.runs[p.coachRun];
      const step = r && r.dir ? -r.dir : 1;
      if (this.session.slide(p.coachRun, step)) this.afterAction();
      this.dirty = true;
      return;
    }
    if (drag) {
      // 同 onMove：轨道拿不到就当作这一下没推动，绝不能抛（一帧异常会让牌桌停在半张状态）
      const run = this.session.runs[drag.run];
      const len = run ? run.cells.length : 0;
      if (!run || !len) { this.dirty = true; return; }
      const k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) {
        const applied = this.session.slide(drag.run, k > len / 2 ? k - len : k);
        if (applied) { this.afterAction(); return; }
      }
      this.dirty = true;
      return;
    }
    if (p.cell && !p.blocked && !p.axis) {
      const end = this.board.cellAt(x, y);
      if (end && end.r === p.cell.r && end.c === p.cell.c) {
        const applied = this.session.tap(p.cell);
        if (applied) { this.afterAction(); return; }
      }
    }
    this.dirty = true;
  }

  /**
   * 挑战手势：按住牌拖动 → 整行/整列循环滑动跟手预览 → 松手提交。
   * 轻点不拖 = 看同款（免费，不消耗提示）。
   */
  private onChallengeTouch(e: EventTouch): void {
    const C = this.cs;
    if (!C) return;
    const id = e.getID();
    if (e.type === Input.EventType.TOUCH_START) {
      if (this.touchId !== null) return;
      if (C.won || C.stuck) return;
      const {x, y} = this.toDesign(e);
      const cell = this.board.cellAt(x, y);
      if (!cell) return;
      if (!cellFace(C.grid, cell)) { this.chPeek = []; this.dirty = true; return; }
      this.touchId = id;
      this.chPress = {x, y, cell};
      this.chDrag = null;
      this.chPeek = [];
      this.lastStep = 0;
      this.board.setDrag(null);
      this.dirty = true;
      return;
    }
    if (id !== this.touchId) return;
    if (e.type === Input.EventType.TOUCH_MOVE) {
      const {x, y} = this.toDesign(e);
      this.onChallengeMove(x, y);
      return;
    }
    this.touchId = null;
    if (!this.chPress) return;
    if (e.type === Input.EventType.TOUCH_CANCEL) {
      this.chPress = null;
      this.chDrag = null;
      this.board.setDrag(null);
      this.dirty = true;
      return;
    }
    const {x, y} = this.toDesign(e);
    this.onChallengeUp(x, y);
  }

  private onChallengeMove(x: number, y: number): void {
    const C = this.cs, p = this.chPress;
    if (!C || !p) return;
    const cw = this.board.cellW, chh = this.board.cellH;
    if (!this.chDrag) {
      const dx = x - p.x, dy = y - p.y;
      const slop = Math.max(8, Math.min(cw, chh) * .22);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
      const axis: Axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
      const index = axis === 'row' ? p.cell.r : p.cell.c;
      this.chDrag = {run: C.runIndex(axis, index), offset: 0, axis, index, len: axis === 'row' ? C.cols : C.rows};
    }
    const d = this.chDrag;
    if (!d) return;
    // cc 的 +y 向上，而 `step>0` 是向右/向下：列方向必须取负，否则预览跟手、松手却滑到反方向。
    const raw = d.axis === 'row' ? (x - p.x) / cw : (p.y - y) / chh;
    d.offset = Math.max(-d.len, Math.min(d.len, raw));
    this.board.setDrag({run: d.run, offset: d.offset});
    const step = Math.round(d.offset);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (this.session.vibration) vibrate('light');
    }
    if (this.dragLabel) {
      this.dragLabel.string = step
        ? `把第 ${d.index + 1} ${d.axis === 'row' ? '行' : '列'}向${dirLabel(d.axis, step)}滑 ${Math.abs(step)} 格 · 松手`
        : '继续拖，松手才提交';
    }
  }

  private onChallengeUp(x: number, y: number): void {
    const C = this.cs, p = this.chPress, d = this.chDrag;
    this.chPress = null;
    this.chDrag = null;
    this.board.setDrag(null);
    if (!C || !p) { this.dirty = true; return; }
    if (d) {
      const k = ((Math.round(d.offset) % d.len) + d.len) % d.len;
      const step = k > d.len / 2 ? k - d.len : k;
      if (step) {
        const res = C.rotate(d.axis, d.index, step);
        if (res) {
          this.chPeek = [];
          this.board.playErase(res.erased);
        }
        this.dirty = true;
        return;
      }
    }
    const end = this.board.cellAt(x, y);
    if (end && (end.r !== p.cell.r || end.c !== p.cell.c)) { this.dirty = true; return; }
    const cells = C.peek(p.cell);
    this.chPeek = cells.length > 1 ? cells : [];
    C.message = cells.length > 1 ? `同款 ${cells.length} 张，金框标出来了。` : '这张牌没有同款。';
    C.revision++;
    this.dirty = true;
  }

  /**
   * 教学屏手势：只做牌桌那套的子集——判定轴 → 找轨 → 跟手预览 → 松手提交。
   *
   * 与牌桌的关键区别：**只有和脚本 expect 一致的动作会被提交**（`TutorialRun.advance` 负责回弹），
   * 所以"硬引导"不需要遮罩挖洞就已经成立了；小盘就 2×3，误触本身几乎不可能。
   * 拖动的符号与牌桌一致：cc 的 +y 向上，列方向要取负，否则预览跟着手、松手却排到反方向。
   */
  private onTutorialTouch(e: EventTouch): void {
    const run = this.tut;
    if (!run) return;
    const id = e.getID();
    if (e.type === Input.EventType.TOUCH_START) {
      if (this.touchId !== null || run.failed) return;
      const st = run.step;
      if (!st || !st.need || run.watchMode) return;                  // 自动演示期间不吃操作
      const {x, y} = this.toDesign(e);
      const cell = this.tutBoard.cellAt(x, y);
      if (!cell) return;                                             // 落在按钮区 → 交给节点自己的 TOUCH_END
      this.touchId = id;
      this.tutPress = {x, y, cell, axis: null, blocked: false};
      this.tutDrag = null;
      this.tutHint = '';
      return;
    }
    if (!this.tutPress || id !== this.touchId) return;
    const p = this.tutPress;
    if (e.type === Input.EventType.TOUCH_MOVE) {
      const {x, y} = this.toDesign(e);
      const cw = this.tutCell ? this.tutCell.cellW : 1, chh = this.tutCell ? this.tutCell.cellH : 1;
      const dx = x - p.x, dy = y - p.y;
      if (!p.axis) {
        const slop = Math.max(8, Math.min(cw, chh) * .22);
        if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
        p.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
        const ri = run.runs.findIndex((r) => r.axis === p.axis && !r.locked && r.cells.some((q) => q.r === p.cell!.r && q.c === p.cell!.c));
        if (ri < 0) { p.blocked = true; this.tutHint = '这一条推不动：按住亮起来的那一条。'; this.dirty = true; return; }
        this.tutDrag = {run: ri, offset: 0};
      }
      if (!this.tutDrag) return;
      const dragRun = run.runs[this.tutDrag.run];
      const len = dragRun ? dragRun.cells.length : 0;
      if (!len) { this.tutDrag = null; this.tutPress = null; this.dirty = true; return; }
      const raw = p.axis === 'row' ? dx / cw : -dy / chh;
      this.tutDrag = {run: this.tutDrag.run, offset: Math.max(-len, Math.min(len, raw))};
      this.tutBoard.setDrag(this.tutDrag);                           // 每次 move 都跟手，不重建整屏
      return;
    }
    this.touchId = null;
    const drag = this.tutDrag;
    this.tutPress = null;
    this.tutDrag = null;
    this.tutBoard.setDrag(null);
    this.dirty = true;
    if (e.type === Input.EventType.TOUCH_CANCEL || run.failed) return;
    const {x, y} = this.toDesign(e);
    if (drag) {
      const dragRun = run.runs[drag.run];
      const len = dragRun ? dragRun.cells.length : 0;
      if (!len) return;
      const k = ((Math.round(drag.offset) % len) + len) % len;
      if (k) this.commitTutorial({kind: 'slide', run: drag.run, step: k > len / 2 ? k - len : k});
      return;
    }
    if (p.cell && !p.blocked && !p.axis) {
      const end = this.tutBoard.cellAt(x, y);
      if (!end || end.r !== p.cell.r || end.c !== p.cell.c) return;
      if (!this.tutSel) this.tutSel = end;
      else { this.commitTutorial({kind: 'match', a: this.tutSel, b: end}); this.tutSel = null; }
      this.dirty = true;
    }
  }

  /** 把动作交给状态机：前进就播消除动画，回弹就把话术贴到横幅上（盘面不会被偷偷改掉）。 */
  private commitTutorial(action: Action): void {
    const run = this.tut;
    if (!run) return;
    const r = run.advance(action);
    if (run.failed) { this.tutorialFail(); return; }
    if (r.advanced) { if (r.erased.length) this.tutBoard.playErase(r.erased); this.tutHint = ''; }
    else this.tutHint = r.message;
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
    // 引导的“试错步”需要让玩家真的去按一次锁轨/单向轨：只有那一条允许命中，
    // 其余锁轨照旧跳过，避免把“推不动”误判成可拖。
    const allowLocked = this.session.coach ? this.session.coachBounceRun() : -1;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.axis !== axis) continue;
      if (runLocked(r) && i !== allowLocked) continue;
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
