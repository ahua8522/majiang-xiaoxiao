/**
 * H5 demo design tokens — green-jade / Chinese-garden skin from the UI reference.
 * Values are mirrored in template.html as CSS custom properties.
 */
export const T = {
  sky1: '#DAEEE7', sky2: '#F1F4E6', sky3: '#E5EDCD', garden: '#ACCAA0',
  gardenDeep: '#86AA78', gardenDark: '#72916C',
  leaf: '#99BC7E', leafDark: '#77975F', leafLight: '#C3D9A6',

  cream: '#FFF9ED', creamDeep: '#F3E6C6', creamEdge: '#E4D2A6',
  gold: '#D8A94E', goldDeep: '#A87C2C', goldLight: '#F3DC9B',
  jade: '#2E7D4F', jadeDeep: '#1C5B37', jadeLight: '#4FA46A', jadeBright: '#43A860',

  ink: '#2B3A28', inkSoft: '#5D6B52', inkFaint: '#8A957E',
  wood: '#C8AF7F', woodDeep: '#A18F6C', woodLight: '#E4D1A9', woodInner: '#A7C8AA',
  felt: '#3F6B3A', feltDeep: '#2E5230',

  tile: '#FDF8E4', tileEdge: '#E8DCBC',
  white: '#FFFFFF'
} as const;

export const FONT_SANS = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
export const FONT_SERIF = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif CJK SC",serif';