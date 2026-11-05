/**
 * 关卡数据盘点：逐关列出盘面尺寸、机制（木桩/空洞/锁行/锁列/叠层/冰面）与参数，
 * 并统计各机制的首现关卡。用法：node tools/audit-levels.cjs
 */
const G = require('../.test/core/Generator.js');

const rows = [];
let first = {};
const mark = (key, i) => { if (first[key] === undefined) first[key] = i + 1; };

for (let i = 0; i < G.LEVELS.length; i++) {
  const L = G.LEVELS[i];
  const r = L.map.length, c = L.map[0].length;
  let wood = 0, holes = 0, d2 = 0, d3 = 0, slots = 0;
  for (const line of L.map) for (const ch of line) {
    if (ch === '#') wood++;
    else if (ch === '.') holes++;
    else { const n = Number(ch) || 0; slots += n; if (n === 2) d2++; if (n === 3) d3++; }
  }
  const d = G.generate(i, 7);
  const iced = d.grid.flat().filter(Array.isArray).flat().filter((f) => String(f).endsWith('~')).length;
  const faces = new Set(d.grid.flat().filter(Array.isArray).flat().map((f) => String(f).replace('~', '')));
  const flower = Array.from(faces).some((f) => f[0] === 'f');
  rows.push({ i: i + 1, r, c, slots, faces: L.faces, scramble: L.scramble, ice: L.ice || 0, ice2: L.ice2 || 0, bombs: L.bombs || 0, wild: !!L.wild, oneWay: (L.oneWay || []).length, unlock: (L.unlock || []).length, moveLimit: L.moveLimit || 0, goal: L.goal ? 1 : 0, wood, holes, d2, d3, lockR: L.lockR, lockC: L.lockC, icedTiles: iced, flower });
  if (wood) mark('木桩', i);
  if (holes) mark('空洞', i);
  if (d2) mark('双层', i);
  if (d3) mark('三层', i);
  if (L.lockR.length) mark('锁行', i);
  if (L.lockC.length) mark('锁列', i);
  if ((L.ice || 0) > 0) mark('冰面', i);
  if (L.ice2) mark('厚冰', i);
  if (L.bombs) mark('鞭炮', i);
  if (L.wild) mark('百搭', i);
  if (L.oneWay && L.oneWay.length) mark('单向轨', i);
  if (L.unlock && L.unlock.length) mark('连锁解锁', i);
  if (L.moveLimit) mark('限步关', i);
  if (L.goal) mark('目标关', i);
  if (flower) mark('花牌出现', i);
}

console.log('序号 盘面   牌位 牌种 打乱 冰对 厚冰 鞭炮 木桩 空洞 双层 三层 锁行 锁列 单向 解锁 限步 目标');
for (const r of rows) {
  console.log([
    String(r.i).padStart(3),
    `${r.r}x${r.c}`.padEnd(6),
    String(r.slots).padStart(3),
    String(r.faces).padStart(3),
    String(r.scramble).padStart(4),
    String(r.ice).padStart(3),
    String(r.ice2).padStart(4),
    String(r.bombs).padStart(4),
    String(r.wood).padStart(4),
    String(r.holes).padStart(4),
    String(r.d2).padStart(4),
    String(r.d3).padStart(4),
    `[${r.lockR}]`.padEnd(8),
    `[${r.lockC}]`.padEnd(8),
    String(r.oneWay).padStart(4),
    String(r.unlock).padStart(4),
    String(r.moveLimit).padStart(4),
    String(r.goal).padStart(4)
  ].join(' '));
}
console.log('\n机制首现关卡：', JSON.stringify(first));
const sizes = {};
for (const r of rows) { const k = `${r.r}x${r.c}`; sizes[k] = (sizes[k] || 0) + 1; }
console.log('尺寸分布：', Object.entries(sizes).map(([k, v]) => `${k}×${v}`).join('  '));
const flowerLevels = rows.filter((r) => r.flower).map((r) => r.i);
console.log(`花牌出现的关卡数：${flowerLevels.length}；最早 ${flowerLevels[0]}，最晚 ${flowerLevels[flowerLevels.length - 1]}`);
