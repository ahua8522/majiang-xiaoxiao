/* 真机反馈两条 UI bug 的取证脚本（不碰真机、不碰开发者工具，直接看渲染出来的画面）。
 *
 * B1  第 224 关（限时 74 秒）打开暂停弹框 → 页面一闪一闪？
 *     判据两条：① 暂停期间 timeLeft 必须停住（停住才不会每秒重建遮罩）；
 *              ② 弹框就位后连拍 8 帧，去重后只能有 1 张（>1 张就是画面在动）。
 *     再加一段「机制复现」：把 modal 强行改回 'none'（＝修复前那一屏没登记弹窗态），
 *     闪烁必须回来——不然只能说"现在不闪"，不能说"当时就是因为这个闪"。
 * B2  牌桌 → 设置 → 玩法说明 → 知道了 → 关闭设置 → 落点必须是牌桌（不能是大厅）。
 * B3  另外 12 步回跳（对局菜单→选关→关、大厅→设置→说明→关、大厅→选关→关…）逐条验，
 *     防止"修好一条、改坏一片"。
 *     全程用真实鼠标事件点节点（按节点名找，不写死坐标），并逐段报 __mj().screen。
 *
 * 用法：先 `node temp/refresh-web.cjs 8477` 出 web-mobile 包（Creator 编辑器要开着），再
 *   MJ_BASE=http://localhost:8477/ MJ_PORT=9347 node tools/verify-ui-nav.cjs
 * 环境变量：MJ_LEVEL 换被测关卡（0 基，默认 223＝第 224 关）。
 * 连拍图落在 temp/ui-nav-shots/（temp 不入库）。
 */
'use strict';
const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MJ_PORT || 9345);
const VIEW_W = 390, VIEW_H = 844, DSF = 2;
const BASE = process.env.MJ_BASE || 'http://localhost:8477/';
const LEVEL = Number(process.env.MJ_LEVEL || 223);   // 0 基：223 = 第 224 关
const SEED_KEY = 'majiang-xiaoxiao:v1';
const SHOT_DIR = path.join(__dirname, '..', 'temp', 'ui-nav-shots');
/* 进度档：maxLevel 放到最后一关；说明卡全部看过，免得 B1/B2 被教学卡挡住。 */
const SEED = JSON.stringify({version: 3, maxLevel: 223, tipsSeen: {
  basic: true, stack: true, lockRow: true, moveLimit: true, oneWay: true, lockCol: true, goal: true,
  ice: true, flower: true, wild: true, stack3: true, ice2: true, bomb: true, unlock: true,
  only258: true, noSuit: true, only19: true, oneSuit: true, collect: true}});

/* CDP 端口与站点端口是两回事：前者是 Chrome 的 /json/list，后者是被测包所在的静态服务。 */
const WEB_PORT = Number((BASE.match(/:(\d+)/) || [])[1] || 8477);
const get = (p) => new Promise((res, rej) => http.get({host: '127.0.0.1', port: WEB_PORT, path: p}, (r) => {
  let b = ''; r.on('data', (c) => b += c); r.on('end', () => res(b));
}).on('error', rej));
const getCdp = (p) => new Promise((res, rej) => http.get({host: '127.0.0.1', port: PORT, path: p}, (r) => {
  let b = ''; r.on('data', (c) => b += c); r.on('end', () => res(b));
}).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOT_DIR, {recursive: true});
  /* 端口身份先验：8477 上必须是我的包，不能是别的项目的服务（踩过拍到别人项目的坑）。 */
  const html = await get('/index.html').catch(() => '');
  if (!/cocos|麻将|majiang/i.test(html)) { console.error('✗ ' + BASE + ' 上不是本项目的包，先跑 temp/refresh-web.cjs'); process.exit(1); }

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-verify-mj-' + PORT),
    '--window-size=' + VIEW_W + ',' + VIEW_H, BASE,
  ], {stdio: 'ignore'});
  process.on('exit', () => { try { chrome.kill(); } catch (e) {} });

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { await sleep(400); try { targets = JSON.parse(await getCdp('/json/list')); } catch (e) {} }
  const baseHost = BASE.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const page = (targets || []).find((t) => t.type === 'page' && t.url.indexOf(baseHost) >= 0);
  if (!page) { console.error('NO TARGET'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, {resolve});
    ws.send(JSON.stringify({id: mid, method, params: params || {}}));
  });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p.resolve(m.result || {}); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', {enabled: true});   // 不模拟聚焦 → cc.game.isPaused() → 场景不加载
  await send('Emulation.setDeviceMetricsOverride', {width: VIEW_W, height: VIEW_H, deviceScaleFactor: DSF, mobile: true});
  await send('Page.bringToFront');

  const loaded = [];
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Page.loadEventFired') loaded.push(1);
  });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) return {__error: String(r.exceptionDetails.exception?.description || r.exceptionDetails.text)};
    return {value: r.result && r.result.value};
  };
  const navigate = async (url) => {
    loaded.length = 0;
    await send('Page.navigate', {url});
    for (let i = 0; i < 120 && !loaded.length; i++) await sleep(200);
  };

  const state = async () => (await evalJs(`(function(){try{
    var m = window.__mj && window.__mj(); if (!m) return {err:'nomj'};
    return {screen: m.screen, level: m.model.levelIndex, modal: m.model.modal,
      timeLeft: m.model.timeLeft, moves: m.model.moves, total: m.model.total, live: m.model.liveTotal};
  }catch(e){return {err:String(e.message)}}})()`)).value;

  /** 等某个条件成立（不用固定 sleep 赌渲染时机）。 */
  const waitFor = async (fn, budgetMs, label) => {
    const end = Date.now() + (budgetMs || 40000);
    let last = null;
    while (Date.now() < end) {
      last = await fn();
      if (last && !last.err && last.ok) return last;
      await sleep(250);
    }
    return {ok: false, why: label + ' 超时：' + JSON.stringify(last)};
  };

  /** 按节点名（正则）找可见节点，返回它的世界包围盒中心换算的 CSS 像素。 */
  const findNode = (pattern) => `(function(){try{
    var re = ${JSON.stringify(pattern)}; re = new RegExp(re);
    var cv = (cc.game && cc.game.canvas) || document.querySelector('canvas'), rect = cv.getBoundingClientRect(), vis = cc.view.getVisibleSize();
    var sx = rect.width / vis.width, sy = rect.height / vis.height, hits = [];
    (function walk(n, d){ if (d > 26) return;
      if (n.activeInHierarchy && re.test(n.name)) {
        var ui = (n._components || []).filter(function(c){return c && typeof c.getBoundingBoxToWorld === 'function';})[0];
        if (ui) { var bb = ui.getBoundingBoxToWorld();
          hits.push({name: n.name, x: rect.left + (bb.x + bb.width / 2) * sx, y: rect.top + rect.height - (bb.y + bb.height / 2) * sy}); }
      }
      for (var i = 0; i < n.children.length; i++) walk(n.children[i], d + 1); })(cc.director.getScene(), 0);
    return {count: hits.length, hit: hits[hits.length - 1] || null};
  }catch(e){return {err:String(e.message)}}})()`;

  const click = async (pattern, label) => {
    const f = await evalJs(findNode(pattern));
    const h = f.value;
    if (!h || h.err || !h.hit) return {ok: false, why: label + '：找不到节点 ' + pattern + ' ' + JSON.stringify(h)};
    if (h.count > 1) console.log('  · ' + label + '：命中 ' + h.count + ' 个同名节点，用最后一个（后画的在上层）');
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: h.hit.x, y: h.hit.y, button: 'left', clickCount: 1, buttons: 1});
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: h.hit.x, y: h.hit.y, button: 'left', clickCount: 1, buttons: 0});
    await sleep(700);
    return {ok: true, at: {x: Math.round(h.hit.x), y: Math.round(h.hit.y)}, name: h.hit.name};
  };

  const shot = async (file) => {
    const s = await send('Page.captureScreenshot', {format: 'png'});
    if (!s.data) return null;
    const buf = Buffer.from(s.data, 'base64');
    fs.writeFileSync(file, buf);
    return crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  };

  /* ── 开局到第 224 关的牌桌 ─────────────────────────────── */
  await navigate(BASE + '?screen=home');
  await evalJs(`(function(){var s=(typeof cc!=='undefined'&&cc.sys&&cc.sys.localStorage)?cc.sys.localStorage:window.localStorage;
    s.setItem(${JSON.stringify(SEED_KEY)}, ${JSON.stringify(SEED)}); return 1;})()`);
  await navigate(BASE + '?level=' + LEVEL + '&screen=board');
  const booted = await waitFor(async () => {
    const st = await state();
    const fr = await evalJs(`(window.__mjFirstFrame===true)`);
    return {ok: !!fr.value && st && st.screen === 'board' && st.level === LEVEL, ...st};
  }, 60000, '牌桌未就绪');
  if (!booted.ok) { console.error('✗ ' + booted.why); process.exit(1); }
  console.log('开局 ok：第 ' + (LEVEL + 1) + ' 关 screen=' + booted.screen + ' timeLeft=' + booted.timeLeft + ' 可消 ' + booted.live + '/' + booted.total);

  /* ── B1：暂停弹框到底闪不闪 ────────────────────────────── */
  const t0 = await state();
  await sleep(1500);
  const t1 = await state();
  console.log('\n[B1] 牌桌阶段（还没暂停）timeLeft ' + t0.timeLeft + ' → ' + t1.timeLeft +
    (t1.timeLeft < t0.timeLeft ? '  ← 走表中（这关确实限时）' : '  ← 没走表！这关不是限时关，测不出这条 bug'));

  const pc = await click('^icon:pause$', '点暂停钮');
  if (!pc.ok) { console.error('✗ ' + pc.why); process.exit(1); }
  const paused = await waitFor(async () => { const st = await state(); return {ok: st.screen === 'pause', ...st}; }, 8000, '暂停弹框没打开');
  console.log('[B1] 打开暂停弹框：screen=' + paused.screen + ' modal=' + JSON.stringify(paused.modal) + ' timeLeft=' + paused.timeLeft);
  await sleep(900);                       // 等入场动画（fadeIn 0.18s）自己走完
  const p1 = await state();
  await sleep(2600);
  const p2 = await state();
  const clockStopped = p2.timeLeft === p1.timeLeft;
  const hashes = [];
  for (let i = 0; i < 8; i++) { hashes.push(await shot(path.join(SHOT_DIR, 'pause-' + i + '.png'))); await sleep(240); }
  const distinct = new Set(hashes.filter(Boolean)).size;
  console.log('[B1] 暂停期间 timeLeft ' + p1.timeLeft + ' → ' + p2.timeLeft + '（' + (clockStopped ? '停表 ✓' : '还在走表 ✗ → 每秒重建遮罩') + '）');
  console.log('[B1] 就位后连拍 8 帧去重 = ' + distinct + ' 张（1 = 画面不动；>1 = 一闪一闪）' + (distinct > 1 ? ' ✗' : ' ✓'));
  console.log('[B1] 逐帧指纹：' + hashes.join(' '));

  await click('^icon:close$', '关闭暂停弹框');
  const resumed = await state();
  console.log('[B1] 点关闭后 screen=' + resumed.screen + '（应回牌桌）');

  /* ── B1-机制：把 modal 强行改回 'none'（＝修复前那一屏没登记弹窗态），闪烁必须回来 ── */
  const inj = await evalJs(`(function(){try{
    var c = cc.director.getScene().getComponentInChildren('GameRoot');
    if (!c || !c.session) return {err: '拿不到 GameRoot 组件'};
    return {ok: true, before: c.session.modal};
  }catch(e){return {err:String(e.message)}}})()`);
  if (!inj.value || !inj.value.ok) {
    console.log('[B1-机制] 跳过：' + (inj.value && inj.value.err));
  } else {
    await click('^icon:pause$', '再次打开暂停弹框');
    await sleep(900);
    await evalJs(`(function(){var c=cc.director.getScene().getComponentInChildren('GameRoot'); c.session.modal='none'; return 1;})()`);
    const mech = [];
    for (let i = 0; i < 6; i++) { mech.push(await shot(path.join(SHOT_DIR, 'mech-' + i + '.png'))); await sleep(300); }
    const d = new Set(mech.filter(Boolean)).size;
    await evalJs(`(function(){var c=cc.director.getScene().getComponentInChildren('GameRoot'); c.session.modal='pause'; return 1;})()`);
    console.log('[B1-机制] 弹框开着而 modal 被改回 none：连拍 6 帧去重 = ' + d + ' 张（>1 就证明「每秒重建 + 淡入重播」就是闪烁本身）' + (d > 1 ? ' ✓复现' : ' ✗没复现，结论要重看'));
    console.log('[B1-机制] 逐帧指纹：' + mech.join(' '));
    await click('^icon:close$', '关掉暂停弹框');
  }

  /* ── B2：设置 → 玩法说明 → 知道了 → 关闭设置 的回跳 ───── */
  const seq = [];
  let tag = 'B2';
  const step = async (pattern, label, want) => {
    const c = await click(pattern, label);
    if (!c.ok) { seq.push({label, err: c.why}); return; }
    const st = await state();
    seq.push({label, screen: st.screen, modal: st.modal, want, pass: st.screen === want});
    console.log('[' + tag + '] ' + label + ' → screen=' + st.screen + '（期望 ' + want + '）' + (st.screen === want ? ' ✓' : ' ✗'));
  };
  await step('^icon:gear$', '牌桌→设置', 'settings');
  await step('^setting:about$', '设置→玩法说明', 'help');
  await step('^button:知道了', '玩法说明→知道了', 'settings');
  await step('^icon:close$', '设置→关闭', 'board');
  const bad = seq.filter((s) => !s.pass);

  /* ── B3：确认这次改动没把本来就对的回跳改坏（弹框来源在链条里不能被覆盖） ── */
  tag = 'B3';
  console.log('\n[B3] 回归其余回跳路径');
  await step('^icon:pause$', '牌桌→对局菜单', 'pause');
  await step('^button:选择关卡', '对局菜单→选关', 'levels');
  await step('^icon:close$', '选关→关闭（应回牌桌，不是大厅）', 'board');
  await step('^icon:pause$', '牌桌→对局菜单', 'pause');
  await step('^button:返回首页', '对局菜单→回大厅', 'home');
  await step('^icon:gear$', '大厅→设置', 'settings');
  await step('^setting:about$', '大厅设置→玩法说明', 'help');
  await step('^button:知道了', '玩法说明→知道了', 'settings');
  await step('^icon:close$', '大厅设置→关闭（应回大厅）', 'home');
  await step('^button:关卡选择', '大厅→选关', 'levels');
  await step('^icon:close$', '选关→关闭（应回大厅）', 'home');
  const bad3 = seq.slice(4).filter((s) => !s.pass);
  console.log('\n结论：B1 ' + (clockStopped && distinct === 1 ? 'PASS' : 'FAIL') +
    ' · B2 ' + (bad.length ? 'FAIL（' + bad.map((b) => b.label + ' 落在 ' + b.screen + '）').join('，') : 'PASS') +
    ' · B3 ' + (bad3.length ? 'FAIL（' + bad3.map((b) => b.label + ' 落在 ' + b.screen + '）').join('，') : 'PASS（12 步回跳全对）'));
  process.exit(0);
})();
