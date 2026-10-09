const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const entry = path.join(__dirname, '../.view-test/view/GameView.js');
const V = fs.existsSync(entry) ? require(entry) : {};

const screens = [[600, 1000], [600, 1334], [750, 1000], [750, 1334], [750, 1668], [375, 667]];
function runsFor(grid, lockR = [], lockC = []) {
  const out = [];
  for (const axis of ['row', 'col']) {
    const n = axis === 'row' ? grid.length : grid[0].length;
    const len = axis === 'row' ? grid[0].length : grid.length;
    for (let index = 0; index < n; index++) {
      if ((axis === 'row' ? lockR : lockC).includes(index)) continue;
      let cells = [];
      const flush = () => { if (cells.length > 1) out.push({axis, index, cells}); cells = []; };
      for (let j = 0; j < len; j++) {
        const p = axis === 'row' ? {r: index, c: j} : {r: j, c: index};
        if (Array.isArray(grid[p.r][p.c])) cells.push(p); else flush();
      }
      flush();
    }
  }
  return out;
}
function model(overrides = {}) {
  const grid = overrides.grid || Array.from({length: 7}, (_, r) => Array.from({length: 9}, (_, c) => [(r + c) % 9 + 1 + 'p']));
  return {grid, runs: overrides.runs || runsFor(grid), levelIndex: 3, maxLevel: 4, total: 100, moves: 12,
    selected: null, hint: [], message: '慢慢来，好牌总会相逢', modal: 'none', reducedMotion: false,
    vibration: true, lastChain: 0, levelCount: 18, ...overrides};
}
function render(m = model(), w = 750, h = 1334) {
  assert.equal(typeof V.render, 'function', '缺少 render 绘图函数');
  return V.render(m, w, h);
}
function bounds(c) {
  if (c.type === 'rect') return {x: c.x, y: c.y, w: c.w, h: c.h};
  if (c.type === 'circle') return {x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2};
  if (c.type === 'line') {
    const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
    return {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
  }
  // Conservative logical em bounds; text y is its top, never its baseline.
  const w = Array.from(c.text).reduce((sum, ch) => sum + (ch.codePointAt(0) < 128 ? 0.65 : 1) * c.size, 0);
  return {x: c.x - (c.align === 'center' ? w / 2 : c.align === 'right' ? w : 0), y: c.y, w, h: c.size};
}
function inside(a, b, epsilon = 0.001) {
  return a.x >= b.x - epsilon && a.y >= b.y - epsilon && a.x + a.w <= b.x + b.w + epsilon && a.y + a.h <= b.y + b.h + epsilon;
}
function cellBox(f, r, c) { const b = f.board; return {x: b.x + c * b.cellW, y: b.y + r * b.cellH, w: b.cellW, h: b.cellH}; }
function cellCommands(f, r, c) { const b = cellBox(f, r, c); return f.commands.filter(cmd => inside(bounds(cmd), b)); }
function circles(f, r, c) { return cellCommands(f, r, c).filter(cmd => cmd.type === 'circle').length; }
function allFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `非有限 geometry: ${value}`);
  else if (value && typeof value === 'object') Object.values(value).forEach(allFinite);
}
function validate(f, w, h) {
  allFinite(f);
  for (const c of f.commands) {
    assert.ok(['rect', 'circle', 'line', 'text'].includes(c.type));
    assert.match(c.color, /^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    if (c.stroke) assert.match(c.stroke, /^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    if (c.type === 'rect') assert.ok(c.w >= 0 && c.h >= 0 && c.r >= 0);
    if (c.type === 'circle') assert.ok(c.r >= 0);
    if (c.type === 'line') assert.ok(c.points.length >= 2 && c.lineWidth > 0);
    if (c.type === 'text') assert.ok(c.size > 0);
    assert.ok(inside(bounds(c), {x: 0, y: 0, w, h}), `绘图越出屏幕 ${JSON.stringify(c)}`);
  }
  for (const hit of f.hits) {
    assert.ok(inside(hit, {x: 0, y: 60, w, h: h - 60}), `按钮侵入安全区或越界 ${hit.id}`);
    assert.ok(hit.w >= Math.max(44, 80 * w / 750) && hit.h >= Math.max(44, 80 * w / 750), `按钮过小 ${hit.id}`);
    assert.equal(V.hitTest(f, hit.x + hit.w / 2, hit.y + hit.h / 2), hit.id);
  }
}

test('公开 render、hitTest、cellAt，Frame 可序列化', () => {
  for (const name of ['render', 'hitTest', 'cellAt']) assert.equal(typeof V[name], 'function', `缺少 ${name} 函数`);
  const frame = render();
  assert.deepEqual(JSON.parse(JSON.stringify(frame)), frame);
});
for (const [w, h] of screens) {
  test(`${w}×${h} 所有 geometry 有限、颜色合法、文字与按钮不越界`, () => validate(render(model(), w, h), w, h));
  test(`${w}×${h} 九列厚牌全部位于棋盘内且留有细缝`, () => {
    const f = render(model(), w, h), b = f.board;
    assert.equal(b.cols, 9); assert.equal(b.rows, 7);
    const board = {x: b.x, y: b.y, w: b.cols * b.cellW, h: b.rows * b.cellH};
    assert.ok(inside(board, {x: 0, y: 200 * w / 750, w, h: h - 200 * w / 750}));
    const tiles = f.commands.filter(c => c.type === 'rect' && c.color === '#FFF9E9');
    assert.equal(tiles.length, 63);
    for (const tile of tiles) { assert.ok(inside(tile, board)); assert.ok(tile.w < b.cellW && tile.h < b.cellH); }
    assert.ok(b.cellW >= 50 * w / 750, '九列牌仍应可读');
  });
}
test('按钮 IDs 和独立命中，棋盘不会与按钮重叠', () => {
  const f = render();
  assert.deepEqual(f.hits.map(h => h.id).sort(), ['home', 'help', 'levels', 'hint', 'shuffle', 'undo', 'restart'].sort());
  for (const hit of f.hits) assert.equal(V.cellAt(f, hit.x + hit.w / 2, hit.y + hit.h / 2), null);
  assert.equal(V.hitTest(f, 0, 0), null);
  assert.equal(V.hitTest(f, NaN, 10), null);
  assert.equal(V.hitTest(f, Infinity, 10), null);
});
test('cellAt 左上坐标、半开边界，空格、木块和孔洞仍返回位置', () => {
  const f = render(model({grid: [[[], null, '#'], [['1p'], [], ['2p']]]})), b = f.board;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    assert.deepEqual(V.cellAt(f, b.x + (c + 0.5) * b.cellW, b.y + (r + 0.5) * b.cellH), {r, c});
  }
  assert.deepEqual(V.cellAt(f, b.x, b.y), {r: 0, c: 0});
  assert.equal(V.cellAt(f, b.x - 0.001, b.y), null);
  assert.equal(V.cellAt(f, b.x + 3 * b.cellW, b.y), null);
  assert.equal(V.cellAt(f, b.x, b.y + 2 * b.cellH), null);
  assert.equal(V.cellAt(f, NaN, b.y), null);
});
const modalActions = {
  help: ['close'], settings: ['close', 'toggle-motion', 'toggle-vibration'], restart: ['close', 'confirm-restart'],
  win: ['next', 'replay', 'levels'], levels: ['close', 'level:0', 'level:1', 'level:2', 'level:3', 'level:4', 'page-next'],
  home: ['continue', 'levels', 'help', 'settings']
};
for (const [modal, ids] of Object.entries(modalActions)) test(`${modal} 弹框只命中自身操作并阻断棋盘，序列化后也有效`, () => {
  for (const [w, h] of screens) {
    const f = render(model({modal}), w, h);
    assert.deepEqual(f.hits.map(h => h.id).sort(), ids.slice().sort());
    validate(f, w, h);
    const copy = JSON.parse(JSON.stringify(f));
    for (let r = 0; r < f.board.rows; r++) for (let c = 0; c < f.board.cols; c++) {
      const b = cellBox(f, r, c);
      assert.equal(V.cellAt(copy, b.x + b.w / 2, b.y + b.h / 2), null);
    }
  }
});
test('选关按最高已解锁索引提供操作，终关胜利不生成越界 next', () => {
  const f = render(model({modal: 'levels', maxLevel: 2}));
  assert.deepEqual(f.hits.map(h => h.id).sort(), ['close', 'level:0', 'level:1', 'level:2', 'page-next'].sort());
  const last = render(model({modal: 'win', levelIndex: 17}));
  assert.deepEqual(last.hits.map(h => h.id).sort(), ['home', 'levels', 'replay'].sort());
});
test('真实筒条万字牌面不同，筒子和竹条不是普通数字文本', () => {
  const faces = [...Array.from({length: 9}, (_, i) => `${i + 1}p`), ...Array.from({length: 9}, (_, i) => `${i + 1}s`), ...Array.from({length: 9}, (_, i) => `${i + 1}m`), ...Array.from({length: 7}, (_, i) => `${i + 1}z`)];
  const signatures = new Set();
  for (const face of faces) {
    const f = render(model({grid: [[[face]]]}));
    const commands = cellCommands(f, 0, 0);
    signatures.add(JSON.stringify(commands));
    if (face.endsWith('p') || face.endsWith('s')) {
      assert.ok(commands.some(c => c.type === 'circle' || c.type === 'line'));
      assert.ok(!commands.some(c => c.type === 'text' && /^[1-9]$/.test(c.text)));
    }
    if (face === '9p') assert.ok(circles(f, 0, 0) >= 9);
  }
  assert.equal(signatures.size, 34, '不能让不同麻将牌面退化成同一张贴图');
});
test('叠牌有绿色牌背与明确层数，只绘制顶牌正面', () => {
  const one = render(model({grid: [[['3p']]]}));
  const stack = render(model({grid: [[['1s', '2m', '3p']]]}));
  assert.equal(circles(stack, 0, 0), circles(one, 0, 0));
  const cs = cellCommands(stack, 0, 0);
  assert.ok(cs.some(c => c.type === 'text' && /3/.test(c.text)));
  assert.ok(cs.filter(c => c.type === 'rect' && c.color === '#81AF68').length >= 2);
});
test('空孔、可用空格与木块不同，木块有两条交叉纹理', () => {
  const f = render(model({grid: [[null, [], '#']]}));
  const hole = cellCommands(f, 0, 0), empty = cellCommands(f, 0, 1), wood = cellCommands(f, 0, 2);
  assert.notDeepEqual(hole.map(c => [c.type, c.color]), empty.map(c => [c.type, c.color]));
  assert.ok(wood.filter(c => c.type === 'line' && c.points.length === 2 && c.points[0].x !== c.points[1].x && c.points[0].y !== c.points[1].y).length >= 2);
});
test('锁行和锁列有外侧锁图标及双轨，不把孤立单格误标成锁行', () => {
  const grid = Array.from({length: 4}, () => Array.from({length: 5}, () => ['1p']));
  const free = render(model({grid}));
  const locked = render(model({grid, runs: runsFor(grid, [1], [2])}));
  const b = locked.board;
  const extras = locked.commands.filter(c => !free.commands.some(d => JSON.stringify(c) === JSON.stringify(d)));
  assert.ok(extras.some(c => c.type === 'rect' && c.x < b.x && Math.abs(c.y - (b.y + b.cellH * 1.5)) < 24));
  assert.ok(extras.some(c => c.type === 'rect' && c.y < b.y && Math.abs(c.x - (b.x + b.cellW * 2.5)) < 24));
  assert.ok(extras.filter(c => c.type === 'line' && bounds(c).w > b.cellW * 4).length >= 2, '行双轨应横贯可用段');
  assert.ok(extras.filter(c => c.type === 'line' && bounds(c).h > b.cellH * 3).length >= 2, '列双轨应纵贯可用段');
  const isolated = render(model({grid: [[['1p'], null, ['2p']]]}));
  assert.ok(!isolated.commands.some(c => c.type === 'text' && /锁轨/.test(c.text)));
});
test('hint 只显示第一步，match 双方和 selected 高亮', () => {
  const grid = [[['1p'], ['1p'], ['2p']]], base = render(model({grid}));
  const first = {kind: 'match', a: {r: 0, c: 0}, b: {r: 0, c: 1}};
  const hint = render(model({grid, hint: [first]}));
  const later = render(model({grid, hint: [first, {kind: 'slide', run: 0, step: 1}]}));
  assert.deepEqual(hint, later);
  for (const c of [0, 1]) assert.notDeepEqual(cellCommands(hint, 0, c), cellCommands(base, 0, c));
  assert.deepEqual(cellCommands(hint, 0, 2), cellCommands(base, 0, 2));
  const selected = render(model({grid, selected: {r: 0, c: 2}}));
  assert.notDeepEqual(cellCommands(selected, 0, 2), cellCommands(base, 0, 2));
});
test('slide 提示给对应跑道双向箭头，行列方向均正确', () => {
  const grid = [[['1p'], ['2p'], ['3p']], [['4p'], ['5p'], ['6p']], [['7p'], ['8p'], ['9p']]];
  const m = model({grid}), base = render(m);
  for (const [axis, index] of [['row', 0], ['col', 0]]) {
    const run = m.runs.findIndex(r => r.axis === axis && r.index === index);
    const f = render({...m, hint: [{kind: 'slide', run, step: 1}]});
    const extras = f.commands.filter(c => !base.commands.some(d => JSON.stringify(c) === JSON.stringify(d)));
    const arrows = extras.filter(c => c.type === 'line' && c.points.length === 3);
    assert.ok(arrows.length >= 2);
    assert.ok(arrows.some(c => axis === 'row' ? bounds(c).h > bounds(c).w : bounds(c).w > bounds(c).h));
    for (const p of m.runs[run].cells) assert.notDeepEqual(cellCommands(f, p.r, p.c), cellCommands(base, p.r, p.c));
  }
});
test('循环拖动按格预览，正负跨多圈、孔洞分段和列拖动不越界也不修改输入', () => {
  const grid = [[['2p'], ['3p'], '#', ['4p'], ['5p']], [['6p'], ['7p'], null, [], []]];
  const m = model({grid}), original = JSON.stringify(m), base = render(m);
  const rowRun = m.runs.findIndex(r => r.axis === 'row' && r.index === 0 && r.cells[0].c === 0);
  const colRun = m.runs.findIndex(r => r.axis === 'col' && r.index === 0);
  for (const offset of [1, -1, 5, -5, 1001, -1001, 0.65]) {
    const f = render({...m, drag: {run: rowRun, offset}});
    assert.equal(circles(f, 0, 0), circles(base, 0, 1));
    assert.equal(circles(f, 0, 1), circles(base, 0, 0));
    assert.deepEqual(cellCommands(f, 0, 3), cellCommands(base, 0, 3));
    for (const tile of f.commands.filter(c => c.type === 'rect' && c.color === '#FFF9E9')) {
      assert.ok(Array.from({length: 2}, (_, r) => Array.from({length: 5}, (_, c) => cellBox(f, r, c))).flat().some(b => inside(tile, b)), '牌不能跨格绘制');
    }
  }
  const col = render({...m, drag: {run: colRun, offset: -1}});
  assert.equal(circles(col, 0, 0), circles(base, 1, 0));
  assert.equal(circles(col, 1, 0), circles(base, 0, 0));
  assert.equal(JSON.stringify(m), original);
});
test('effect 进度有界，减少动态保留静态反馈且输出确定', () => {
  const m = model({effect: {cells: [{r: 0, c: 0}, {r: 6, c: 8}], progress: 0.25}, lastChain: 3});
  validate(render(m), 750, 1334);
  assert.deepEqual(render(m), render(m));
  assert.notDeepEqual(render(m), render({...m, effect: {...m.effect, progress: 0.75}}));
  assert.deepEqual(render({...m, reducedMotion: true}), render({...m, reducedMotion: true, effect: {...m.effect, progress: 0.75}}));
  for (const progress of [-10, 10, NaN]) validate(render({...m, effect: {...m.effect, progress}}), 750, 1334);
});
test('长文案及极端计数不会溢出，空棋盘几何有效', () => {
  for (const [w, h] of screens) validate(render(model({message: '掌柜说：相邻的同牌可以消除，拖动整段循环，不限步数。'.repeat(30), moves: 1000000000, total: 1000000000}), w, h), w, h);
  for (const grid of [[], [[]]]) {
    const f = render(model({grid, runs: []}));
    validate(f, 750, 1334);
    assert.equal(V.cellAt(f, f.board.x, f.board.y), null);
  }
});
test('三章分页只显示六关，首页与各章在所有屏幕尺寸不越界',()=>{
  for(const [w,h]of screens)for(let page=0;page<3;page++){
    const f=render(model({modal:'levels',levelPage:page,maxLevel:17}),w,h);
    validate(f,w,h);assert.equal(f.hits.filter(h=>h.id.startsWith('level:')).length,6);
    assert.ok(f.hits.some(h=>h.id===`level:${page*6}`));
    validate(render(model({modal:'home'}),w,h),w,h);
  }
});
test('辅助耗尽和无撤销历史时禁用按钮，结算只画实际星级',()=>{
  const f=render(model({hintsLeft:0,shufflesLeft:0,canUndo:false}));
  assert.ok(!f.hits.some(h=>['hint','shuffle','undo'].includes(h.id)));
  const win=render(model({modal:'win',rating:1}));
  assert.ok(win.commands.some(c=>c.type==='text'&&c.text.includes('三星目标')));
});
