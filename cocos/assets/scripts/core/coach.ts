/**
 * 机制首见的“真盘引导”内容。
 *
 * 这里只放**文案、步数与聚焦对象**，不放每一步的动作：
 * 目标动作永远取当前关卡认证解 `solution[0]`，走对后现成的 `Session.apply()` 会把它移走。
 * 这样引完的盘面一定还在认证解上，不需要另写一套“教学动作”再证明它不会把玩家带死。
 *
 * 步数来自 2026-10-23 对 224 关真实生成盘面的实测（见 spec 2.2）：
 * 认证解里首次能碰到该机制的步数 ≤3 的取前缀；冰面（7 步）、花牌（6 步）、
 * 鞭炮（6 步）、断门（认证解不碰）、三层（5 步）只走 1 步 + 金色聚焦，不硬拖玩家。
 *
 * 本文件不许 import 'cc'：node 门禁要在无引擎环境里跑它。
 */
import {bare, hasIce, iceLayers, isBomb, isWild, suitOf} from './Rules';
import type {Grid, Pos} from './Rules';
import type {LevelDef} from './Generator';

export interface CoachText {
  /** 与 LevelDef.intro 对齐 */
  key: string;
  /** 横幅左侧的机制名 */
  title: string;
  /** 每一步一句；末句可重复。字数要短——横幅 overflow = NONE，超了会画到屏外。 */
  say: string[];
  /** 认证解前缀步数（1~3） */
  steps: 1 | 2 | 3;
  /** 先做一次“推不动”的试错（锁行 / 锁列 / 单向轨） */
  bounce?: boolean;
  /** 金色聚焦框标在哪些格子上；只教“看哪里”，不参与动作判定 */
  focus?: 'ice' | 'ice2' | 'bomb' | 'wild' | 'flower' | 'stack' | 'stack3' | 'goal' | 'collect' | 'noSuit';
}

/** 运行时状态：当前讲到第几步、做错时的短句。 */
export interface CoachState {
  text: CoachText;
  /** 已完成步数（含试错步） */
  index: number;
  /** 总步数 = steps + (bounce ? 1 : 0) */
  total: number;
  /** 做错时给视图的一行提示；空串 = 没做错 */
  hint: string;
}

/** 下标就是机制键；`only258` 故意不在这里——章 6 的小盘教学已经覆盖，避免重复教。 */
export const COACH_TEXT: Record<string, CoachText> = {
  basic: {
    key: 'basic', title: '推与点',
    say: ['拖亮起来的这一行，同牌碰头就消。'],
    steps: 1
  },
  stack: {
    key: 'stack', title: '叠牌',
    say: ['叠着的牌要消两次，右上角是层数。'],
    steps: 1, focus: 'stack'
  },
  lockRow: {
    key: 'lockRow', title: '锁行',
    say: ['这一行被锁住，先拖一下试试。', '换亮起来的地方，做一步。'],
    steps: 1, bounce: true
  },
  lockCol: {
    key: 'lockCol', title: '锁列',
    say: ['这一列被锁住，先拖一下试试。', '换亮起来的地方，做一步。'],
    steps: 1, bounce: true
  },
  moveLimit: {
    key: 'moveLimit', title: '限步',
    say: ['右上角步数用完还没清台就输。'],
    steps: 1
  },
  oneWay: {
    key: 'oneWay', title: '单向轨',
    say: ['这条轨只能顺箭头推，先反推试试。', '照亮起来的地方，做一步。'],
    steps: 1, bounce: true
  },
  unlock: {
    key: 'unlock', title: '连锁解锁',
    say: ['消一对计数前进，够数自动解锁。'],
    steps: 1
  },
  ice: {
    key: 'ice', title: '冰面',
    say: ['覆霜牌要消两次：先碎冰，再收走。'],
    steps: 1, focus: 'ice'
  },
  bomb: {
    key: 'bomb', title: '鞭炮',
    say: ['鞭炮配对会震碎全场同款冰面。'],
    steps: 1, focus: 'bomb'
  },
  ice2: {
    key: 'ice2', title: '厚冰',
    say: ['厚霜要碎两次冰，再消一次才收走。'],
    steps: 1, focus: 'ice2'
  },
  flower: {
    key: 'flower', title: '花牌',
    say: ['花牌配对规则不变，同牌相邻就消。'],
    steps: 1, focus: 'flower'
  },
  wild: {
    key: 'wild', title: '百搭',
    say: ['星号花牌是百搭，能配任意牌。', '先推这一轨，把百搭送过去。', '再推一次，让百搭碰上去。'],
    steps: 3, focus: 'wild'
  },
  goal: {
    key: 'goal', title: '目标关',
    say: ['不用清台：先达成左上角目标。', '先走两步，把目标推到一起。', '最后这一步会推进目标。'],
    steps: 3, focus: 'goal'
  },
  noSuit: {
    key: 'noSuit', title: '断门',
    say: ['这一门只能轻点，滑动带不走。'],
    steps: 1, focus: 'noSuit'
  },
  only19: {
    key: 'only19', title: '幺九',
    say: ['只有 1、9 和字牌能配对。'],
    steps: 1
  },
  stack3: {
    key: 'stack3', title: '三层牌',
    say: ['三层牌要连消三次才清空。'],
    steps: 1, focus: 'stack3'
  },
  oneSuit: {
    key: 'oneSuit', title: '清一色',
    say: ['只有一门能配对，其余全是滑块。'],
    steps: 1
  },
  collect: {
    key: 'collect', title: '集齐一组',
    say: ['这一组各消一对就胡。', '再走一步，顶栏种数会前进。'],
    steps: 2, focus: 'collect'
  }
};

export function coachFor(key: string): CoachText | null {
  return COACH_TEXT[key] || null;
}

/** 与旧机制卡分开记：老玩家已经看过文字卡，也要再看一次新引导。 */
export function coachSeenKey(key: string): string {
  return 'coach:' + key;
}

/** 金色聚焦框：按机制类型找盘面上要“看”的格子。纯函数，门禁可直接断言。 */
export function coachFocusCells(def: LevelDef, grid: Grid, key: string): Pos[] {
  const t = coachFor(key);
  if (!t || !t.focus) return [];
  const out: Pos[] = [];
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!Array.isArray(cell) || !cell.length) return;
    const face = cell[cell.length - 1];
    const p = {r, c};
    switch (t.focus) {
      case 'ice': if (hasIce(face)) out.push(p); break;
      case 'ice2': if (iceLayers(face) >= 2) out.push(p); break;
      case 'bomb': if (isBomb(face)) out.push(p); break;
      case 'wild': if (isWild(face)) out.push(p); break;
      case 'flower': if (/^f[1-8]$/.test(bare(face))) out.push(p); break;
      case 'stack': if (cell.length >= 2) out.push(p); break;
      case 'stack3': if (cell.length >= 3) out.push(p); break;
      case 'goal': {
        const g = def.goal;
        if (!g) break;
        if (g.kind === 'ice') { if (hasIce(face)) out.push(p); }
        else if (g.kind === 'face') { if (bare(face) === g.face) out.push(p); }
        else if ((g.faces || []).includes(bare(face))) out.push(p);
        break;
      }
      case 'collect': if ((def.goal?.faces || []).includes(bare(face))) out.push(p); break;
      case 'noSuit': if (suitOf(face) === def.dialect?.noSlideSuit) out.push(p); break;
    }
  }));
  return out;
}
