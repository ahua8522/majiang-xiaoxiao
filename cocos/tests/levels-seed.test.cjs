/**
 * 种子冻结门禁。
 *
 * 关卡内容 = `map`（形状）+ `seed`（发牌种子）的纯函数。这两行一旦定死，
 * 玩家任何时候进第 N 关看到的都是同一盘——这是「预生成」的全部含义，
 * 也是切图审阅、作者试解、每日挑战「全员同关」能成立的前提。
 *
 * 因此这个文件守的不是「能不能出解」（generation.test.cjs 管），
 * 而是「内容有没有被悄悄重摇」：`author-levels.cjs` 从不读回 levels.ts，
 * 全靠它自己 require 上一次编译出来的旧表继承 seed，一旦这条断了，
 * 任何一处 `i >= 常量` 的改动都会让已经发布的关卡换一副牌。
 */
const {test} = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const core = (name) => require(path.join(__dirname, '..', '.test', 'core', name));

const G = core('Generator.js');
const R = core('Rules.js');
const LEVELS = G.LEVELS;

/** map 字符含义：`.` 空洞 `#` 木桩 `1/2/3` 该格叠了几层。牌位 = 各格层数之和。 */
const slotsOf = (map) =>
  map.reduce((n, row) => n + [...row].reduce((m, ch) => m + ('123'.includes(ch) ? Number(ch) : 0), 0), 0);

test('关卡表存在且非空（先跑 npm run build:core）', () => {
  assert.ok(Array.isArray(LEVELS) && LEVELS.length > 0, 'LEVELS 为空：先跑 npm run build:core');
});

test('每一关都钉了合法种子', () => {
  LEVELS.forEach((def, i) => {
    assert.ok(Number.isInteger(def.seed) && def.seed >= 0 && def.seed <= 0xFFFFFFFF,
      `第 ${i + 1} 关缺 seed（内容还没冻结）`);
  });
});

test('钉住的种子能发出满盘，牌位一个不差', () => {
  LEVELS.forEach((def, i) => {
    assert.ok(Number.isInteger(def.seed), `第 ${i + 1} 关没有 seed`);
    const deal = G.generate(i, def.seed);
    assert.strictEqual(R.count(deal.grid), slotsOf(def.map),
      `第 ${i + 1} 关 seed ${def.seed} 发出的盘面牌位不等于 map 定义的 ${slotsOf(def.map)}`);
  });
});

test('指纹必须等于当前引擎用该种子发出的盘面（内容真的冻住了）', () => {
  // 这一条才是"预生成"的承重墙：seed 相同不代表盘面相同——生成器实现改一行就会换牌。
  // 实测发生过：重写 constructOnce 的候选排序之后，120 关 map 一字未动、30 关参考解变了。
  const stale = [];
  LEVELS.forEach((def, i) => {
    if (!Number.isInteger(def.seed) || !def.hash) return;   // 缺字段由上面两条报，这里只验一致性
    const deal = G.generate(i, def.seed);
    if (R.boardHash(deal.grid) !== def.hash) stale.push(i + 1);
  });
  assert.deepEqual(stale, [],
    `第 ${stale.slice(0, 12).join('、')} 关：种子还在，盘面却已经不是当初那一盘——生成器实现变了，请跑 npm run author:levels 重钉并重新试玩`);
});

test('同一关同一种子重放两次，盘面完全一致（内容冻结的定义）', () => {
  const sample = [0, 41, 119].filter((i) => LEVELS[i] && Number.isInteger(LEVELS[i].seed));
  assert.ok(sample.length >= 3, '抽样关卡没有钉种子');
  sample.forEach((i) => {
    const a = JSON.stringify(G.generate(i, LEVELS[i].seed).grid);
    const b = JSON.stringify(G.generate(i, LEVELS[i].seed).grid);
    assert.strictEqual(a, b, `第 ${i + 1} 关不确定`);
  });
});

test('换一颗种子必须给出不同的盘（否则 seed 字段是假的）', () => {
  const sample = [0, 6, 30].filter((i) => LEVELS[i] && Number.isInteger(LEVELS[i].seed));
  assert.strictEqual(sample.length, 3, '抽样关卡没钉种子，这条断言会空转');
  sample.forEach((i) => {
    const def = LEVELS[i];
    const mine = JSON.stringify(G.generate(i, def.seed).grid);
    const other = JSON.stringify(G.generate(i, (def.seed + 1) >>> 0).grid);
    assert.notStrictEqual(mine, other, `第 ${i + 1} 关换种子仍是同一盘，seed 没参与发牌`);
  });
});
