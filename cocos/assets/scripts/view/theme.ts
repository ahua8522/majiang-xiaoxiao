/**
 * 设计令牌 · 绿玉庭院（与 H5 demo 的 UI 稿同一套）。
 *
 * 这个文件不依赖 cc，也不依赖任何平台 API：只有色值、圆角、描边、厚度与排版数值，
 * 供 `art.ts`（Canvas2D 绘制）与 `widgets.ts`（cc 节点装配）共同消费。
 */

/** 主色板。 */
export const palette = {
  /** 天空 / 庭院背景 */
  sky1: '#DAEEE7', sky2: '#F1F4E6', sky3: '#E5EDCD',
  garden: '#ACCAA0', gardenDeep: '#86AA78', gardenDark: '#72916C',
  leaf: '#99BC7E', leafDark: '#77975F', leafLight: '#C3D9A6',

  /** 纸面 / 卡片 */
  cream: '#FFF9ED', creamDeep: '#F3E6C6', creamEdge: '#E4D2A6',
  gold: '#D8A94E', goldDeep: '#A87C2C', goldLight: '#F3DC9B',
  jade: '#2E7D4F', jadeDeep: '#1C5B37', jadeLight: '#4FA46A', jadeBright: '#43A860',

  /** 文字 */
  ink: '#2B3A28', inkSoft: '#5D6B52', inkFaint: '#8A957E',

  /** 木框 */
  wood: '#C8AF7F', woodDeep: '#A18F6C', woodLight: '#E4D1A9', woodInner: '#A7C8AA',

  /** 牌面 */
  tile: '#FDF8E4', tileEdge: '#E8DCBC',
  red: '#C0392B', navy: '#2B4A7A', blue: '#2E7FB8',

  white: '#FFFFFF',
  clear: '#00000000'
} as const;

/** 牌背按花色分色。f=花牌（梅红）、x=大厅装饰字牌（随牌面单独给色，见 art.ts DECO）、b=鞭炮（暗红）。 */
export const suit = {p: '#2E7FB8', s: '#2E8B57', m: '#C0392B', z: '#6B4FA0', f: '#C2678F', x: '#2E7FB8', b: '#8C2318'} as Record<string, string>;

/** 圆角（设计单位，基于 750 宽设计分辨率）。 */
export const radius = {tile: 14, card: 28, button: 24, pill: 999, chip: 14} as const;

/** 描边宽度。 */
export const stroke = {tile: 2, card: 3, hairline: 1} as const;

/** 实心投影的向下偏移——「厚」的来源，不是模糊阴影。 */
export const depth = {tile: 5, button: 6, card: 8, chip: 3} as const;

/** 排版（设计单位）。 */
export const type = {logo: 96, title: 40, label: 30, body: 25, caption: 21, micro: 18} as const;

/** 间距。 */
export const space = {xs: 6, sm: 12, md: 20, lg: 28, xl: 40} as const;

/** 设计分辨率：与项目设置 / Canvas 的 UITransform 一致，视图里直接用设计单位，不再手算缩放。 */
export const DESIGN = {width: 750, height: 1334} as const;

/** 取花色对应的牌背色；未知花色回落到墨色。装饰字牌按牌号给色（萬红/乐绿/筒蓝）。 */
export function suitColor(face: string): string {
  const lead = /[a-z]/i.test(face[0] || '');
  const key = lead ? face[0] : face[1] || '';
  if (key === 'x') return ['#C0392B', '#2E8B57', '#2E7FB8'][Number(face[1]) - 1] || palette.ink;
  return suit[key] || palette.ink;
}