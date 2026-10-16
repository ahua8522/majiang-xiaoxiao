/**
 * H5 demo design tokens — green-jade / Chinese-garden skin from the UI reference.
 * Values are mirrored in template.html as CSS custom properties.
 */
export const T = {
  sky1: '#9FD6E8', sky2: '#CFE9E6', sky3: '#DCEFD2', garden: '#8FB65F',
  gardenDeep: '#6A9548', gardenDark: '#3E6A31',
  leaf: '#7FB04C', leafDark: '#4A7A31', leafLight: '#A8CE72',

  cream: '#FBF3DE', creamDeep: '#F3E6C6', creamEdge: '#E4D2A6',
  gold: '#D8A94E', goldDeep: '#A87C2C', goldLight: '#F3DC9B',
  jade: '#2E7D4F', jadeDeep: '#1C5B37', jadeLight: '#4FA46A', jadeBright: '#43A860',

  ink: '#2B3A28', inkSoft: '#5D6B52', inkFaint: '#8A957E',
  wood: '#8B5A2B', woodDeep: '#5A3714', woodLight: '#B58046', woodInner: '#6E4A22',
  felt: '#3F6B3A', feltDeep: '#2E5230',

  tile: '#FDF8E4', tileEdge: '#E8DCBC',
  white: '#FFFFFF'
} as const;

export const FONT_SANS = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
export const FONT_SERIF = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif CJK SC",serif';