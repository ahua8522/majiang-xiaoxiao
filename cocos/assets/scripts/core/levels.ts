/** 520 关 / 26 章。由 tools/author-campaign.cjs 生成并按真实机关状态验证。 */
export interface LevelDef {
  floors?: {r:number;c:number;kind:'flower'|'dew'|'bud';need:number}[];
  keyLocks?: {axis:'row'|'col';index:number;face:string;count:number}[];
  energy?: boolean;
  referencePar?: number;
  map: string[];
  lockR: number[];
  lockC: number[];
  faces: number;
  scramble: number;
  /** 冰面对子数（冰牌要消两次：第一下碎冰）。0/缺省表示无冰面。 */
  ice?: number;
  /** 其中「厚冰」对子数（要碎两次冰，合计三次消除）。 */
  ice2?: number;
  /** 鞭炮对子数：配对时震碎相邻冰牌（只在有冰的关出现）。 */
  bombs?: number;
  /** 花牌（春夏秋冬/梅兰竹菊）是否入池。 */
  flowers?: boolean;
  /** 花牌当百搭（能与任意牌配对）。 */
  wild?: boolean;
  /** 单向轨：只能朝 dir 方向推（+1=右/下，-1=左/上）。 */
  oneWay?: {axis: 'row' | 'col'; index: number; dir: 1 | -1}[];
  /** 连锁解锁：该轨先锁住，累计消掉 after 对之后自动解锁。 */
  unlock?: {axis: 'row' | 'col'; index: number; after: number}[];
  /** 步数上限：用尽仍未清台即失败。 */
  moveLimit?: number;
  /** 目标关：不必清空，先达成目标即通关。「collect」= 集齐一组（八花齐 / 三元齐 / 清龙），
   *  faces 是那一组的牌面代号，进度按「集齐了几种」算。 */
  goal?: {kind: 'face' | 'ice' | 'collect' | 'garden'; face?: string; faces?: string[]; count: number};
  /**
   * 方言：只约束「哪些牌能配对」。白名单外的牌是哑弹——占位、能当滑块，但永远配不上，
   * 通关判定因此看 `Rules.liveCount` 而不是 `count`（只剩哑弹也算清台）。
   * 与 `wild` 互斥：财神不吃哑弹，两者同时开会让玩家以为还能消。
   */
  dialect?: {ranks?: number[]; suit?: 'p' | 's' | 'm'; noSlideSuit?: 'p' | 's' | 'm'; honors?: boolean};
  /** 限时（秒）。必须由 `par × 每步秒数` 推出来，不许手填一个好看的数字。 */
  timeLimit?: number;
  /** 所属章节（0 基）。工具对每一关都会发射；星图分组与难度档读它，缺省时按 index/16 推。 */
  chapter?: number;
  /** 本关首次出现某机制时的说明键（视图据此弹「新玩法」卡片）。 */
  intro?: string;
  /**
   * 钉死的发牌种子。**关卡内容 = map + seed 的纯函数**，所以这一行就是这一关的本体。
   * 规矩：改了 `map` 必须重钉；`map` 没改就不许换。
   * `npm run author:levels` 只给没有 seed 的关补，要重钉显式用 `--reseed[=81-96]`。
   */
  seed: number;
  /**
   * 盘面内容指纹（`Rules.boardHash` 的前 8 位十六进制）。
   * 光钉 seed 挡不住"改引擎"：生成器实现变一行，同一颗种子就发出另一盘。
   * 所以真正的冻结判据是这个指纹——`tests/levels-seed.test.cjs` 逐关重算并比对。
   */
  hash: string;
}

/** 关卡表，共 520 关。 */
export const LEVELS: LevelDef[] = [
  // 第 1 关 · 4 列 × 3 行 · 参考解 3 步
  {"map":["1111","1111","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":2,"seed":20269024,"hash":"282f02f7","chapter":0,"energy":false,"referencePar":3,"intro":"ctip:0"},
  // 第 2 关 · 4 列 × 3 行 · 参考解 3 步
  {"map":["..11","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":3,"seed":20276943,"hash":"3c0950a7","chapter":0,"energy":false,"referencePar":3},
  // 第 3 关 · 4 列 × 3 行 · 参考解 4 步
  {"map":["..11","..11","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":4,"seed":20284862,"hash":"5131acb1","chapter":0,"energy":false,"referencePar":4},
  // 第 4 关 · 4 列 × 3 行 · 参考解 3 步
  {"map":["1111","11..","..11"],"lockR":[],"lockC":[],"faces":4,"scramble":5,"seed":20292781,"hash":"a8d32a0d","chapter":0,"energy":false,"referencePar":3},
  // 第 5 关 · 4 列 × 4 行 · 参考解 5 步
  {"map":["1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":9,"seed":20300700,"hash":"929dd677","chapter":0,"energy":false,"referencePar":5},
  // 第 6 关 · 4 列 × 4 行 · 参考解 3 步
  {"map":["1111","11..","1111","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20308619,"hash":"dc849087","chapter":0,"energy":false,"referencePar":3},
  // 第 7 关 · 4 列 × 4 行 · 参考解 4 步
  {"map":["..11","..11","1111","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":6,"seed":20316538,"hash":"88722ed5","chapter":0,"energy":false,"referencePar":4},
  // 第 8 关 · 4 列 × 4 行 · 参考解 3 步
  {"map":["..11","..11","11..","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":7,"seed":20324457,"hash":"b160817f","chapter":0,"energy":false,"referencePar":3},
  // 第 9 关 · 4 列 × 5 行 · 参考解 5 步
  {"map":["11..","1111","1111","11..","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20332376,"hash":"a5c21235","chapter":0,"energy":false,"referencePar":5},
  // 第 10 关 · 4 列 × 5 行 · 参考解 9 步
  {"map":["1111","1111","11..","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":9,"seed":20340295,"hash":"076bb961","chapter":0,"energy":false,"referencePar":9},
  // 第 11 关 · 4 列 × 5 行 · 参考解 4 步
  {"map":["1111","1111","1111","11..","11.."],"lockR":[],"lockC":[],"faces":5,"scramble":5,"seed":20348214,"hash":"815b41e1","chapter":0,"energy":false,"referencePar":4},
  // 第 12 关 · 4 列 × 5 行 · 参考解 3 步
  {"map":["..11","1111","11..","1111","11.."],"lockR":[],"lockC":[],"faces":6,"scramble":6,"seed":20356133,"hash":"d4231429","chapter":0,"energy":false,"referencePar":3},
  // 第 13 关 · 4 列 × 3 行 · 参考解 7 步
  {"map":["1111","1111","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":7,"seed":20364052,"hash":"8fbf3f21","chapter":0,"energy":false,"referencePar":7},
  // 第 14 关 · 4 列 × 3 行 · 参考解 4 步
  {"map":["..11","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":8,"seed":20371971,"hash":"25b38471","chapter":0,"energy":false,"referencePar":4},
  // 第 15 关 · 4 列 × 3 行 · 参考解 2 步
  {"map":["..11","1111","11.."],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20379890,"hash":"8188909f","chapter":0,"energy":false,"referencePar":2},
  // 第 16 关 · 4 列 × 3 行 · 参考解 3 步
  {"map":["1111","....","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":5,"seed":20387809,"hash":"32c5843b","chapter":0,"energy":false,"referencePar":3},
  // 第 17 关 · 4 列 × 4 行 · 参考解 6 步
  {"map":["1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":6,"seed":20395728,"hash":"b09aa949","chapter":0,"energy":false,"referencePar":6},
  // 第 18 关 · 4 列 × 4 行 · 参考解 5 步
  {"map":["1111","..11","1111","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":20403647,"hash":"9e49ec37","chapter":0,"energy":false,"referencePar":5},
  // 第 19 关 · 4 列 × 4 行 · 参考解 5 步
  {"map":["11..","..11","1111","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":8,"seed":20411566,"hash":"060ce14f","chapter":0,"energy":false,"referencePar":5},
  // 第 20 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["..11","11..","11..","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":9,"seed":20419485,"hash":"1a8d071b","chapter":0,"energy":false,"referencePar":7},
  // 第 21 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["2211","1111","2211","1111","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20427404,"hash":"56e9c0d9","chapter":1,"energy":false,"referencePar":7,"intro":"ctip:1"},
  // 第 22 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["2211","2211","..11","1111","2211"],"lockR":[],"lockC":[],"faces":6,"scramble":6,"seed":20435323,"hash":"2fddd185","chapter":1,"energy":false,"referencePar":8,"moveLimit":16},
  // 第 23 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["11..","2211","1122","2211","..22"],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":20443242,"hash":"c6db66a3","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 24 关 · 4 列 × 5 行 · 参考解 9 步
  {"map":["..22","....","1111","1111","2211"],"lockR":[],"lockC":[],"faces":5,"scramble":8,"seed":20451161,"hash":"93299161","chapter":1,"energy":false,"referencePar":9,"moveLimit":17},
  // 第 25 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","22111","11112","11112","22111","11111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":20459080,"hash":"67631f9b","chapter":1,"energy":false,"referencePar":8,"moveLimit":16},
  // 第 26 关 · 5 列 × 6 行 · 参考解 6 步
  {"map":["11221","22221","1111.","1111.","11111","22111"],"lockR":[],"lockC":[],"faces":9,"scramble":5,"seed":20466999,"hash":"8ff45713","chapter":1,"energy":false,"referencePar":6},
  // 第 27 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11112","11222","..111","11111","11..1","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":6,"seed":20474918,"hash":"62684e33","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 28 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["1111.","1111.","11111","22221","..221","..111"],"lockR":[],"lockC":[],"faces":8,"scramble":7,"seed":20482837,"hash":"c1a914b5","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 29 关 · 4 列 × 5 行 · 参考解 4 步
  {"map":["1122","2222","..11","11..","1122"],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20490756,"hash":"17e78691","chapter":1,"energy":false,"referencePar":4},
  // 第 30 关 · 4 列 × 6 行 · 参考解 9 步
  {"map":["22..","1122","1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":20498675,"hash":"3b77783b","chapter":1,"energy":false,"referencePar":9,"moveLimit":17},
  // 第 31 关 · 4 列 × 6 行 · 参考解 5 步
  {"map":["11..","1111","2211","..11","1111","2222"],"lockR":[],"lockC":[],"faces":7,"scramble":5,"seed":20506594,"hash":"d57ccb43","chapter":1,"energy":false,"referencePar":5},
  // 第 32 关 · 4 列 × 6 行 · 参考解 5 步
  {"map":["22..","2211","1111","..11","2222","11.."],"lockR":[],"lockC":[],"faces":7,"scramble":6,"seed":20514513,"hash":"1b556831","chapter":1,"energy":false,"referencePar":5,"moveLimit":13},
  // 第 33 关 · 4 列 × 5 行 · 参考解 5 步
  {"map":["1111","1111","1111","2222","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":20522432,"hash":"800c5181","chapter":1,"energy":false,"referencePar":5,"moveLimit":13},
  // 第 34 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["2211","2211","1111","22..","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":8,"seed":20530351,"hash":"b5202885","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 35 关 · 4 列 × 5 行 · 参考解 4 步
  {"map":["22..","1122","11..","..22","..22"],"lockR":[],"lockC":[],"faces":6,"scramble":5,"seed":20538270,"hash":"a9d04bd3","chapter":1,"energy":false,"referencePar":4},
  // 第 36 关 · 4 列 × 5 行 · 参考解 5 步
  {"map":["....","2211","1111","2211","11.."],"lockR":[],"lockC":[],"faces":5,"scramble":5,"seed":20546189,"hash":"6a1551f9","chapter":1,"energy":false,"referencePar":5},
  // 第 37 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11221","11111","11112","11112","22111","11111"],"lockR":[],"lockC":[],"faces":9,"scramble":6,"seed":20554108,"hash":"1cc8faed","chapter":1,"energy":false,"referencePar":9,"moveLimit":17},
  // 第 38 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["22111","..221","11112","22112","11111","11111"],"lockR":[],"lockC":[],"faces":9,"scramble":7,"seed":20562027,"hash":"f224f439","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 39 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["2211.","1111.","11..1","22111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":20569946,"hash":"dafbb69b","chapter":1,"energy":false,"referencePar":7,"moveLimit":15},
  // 第 40 关 · 4 列 × 6 行 · 参考解 9 步
  {"map":["..22","2211","1111","2211","..11","11.."],"lockR":[],"lockC":[],"faces":6,"scramble":9,"seed":20577865,"hash":"fe163e95","chapter":1,"energy":false,"referencePar":9,"moveLimit":17},
  // 第 41 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["1111","1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":6,"seed":20585784,"hash":"ec3444a9","chapter":2,"energy":false,"ice":1,"referencePar":8,"intro":"ctip:2"},
  // 第 42 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["1111","1111","1111","1111","..11"],"lockR":[],"lockC":[],"faces":5,"scramble":7,"seed":20593703,"hash":"c0a2e65f","chapter":2,"energy":false,"ice":1,"referencePar":8,"moveLimit":16},
  // 第 43 关 · 4 列 × 5 行 · 参考解 9 步
  {"map":["1111","11..","1111","1111","..11"],"lockR":[],"lockC":[],"faces":6,"scramble":8,"seed":20601622,"hash":"13fa4429","chapter":2,"energy":false,"ice":1,"referencePar":9,"moveLimit":17},
  // 第 44 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["1111","....","1111","1111","..11"],"lockR":[],"lockC":[],"faces":4,"scramble":9,"seed":20609541,"hash":"83cae577","chapter":2,"energy":false,"ice":1,"referencePar":8,"moveLimit":16},
  // 第 45 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":20617460,"hash":"83874f97","chapter":2,"energy":false,"ice":1,"referencePar":8,"moveLimit":16},
  // 第 46 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","11111","11111","11111","..111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":6,"seed":20625379,"hash":"1ac8eda5","chapter":2,"energy":false,"ice":2,"referencePar":9},
  // 第 47 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["..111","11111","1111.","1111.","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":20633298,"hash":"0438a583","chapter":2,"energy":false,"ice":2,"referencePar":8,"moveLimit":16},
  // 第 48 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11..1","..111","11111","11..1","11111","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":8,"seed":20641217,"hash":"da572c73","chapter":2,"energy":false,"ice":2,"referencePar":10,"moveLimit":18},
  // 第 49 关 · 4 列 × 5 行 · 参考解 4 步
  {"map":["....","1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":6,"seed":20649136,"hash":"cf34d493","chapter":2,"energy":false,"ice":1,"referencePar":4},
  // 第 50 关 · 4 列 × 6 行 · 参考解 13 步
  {"map":["1111","11..","1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":6,"scramble":10,"seed":20657055,"hash":"d715512f","chapter":2,"energy":false,"ice":2,"referencePar":13,"moveLimit":21},
  // 第 51 关 · 4 列 × 6 行 · 参考解 9 步
  {"map":["1111","1111","1111","1111","....","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":6,"seed":20664974,"hash":"b7832e97","chapter":2,"energy":false,"ice":3,"referencePar":9},
  // 第 52 关 · 4 列 × 6 行 · 参考解 9 步
  {"map":["1111","1111","..11","1111","..11","11.."],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":20672893,"hash":"a5e89757","chapter":2,"energy":false,"ice":3,"referencePar":9,"moveLimit":17},
  // 第 53 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["1111","1111","1111","1111","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":8,"seed":20680812,"hash":"dd0e90eb","chapter":2,"energy":false,"ice":3,"referencePar":7,"moveLimit":15},
  // 第 54 关 · 4 列 × 5 行 · 参考解 12 步
  {"map":["1111","1111","1111","..11","1111"],"lockR":[],"lockC":[],"faces":5,"scramble":9,"seed":20688731,"hash":"74c41add","chapter":2,"energy":false,"ice":3,"referencePar":12,"moveLimit":20},
  // 第 55 关 · 4 列 × 5 行 · 参考解 5 步
  {"map":["1111","..11","1111","..11","...."],"lockR":[],"lockC":[],"faces":6,"scramble":6,"seed":20696650,"hash":"15575705","chapter":2,"energy":false,"ice":1,"referencePar":5},
  // 第 56 关 · 4 列 × 5 行 · 参考解 9 步
  {"map":["..11","11..","11..","1111","1111"],"lockR":[],"lockC":[],"faces":4,"scramble":6,"seed":20704569,"hash":"73c33337","chapter":2,"energy":false,"ice":4,"referencePar":9},
  // 第 57 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":7,"seed":20712488,"hash":"e7445ec9","chapter":2,"energy":false,"ice":4,"referencePar":10,"moveLimit":18},
  // 第 58 关 · 5 列 × 6 行 · 参考解 12 步
  {"map":["11111","11111","11111","11111","11111","..111"],"lockR":[],"lockC":[],"faces":7,"scramble":8,"seed":20720407,"hash":"87d070cf","chapter":2,"energy":false,"ice":4,"referencePar":12,"moveLimit":20},
  // 第 59 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11111","..111","..111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":20728326,"hash":"fbe4cd19","chapter":2,"energy":false,"ice":4,"referencePar":10,"moveLimit":18},
  // 第 60 关 · 4 列 × 6 行 · 参考解 11 步
  {"map":["11..","11..","1111","1111","1111","..11"],"lockR":[],"lockC":[],"faces":5,"scramble":10,"seed":20736245,"hash":"2ac2ee39","chapter":2,"energy":false,"ice":4,"referencePar":11,"moveLimit":19},
  // 第 61 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":6,"seed":20744164,"hash":"f91a7f1b","chapter":3,"energy":false,"floors":[{"r":2,"c":0,"kind":"flower","need":1},{"r":3,"c":3,"kind":"flower","need":1},{"r":0,"c":1,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":7,"intro":"ctip:3"},
  // 第 62 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","..111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":20752083,"hash":"7a1e938d","chapter":3,"energy":false,"floors":[{"r":2,"c":0,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8,"moveLimit":16},
  // 第 63 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","..111","11111","11111","11..1","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":8,"seed":20760002,"hash":"ca1b9c4f","chapter":3,"energy":false,"floors":[{"r":2,"c":0,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":0,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"moveLimit":17},
  // 第 64 关 · 5 列 × 6 行 · 参考解 6 步
  {"map":["11111","11111","11111","11111","1111.","....."],"lockR":[],"lockC":[],"faces":6,"scramble":9,"seed":20767921,"hash":"0226868f","chapter":3,"energy":false,"floors":[{"r":0,"c":1,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":6,"moveLimit":14},
  // 第 65 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":10,"seed":20775840,"hash":"c63351df","chapter":3,"energy":false,"floors":[{"r":4,"c":1,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 66 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":6,"seed":20783759,"hash":"c594ba63","chapter":3,"energy":false,"floors":[{"r":0,"c":1,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1},{"r":1,"c":5,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8},
  // 第 67 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","..1111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":7,"seed":20791678,"hash":"38b953df","chapter":3,"energy":false,"floors":[{"r":4,"c":4,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8,"moveLimit":16},
  // 第 68 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["....11","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":20799597,"hash":"5882b2c7","chapter":3,"energy":false,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":2,"c":2,"kind":"flower","need":1},{"r":3,"c":0,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"moveLimit":17},
  // 第 69 关 · 4 列 × 5 行 · 参考解 6 步
  {"map":["1111","1111","11..","11..","1111"],"lockR":[],"lockC":[],"faces":7,"scramble":6,"seed":20807516,"hash":"9426de63","chapter":3,"energy":false,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":2,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":6},
  // 第 70 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":20815435,"hash":"aa227415","chapter":3,"energy":false,"floors":[{"r":4,"c":0,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1},{"r":5,"c":5,"kind":"flower","need":1},{"r":1,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 71 关 · 6 列 × 7 行 · 参考解 6 步
  {"map":["111111","111111","111111","11..11","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":10,"scramble":6,"seed":20823354,"hash":"9f7ce4d7","chapter":3,"energy":false,"floors":[{"r":2,"c":0,"kind":"flower","need":1},{"r":3,"c":0,"kind":"flower","need":1},{"r":0,"c":4,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":6},
  // 第 72 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["..1111","111111","1111..","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":7,"seed":20831273,"hash":"805ed26b","chapter":3,"energy":false,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"moveLimit":17},
  // 第 73 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":20839192,"hash":"971ce647","chapter":3,"energy":false,"floors":[{"r":1,"c":2,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"moveLimit":17},
  // 第 74 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","11111","11111","11111","11..1","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":20847111,"hash":"22bc493f","chapter":3,"energy":false,"floors":[{"r":4,"c":4,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"moveLimit":17},
  // 第 75 关 · 4 列 × 5 行 · 参考解 5 步
  {"map":["....","1111","1111","1111","...."],"lockR":[],"lockC":[],"faces":7,"scramble":6,"seed":20855030,"hash":"c1b7194d","chapter":3,"energy":false,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1},{"r":3,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":5},
  // 第 76 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11..1","11111","..111","..111","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":6,"seed":20862949,"hash":"a061efe1","chapter":3,"energy":false,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":2,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":7},
  // 第 77 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":7,"seed":20870868,"hash":"176ef43b","chapter":3,"energy":false,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8,"moveLimit":16},
  // 第 78 关 · 6 列 × 6 行 · 参考解 7 步
  {"map":["111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":20878787,"hash":"f1a084eb","chapter":3,"energy":false,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":4,"c":2,"kind":"flower","need":1},{"r":0,"c":1,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":7,"moveLimit":15},
  // 第 79 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","1111..","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":20886706,"hash":"afee35bd","chapter":3,"energy":false,"floors":[{"r":4,"c":1,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8,"moveLimit":16},
  // 第 80 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["111111","1111..","111111","111111","111111","111111","11...."],"lockR":[],"lockC":[],"faces":9,"scramble":10,"seed":20894625,"hash":"f6ed0239","chapter":3,"energy":false,"floors":[{"r":3,"c":0,"kind":"flower","need":1},{"r":5,"c":1,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1},{"r":0,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11,"moveLimit":19},
  // 第 81 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":7,"seed":20902544,"hash":"57b3c913","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p"],"count":1},"referencePar":8,"intro":"ctip:4"},
  // 第 82 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11111","11111","..111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":8,"seed":20910463,"hash":"cb692e3f","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p"],"count":1},"referencePar":7,"moveLimit":15},
  // 第 83 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","1111.","1111.","11111","..111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":20918382,"hash":"6a88fc6f","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p"],"count":1},"referencePar":8,"moveLimit":16},
  // 第 84 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11111","11..1","11..1","11111","..111"],"lockR":[],"lockC":[],"faces":6,"scramble":10,"seed":20926301,"hash":"d9c9ba3b","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["2p"],"count":1},"referencePar":7,"moveLimit":15},
  // 第 85 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":11,"seed":20934220,"hash":"71a47c4d","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["3m","9s"],"count":2},"referencePar":9,"moveLimit":17},
  // 第 86 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","11..11","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":7,"seed":20942139,"hash":"7d14e509","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["2p","z6"],"count":2},"referencePar":9},
  // 第 87 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","11..11","1111.."],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":20950058,"hash":"a3f99f23","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["9s","3m"],"count":2},"referencePar":10,"moveLimit":18},
  // 第 88 关 · 6 列 × 6 行 · 参考解 6 步
  {"map":["1111..","111111","11..11","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":20957977,"hash":"40160447","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["6s","2p"],"count":2},"referencePar":6,"moveLimit":14},
  // 第 89 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["1111","....","1111","1111","1111"],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":20965896,"hash":"bdacee6b","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p","z6"],"count":2},"referencePar":7},
  // 第 90 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":20973815,"hash":"82ea1d2f","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["z6","2p"],"count":2},"referencePar":12,"moveLimit":20},
  // 第 91 关 · 6 列 × 7 行 · 参考解 8 步
  {"map":["111111","11..11","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":7,"seed":20981734,"hash":"783a8c0b","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["4s","2p"],"count":2},"referencePar":8},
  // 第 92 关 · 6 列 × 7 行 · 参考解 8 步
  {"map":["111111","111111","11....","11..11","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":20989653,"hash":"22dd68f5","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["z5","9s"],"count":2},"referencePar":8,"moveLimit":16},
  // 第 93 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":20997572,"hash":"b26a8f5f","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["2p","7p"],"count":2},"referencePar":9,"moveLimit":17},
  // 第 94 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11111","11111","11111","11111","..111"],"lockR":[],"lockC":[],"faces":7,"scramble":10,"seed":21005491,"hash":"ee3c33fb","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p","3m","6s"],"count":3},"referencePar":10,"moveLimit":18},
  // 第 95 关 · 4 列 × 5 行 · 参考解 3 步
  {"map":["..11","1111","11..","11..","..11"],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":21013410,"hash":"bab36bef","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["9s","7p","3m"],"count":3},"referencePar":3},
  // 第 96 关 · 5 列 × 6 行 · 参考解 6 步
  {"map":["..111","11111","11...","1111.","11111","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":21021329,"hash":"574a1589","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["2p","3m","z5"],"count":3},"referencePar":6},
  // 第 97 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":21029248,"hash":"83fe8b6f","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["7p","2p","z5"],"count":3},"referencePar":8,"moveLimit":16},
  // 第 98 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21037167,"hash":"101d35a9","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["4s","2p","9s"],"count":3},"referencePar":10,"moveLimit":18},
  // 第 99 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","..1111","..1111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21045086,"hash":"041943dd","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["4s","z5","2p"],"count":3},"referencePar":8,"moveLimit":16},
  // 第 100 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["....11","..1111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":11,"seed":21053005,"hash":"67967923","chapter":4,"energy":false,"goal":{"kind":"collect","faces":["9s","2p","z6"],"count":3},"referencePar":10,"moveLimit":18},
  // 第 101 关 · 5 列 × 6 行 · 参考解 6 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":7,"seed":21060924,"hash":"621e53c3","chapter":5,"energy":true,"referencePar":6,"intro":"ctip:5"},
  // 第 102 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11111","11111","11111","11111","11..1"],"lockR":[],"lockC":[],"faces":7,"scramble":8,"seed":21068843,"hash":"fef9d4c3","chapter":5,"energy":true,"referencePar":7,"moveLimit":15},
  // 第 103 关 · 5 列 × 6 行 · 参考解 11 步
  {"map":["11..1","11111","11111","11111","11111","..111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":21076762,"hash":"625cb597","chapter":5,"energy":true,"referencePar":11,"moveLimit":19},
  // 第 104 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11..1","..111","..111","11111","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":10,"seed":21084681,"hash":"94eedf6b","chapter":5,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 105 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":11,"seed":21092600,"hash":"6ce826f7","chapter":5,"energy":true,"referencePar":11,"moveLimit":19},
  // 第 106 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","1111..","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":7,"seed":21100519,"hash":"5e5114e9","chapter":5,"energy":true,"referencePar":8},
  // 第 107 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","..1111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21108438,"hash":"5136ed1b","chapter":5,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 108 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","11....","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21116357,"hash":"fcfe03a3","chapter":5,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 109 关 · 4 列 × 5 行 · 参考解 6 步
  {"map":["1111","1111","..11","1111","11.."],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":21124276,"hash":"9f014a33","chapter":5,"energy":true,"referencePar":6},
  // 第 110 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":21132195,"hash":"a9e6e00f","chapter":5,"energy":true,"referencePar":12,"moveLimit":20},
  // 第 111 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","11..11","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":7,"seed":21140114,"hash":"caa4724b","chapter":5,"energy":true,"referencePar":9},
  // 第 112 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","..1111","11..11","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":21148033,"hash":"f6089f55","chapter":5,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 113 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21155952,"hash":"3432b2e5","chapter":5,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 114 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11..1","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":10,"seed":21163871,"hash":"0ebbb70d","chapter":5,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 115 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["....","..11","1111","11..","1111"],"lockR":[],"lockC":[],"faces":7,"scramble":7,"seed":21171790,"hash":"5bc0bd95","chapter":5,"energy":true,"referencePar":8},
  // 第 116 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["1111.","1111.","11111","11111","11111","....1"],"lockR":[],"lockC":[],"faces":6,"scramble":7,"seed":21179709,"hash":"5fda2031","chapter":5,"energy":true,"referencePar":7},
  // 第 117 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":21187628,"hash":"2dab1845","chapter":5,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 118 关 · 6 列 × 6 行 · 参考解 7 步
  {"map":["..1111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21195547,"hash":"a997ddc1","chapter":5,"energy":true,"referencePar":7,"moveLimit":15},
  // 第 119 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","11..11","11..11","111111","111111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21203466,"hash":"65735e81","chapter":5,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 120 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["11....","111111","111111","11..11","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":11,"seed":21211385,"hash":"5b73fd33","chapter":5,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 121 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21219304,"hash":"648d049d","chapter":6,"energy":true,"referencePar":8,"intro":"ctip:6"},
  // 第 122 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","11111","11##1","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":21227223,"hash":"5ab85da1","chapter":6,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 123 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["##111","11111","11111","11111","11111","##111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21235142,"hash":"71ae269b","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 124 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["1111#","1111#","11111","11111","##111","11##1"],"lockR":[],"lockC":[],"faces":6,"scramble":11,"seed":21243061,"hash":"0f18b131","chapter":6,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 125 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21250980,"hash":"6136a7cd","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 126 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["1111##","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":21258899,"hash":"f11f85d5","chapter":6,"energy":true,"referencePar":8},
  // 第 127 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["11##11","##1111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21266818,"hash":"06b74581","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 128 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","##1111","1111##","111111","##1111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21274737,"hash":"2f2a203b","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 129 关 · 4 列 × 5 行 · 参考解 7 步
  {"map":["1111","1111","##11","##11","1111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21282656,"hash":"9f4c2293","chapter":6,"energy":true,"referencePar":7},
  // 第 130 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["111111","111111","111111","##1111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":21290575,"hash":"3a6eeec7","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 131 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","####11","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":8,"seed":21298494,"hash":"c49e46d5","chapter":6,"energy":true,"referencePar":9},
  // 第 132 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","##1111","11##11","##1111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21306413,"hash":"bf61d921","chapter":6,"energy":true,"referencePar":12,"moveLimit":20},
  // 第 133 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21314332,"hash":"75e74a5b","chapter":6,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 134 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11111","11111","11111","1111#","1111#"],"lockR":[],"lockC":[],"faces":7,"scramble":11,"seed":21322251,"hash":"6d3431c5","chapter":6,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 135 关 · 4 列 × 5 行 · 参考解 6 步
  {"map":["11##","1111","1111","11##","####"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21330170,"hash":"cbd15b2b","chapter":6,"energy":true,"referencePar":6},
  // 第 136 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["##111","11##1","11111","11111","11##1","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":8,"seed":21338089,"hash":"dd2aa207","chapter":6,"energy":true,"referencePar":8},
  // 第 137 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21346008,"hash":"8a0b6d99","chapter":6,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 138 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","##1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":10,"seed":21353927,"hash":"9b3b2bcd","chapter":6,"energy":true,"referencePar":8,"moveLimit":16},
  // 第 139 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["111111","11##11","111111","111111","111111","1111##"],"lockR":[],"lockC":[],"faces":8,"scramble":11,"seed":21361846,"hash":"a0210eed","chapter":6,"energy":true,"referencePar":11,"moveLimit":19},
  // 第 140 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["11##11","111111","111111","111111","##11##","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21369765,"hash":"7ea41e27","chapter":6,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 141 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21377684,"hash":"52568c71","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":1}],"referencePar":7,"intro":"ctip:7"},
  // 第 142 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11..1","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":9,"seed":21385603,"hash":"139822ab","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":2,"dir":-1}],"referencePar":9,"moveLimit":17},
  // 第 143 关 · 5 列 × 6 行 · 参考解 7 步
  {"map":["11..1","11111","11111","11..1","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21393522,"hash":"e0b8d6f1","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"referencePar":7,"moveLimit":15},
  // 第 144 关 · 5 列 × 6 行 · 参考解 9 步
  {"map":["11111","....1","..111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":6,"scramble":11,"seed":21401441,"hash":"fbe8e235","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":2,"dir":1}],"referencePar":9,"moveLimit":17},
  // 第 145 关 · 6 列 × 6 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21409360,"hash":"efe5c84d","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"referencePar":12,"moveLimit":20},
  // 第 146 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":8,"seed":21417279,"hash":"4e81ac2f","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"referencePar":8},
  // 第 147 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","1111..","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21425198,"hash":"ba3d32f1","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":1}],"referencePar":8,"moveLimit":16},
  // 第 148 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["11..11","....11","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21433117,"hash":"9a2e3f8d","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"referencePar":8,"moveLimit":16},
  // 第 149 关 · 4 列 × 5 行 · 参考解 8 步
  {"map":["1111","1111","..11","1111","..11"],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21441036,"hash":"1973ef3b","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":2,"dir":-1}],"referencePar":8},
  // 第 150 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["..1111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":21448955,"hash":"1e261c1f","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":1}],"referencePar":10,"moveLimit":18},
  // 第 151 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","11..11","11..11","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":8,"seed":21456874,"hash":"5835f401","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"referencePar":10},
  // 第 152 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["111111","1111..","..1111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21464793,"hash":"694fed35","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"referencePar":11,"moveLimit":19},
  // 第 153 关 · 5 列 × 6 行 · 参考解 10 步
  {"map":["11111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":8,"scramble":10,"seed":21472712,"hash":"43bc1eeb","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":1}],"referencePar":10,"moveLimit":18},
  // 第 154 关 · 5 列 × 6 行 · 参考解 6 步
  {"map":["..111","11111","11111","11111","11111","11111"],"lockR":[],"lockC":[],"faces":7,"scramble":11,"seed":21480631,"hash":"701d4e8f","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":2,"dir":-1}],"referencePar":6,"moveLimit":14},
  // 第 155 关 · 4 列 × 5 行 · 参考解 4 步
  {"map":["1111","..11","..11","11..","11.."],"lockR":[],"lockC":[],"faces":8,"scramble":8,"seed":21488550,"hash":"6a0669e9","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":2,"dir":-1}],"referencePar":4},
  // 第 156 关 · 5 列 × 6 行 · 参考解 8 步
  {"map":["11111","11111","1111.","..11.","11111","11..1"],"lockR":[],"lockC":[],"faces":6,"scramble":8,"seed":21496469,"hash":"5ca700c5","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":2,"dir":1}],"referencePar":8},
  // 第 157 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21504388,"hash":"7086d697","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"referencePar":9,"moveLimit":17},
  // 第 158 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","..1111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":10,"seed":21512307,"hash":"c811f833","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"referencePar":10,"moveLimit":18},
  // 第 159 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","..1111","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":11,"seed":21520226,"hash":"4f1c431d","chapter":7,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":1}],"referencePar":10,"moveLimit":18},
  // 第 160 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","1111..","111111","..1111","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21528145,"hash":"523a8e25","chapter":7,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"referencePar":12,"moveLimit":20},
  // 第 161 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":9,"seed":21536064,"hash":"1339add7","chapter":8,"energy":true,"floors":[{"r":2,"c":0,"kind":"dew","need":1},{"r":0,"c":0,"kind":"dew","need":1},{"r":6,"c":5,"kind":"dew","need":1},{"r":2,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9,"intro":"ctip:8"},
  // 第 162 关 · 6 列 × 7 行 · 参考解 8 步
  {"map":["..1111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":21543983,"hash":"38b89709","chapter":8,"energy":true,"floors":[{"r":4,"c":0,"kind":"dew","need":1},{"r":2,"c":5,"kind":"dew","need":1},{"r":2,"c":1,"kind":"dew","need":1},{"r":1,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8,"moveLimit":16},
  // 第 163 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["11..11","111111","111111","111111","1111..","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":21551902,"hash":"685b812f","chapter":8,"energy":true,"floors":[{"r":1,"c":3,"kind":"dew","need":1},{"r":6,"c":2,"kind":"dew","need":1},{"r":5,"c":1,"kind":"dew","need":1},{"r":0,"c":4,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11,"moveLimit":19},
  // 第 164 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["111111","111111","111111","111111","111111","..11..","11..11"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21559821,"hash":"3d74f28d","chapter":8,"energy":true,"floors":[{"r":0,"c":0,"kind":"dew","need":1},{"r":4,"c":2,"kind":"dew","need":1},{"r":0,"c":1,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11,"moveLimit":19},
  // 第 165 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":21567740,"hash":"d0c35f85","chapter":8,"energy":true,"floors":[{"r":1,"c":1,"kind":"dew","need":1},{"r":1,"c":4,"kind":"dew","need":1},{"r":7,"c":4,"kind":"dew","need":1},{"r":7,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 166 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111111","111111","111111","11..11","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":9,"seed":21575659,"hash":"6f9de3cb","chapter":8,"energy":true,"floors":[{"r":0,"c":1,"kind":"dew","need":1},{"r":4,"c":3,"kind":"dew","need":1},{"r":6,"c":1,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10},
  // 第 167 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","..1111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":10,"seed":21583578,"hash":"39bf3551","chapter":8,"energy":true,"floors":[{"r":5,"c":4,"kind":"dew","need":1},{"r":3,"c":4,"kind":"dew","need":1},{"r":2,"c":1,"kind":"dew","need":1},{"r":3,"c":1,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 168 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","..11..","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":11,"scramble":11,"seed":21591497,"hash":"48d22991","chapter":8,"energy":true,"floors":[{"r":2,"c":3,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1},{"r":1,"c":4,"kind":"dew","need":1},{"r":7,"c":2,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 169 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","..1111","11..11","111111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21599416,"hash":"67c1dd85","chapter":8,"energy":true,"floors":[{"r":3,"c":1,"kind":"dew","need":1},{"r":4,"c":4,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1},{"r":2,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8},
  // 第 170 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","..11111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":21607335,"hash":"a3b40c63","chapter":8,"energy":true,"floors":[{"r":1,"c":5,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1},{"r":7,"c":2,"kind":"dew","need":1},{"r":7,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 171 关 · 7 列 × 8 行 · 参考解 11 步
  {"map":["1111111","1111111","..1111.","111111.","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":9,"seed":21615254,"hash":"612562df","chapter":8,"energy":true,"floors":[{"r":1,"c":1,"kind":"dew","need":1},{"r":4,"c":2,"kind":"dew","need":1},{"r":5,"c":2,"kind":"dew","need":1},{"r":7,"c":6,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11},
  // 第 172 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111111","1111..1","..11111","..11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":10,"seed":21623173,"hash":"0f64ac37","chapter":8,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":2,"c":4,"kind":"dew","need":1},{"r":3,"c":0,"kind":"dew","need":1},{"r":7,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 173 关 · 6 列 × 7 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":11,"seed":21631092,"hash":"66b74231","chapter":8,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":2,"c":3,"kind":"dew","need":1},{"r":3,"c":5,"kind":"dew","need":1},{"r":5,"c":2,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 174 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":21639011,"hash":"d704496f","chapter":8,"energy":true,"floors":[{"r":1,"c":2,"kind":"dew","need":1},{"r":5,"c":4,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1},{"r":6,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12,"moveLimit":20},
  // 第 175 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["1111..","1111..","..1111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":8,"scramble":9,"seed":21646930,"hash":"0b1a630f","chapter":8,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":4,"c":2,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1},{"r":3,"c":1,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":8},
  // 第 176 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","11..11","111111","11..11","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21654849,"hash":"d0c32655","chapter":8,"energy":true,"floors":[{"r":1,"c":5,"kind":"dew","need":1},{"r":6,"c":0,"kind":"dew","need":1},{"r":3,"c":5,"kind":"dew","need":1},{"r":0,"c":3,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9},
  // 第 177 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":10,"seed":21662768,"hash":"b831a4a7","chapter":8,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":5,"c":3,"kind":"dew","need":1},{"r":3,"c":0,"kind":"dew","need":1},{"r":3,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 178 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","1111..","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":11,"seed":21670687,"hash":"b03f7491","chapter":8,"energy":true,"floors":[{"r":3,"c":1,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1},{"r":0,"c":3,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11,"moveLimit":19},
  // 第 179 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["1111..","111111","..1111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":21678606,"hash":"2ac33197","chapter":8,"energy":true,"floors":[{"r":2,"c":4,"kind":"dew","need":1},{"r":4,"c":0,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1},{"r":0,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12,"moveLimit":20},
  // 第 180 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111..1","1111111","1111111","11..111","1111..1"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":21686525,"hash":"d4e7ac87","chapter":8,"energy":true,"floors":[{"r":2,"c":2,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1},{"r":6,"c":0,"kind":"dew","need":1},{"r":7,"c":3,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 181 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":9,"seed":21694444,"hash":"2ab2479f","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":11,"intro":"ctip:9"},
  // 第 182 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","1111..","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":21702363,"hash":"b8a35f23","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":3,"face":"4s","count":2}],"referencePar":9,"moveLimit":17},
  // 第 183 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","..11..","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":21710282,"hash":"14b8e865","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":9,"moveLimit":17},
  // 第 184 关 · 6 列 × 7 行 · 参考解 8 步
  {"map":["111111","11..11","..1111","111111","1111..","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":12,"seed":21718201,"hash":"5ad57ef3","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":3,"face":"9s","count":2}],"referencePar":8,"moveLimit":16},
  // 第 185 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":21726120,"hash":"9e42a4eb","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":12,"moveLimit":20},
  // 第 186 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["1111..","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":9,"seed":21734039,"hash":"e54cbbfd","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":13},
  // 第 187 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","11..11","..1111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":10,"seed":21741958,"hash":"ffc03111","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":11,"moveLimit":19},
  // 第 188 关 · 6 列 × 8 行 · 参考解 8 步
  {"map":["11....","111111","11..11","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":11,"seed":21749877,"hash":"426275ff","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":8,"moveLimit":16},
  // 第 189 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","..11..","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21757796,"hash":"a3869de1","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":9},
  // 第 190 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","1111111","1111111","1111111","..11111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":21765715,"hash":"e265f101","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":16,"moveLimit":24},
  // 第 191 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["..11111","1111111","1111111","1111111","1111111","1111111","..11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":9,"seed":21773634,"hash":"cde0a7b5","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":12},
  // 第 192 关 · 7 列 × 8 行 · 参考解 11 步
  {"map":["1111..1","1111111","1111111","1111111","1111111","1111111","111111.","..1111."],"lockR":[],"lockC":[],"faces":13,"scramble":10,"seed":21781553,"hash":"9a70c90f","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":11,"moveLimit":19},
  // 第 193 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":11,"seed":21789472,"hash":"fe15d1a3","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":10,"moveLimit":18},
  // 第 194 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":21797391,"hash":"d94b5d49","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":3,"face":"4s","count":2}],"referencePar":9,"moveLimit":17},
  // 第 195 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["..1111","1111..","111111","11....","111111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21805310,"hash":"1525fa9f","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":9},
  // 第 196 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","11..11","11..11","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":9,"seed":21813229,"hash":"ee480b65","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":3,"face":"9s","count":2}],"referencePar":13},
  // 第 197 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":10,"seed":21821148,"hash":"92c23c1d","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":11,"moveLimit":19},
  // 第 198 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111111","111111","111111","111111","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":11,"seed":21829067,"hash":"788c061f","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":10,"moveLimit":18},
  // 第 199 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","11..11","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":21836986,"hash":"135ddca3","chapter":9,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":13,"moveLimit":21},
  // 第 200 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","11..111","1111111","1111111","1111..1","11..111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":21844905,"hash":"2518bb49","chapter":9,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":16,"moveLimit":24},
  // 第 201 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["221111","111122","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":10,"seed":21852824,"hash":"df65404b","chapter":10,"energy":true,"floors":[{"r":5,"c":2,"kind":"flower","need":1},{"r":2,"c":0,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"intro":"ctip:10"},
  // 第 202 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["112211","111111","111111","111111","111111","..1122","112211"],"lockR":[],"lockC":[],"faces":12,"scramble":11,"seed":21860743,"hash":"0178e773","chapter":10,"energy":true,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1},{"r":6,"c":1,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11,"moveLimit":19},
  // 第 203 关 · 6 列 × 7 行 · 参考解 15 步
  {"map":["222211","111111","11..11","112211","111111","2211..","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":21868662,"hash":"57e4bd59","chapter":10,"energy":true,"floors":[{"r":4,"c":2,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":4,"c":4,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 204 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["112211","111111","1111..","..1111","111111","111111","1122.."],"lockR":[],"lockC":[],"faces":10,"scramble":13,"seed":21876581,"hash":"41c2559b","chapter":10,"energy":true,"floors":[{"r":3,"c":3,"kind":"flower","need":1},{"r":0,"c":5,"kind":"flower","need":1},{"r":2,"c":2,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 205 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111122","221111","111111","111111","111111","221111"],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":21884500,"hash":"fe6ef2d5","chapter":10,"energy":true,"floors":[{"r":5,"c":0,"kind":"flower","need":1},{"r":7,"c":4,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 206 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","1111..","221111","112211","221111","221111","111111","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":10,"seed":21892419,"hash":"7b7fcf93","chapter":10,"energy":true,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":6,"c":2,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13},
  // 第 207 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["..1111","111111","111111","111111","111111","111111","112211","11..22"],"lockR":[],"lockC":[],"faces":12,"scramble":11,"seed":21900338,"hash":"49c80551","chapter":10,"energy":true,"floors":[{"r":3,"c":0,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":3,"c":5,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12,"moveLimit":20},
  // 第 208 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["112211","221111","..2211","111111","111111","111111","111111","..11.."],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":21908257,"hash":"d03743e7","chapter":10,"energy":true,"floors":[{"r":3,"c":0,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 209 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["112211","111111","111111","221122","1111..","1122.."],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":21916176,"hash":"bfd0ae15","chapter":10,"energy":true,"floors":[{"r":0,"c":3,"kind":"flower","need":1},{"r":2,"c":2,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11},
  // 第 210 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","11..111","1122111","1111111","1111221","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":21924095,"hash":"bee38b83","chapter":10,"energy":true,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 211 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["1111112","11..112","1111111","1111111","1122111","1111111","..11111","2211111"],"lockR":[],"lockC":[],"faces":15,"scramble":10,"seed":21932014,"hash":"70814ca3","chapter":10,"energy":true,"floors":[{"r":2,"c":5,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12},
  // 第 212 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["2211111","11..111","1111..1","1111111","2211111","1122111","1111111","2211..1"],"lockR":[],"lockC":[],"faces":15,"scramble":11,"seed":21939933,"hash":"df55863f","chapter":10,"energy":true,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":2,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":1,"c":6,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 213 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["221111","111111","111111","112211","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":21947852,"hash":"eda40e4f","chapter":10,"energy":true,"floors":[{"r":0,"c":3,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1},{"r":0,"c":5,"kind":"flower","need":1},{"r":2,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 214 关 · 6 列 × 7 行 · 参考解 14 步
  {"map":["111111","111111","11..22","111122","111111","111122","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":21955771,"hash":"b707f7cb","chapter":10,"energy":true,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":3,"c":5,"kind":"flower","need":1},{"r":3,"c":3,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 215 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["2222..","111111","..1111","..2211","11..11","112211"],"lockR":[],"lockC":[],"faces":9,"scramble":10,"seed":21963690,"hash":"5f4803ef","chapter":10,"energy":true,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1},{"r":1,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":9},
  // 第 216 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["1111..","111122","1111..","111122","11..11","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":21971609,"hash":"5bcfe06f","chapter":10,"energy":true,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":3,"c":1,"kind":"flower","need":1},{"r":0,"c":2,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10},
  // 第 217 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111122","111111","111111","221111","111122","111111","111111","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":11,"seed":21979528,"hash":"5fa42903","chapter":10,"energy":true,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":2,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 218 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["1111..","111111","111111","221111","112222","221111","111111","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":12,"seed":21987447,"hash":"9499c8cf","chapter":10,"energy":true,"floors":[{"r":3,"c":2,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 219 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","222211","..1111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":21995366,"hash":"457ce09b","chapter":10,"energy":true,"floors":[{"r":3,"c":3,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 220 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1122111","1111111","111111.","11..11.","1111111","1111221","2211111","1111..1"],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":22003285,"hash":"d2ae7fab","chapter":10,"energy":true,"floors":[{"r":2,"c":1,"kind":"flower","need":1},{"r":7,"c":6,"kind":"flower","need":1},{"r":2,"c":4,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 221 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","112211","112211","222222","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":10,"seed":22011204,"hash":"834da235","chapter":11,"energy":true,"floors":[{"r":5,"c":2,"kind":"bud","need":2},{"r":6,"c":2,"kind":"bud","need":2},{"r":3,"c":0,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":13,"intro":"ctip:11"},
  // 第 222 关 · 6 列 × 7 行 · 参考解 11 步
  {"map":["1111..","112211","111122","111111","112211","111122","112211"],"lockR":[],"lockC":[],"faces":13,"scramble":11,"seed":22019123,"hash":"171039e1","chapter":11,"energy":true,"floors":[{"r":1,"c":3,"kind":"bud","need":2},{"r":3,"c":4,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":11,"moveLimit":19},
  // 第 223 关 · 6 列 × 7 行 · 参考解 14 步
  {"map":["111122","112211","111111","221122","..1111","..2211","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":22027042,"hash":"44b520b1","chapter":11,"energy":true,"floors":[{"r":1,"c":1,"kind":"bud","need":2},{"r":4,"c":2,"kind":"bud","need":2},{"r":1,"c":5,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"moveLimit":22},
  // 第 224 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["112222","11..22","111111","1111..","111111","111111","22..22"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":22034961,"hash":"abb3317b","chapter":11,"energy":true,"floors":[{"r":5,"c":4,"kind":"bud","need":2},{"r":0,"c":4,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":10,"moveLimit":18},
  // 第 225 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111111","111111","111111","112211","222211","111111","112211","111122"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":22042880,"hash":"3ef67655","chapter":11,"energy":true,"floors":[{"r":4,"c":4,"kind":"bud","need":2},{"r":0,"c":2,"kind":"bud","need":2},{"r":4,"c":0,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":10,"moveLimit":18},
  // 第 226 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["221111","..1111","111111","111111","111122","111122","112222","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":10,"seed":22050799,"hash":"a615a891","chapter":11,"energy":true,"floors":[{"r":7,"c":1,"kind":"bud","need":2},{"r":6,"c":5,"kind":"bud","need":2},{"r":0,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":13},
  // 第 227 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","221111","111111","1122..","222211","111111","111111","1122.."],"lockR":[],"lockC":[],"faces":14,"scramble":11,"seed":22058718,"hash":"55cbe3db","chapter":11,"energy":true,"floors":[{"r":4,"c":2,"kind":"bud","need":2},{"r":6,"c":0,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":15,"moveLimit":23},
  // 第 228 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["..1111","111111","..2211","221122","111111","11..22","111111","111122"],"lockR":[],"lockC":[],"faces":13,"scramble":12,"seed":22066637,"hash":"ae6a3d45","chapter":11,"energy":true,"floors":[{"r":2,"c":5,"kind":"bud","need":2},{"r":6,"c":4,"kind":"bud","need":2},{"r":6,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":12,"moveLimit":20},
  // 第 229 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["112222","11..22","111111","111111","11..11","222211"],"lockR":[],"lockC":[],"faces":11,"scramble":10,"seed":22074556,"hash":"882c130d","chapter":11,"energy":true,"floors":[{"r":3,"c":4,"kind":"bud","need":2},{"r":2,"c":0,"kind":"bud","need":2},{"r":5,"c":5,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":8},
  // 第 230 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1122111","1111..1","1111111","1122111","2211111","2211111","1111221","1111111"],"lockR":[],"lockC":[],"faces":16,"scramble":14,"seed":22082475,"hash":"dfad525b","chapter":11,"energy":true,"floors":[{"r":4,"c":6,"kind":"bud","need":2},{"r":0,"c":1,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":15,"moveLimit":23},
  // 第 231 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["2211111","1111111","1111111","1122111","221111.","111111.","2211111","1122..1"],"lockR":[],"lockC":[],"faces":16,"scramble":10,"seed":22090394,"hash":"6c398e55","chapter":11,"energy":true,"floors":[{"r":3,"c":3,"kind":"bud","need":2},{"r":4,"c":0,"kind":"bud","need":2},{"r":7,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14},
  // 第 232 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["111111.","112211.","112211.","112211.","1111111","1111..1","2222111","1111111"],"lockR":[],"lockC":[],"faces":15,"scramble":11,"seed":22098313,"hash":"9c148267","chapter":11,"energy":true,"floors":[{"r":2,"c":3,"kind":"bud","need":2},{"r":1,"c":1,"kind":"bud","need":2},{"r":3,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":12,"moveLimit":20},
  // 第 233 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["112211","111111","111111","221122","112211","111111","221111"],"lockR":[],"lockC":[],"faces":13,"scramble":12,"seed":22106232,"hash":"05a06d2d","chapter":11,"energy":true,"floors":[{"r":4,"c":5,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2},{"r":4,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":12,"moveLimit":20},
  // 第 234 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111122","221111","112211","111122","111111","1111..","112211"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":22114151,"hash":"6cf6a7f3","chapter":11,"energy":true,"floors":[{"r":4,"c":5,"kind":"bud","need":2},{"r":2,"c":3,"kind":"bud","need":2},{"r":5,"c":0,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":13,"moveLimit":21},
  // 第 235 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["221122","1122..","111122","11..11","1122..","11..11"],"lockR":[],"lockC":[],"faces":10,"scramble":10,"seed":22122070,"hash":"8e6ee8e3","chapter":11,"energy":true,"floors":[{"r":1,"c":2,"kind":"bud","need":2},{"r":0,"c":4,"kind":"bud","need":2},{"r":3,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":8},
  // 第 236 关 · 6 列 × 7 行 · 参考解 10 步
  {"map":["1122..","111122","111122","..1111","22..11","111111","112211"],"lockR":[],"lockC":[],"faces":12,"scramble":10,"seed":22129989,"hash":"89948145","chapter":11,"energy":true,"floors":[{"r":6,"c":3,"kind":"bud","need":2},{"r":1,"c":3,"kind":"bud","need":2},{"r":0,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":10},
  // 第 237 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["221111","221111","111111","112211","112211","111111","221111","111111"],"lockR":[],"lockC":[],"faces":15,"scramble":11,"seed":22137908,"hash":"608559f7","chapter":11,"energy":true,"floors":[{"r":1,"c":3,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2},{"r":1,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":11,"moveLimit":19},
  // 第 238 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","112211","111111","221111","221122","111111","22..11"],"lockR":[],"lockC":[],"faces":14,"scramble":12,"seed":22145827,"hash":"63f356f1","chapter":11,"energy":true,"floors":[{"r":0,"c":2,"kind":"bud","need":2},{"r":5,"c":5,"kind":"bud","need":2},{"r":5,"c":0,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":11,"moveLimit":19},
  // 第 239 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111122","111111","111122","1111..","11..11","221111","111111","112222"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":22153746,"hash":"14548943","chapter":11,"energy":true,"floors":[{"r":0,"c":3,"kind":"bud","need":2},{"r":1,"c":4,"kind":"bud","need":2}],"goal":{"kind":"garden","count":2},"referencePar":10,"moveLimit":18},
  // 第 240 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["2211111","1122111","111111.","112211.","1111111","11....1","1111222","1111112"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":22161665,"hash":"b1bbd5cb","chapter":11,"energy":true,"floors":[{"r":1,"c":3,"kind":"bud","need":2},{"r":7,"c":6,"kind":"bud","need":2},{"r":7,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"moveLimit":22},
  // 第 241 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":11,"seed":22169584,"hash":"1f1f0a9b","chapter":12,"energy":true,"ice":1,"floors":[{"r":4,"c":0,"kind":"flower","need":1},{"r":6,"c":0,"kind":"flower","need":1},{"r":0,"c":4,"kind":"flower","need":1},{"r":6,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12,"intro":"ctip:12"},
  // 第 242 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","111111","111111","1111..","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":22177503,"hash":"8b93467f","chapter":12,"energy":true,"ice":1,"floors":[{"r":0,"c":5,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1},{"r":5,"c":5,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 243 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","111111","111111","11..11","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":13,"seed":22185422,"hash":"c25d075d","chapter":12,"energy":true,"ice":1,"floors":[{"r":5,"c":4,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1},{"r":3,"c":0,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 244 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","..1111","..1111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":14,"seed":22193341,"hash":"bfda82bf","chapter":12,"energy":true,"ice":1,"floors":[{"r":5,"c":5,"kind":"flower","need":1},{"r":2,"c":4,"kind":"flower","need":1},{"r":3,"c":5,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 245 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":22201260,"hash":"88a47131","chapter":12,"energy":true,"ice":1,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1},{"r":1,"c":5,"kind":"flower","need":1},{"r":4,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12,"moveLimit":20},
  // 第 246 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":11,"seed":22209179,"hash":"9a6105f9","chapter":12,"energy":true,"ice":2,"floors":[{"r":0,"c":1,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":6,"c":4,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13},
  // 第 247 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","..1111","1111..","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":22217098,"hash":"bedc08d5","chapter":12,"energy":true,"ice":2,"ice2":1,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":7,"c":1,"kind":"flower","need":1},{"r":6,"c":4,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 248 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["11..11","111111","111111","1111..","111111","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":22225017,"hash":"80194fa5","chapter":12,"energy":true,"ice":2,"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":4,"c":3,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 249 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["1111..","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":22232936,"hash":"f0509dd7","chapter":12,"energy":true,"ice":1,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":3,"c":3,"kind":"flower","need":1},{"r":5,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11},
  // 第 250 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","..11111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":22240855,"hash":"6ceafb9f","chapter":12,"energy":true,"ice":2,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":6,"c":6,"kind":"flower","need":1},{"r":7,"c":3,"kind":"flower","need":1},{"r":7,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 251 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111..1","11..111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":11,"seed":22248774,"hash":"18fd934f","chapter":12,"energy":true,"ice":3,"floors":[{"r":2,"c":6,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":5,"c":1,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15},
  // 第 252 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","11..11.","111111.","1111111","1111111","..11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":12,"seed":22256693,"hash":"8f4b4ed1","chapter":12,"energy":true,"ice":3,"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":1,"c":4,"kind":"flower","need":1},{"r":3,"c":3,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 253 关 · 6 列 × 7 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":22264612,"hash":"a69b2835","chapter":12,"energy":true,"ice":3,"floors":[{"r":5,"c":0,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 254 关 · 6 列 × 7 行 · 参考解 15 步
  {"map":["111111","111111","111111","11..11","111111","111111","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":14,"seed":22272531,"hash":"0569e417","chapter":12,"energy":true,"ice":3,"ice2":1,"floors":[{"r":1,"c":1,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":2,"c":0,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 255 关 · 6 列 × 6 行 · 参考解 10 步
  {"map":["111111","1111..","111111","11..11","11..11","11..11"],"lockR":[],"lockC":[],"faces":10,"scramble":11,"seed":22280450,"hash":"d97af9dd","chapter":12,"energy":true,"ice":1,"floors":[{"r":0,"c":1,"kind":"flower","need":1},{"r":2,"c":4,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10},
  // 第 256 关 · 6 列 × 7 行 · 参考解 14 步
  {"map":["111111","111111","111111","11....","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":9,"scramble":11,"seed":22288369,"hash":"0f9011b5","chapter":12,"energy":true,"ice":4,"floors":[{"r":4,"c":0,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1},{"r":2,"c":4,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14},
  // 第 257 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":22296288,"hash":"abee448f","chapter":12,"energy":true,"ice":4,"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1},{"r":5,"c":1,"kind":"flower","need":1},{"r":5,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 258 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":22304207,"hash":"6a6363bd","chapter":12,"energy":true,"ice":4,"floors":[{"r":4,"c":2,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":5,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 259 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["..1111","111111","111111","111111","111111","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":14,"seed":22312126,"hash":"1ef2c4f1","chapter":12,"energy":true,"ice":4,"floors":[{"r":4,"c":2,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":2,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 260 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","1111111","1111111","..11...","111111.","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":22320045,"hash":"2d422715","chapter":12,"energy":true,"ice":4,"floors":[{"r":0,"c":3,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1},{"r":6,"c":6,"kind":"flower","need":1},{"r":7,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 261 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[3],"faces":11,"scramble":11,"seed":22327964,"hash":"260379ad","chapter":13,"energy":true,"referencePar":9,"intro":"ctip:13"},
  // 第 262 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","11..11","111111"],"lockR":[3],"lockC":[],"faces":10,"scramble":12,"seed":22335883,"hash":"e66504c3","chapter":13,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 263 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","11..11","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[3],"faces":10,"scramble":13,"seed":22343802,"hash":"afeb98c3","chapter":13,"energy":true,"referencePar":12,"moveLimit":20},
  // 第 264 关 · 6 列 × 7 行 · 参考解 9 步
  {"map":["11..11","..1111","111111","111111","..1111","111111","111111"],"lockR":[3],"lockC":[],"faces":9,"scramble":14,"seed":22351721,"hash":"792b582d","chapter":13,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 265 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[3],"faces":12,"scramble":15,"seed":22359640,"hash":"bed2c16f","chapter":13,"energy":true,"referencePar":14,"moveLimit":22},
  // 第 266 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["111111","..1111","111111","111111","111111","111111","111111","111111"],"lockR":[4],"lockC":[],"faces":12,"scramble":11,"seed":22367559,"hash":"ff800f3f","chapter":13,"energy":true,"referencePar":12},
  // 第 267 关 · 6 列 × 8 行 · 参考解 9 步
  {"map":["111111","111111","1111..","111111","111111","111111","111111","11..11"],"lockR":[],"lockC":[3],"faces":11,"scramble":12,"seed":22375478,"hash":"5e0d63e1","chapter":13,"energy":true,"referencePar":9,"moveLimit":17},
  // 第 268 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","..1111","111111","..1111","11..11"],"lockR":[4],"lockC":[],"faces":11,"scramble":13,"seed":22383397,"hash":"55cd3aa5","chapter":13,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 269 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","111111","111111","11....","111111","111111"],"lockR":[],"lockC":[3],"faces":10,"scramble":11,"seed":22391316,"hash":"e5195a6d","chapter":13,"energy":true,"referencePar":8},
  // 第 270 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111111","1111..1","1111111","1111111","1111111"],"lockR":[4],"lockC":[],"faces":14,"scramble":15,"seed":22399235,"hash":"8c068ccd","chapter":13,"energy":true,"referencePar":14,"moveLimit":22},
  // 第 271 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","11..111","1111111","1111..1","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[3],"faces":13,"scramble":11,"seed":22407154,"hash":"21c205d5","chapter":13,"energy":true,"referencePar":15},
  // 第 272 关 · 7 列 × 8 行 · 参考解 13 步
  {"map":["11..111","..11111","1111111","1111..1","1111111","1111111","1111111","1111111"],"lockR":[4],"lockC":[],"faces":13,"scramble":12,"seed":22415073,"hash":"a070f97d","chapter":13,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 273 关 · 6 列 × 7 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[3],"faces":11,"scramble":13,"seed":22422992,"hash":"65997575","chapter":13,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 274 关 · 6 列 × 7 行 · 参考解 14 步
  {"map":["..1111","111111","111111","111111","111111","111111","111111"],"lockR":[3],"lockC":[],"faces":10,"scramble":14,"seed":22430911,"hash":"a888d39d","chapter":13,"energy":true,"referencePar":14,"moveLimit":22},
  // 第 275 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["....11","....11","111111","111111","111111","111111"],"lockR":[],"lockC":[3],"faces":10,"scramble":11,"seed":22438830,"hash":"1b4757e3","chapter":13,"energy":true,"referencePar":11},
  // 第 276 关 · 6 列 × 7 行 · 参考解 12 步
  {"map":["111111","111111","111111","1111..","11....","111111","111111"],"lockR":[3],"lockC":[],"faces":9,"scramble":11,"seed":22446749,"hash":"e367b499","chapter":13,"energy":true,"referencePar":12},
  // 第 277 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[3],"faces":12,"scramble":12,"seed":22454668,"hash":"b1edd9a7","chapter":13,"energy":true,"referencePar":12,"moveLimit":20},
  // 第 278 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","1111..","111111","111111","111111","111111","111111"],"lockR":[4],"lockC":[],"faces":12,"scramble":13,"seed":22462587,"hash":"b0165e17","chapter":13,"energy":true,"referencePar":11,"moveLimit":19},
  // 第 279 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","..1111","111111","..1111","111111","111111"],"lockR":[],"lockC":[3],"faces":11,"scramble":14,"seed":22470506,"hash":"2f2d7303","chapter":13,"energy":true,"referencePar":15,"moveLimit":23},
  // 第 280 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["..11111","1111111","1111111","11..111","111111.","111111.","1111111","1111111"],"lockR":[4],"lockC":[],"faces":13,"scramble":15,"seed":22478425,"hash":"07d2eedd","chapter":13,"energy":true,"referencePar":15,"moveLimit":23},
  // 第 281 关 · 6 列 × 8 行 · 参考解 7 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":22486344,"hash":"0950f83d","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":7,"intro":"ctip:14"},
  // 第 282 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":22494263,"hash":"e8141ab5","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":16,"moveLimit":24},
  // 第 283 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["1111..","111111","111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":14,"seed":22502182,"hash":"e98dd539","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":14,"moveLimit":22},
  // 第 284 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["11..11","111111","111111","111111","111111","111111","1111..","11..11"],"lockR":[],"lockC":[],"faces":11,"scramble":15,"seed":22510101,"hash":"295cd6bb","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":10,"moveLimit":18},
  // 第 285 关 · 7 列 × 8 行 · 参考解 11 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":22518020,"hash":"599055dd","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":11,"moveLimit":19},
  // 第 286 关 · 7 列 × 8 行 · 参考解 20 步
  {"map":["1111111","1111111","1111111","1111111","111111.","111111.","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":12,"seed":22525939,"hash":"ea1a0cf3","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":20},
  // 第 287 关 · 7 列 × 8 行 · 参考解 11 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","11....1","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":22533858,"hash":"256d282b","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":11,"moveLimit":19},
  // 第 288 关 · 7 列 × 8 行 · 参考解 8 步
  {"map":["1111111","1111111","1111111","1111111","1111..1","11..111","..11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":14,"seed":22541777,"hash":"4bd87c65","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":8,"moveLimit":16},
  // 第 289 关 · 6 列 × 6 行 · 参考解 9 步
  {"map":["111111","111111","111111","111111","1111..","1111.."],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":22549696,"hash":"83ea8a51","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":9},
  // 第 290 关 · 8 列 × 8 行 · 参考解 14 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11..1111"],"lockR":[],"lockC":[],"faces":16,"scramble":16,"seed":22557615,"hash":"42f0ea43","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":14,"moveLimit":22},
  // 第 291 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["11111111","11111111","11111111","..111111","11111111","1111..11","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":12,"seed":22565534,"hash":"0ca2b593","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":17},
  // 第 292 关 · 8 列 × 8 行 · 参考解 11 步
  {"map":["11..1111","111111..","11111111","111111..","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":13,"seed":22573453,"hash":"986a6bc1","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":11,"moveLimit":19},
  // 第 293 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":22581372,"hash":"b6d2ceed","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":13,"moveLimit":21},
  // 第 294 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","11..11","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":22589291,"hash":"39ccff67","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":14,"moveLimit":22},
  // 第 295 关 · 6 列 × 6 行 · 参考解 8 步
  {"map":["111111","1111..","111111","111111","......","111111"],"lockR":[],"lockC":[],"faces":10,"scramble":12,"seed":22597210,"hash":"a7c16cab","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":8},
  // 第 296 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["111111","11..11","11..11","111111","111111","111111","111111","1111.."],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":22605129,"hash":"1b10dbb3","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":10},
  // 第 297 关 · 7 列 × 8 行 · 参考解 19 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":22613048,"hash":"0c1a1b83","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":19,"moveLimit":28},
  // 第 298 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111..1","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":22620967,"hash":"62d2c803","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":14,"moveLimit":22},
  // 第 299 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["1111111","..11111","1111111","1111111","1111111","1111111","111111.","111111."],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":22628886,"hash":"c304c0a3","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":12,"moveLimit":20},
  // 第 300 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["..111111","11111111","11111111","111111..","1111..11","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":16,"seed":22636805,"hash":"f2dbfe47","chapter":14,"energy":true,"flowers":true,"wild":true,"goal":{"kind":"face","face":"f1*","count":1},"referencePar":17,"moveLimit":25},
  // 第 301 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":12,"seed":22644724,"hash":"133b2c15","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":15,"intro":"ctip:15"},
  // 第 302 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","11..11","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":22652643,"hash":"c311635f","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":15,"moveLimit":23},
  // 第 303 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","..1111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":11,"scramble":14,"seed":22660562,"hash":"4d7cee37","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":15,"moveLimit":23},
  // 第 304 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","11..11","11..11","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":15,"seed":22668481,"hash":"f0d98f5f","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":15,"moveLimit":23},
  // 第 305 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":22676400,"hash":"ff6cda39","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":15,"moveLimit":23},
  // 第 306 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["11..111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":12,"seed":22684319,"hash":"a571d7e3","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":17},
  // 第 307 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","11..111","1111111","1111111","1111111","1111..1","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":22692238,"hash":"79a0706f","chapter":15,"energy":true,"ice":2,"ice2":1,"bombs":1,"referencePar":14,"moveLimit":22},
  // 第 308 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","1111..1","11..111","1111111","1111111","1111111","..11111"],"lockR":[],"lockC":[],"faces":13,"scramble":14,"seed":22700157,"hash":"36063fcb","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":16,"moveLimit":24},
  // 第 309 关 · 6 列 × 6 行 · 参考解 14 步
  {"map":["111111","11..11","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":22708076,"hash":"b678483b","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":14},
  // 第 310 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["11..1111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":16,"scramble":16,"seed":22715995,"hash":"f597a777","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":17,"moveLimit":25},
  // 第 311 关 · 8 列 × 8 行 · 参考解 14 步
  {"map":["11111111","..111111","11111111","11111111","11111111","11..1111","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":12,"seed":22723914,"hash":"33cf5459","chapter":15,"energy":true,"ice":3,"bombs":1,"referencePar":14},
  // 第 312 关 · 8 列 × 8 行 · 参考解 14 步
  {"map":["11111111","111111..","11111111","11..1111","11111111","11111111","..111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":13,"seed":22731833,"hash":"db9bfa69","chapter":15,"energy":true,"ice":3,"bombs":1,"referencePar":14,"moveLimit":22},
  // 第 313 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":22739752,"hash":"c5e5ce37","chapter":15,"energy":true,"ice":3,"bombs":1,"referencePar":16,"moveLimit":24},
  // 第 314 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["..1111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":22747671,"hash":"08987dff","chapter":15,"energy":true,"ice":3,"ice2":1,"bombs":1,"referencePar":18,"moveLimit":27},
  // 第 315 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["111111","111111","111111","..1111","11....","..1111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":22755590,"hash":"1b3a217f","chapter":15,"energy":true,"ice":2,"bombs":1,"referencePar":11},
  // 第 316 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["..1111","111111","111111","111111","..1111","11..11","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":12,"seed":22763509,"hash":"b7d81bd1","chapter":15,"energy":true,"ice":4,"bombs":1,"referencePar":18},
  // 第 317 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":22771428,"hash":"d30562f9","chapter":15,"energy":true,"ice":4,"bombs":1,"referencePar":16,"moveLimit":24},
  // 第 318 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","111111.","111111."],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":22779347,"hash":"d8e6147f","chapter":15,"energy":true,"ice":4,"bombs":1,"referencePar":15,"moveLimit":23},
  // 第 319 关 · 7 列 × 8 行 · 参考解 18 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111..1","1111111","11..111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":22787266,"hash":"550b6f23","chapter":15,"energy":true,"ice":4,"bombs":1,"referencePar":18,"moveLimit":27},
  // 第 320 关 · 8 列 × 8 行 · 参考解 18 步
  {"map":["11111111","11..1111","11111111","1111..11","11..1111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":16,"seed":22795185,"hash":"b69254ff","chapter":15,"energy":true,"ice":4,"bombs":1,"referencePar":18,"moveLimit":27},
  // 第 321 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":22803104,"hash":"ed0af8a3","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["4s"],"count":1},"referencePar":11,"intro":"ctip:16"},
  // 第 322 关 · 6 列 × 8 行 · 参考解 11 步
  {"map":["111111","111111","11..11","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":22811023,"hash":"fe67baf7","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["9s"],"count":1},"referencePar":11,"moveLimit":19},
  // 第 323 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["11..11","111111","111111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":15,"seed":22818942,"hash":"aa5bfc2f","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["9s"],"count":1},"referencePar":16,"moveLimit":24},
  // 第 324 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["..1111","111111","111111","..1111","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":16,"seed":22826861,"hash":"ba94c913","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["4s"],"count":1},"referencePar":13,"moveLimit":21},
  // 第 325 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":22834780,"hash":"b3e6b1c7","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["z6","3m"],"count":2},"referencePar":15,"moveLimit":23},
  // 第 326 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","11..111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":13,"seed":22842699,"hash":"004a38a1","chapter":16,"energy":true,"ice":2,"goal":{"kind":"collect","faces":["6s","2p"],"count":2},"referencePar":17},
  // 第 327 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111..1","1111111","111111.","111111.","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":14,"seed":22850618,"hash":"04ebcea9","chapter":16,"energy":true,"ice":2,"ice2":1,"goal":{"kind":"collect","faces":["9s","4s"],"count":2},"referencePar":15,"moveLimit":23},
  // 第 328 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","11..111","1111111","..11..1","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":22858537,"hash":"769b2ef1","chapter":16,"energy":true,"ice":2,"goal":{"kind":"collect","faces":["6s","9s"],"count":2},"referencePar":17,"moveLimit":25},
  // 第 329 关 · 6 列 × 6 行 · 参考解 14 步
  {"map":["111111","..1111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":22866456,"hash":"f1b6a0a5","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["z6","4s"],"count":2},"referencePar":14},
  // 第 330 关 · 8 列 × 8 行 · 参考解 19 步
  {"map":["..111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":22874375,"hash":"ce34b9df","chapter":16,"energy":true,"ice":2,"goal":{"kind":"collect","faces":["z5","7p"],"count":2},"referencePar":19,"moveLimit":28},
  // 第 331 关 · 8 列 × 8 行 · 参考解 15 步
  {"map":["11111111","..111111","11111111","11111111","11111111","11..1111","11111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":13,"seed":22882294,"hash":"dad7945d","chapter":16,"energy":true,"ice":3,"goal":{"kind":"collect","faces":["2p","3m"],"count":2},"referencePar":15},
  // 第 332 关 · 8 列 × 8 行 · 参考解 16 步
  {"map":["111111..","11..1111","11111111","11111111","11111111","11111111","..111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":22890213,"hash":"50cdb103","chapter":16,"energy":true,"ice":3,"goal":{"kind":"collect","faces":["2p","7p"],"count":2},"referencePar":16,"moveLimit":24},
  // 第 333 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":22898132,"hash":"389f7a0f","chapter":16,"energy":true,"ice":3,"goal":{"kind":"collect","faces":["3m","7p"],"count":2},"referencePar":16,"moveLimit":24},
  // 第 334 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["111111","111111","111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":22906051,"hash":"1aa431e7","chapter":16,"energy":true,"ice":3,"ice2":1,"goal":{"kind":"collect","faces":["7p","z5","2p"],"count":3},"referencePar":18,"moveLimit":27},
  // 第 335 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["11..11","111111","111111","11..11","..1111","1111.."],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":22913970,"hash":"9b466fef","chapter":16,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["3m","z5","7p"],"count":3},"referencePar":13},
  // 第 336 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","11..11","111111","111111","111111","11..11","111111","11..11"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":22921889,"hash":"ebaf18e7","chapter":16,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["3m","6s","7p"],"count":3},"referencePar":13},
  // 第 337 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":22929808,"hash":"477f6c59","chapter":16,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["7p","4s","6s"],"count":3},"referencePar":15,"moveLimit":23},
  // 第 338 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","..11111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":22937727,"hash":"86f145a1","chapter":16,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["6s","3m","z5"],"count":3},"referencePar":15,"moveLimit":23},
  // 第 339 关 · 7 列 × 8 行 · 参考解 20 步
  {"map":["1111111","1111111","1111111","..11111","1111111","1111111","..11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":22945646,"hash":"450267bd","chapter":16,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["z6","7p","z5"],"count":3},"referencePar":20,"moveLimit":29},
  // 第 340 关 · 8 列 × 8 行 · 参考解 18 步
  {"map":["1111..11","..111111","11111111","11111111","11111111","11111111","11111111","..111111"],"lockR":[],"lockC":[],"faces":15,"scramble":17,"seed":22953565,"hash":"c8fd638b","chapter":16,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["z6","z5","9s"],"count":3},"referencePar":18,"moveLimit":27},
  // 第 341 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","112211","111122"],"lockR":[],"lockC":[],"faces":13,"scramble":13,"seed":22961484,"hash":"f3fba989","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":13,"intro":"ctip:17"},
  // 第 342 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111122","111111","111111","11..11","112211","111111","111111","221111"],"lockR":[],"lockC":[],"faces":13,"scramble":14,"seed":22969403,"hash":"ee23c07d","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":16,"moveLimit":24},
  // 第 343 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["..1111","111111","112211","..1111","221111","111111","111122","221111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":22977322,"hash":"cf00b14b","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":17,"moveLimit":25},
  // 第 344 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["1111..","111111","111111","111122","..1122","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":22985241,"hash":"423e12d3","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":14,"moveLimit":22},
  // 第 345 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["2211111","1111111","1111111","1111111","1111221","1111111","1111111","2211111"],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":22993160,"hash":"fa5c8d8f","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":17,"moveLimit":25},
  // 第 346 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["11..111","1111111","1122111","1111111","2211111","1122111","1111111","2211111"],"lockR":[],"lockC":[],"faces":16,"scramble":13,"seed":23001079,"hash":"82f5bb19","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":15},
  // 第 347 关 · 7 列 × 8 行 · 参考解 13 步
  {"map":["1122..1","1111111","1111111","1111111","1111111","1111221","111111.","111111."],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":23008998,"hash":"967e283b","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":13,"moveLimit":21},
  // 第 348 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","11..111","1111111","2211111","1111..1","1122111","1111112","..11112"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":23016917,"hash":"0c456121","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":14,"moveLimit":22},
  // 第 349 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["111111","..1122","1111..","111111","112222","221111"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":23024836,"hash":"e0c810f9","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":13},
  // 第 350 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11112211","111122.."],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":23032755,"hash":"64403b81","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":17,"moveLimit":25},
  // 第 351 关 · 8 列 × 8 行 · 参考解 13 步
  {"map":["2211..11","11221111","11111111","22111111","11111111","11111111","11111111","1111..11"],"lockR":[],"lockC":[],"faces":17,"scramble":13,"seed":23040674,"hash":"a3472fdd","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":4,"face":"6s","count":2}],"referencePar":13},
  // 第 352 关 · 8 列 × 8 行 · 参考解 15 步
  {"map":["22111111","11..1122","22..1111","11111111","1111..11","11111111","11221111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":14,"seed":23048593,"hash":"a83cafdd","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":15,"moveLimit":23},
  // 第 353 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111122","112211","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":23056512,"hash":"3f49fc69","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":13,"moveLimit":21},
  // 第 354 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["221111","111111","111111","111111","111111","112211","1122..","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23064431,"hash":"554abeb9","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":17,"moveLimit":25},
  // 第 355 关 · 6 列 × 6 行 · 参考解 14 步
  {"map":["1111..","..1122","111111","..2211","11..22","112211"],"lockR":[],"lockC":[],"faces":11,"scramble":13,"seed":23072350,"hash":"16f534eb","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":14},
  // 第 356 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["11..11","1111..","111111","11..11","112211","111111","111111","112211"],"lockR":[],"lockC":[],"faces":12,"scramble":13,"seed":23080269,"hash":"1394ead9","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":12},
  // 第 357 关 · 7 列 × 8 行 · 参考解 13 步
  {"map":["1111111","1111111","1122111","1111111","1111111","1111221","1111111","1122111"],"lockR":[],"lockC":[],"faces":16,"scramble":14,"seed":23088188,"hash":"24bb62eb","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"referencePar":13,"moveLimit":21},
  // 第 358 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","1111111","1111111","1111221","1122112","1111112","..11111","1122111"],"lockR":[],"lockC":[],"faces":16,"scramble":15,"seed":23096107,"hash":"bc90a1c9","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"referencePar":15,"moveLimit":23},
  // 第 359 关 · 7 列 × 8 行 · 参考解 19 步
  {"map":["1111111","1111111","1111..2","1111112","1111111","11..111","1111221","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":23104026,"hash":"e0cbbfe7","chapter":17,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"referencePar":19,"moveLimit":28},
  // 第 360 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["11111111","11111122","11112211","11111111","11..2211","..111111","..111111","11111111"],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":23111945,"hash":"fd20bb09","chapter":17,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"referencePar":17,"moveLimit":25},
  // 第 361 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":23119864,"hash":"ccb48b85","chapter":18,"energy":true,"floors":[{"r":4,"c":3,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1},{"r":1,"c":0,"kind":"dew","need":1},{"r":2,"c":2,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"intro":"ctip:18"},
  // 第 362 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","11##11","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":23127783,"hash":"fda02205","chapter":18,"energy":true,"floors":[{"r":1,"c":1,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1},{"r":4,"c":1,"kind":"dew","need":1},{"r":7,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 363 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","##1111","111111","111111","11##11","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23135702,"hash":"c5f83ddf","chapter":18,"energy":true,"floors":[{"r":1,"c":1,"kind":"dew","need":1},{"r":3,"c":4,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1},{"r":7,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 364 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","1111##","##1111","111111","111111","##1111"],"lockR":[],"lockC":[],"faces":11,"scramble":17,"seed":23143621,"hash":"28e87a77","chapter":18,"energy":true,"floors":[{"r":5,"c":4,"kind":"dew","need":1},{"r":3,"c":3,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1},{"r":6,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 365 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":18,"seed":23151540,"hash":"c0a314fd","chapter":18,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":7,"c":5,"kind":"dew","need":1},{"r":3,"c":5,"kind":"dew","need":1},{"r":7,"c":3,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 366 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["1111111","1111111","1111111","1111111","1111##1","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":14,"seed":23159459,"hash":"d8d95115","chapter":18,"energy":true,"floors":[{"r":1,"c":3,"kind":"dew","need":1},{"r":2,"c":2,"kind":"dew","need":1},{"r":4,"c":1,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12},
  // 第 367 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["111111#","111111#","1111111","1111111","1111111","1111111","##11111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":23167378,"hash":"cb30b3c9","chapter":18,"energy":true,"floors":[{"r":0,"c":4,"kind":"dew","need":1},{"r":5,"c":5,"kind":"dew","need":1},{"r":6,"c":6,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 368 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111##1","1111111","1111111","1111##1","1111111","1111111","##11111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23175297,"hash":"2442a913","chapter":18,"energy":true,"floors":[{"r":2,"c":4,"kind":"dew","need":1},{"r":5,"c":1,"kind":"dew","need":1},{"r":0,"c":1,"kind":"dew","need":1},{"r":6,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 369 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","11####"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":23183216,"hash":"7a573a5b","chapter":18,"energy":true,"floors":[{"r":1,"c":4,"kind":"dew","need":1},{"r":2,"c":2,"kind":"dew","need":1},{"r":1,"c":0,"kind":"dew","need":1},{"r":4,"c":3,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13},
  // 第 370 关 · 8 列 × 8 行 · 参考解 19 步
  {"map":["11111111","11111111","11111111","11111111","##111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":16,"scramble":18,"seed":23191135,"hash":"a5056961","chapter":18,"energy":true,"floors":[{"r":1,"c":5,"kind":"dew","need":1},{"r":4,"c":4,"kind":"dew","need":1},{"r":0,"c":3,"kind":"dew","need":1},{"r":3,"c":6,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"moveLimit":28},
  // 第 371 关 · 8 列 × 8 行 · 参考解 15 步
  {"map":["11111111","11111111","111111##","11111111","11111111","11111111","11111111","111111##"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":23199054,"hash":"94ceabdf","chapter":18,"energy":true,"floors":[{"r":5,"c":0,"kind":"dew","need":1},{"r":0,"c":5,"kind":"dew","need":1},{"r":2,"c":3,"kind":"dew","need":1},{"r":5,"c":4,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15},
  // 第 372 关 · 8 列 × 8 行 · 参考解 13 步
  {"map":["1111####","11111111","11111111","11111111","11111111","11111111","##111111","11111111"],"lockR":[],"lockC":[],"faces":15,"scramble":15,"seed":23206973,"hash":"95cf2ff3","chapter":18,"energy":true,"floors":[{"r":5,"c":4,"kind":"dew","need":1},{"r":1,"c":1,"kind":"dew","need":1},{"r":4,"c":4,"kind":"dew","need":1},{"r":1,"c":6,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13,"moveLimit":21},
  // 第 373 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23214892,"hash":"a0834c49","chapter":18,"energy":true,"floors":[{"r":1,"c":3,"kind":"dew","need":1},{"r":5,"c":4,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1},{"r":7,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16,"moveLimit":24},
  // 第 374 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","111111","111111","111111","11##11","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23222811,"hash":"c7cf8361","chapter":18,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1},{"r":2,"c":4,"kind":"dew","need":1},{"r":0,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 375 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["##1111","####11","111111","111111","1111##","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":23230730,"hash":"487476d5","chapter":18,"energy":true,"floors":[{"r":3,"c":2,"kind":"dew","need":1},{"r":4,"c":3,"kind":"dew","need":1},{"r":2,"c":5,"kind":"dew","need":1},{"r":0,"c":2,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11},
  // 第 376 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["##11##","111111","111111","1111##","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":14,"seed":23238649,"hash":"6bb96ce7","chapter":18,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":0,"c":2,"kind":"dew","need":1},{"r":0,"c":3,"kind":"dew","need":1},{"r":4,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":13},
  // 第 377 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":23246568,"hash":"6af5840b","chapter":18,"energy":true,"floors":[{"r":1,"c":1,"kind":"dew","need":1},{"r":4,"c":3,"kind":"dew","need":1},{"r":2,"c":5,"kind":"dew","need":1},{"r":6,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"moveLimit":22},
  // 第 378 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","111111#","111111#"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":23254487,"hash":"fa265ea3","chapter":18,"energy":true,"floors":[{"r":1,"c":5,"kind":"dew","need":1},{"r":3,"c":2,"kind":"dew","need":1},{"r":5,"c":1,"kind":"dew","need":1},{"r":2,"c":4,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 379 关 · 7 列 × 8 行 · 参考解 10 步
  {"map":["1111111","1111111","111111#","111111#","1111111","1111111","1111111","##11111"],"lockR":[],"lockC":[],"faces":13,"scramble":17,"seed":23262406,"hash":"f37b7133","chapter":18,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":0,"c":1,"kind":"dew","need":1},{"r":6,"c":4,"kind":"dew","need":1},{"r":3,"c":4,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":10,"moveLimit":18},
  // 第 380 关 · 8 列 × 8 行 · 参考解 16 步
  {"map":["11111111","11111111","111111##","111111##","11111111","11111111","11111111","11##1111"],"lockR":[],"lockC":[],"faces":15,"scramble":18,"seed":23270325,"hash":"5066cf9b","chapter":18,"energy":true,"floors":[{"r":4,"c":0,"kind":"dew","need":1},{"r":1,"c":4,"kind":"dew","need":1},{"r":4,"c":5,"kind":"dew","need":1},{"r":6,"c":7,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16,"moveLimit":24},
  // 第 381 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","112211","222211","111111","221111","111111","221111","111111"],"lockR":[],"lockC":[],"faces":15,"scramble":14,"seed":23278244,"hash":"4319d833","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"floors":[{"r":1,"c":2,"kind":"bud","need":2},{"r":2,"c":3,"kind":"bud","need":2},{"r":4,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"intro":"ctip:19"},
  // 第 382 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["..1111","221111","111111","111111","111111","111122","111111","222222"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":23286163,"hash":"69cb5a3b","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":1,"c":0,"kind":"bud","need":2},{"r":4,"c":4,"kind":"bud","need":2},{"r":2,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":15,"moveLimit":23},
  // 第 383 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","112211","112211","..1122","11..11","111111","112222"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":23294082,"hash":"51bafba3","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"floors":[{"r":7,"c":1,"kind":"bud","need":2},{"r":1,"c":3,"kind":"bud","need":2},{"r":7,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 384 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["..1122","112211","111122","112211","22..11","111111","111111","1111.."],"lockR":[],"lockC":[],"faces":13,"scramble":17,"seed":23302001,"hash":"96cdcfd7","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":1}],"floors":[{"r":4,"c":0,"kind":"bud","need":2},{"r":0,"c":3,"kind":"bud","need":2},{"r":6,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":13,"moveLimit":21},
  // 第 385 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1122111","1111111","1111111","1111221","1111112","1122112","1111111","2211111"],"lockR":[],"lockC":[],"faces":17,"scramble":18,"seed":23309920,"hash":"149db02d","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"floors":[{"r":2,"c":0,"kind":"bud","need":2},{"r":2,"c":5,"kind":"bud","need":2},{"r":4,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"moveLimit":22},
  // 第 386 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","2211221","2211111","1111111","1111221","..11221","1111111","1111111"],"lockR":[],"lockC":[],"faces":16,"scramble":14,"seed":23317839,"hash":"d4c55ee1","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":5,"c":6,"kind":"bud","need":2},{"r":2,"c":4,"kind":"bud","need":2},{"r":1,"c":0,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":16},
  // 第 387 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111221","1111221","1122111","1111111","2222111","1111..1","1111..1","1111111"],"lockR":[],"lockC":[],"faces":16,"scramble":15,"seed":23325758,"hash":"59882efb","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"floors":[{"r":1,"c":3,"kind":"bud","need":2},{"r":0,"c":4,"kind":"bud","need":2},{"r":2,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 388 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["2211111","1111111","222222.","11..11.","1111111","1111111","11..112","1111112"],"lockR":[],"lockC":[],"faces":15,"scramble":16,"seed":23333677,"hash":"0545be51","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":5,"c":5,"kind":"bud","need":2},{"r":7,"c":4,"kind":"bud","need":2},{"r":2,"c":4,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":16,"moveLimit":24},
  // 第 389 关 · 6 列 × 6 行 · 参考解 14 步
  {"map":["1122..","11..11","111111","112211","112222","111122"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":23341596,"hash":"21f54d95","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"floors":[{"r":2,"c":5,"kind":"bud","need":2},{"r":3,"c":3,"kind":"bud","need":2},{"r":2,"c":4,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14},
  // 第 390 关 · 8 列 × 8 行 · 参考解 14 步
  {"map":["11111111","11112211","11111111","1111..22","11111111","11111122","11111122","11112211"],"lockR":[],"lockC":[],"faces":18,"scramble":18,"seed":23349515,"hash":"85da248d","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":1}],"floors":[{"r":5,"c":6,"kind":"bud","need":2},{"r":1,"c":3,"kind":"bud","need":2},{"r":3,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"moveLimit":22},
  // 第 391 关 · 8 列 × 8 行 · 参考解 14 步
  {"map":["..221111","11111122","11111111","22111111","11111111","22221111","11111111","111111.."],"lockR":[],"lockC":[],"faces":18,"scramble":14,"seed":23357434,"hash":"7f257525","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"floors":[{"r":3,"c":2,"kind":"bud","need":2},{"r":2,"c":4,"kind":"bud","need":2},{"r":6,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14},
  // 第 392 关 · 8 列 × 8 行 · 参考解 17 步
  {"map":["11..1111","11112211","11111111","2211..11","111111..","11222211","11111111","11112211"],"lockR":[],"lockC":[],"faces":17,"scramble":15,"seed":23365353,"hash":"88ca9e79","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":-1}],"floors":[{"r":5,"c":2,"kind":"bud","need":2},{"r":1,"c":5,"kind":"bud","need":2},{"r":6,"c":7,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 393 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","221111","111111","111111","221122","221111","221111"],"lockR":[],"lockC":[],"faces":15,"scramble":16,"seed":23373272,"hash":"0a9c88b9","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"floors":[{"r":2,"c":5,"kind":"bud","need":2},{"r":7,"c":0,"kind":"bud","need":2},{"r":0,"c":2,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 394 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["..1122","111111","221111","111111","221111","112211","111111","221111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":23381191,"hash":"fd4890df","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":6,"c":2,"kind":"bud","need":2},{"r":7,"c":0,"kind":"bud","need":2},{"r":1,"c":4,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 395 关 · 6 列 × 6 行 · 参考解 15 步
  {"map":["1111..","1122..","112211","..2211","1122..","221111"],"lockR":[],"lockC":[],"faces":12,"scramble":14,"seed":23389110,"hash":"75e093e1","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"floors":[{"r":4,"c":0,"kind":"bud","need":2},{"r":0,"c":3,"kind":"bud","need":2},{"r":2,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":15},
  // 第 396 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","112211","221111","1122..","..1111","1122..","221111"],"lockR":[],"lockC":[],"faces":13,"scramble":14,"seed":23397029,"hash":"88efd457","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":1}],"floors":[{"r":3,"c":1,"kind":"bud","need":2},{"r":0,"c":4,"kind":"bud","need":2},{"r":7,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14},
  // 第 397 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","2211111","1111111","1111111","1111111","2222221","1111221"],"lockR":[],"lockC":[],"faces":17,"scramble":15,"seed":23404948,"hash":"b3b78923","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"floors":[{"r":1,"c":4,"kind":"bud","need":2},{"r":5,"c":6,"kind":"bud","need":2},{"r":6,"c":5,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":14,"moveLimit":22},
  // 第 398 关 · 7 列 × 8 行 · 参考解 19 步
  {"map":["1111112","1122112","1111111","..11221","1111111","1111111","1111111","1122221"],"lockR":[],"lockC":[],"faces":16,"scramble":16,"seed":23412867,"hash":"e7f5e5a5","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":7,"c":1,"kind":"bud","need":2},{"r":7,"c":4,"kind":"bud","need":2},{"r":1,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":19,"moveLimit":28},
  // 第 399 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["11..111","1111111","1122221","1111221","2211112","1111112","1111111","1111..1"],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":23420786,"hash":"4cdb38df","chapter":19,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"floors":[{"r":2,"c":2,"kind":"bud","need":2},{"r":3,"c":5,"kind":"bud","need":2},{"r":3,"c":4,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":15,"moveLimit":23},
  // 第 400 关 · 8 列 × 8 行 · 参考解 18 步
  {"map":["11221122","11111111","11221111","11112211","11111111","2211..11","..1111..","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":18,"seed":23428705,"hash":"c3013745","chapter":19,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":-1}],"floors":[{"r":0,"c":5,"kind":"bud","need":2},{"r":0,"c":2,"kind":"bud","need":2},{"r":1,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":18,"moveLimit":27},
  // 第 401 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":23436624,"hash":"ec27487f","chapter":20,"energy":true,"referencePar":15,"intro":"ctip:20"},
  // 第 402 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","..1111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23444543,"hash":"a0c6c73b","chapter":20,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 403 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","11..11","111111","11..11"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23452462,"hash":"9bb24375","chapter":20,"energy":true,"referencePar":14,"moveLimit":22},
  // 第 404 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["..11..","111111","111111","111111","11..11","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":18,"seed":23460381,"hash":"ce4171e5","chapter":20,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 405 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":19,"seed":23468300,"hash":"3d48c0dd","chapter":20,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 406 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1111111","..11111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":15,"seed":23476219,"hash":"92fa36e3","chapter":20,"energy":true,"referencePar":15},
  // 第 407 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","..11111","1111111","1111111","..11111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23484138,"hash":"c31d3777","chapter":20,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 408 关 · 7 列 × 8 行 · 参考解 14 步
  {"map":["1111111","1111111","..11..1","1111111","1111111","1111111","1111111","1111..1"],"lockR":[],"lockC":[],"faces":13,"scramble":17,"seed":23492057,"hash":"8777b80f","chapter":20,"energy":true,"referencePar":14,"moveLimit":22},
  // 第 409 关 · 6 列 × 6 行 · 参考解 14 步
  {"map":["111111","..1111","111111","1111..","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":23499976,"hash":"22386cf3","chapter":20,"energy":true,"referencePar":14},
  // 第 410 关 · 8 列 × 9 行 · 参考解 16 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","111111..","11111111"],"lockR":[],"lockC":[],"faces":18,"scramble":19,"seed":23507895,"hash":"f64d2569","chapter":20,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 411 关 · 8 列 × 9 行 · 参考解 16 步
  {"map":["11111111","11111111","11111111","11111111","..111111","11111111","11111111","11..1111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":15,"seed":23515814,"hash":"aaf5e267","chapter":20,"energy":true,"referencePar":16},
  // 第 412 关 · 8 列 × 9 行 · 参考解 21 步
  {"map":["11111111","..111111","11111111","1111..11","11111111","11111111","11111111","11..1111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":16,"seed":23523733,"hash":"5c9082d5","chapter":20,"energy":true,"referencePar":21,"moveLimit":31},
  // 第 413 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":17,"seed":23531652,"hash":"fd6fbdef","chapter":20,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 414 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","111111.."],"lockR":[],"lockC":[],"faces":20,"scramble":18,"seed":23539571,"hash":"baf93975","chapter":20,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 415 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["..1111","11..11","..1111","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":12,"scramble":15,"seed":23547490,"hash":"7a5e41c9","chapter":20,"energy":true,"referencePar":13},
  // 第 416 关 · 8 列 × 10 行 · 参考解 13 步
  {"map":["11111111","11111111","11111111","11111111","11111111","1111..11","11111111","11..1111","111111..","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":15,"seed":23555409,"hash":"8b6adcf9","chapter":20,"energy":true,"referencePar":13},
  // 第 417 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23563328,"hash":"dd08e141","chapter":20,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 418 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23571247,"hash":"41269cd9","chapter":20,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 419 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","111111","111111","1111..","11..11","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":18,"seed":23579166,"hash":"12341dd3","chapter":20,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 420 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["111111..","111111..","11111111","11111111","11111111","11111111","11..1111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":19,"seed":23587085,"hash":"6ca81f55","chapter":20,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 421 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","331111","111111","113311","111111","111111","113311","113311"],"lockR":[],"lockC":[],"faces":16,"scramble":15,"seed":23595004,"hash":"e50ad3d1","chapter":21,"energy":true,"referencePar":15,"intro":"ctip:21"},
  // 第 422 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","113311","..1111","111111","331111","331111","113311","111111"],"lockR":[],"lockC":[],"faces":16,"scramble":16,"seed":23602923,"hash":"04bdf963","chapter":21,"energy":true,"referencePar":15,"moveLimit":23},
  // 第 423 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111133","113311","111111","111111","11..11","3333.."],"lockR":[],"lockC":[],"faces":15,"scramble":17,"seed":23610842,"hash":"c8e4d281","chapter":21,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 424 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["....11","111133","111111","111111","113311","11..33","113311","111111"],"lockR":[],"lockC":[],"faces":15,"scramble":18,"seed":23618761,"hash":"0792641f","chapter":21,"energy":true,"referencePar":16,"moveLimit":24},
  // 第 425 关 · 7 列 × 8 行 · 参考解 19 步
  {"map":["1111111","1133111","1111111","3311111","1111331","3311111","1111111","1111111"],"lockR":[],"lockC":[],"faces":18,"scramble":19,"seed":23626680,"hash":"c5c21ea3","chapter":21,"energy":true,"referencePar":19,"moveLimit":28},
  // 第 426 关 · 7 列 × 8 行 · 参考解 15 步
  {"map":["1133111","1133111","1111111","1111111","..33111","1111331","1111111","1111111"],"lockR":[],"lockC":[],"faces":18,"scramble":15,"seed":23634599,"hash":"7c5965e9","chapter":21,"energy":true,"referencePar":15},
  // 第 427 关 · 7 列 × 8 行 · 参考解 13 步
  {"map":["1111111","1133111","1133113","1111113","1111111","..11111","33..111","1111111"],"lockR":[],"lockC":[],"faces":17,"scramble":16,"seed":23642518,"hash":"76e09ae9","chapter":21,"energy":true,"referencePar":13,"moveLimit":21},
  // 第 428 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","1133331","1111111","1133111","..11111","111111.","3311..."],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":23650437,"hash":"e5b9a9c5","chapter":21,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 429 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["..3311","111111","113311","111111","111133","..3311"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":23658356,"hash":"b72e07c9","chapter":21,"energy":true,"referencePar":13},
  // 第 430 关 · 8 列 × 9 行 · 参考解 21 步
  {"map":["11111111","11113311","11111111","11331111","111111..","11111111","11111111","33113311","11111111"],"lockR":[],"lockC":[],"faces":22,"scramble":19,"seed":23666275,"hash":"481db1c7","chapter":21,"energy":true,"referencePar":21,"moveLimit":31},
  // 第 431 关 · 8 列 × 9 行 · 参考解 19 步
  {"map":["11113311","11111111","..111133","11111133","11111111","11111111","11111111","11..1133","11111111"],"lockR":[],"lockC":[],"faces":21,"scramble":15,"seed":23674194,"hash":"3ef741a1","chapter":21,"energy":true,"referencePar":19},
  // 第 432 关 · 8 列 × 9 行 · 参考解 17 步
  {"map":["..111111","11..1111","11331111","11111111","11111111","33113311","..111111","33111111","11111111"],"lockR":[],"lockC":[],"faces":21,"scramble":16,"seed":23682113,"hash":"52be35e3","chapter":21,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 433 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11113311","11111111","11111111","11113311","11331111","11111111","11111111","11111111","11111133","11111111"],"lockR":[],"lockC":[],"faces":24,"scramble":17,"seed":23690032,"hash":"e1810649","chapter":21,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 434 关 · 8 列 × 10 行 · 参考解 26 步
  {"map":["..111111","11111111","11111111","11111111","11111111","11111133","11111111","11113333","11111111","11111133"],"lockR":[],"lockC":[],"faces":24,"scramble":18,"seed":23697951,"hash":"9b2cd0bd","chapter":21,"energy":true,"referencePar":26,"moveLimit":38},
  // 第 435 关 · 6 列 × 6 行 · 参考解 13 步
  {"map":["11..33","33....","111111","111111","333311","11..11"],"lockR":[],"lockC":[],"faces":13,"scramble":15,"seed":23705870,"hash":"8d0cb1d7","chapter":21,"energy":true,"referencePar":13},
  // 第 436 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11113311","..111111","33111111","111111..","11333311","11111111","1111..11","11111111"],"lockR":[],"lockC":[],"faces":23,"scramble":15,"seed":23713789,"hash":"92d144f7","chapter":21,"energy":true,"referencePar":18},
  // 第 437 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111133","111111","111111","333311","111133","111111","111111","111111"],"lockR":[],"lockC":[],"faces":16,"scramble":16,"seed":23721708,"hash":"b24b3e33","chapter":21,"energy":true,"referencePar":15,"moveLimit":23},
  // 第 438 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","113333","111111","111111","111111","333311","111111","1111.."],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":23729627,"hash":"5fc16a41","chapter":21,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 439 关 · 6 列 × 8 行 · 参考解 10 步
  {"map":["113311","..1111","111111","111111","11..33","331133","111111","111111"],"lockR":[],"lockC":[],"faces":15,"scramble":18,"seed":23737546,"hash":"535eaad3","chapter":21,"energy":true,"referencePar":10,"moveLimit":18},
  // 第 440 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111133","11111111","..331111","11..1111","11111111","11111111","11113311","..111111","11111133","11111111"],"lockR":[],"lockC":[],"faces":23,"scramble":19,"seed":23745465,"hash":"d1db729b","chapter":21,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 441 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23753384,"hash":"84c1d31d","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":2}],"referencePar":17,"intro":"ctip:22"},
  // 第 442 关 · 6 列 × 8 行 · 参考解 12 步
  {"map":["111111","111111","11..11","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23761303,"hash":"57df7059","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":3}],"referencePar":12,"moveLimit":20},
  // 第 443 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["111111","111111","..1111","111111","1111..","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":23769222,"hash":"72b07e15","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":4}],"referencePar":18,"moveLimit":27},
  // 第 444 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["111111","....11","111111","..1111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":19,"seed":23777141,"hash":"3de02f35","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":5}],"referencePar":18,"moveLimit":27},
  // 第 445 关 · 7 列 × 8 行 · 参考解 20 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":20,"seed":23785060,"hash":"4713b59b","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":2}],"referencePar":20,"moveLimit":29},
  // 第 446 关 · 7 列 × 8 行 · 参考解 10 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111..1","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":23792979,"hash":"d35b7d47","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":3}],"referencePar":10},
  // 第 447 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["..11111","1111111","1111111","1111111","1111..1","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":17,"seed":23800898,"hash":"ef2393a5","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":4}],"referencePar":17,"moveLimit":25},
  // 第 448 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","111111.","111111.","1111111","1111..1","1111111","..11111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":23808817,"hash":"20c3aba3","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":5}],"referencePar":16,"moveLimit":24},
  // 第 449 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["111111","11..11","1111..","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23816736,"hash":"f0af7b19","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":2}],"referencePar":11},
  // 第 450 关 · 8 列 × 9 行 · 参考解 23 步
  {"map":["11111111","..111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":18,"scramble":20,"seed":23824655,"hash":"391a7a39","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":3}],"referencePar":23,"moveLimit":34},
  // 第 451 关 · 8 列 × 9 行 · 参考解 16 步
  {"map":["111111..","11111111","11111111","11111111","..111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":16,"seed":23832574,"hash":"b52f2745","chapter":22,"energy":true,"unlock":[{"axis":"col","index":4,"after":4}],"referencePar":16},
  // 第 452 关 · 8 列 × 9 行 · 参考解 15 步
  {"map":["11111111","11111111","1111....","11..1111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":23840493,"hash":"95112531","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":5}],"referencePar":15,"moveLimit":23},
  // 第 453 关 · 8 列 × 10 行 · 参考解 19 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":18,"seed":23848412,"hash":"5e4e1e33","chapter":22,"energy":true,"unlock":[{"axis":"col","index":4,"after":2}],"referencePar":19,"moveLimit":28},
  // 第 454 关 · 8 列 × 10 行 · 参考解 21 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","1111..11","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":19,"seed":23856331,"hash":"217761f9","chapter":22,"energy":true,"unlock":[{"axis":"row","index":5,"after":3}],"referencePar":21,"moveLimit":31},
  // 第 455 关 · 6 列 × 6 行 · 参考解 16 步
  {"map":["111111","111111","..1111","..1111","111111","..11.."],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23864250,"hash":"b91ab709","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":4}],"referencePar":16},
  // 第 456 关 · 8 列 × 10 行 · 参考解 17 步
  {"map":["11..1111","..111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","1111..11"],"lockR":[],"lockC":[],"faces":19,"scramble":16,"seed":23872169,"hash":"86d8c7e9","chapter":22,"energy":true,"unlock":[{"axis":"row","index":5,"after":5}],"referencePar":17},
  // 第 457 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23880088,"hash":"27bddeaf","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":2}],"referencePar":16,"moveLimit":24},
  // 第 458 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":23888007,"hash":"79f3c3a7","chapter":22,"energy":true,"unlock":[{"axis":"row","index":4,"after":3}],"referencePar":16,"moveLimit":24},
  // 第 459 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","1111..","111111","1111..","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":19,"seed":23895926,"hash":"77ef9301","chapter":22,"energy":true,"unlock":[{"axis":"col","index":3,"after":4}],"referencePar":19,"moveLimit":28},
  // 第 460 关 · 8 列 × 10 行 · 参考解 19 步
  {"map":["11111111","11111111","..111111","11111111","11111111","11111111","11111111","11111111","111111..","..111111"],"lockR":[],"lockC":[],"faces":19,"scramble":20,"seed":23903845,"hash":"3a63a5bd","chapter":22,"energy":true,"unlock":[{"axis":"row","index":5,"after":5}],"referencePar":19,"moveLimit":28},
  // 第 461 关 · 6 列 × 8 行 · 参考解 14 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":16,"seed":23911764,"hash":"26912d65","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"floors":[{"r":2,"c":3,"kind":"flower","need":1},{"r":4,"c":4,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":1,"c":5,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":14,"intro":"ctip:23"},
  // 第 462 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":23919683,"hash":"6dca2277","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"floors":[{"r":0,"c":4,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1},{"r":5,"c":5,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 463 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","..1111","111111","1111..","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":23927602,"hash":"df672a75","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"floors":[{"r":7,"c":4,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1},{"r":7,"c":0,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 464 关 · 6 列 × 8 行 · 参考解 15 步
  {"map":["..1111","111111","111111","111111","..1111","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":19,"seed":23935521,"hash":"82af391f","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"floors":[{"r":4,"c":3,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1},{"r":0,"c":4,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":15,"moveLimit":23},
  // 第 465 关 · 7 列 × 8 行 · 参考解 20 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":20,"seed":23943440,"hash":"1bb7b06d","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"floors":[{"r":1,"c":0,"kind":"flower","need":1},{"r":6,"c":0,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":5,"c":6,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":20,"moveLimit":29},
  // 第 466 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111111","1111111","11..111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":16,"seed":23951359,"hash":"904cbaff","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"floors":[{"r":5,"c":3,"kind":"flower","need":1},{"r":3,"c":6,"kind":"flower","need":1},{"r":7,"c":6,"kind":"flower","need":1},{"r":7,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16},
  // 第 467 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["1111111","1111111","1111..1","1111111","111111.","111111.","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":17,"seed":23959278,"hash":"2b746b03","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"floors":[{"r":4,"c":0,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1},{"r":1,"c":0,"kind":"flower","need":1},{"r":3,"c":6,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 468 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["111111.","1111...","1111111","1111111","1111111","1111111","1111111","11..111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":23967197,"hash":"bc29ec2b","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"floors":[{"r":2,"c":2,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1},{"r":5,"c":4,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 469 关 · 6 列 × 6 行 · 参考解 16 步
  {"map":["111111","1111..","111111","111111","111111","1111.."],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":23975116,"hash":"0fe2a957","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"floors":[{"r":0,"c":1,"kind":"flower","need":1},{"r":3,"c":1,"kind":"flower","need":1},{"r":5,"c":1,"kind":"flower","need":1},{"r":4,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16},
  // 第 470 关 · 8 列 × 9 行 · 参考解 19 步
  {"map":["11111111","11111111","11111111","11111111","11111111","..111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":18,"scramble":20,"seed":23983035,"hash":"139af7df","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"floors":[{"r":6,"c":0,"kind":"flower","need":1},{"r":4,"c":5,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1},{"r":8,"c":6,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"moveLimit":28},
  // 第 471 关 · 8 列 × 9 行 · 参考解 16 步
  {"map":["1111..11","11111111","11111111","11111111","11..1111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":16,"seed":23990954,"hash":"8ec72e87","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":4,"face":"6s","count":2}],"floors":[{"r":2,"c":4,"kind":"flower","need":1},{"r":4,"c":0,"kind":"flower","need":1},{"r":2,"c":6,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16},
  // 第 472 关 · 8 列 × 9 行 · 参考解 17 步
  {"map":["11111111","111111..","11111111","1111..11","..111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":23998873,"hash":"7a0d861b","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"floors":[{"r":5,"c":2,"kind":"flower","need":1},{"r":8,"c":4,"kind":"flower","need":1},{"r":0,"c":6,"kind":"flower","need":1},{"r":8,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 473 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":18,"seed":24006792,"hash":"3532588b","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":4,"face":"z6","count":2}],"floors":[{"r":7,"c":4,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1},{"r":2,"c":6,"kind":"flower","need":1},{"r":5,"c":7,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":18,"moveLimit":27},
  // 第 474 关 · 8 列 × 10 行 · 参考解 20 步
  {"map":["11111111","..111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":19,"seed":24014711,"hash":"29a6d3ff","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":5,"face":"4s","count":2}],"floors":[{"r":7,"c":1,"kind":"flower","need":1},{"r":9,"c":6,"kind":"flower","need":1},{"r":8,"c":4,"kind":"flower","need":1},{"r":0,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":20,"moveLimit":29},
  // 第 475 关 · 6 列 × 6 行 · 参考解 12 步
  {"map":["1111..","11....","111111","111111","11..11","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":16,"seed":24022630,"hash":"937bc7e7","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":3,"c":5,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":12},
  // 第 476 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","..111111","11111111","..11..11","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":16,"seed":24030549,"hash":"889fd3cf","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":5,"face":"9s","count":2}],"floors":[{"r":1,"c":6,"kind":"flower","need":1},{"r":9,"c":0,"kind":"flower","need":1},{"r":7,"c":0,"kind":"flower","need":1},{"r":5,"c":0,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":18},
  // 第 477 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":24038468,"hash":"155e8b45","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"floors":[{"r":7,"c":3,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":0,"c":0,"kind":"flower","need":1},{"r":2,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":17,"moveLimit":25},
  // 第 478 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["111111","1111..","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":24046387,"hash":"601e1519","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"floors":[{"r":2,"c":5,"kind":"flower","need":1},{"r":5,"c":4,"kind":"flower","need":1},{"r":3,"c":0,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":18,"moveLimit":27},
  // 第 479 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","..1111","111111","..1111","111111","111111"],"lockR":[],"lockC":[],"faces":11,"scramble":19,"seed":24054306,"hash":"2bad56b3","chapter":23,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"floors":[{"r":4,"c":2,"kind":"flower","need":1},{"r":2,"c":4,"kind":"flower","need":1},{"r":7,"c":2,"kind":"flower","need":1},{"r":3,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16,"moveLimit":24},
  // 第 480 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11..1111","11..1111","11111111","11111111","111111..","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":20,"seed":24062225,"hash":"29a789ab","chapter":23,"energy":true,"keyLocks":[{"axis":"row","index":5,"face":"9s","count":2}],"floors":[{"r":0,"c":0,"kind":"flower","need":1},{"r":2,"c":5,"kind":"flower","need":1},{"r":8,"c":6,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":18,"moveLimit":27},
  // 第 481 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":24070144,"hash":"c47ac5bd","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"goal":{"kind":"collect","faces":["6s"],"count":1},"referencePar":16,"intro":"ctip:24"},
  // 第 482 关 · 6 列 × 8 行 · 参考解 13 步
  {"map":["111111","111111","111111","111111","111111","11..11","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":24078063,"hash":"4c0fc80b","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["z6"],"count":1},"referencePar":13,"moveLimit":21},
  // 第 483 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","..1111","111111","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":14,"scramble":19,"seed":24085982,"hash":"229214b5","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["3m"],"count":1},"referencePar":19,"moveLimit":28},
  // 第 484 关 · 6 列 × 8 行 · 参考解 21 步
  {"map":["111111","11..11","111111","1111..","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":20,"seed":24093901,"hash":"4d9e0be1","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":1}],"goal":{"kind":"collect","faces":["z5"],"count":1},"referencePar":21,"moveLimit":31},
  // 第 485 关 · 7 列 × 8 行 · 参考解 12 步
  {"map":["1111111","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":21,"seed":24101820,"hash":"e4611585","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["3m","z6"],"count":2},"referencePar":12,"moveLimit":20},
  // 第 486 关 · 7 列 × 8 行 · 参考解 18 步
  {"map":["1111..1","1111111","1111111","1111111","1111111","1111111","1111111","1111111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":24109739,"hash":"dfb33a13","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["6s","7p"],"count":2},"referencePar":18},
  // 第 487 关 · 7 列 × 8 行 · 参考解 19 步
  {"map":["1111111","1111111","111111.","111111.","1111111","1111..1","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":24117658,"hash":"69fa4f51","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"goal":{"kind":"collect","faces":["3m","7p"],"count":2},"referencePar":19,"moveLimit":28},
  // 第 488 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111..1","1111111","1111111","1111..1","1111111","11..111","1111111","1111111"],"lockR":[],"lockC":[],"faces":13,"scramble":19,"seed":24125577,"hash":"7f71ac15","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["4s","6s"],"count":2},"referencePar":16,"moveLimit":24},
  // 第 489 关 · 6 列 × 6 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","11....","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":24133496,"hash":"1e67be27","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["9s","3m"],"count":2},"referencePar":16},
  // 第 490 关 · 8 列 × 9 行 · 参考解 23 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11..1111","11111111","11111111"],"lockR":[],"lockC":[],"faces":18,"scramble":21,"seed":24141415,"hash":"4e636781","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":1}],"goal":{"kind":"collect","faces":["4s","6s"],"count":2},"referencePar":23,"moveLimit":34},
  // 第 491 关 · 8 列 × 9 行 · 参考解 15 步
  {"map":["..111111","1111..11","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":24149334,"hash":"af9728a7","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["z5","9s"],"count":2},"referencePar":15},
  // 第 492 关 · 8 列 × 9 行 · 参考解 15 步
  {"map":["11111111","111111..","11111111","..111111","1111..11","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":18,"seed":24157253,"hash":"648f2f71","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["z5","9s"],"count":2},"referencePar":15,"moveLimit":23},
  // 第 493 关 · 8 列 × 10 行 · 参考解 19 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":19,"seed":24165172,"hash":"bb3aa765","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":5,"dir":1}],"goal":{"kind":"collect","faces":["9s","3m"],"count":2},"referencePar":19,"moveLimit":28},
  // 第 494 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","1111..11","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":20,"seed":24173091,"hash":"b3557935","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["z5","3m","2p"],"count":3},"referencePar":18,"moveLimit":27},
  // 第 495 关 · 6 列 × 6 行 · 参考解 12 步
  {"map":["1111..","111111","111111","1111..","....11","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":24181010,"hash":"7d3bf5b3","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["7p","z5","z6"],"count":3},"referencePar":12},
  // 第 496 关 · 8 列 × 10 行 · 参考解 17 步
  {"map":["111111..","1111..11","11111111","11111111","11111111","1111..11","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":17,"seed":24188929,"hash":"03fedc89","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":1}],"goal":{"kind":"collect","faces":["z5","2p","3m"],"count":3},"referencePar":17},
  // 第 497 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":24196848,"hash":"2d5159eb","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["9s","4s","z5"],"count":3},"referencePar":16,"moveLimit":24},
  // 第 498 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":14,"scramble":19,"seed":24204767,"hash":"9d670783","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"goal":{"kind":"collect","faces":["z5","6s","2p"],"count":3},"referencePar":19,"moveLimit":28},
  // 第 499 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","111111","111111","1111..","..1111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":20,"seed":24212686,"hash":"4e04a057","chapter":24,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"goal":{"kind":"collect","faces":["3m","2p","z6"],"count":3},"referencePar":19,"moveLimit":28},
  // 第 500 关 · 8 列 × 10 行 · 参考解 23 步
  {"map":["11111111","11..1111","11111111","11111111","11....11","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":21,"seed":24220605,"hash":"09b70535","chapter":24,"energy":true,"oneWay":[{"axis":"col","index":4,"dir":-1}],"goal":{"kind":"collect","faces":["9s","2p","z6"],"count":3},"referencePar":23,"moveLimit":34},
  // 第 501 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","111111","111111","111111","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":17,"seed":24228524,"hash":"186b399d","chapter":25,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"z6","count":2}],"floors":[{"r":1,"c":1,"kind":"flower","need":1},{"r":6,"c":4,"kind":"flower","need":1},{"r":5,"c":3,"kind":"flower","need":1},{"r":1,"c":2,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"intro":"ctip:25"},
  // 第 502 关 · 6 列 × 8 行 · 参考解 16 步
  {"map":["111111","111111","111111","11..11","111111","111111","111111","111111"],"lockR":[],"lockC":[],"faces":13,"scramble":18,"seed":24236443,"hash":"47f0976f","chapter":25,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"4s","count":2}],"floors":[{"r":0,"c":2,"kind":"flower","need":1},{"r":5,"c":2,"kind":"flower","need":1},{"r":6,"c":3,"kind":"flower","need":1},{"r":4,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":16,"moveLimit":24},
  // 第 503 关 · 6 列 × 8 行 · 参考解 19 步
  {"map":["111111","..1111","111111","111111","111111","111111","111111","11..11"],"lockR":[],"lockC":[],"faces":14,"scramble":19,"seed":24244362,"hash":"4b6fbb79","chapter":25,"energy":true,"keyLocks":[{"axis":"col","index":3,"face":"6s","count":2}],"floors":[{"r":2,"c":2,"kind":"flower","need":1},{"r":6,"c":5,"kind":"flower","need":1},{"r":0,"c":5,"kind":"flower","need":1},{"r":0,"c":1,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"moveLimit":28},
  // 第 504 关 · 6 列 × 8 行 · 参考解 21 步
  {"map":["111111","1111..","111111","1111..","111111","111111","1111..","111111"],"lockR":[],"lockC":[],"faces":12,"scramble":20,"seed":24252281,"hash":"48cc4119","chapter":25,"energy":true,"keyLocks":[{"axis":"row","index":4,"face":"9s","count":2}],"floors":[{"r":0,"c":3,"kind":"flower","need":1},{"r":1,"c":1,"kind":"flower","need":1},{"r":3,"c":2,"kind":"flower","need":1},{"r":7,"c":4,"kind":"flower","need":1}],"goal":{"kind":"garden","count":4},"referencePar":21,"moveLimit":31},
  // 第 505 关 · 7 列 × 8 行 · 参考解 20 步
  {"map":["1122221","1111111","1111111","1111111","1122112","1122112","1111111","1111111"],"lockR":[],"lockC":[],"faces":17,"scramble":21,"seed":24260200,"hash":"3ab06f69","chapter":25,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":-1}],"floors":[{"r":6,"c":5,"kind":"bud","need":2},{"r":2,"c":1,"kind":"bud","need":2},{"r":4,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":20,"moveLimit":29},
  // 第 506 关 · 7 列 × 8 行 · 参考解 16 步
  {"map":["1111111","1111221","1111112","1111112","1111221","..11111","2211111","2211111"],"lockR":[],"lockC":[],"faces":16,"scramble":17,"seed":24268119,"hash":"fd44dee7","chapter":25,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":7,"c":4,"kind":"bud","need":2},{"r":0,"c":5,"kind":"bud","need":2},{"r":2,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":16},
  // 第 507 关 · 7 列 × 8 行 · 参考解 26 步
  {"map":["2211112","1111112","1111111","2211111","22..111","1111221","1111111","..11111"],"lockR":[],"lockC":[],"faces":16,"scramble":18,"seed":24276038,"hash":"a08307d3","chapter":25,"energy":true,"oneWay":[{"axis":"row","index":4,"dir":1}],"floors":[{"r":2,"c":3,"kind":"bud","need":2},{"r":1,"c":6,"kind":"bud","need":2},{"r":3,"c":1,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":26,"moveLimit":38},
  // 第 508 关 · 7 列 × 8 行 · 参考解 17 步
  {"map":["..11112","1111222","1111..1","1111111","2211111","..11221","2211111","1111111"],"lockR":[],"lockC":[],"faces":15,"scramble":19,"seed":24283957,"hash":"79280dbd","chapter":25,"energy":true,"oneWay":[{"axis":"col","index":3,"dir":-1}],"floors":[{"r":1,"c":5,"kind":"bud","need":2},{"r":5,"c":5,"kind":"bud","need":2},{"r":4,"c":3,"kind":"bud","need":2}],"goal":{"kind":"garden","count":3},"referencePar":17,"moveLimit":25},
  // 第 509 关 · 6 列 × 6 行 · 参考解 11 步
  {"map":["111111","1111##","111111","1111##","111111","111111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":24291876,"hash":"d6b20e47","chapter":25,"energy":true,"floors":[{"r":3,"c":1,"kind":"dew","need":1},{"r":5,"c":4,"kind":"dew","need":1},{"r":2,"c":2,"kind":"dew","need":1},{"r":0,"c":5,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":11},
  // 第 510 关 · 8 列 × 9 行 · 参考解 19 步
  {"map":["11111111","11111111","111111##","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":18,"scramble":21,"seed":24299795,"hash":"d906e2d9","chapter":25,"energy":true,"floors":[{"r":5,"c":0,"kind":"dew","need":1},{"r":7,"c":6,"kind":"dew","need":1},{"r":8,"c":1,"kind":"dew","need":1},{"r":1,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"moveLimit":28},
  // 第 511 关 · 8 列 × 9 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","11##1111","##111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":17,"seed":24307714,"hash":"554e7f1f","chapter":25,"energy":true,"floors":[{"r":1,"c":0,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1},{"r":6,"c":5,"kind":"dew","need":1},{"r":6,"c":0,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":18},
  // 第 512 关 · 8 列 × 9 行 · 参考解 19 步
  {"map":["11111111","##11##11","11111111","11111111","11111111","11111111","##111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":17,"scramble":18,"seed":24315633,"hash":"8b636d73","chapter":25,"energy":true,"floors":[{"r":3,"c":4,"kind":"dew","need":1},{"r":7,"c":1,"kind":"dew","need":1},{"r":5,"c":4,"kind":"dew","need":1},{"r":1,"c":3,"kind":"dew","need":1}],"goal":{"kind":"garden","count":4},"referencePar":19,"moveLimit":28},
  // 第 513 关 · 8 列 × 10 行 · 参考解 18 步
  {"map":["11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":19,"seed":24323552,"hash":"aad8cd5f","chapter":25,"energy":true,"ice":3,"goal":{"kind":"collect","faces":["z5","3m"],"count":2},"referencePar":18,"moveLimit":27},
  // 第 514 关 · 8 列 × 10 行 · 参考解 21 步
  {"map":["11111111","11..1111","11111111","11111111","11111111","11111111","11111111","11111111","11111111","11111111"],"lockR":[],"lockC":[],"faces":20,"scramble":20,"seed":24331471,"hash":"d01d8e65","chapter":25,"energy":true,"ice":3,"ice2":1,"goal":{"kind":"collect","faces":["z6","2p","7p"],"count":3},"referencePar":21,"moveLimit":31},
  // 第 515 关 · 6 列 × 6 行 · 参考解 17 步
  {"map":["......","111111","111111","111111","111111","..1111"],"lockR":[],"lockC":[],"faces":14,"scramble":17,"seed":24339390,"hash":"1cc1e8b1","chapter":25,"energy":true,"ice":1,"goal":{"kind":"collect","faces":["7p","6s","z6"],"count":3},"referencePar":17},
  // 第 516 关 · 8 列 × 10 行 · 参考解 22 步
  {"map":["111111..","11111111","11111111","11111111","11111111","11111111","11..1111","11111111","11..1111","11111111"],"lockR":[],"lockC":[],"faces":19,"scramble":17,"seed":24347309,"hash":"f4c9b931","chapter":25,"energy":true,"ice":4,"goal":{"kind":"collect","faces":["6s","z6","4s"],"count":3},"referencePar":22},
  // 第 517 关 · 6 列 × 8 行 · 参考解 18 步
  {"map":["111111","111133","111111","111111","111111","331133","111111","331111"],"lockR":[],"lockC":[],"faces":16,"scramble":18,"seed":24355228,"hash":"909eebc1","chapter":25,"energy":true,"referencePar":18,"moveLimit":27},
  // 第 518 关 · 6 列 × 8 行 · 参考解 17 步
  {"map":["111111","331111","111111","111111","1133..","331111","111111","331111"],"lockR":[],"lockC":[],"faces":16,"scramble":19,"seed":24363147,"hash":"bc031a7b","chapter":25,"energy":true,"referencePar":17,"moveLimit":25},
  // 第 519 关 · 6 列 × 8 行 · 参考解 20 步
  {"map":["331111","331111","111111","331111","113311","111111","1111..","1111.."],"lockR":[],"lockC":[],"faces":15,"scramble":20,"seed":24371066,"hash":"894721f3","chapter":25,"energy":true,"referencePar":20,"moveLimit":29},
  // 第 520 关 · 8 列 × 10 行 · 参考解 20 步
  {"map":["11111111","33113311","11113311","11111111","..113311","111111..","11111111","11111111","111111..","11111111"],"lockR":[],"lockC":[],"faces":23,"scramble":21,"seed":24378985,"hash":"0d3bee4b","chapter":25,"energy":true,"referencePar":20,"moveLimit":29},
];
export {CAMPAIGN_VERSION, CHAPTER_LENGTH} from './Campaign';
import {CHAPTERS} from './Campaign';
export const CHAPTER_NAMES: string[] = CHAPTERS.map(c=>c[0]);
export function levelAt(index:number):LevelDef{return LEVELS[Number.isFinite(index)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(index))):0];}
