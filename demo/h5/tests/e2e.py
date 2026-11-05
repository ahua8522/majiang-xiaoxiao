"""Browser end-to-end checks for the H5 demo.

Drives the real page with Playwright: taps the canvas, drags rows/columns, clears a
level with the generator's certified solution, and asserts the UI state transitions.

Prerequisites:  pip install playwright && playwright install chromium
Run:            npm run demo:test        (starts its own server)
                python demo/h5/tests/e2e.py --url http://127.0.0.1:8090/
"""
import argparse
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
DEMO = HERE.parent
fails = []
count_ok = 0


def ok(cond, msg):
    global count_ok
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if cond:
        count_ok += 1
    else:
        fails.append(msg)


def main(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 420, 'height': 760}, device_scale_factor=2)
        errors = []
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type == 'error' else None)

        def load(**q):
            page.goto(url + '?' + '&'.join(f'{k}={v}' for k, v in q.items()))
            page.wait_for_function('window.__mjReady === true', timeout=10000)
            page.wait_for_timeout(220)

        def state():
            return page.evaluate("""() => { const s = window.mj.session;
              return {level: s.levelIndex, moves: s.moves, modal: s.modal, screen: window.mj.screen,
                      left: s.grid.flat().filter(c => Array.isArray(c)).reduce((n, c) => n + c.length, 0),
                      hints: s.hintsLeft, shuffles: s.shufflesLeft, rows: s.grid.length, cols: s.grid[0].length,
                      stars: s.stars, max: s.maxLevel, grid: s.grid}; }""")

        def hit(id_):
            return page.evaluate("""(id) => { const a = window.mj; const h = a.hits.find(h => h.id === id);
              if (!h) return null; const r = a.canvas.getBoundingClientRect();
              return [r.left + (h.x + h.w / 2) * a.s, r.top + (h.y + h.h / 2) * a.s]; }""", id_)

        def tap(id_):
            pt = hit(id_)
            ok(pt is not None, f'{id_} is hittable')
            if not pt:
                return
            page.mouse.move(*pt)
            page.mouse.down()
            page.wait_for_timeout(40)
            page.mouse.up()
            page.wait_for_timeout(200)

        def center(rc):
            return page.evaluate("""(rc) => { const a = window.mj, b = a.boardBox, r = a.canvas.getBoundingClientRect();
              const cw = b.w / a.session.grid[0].length, ch = b.h / a.session.grid.length;
              return [r.left + (b.x + (rc.c + .5) * cw) * a.s, r.top + (b.y + (rc.r + .5) * ch) * a.s]; }""", rc)

        def tap_cell(rc):
            page.mouse.move(*center(rc))
            page.mouse.down()
            page.wait_for_timeout(40)
            page.mouse.up()
            page.wait_for_timeout(160)

        def drag_cells(rc, cells, axis='row'):
            x0, y0 = center(rc)
            step = page.evaluate("""(axis) => { const b = window.mj.boardBox, g = window.mj.session.grid;
              return axis === 'row' ? b.w / g[0].length : b.h / g.length; }""", axis)
            scale = page.evaluate('() => window.mj.s')
            x1, y1 = (x0 + step * scale * cells, y0) if axis == 'row' else (x0, y0 + step * scale * cells)
            page.mouse.move(x0, y0)
            page.mouse.down()
            page.wait_for_timeout(40)
            for i in range(1, 13):
                page.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12)
                page.wait_for_timeout(14)
            page.mouse.up()
            page.wait_for_timeout(240)

        # 1. home → board
        load(screen='home', level=0)
        ok(state()['screen'] == 'home', 'loads on the home screen')
        tap('start')
        st = state()
        ok(st['screen'] == 'board', '开始游戏 enters the board')
        ok((st['rows'], st['cols']) == (3, 4), f"level 1 board is 3x4 (got {st['rows']}x{st['cols']})")

        # 2. tap-to-match
        pr = page.evaluate("""() => { const g = window.mj.session.grid; const out = [];
          for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) { const a = g[r][c];
            if (!Array.isArray(a) || !a.length) continue;
            for (const [dr, dc] of [[0, 1], [1, 0]]) { const b = g[r + dr] && g[r + dr][c + dc];
              if (Array.isArray(b) && b.length && b[b.length - 1] === a[a.length - 1]) out.push([r, c]); } }
          return out; }""")
        ok(len(pr) > 0, 'level 1 exposes an adjacent pair')
        before = state()
        tap_cell({'r': pr[0][0], 'c': pr[0][1]})
        after = state()
        ok(after['moves'] > before['moves'], f"tapping a pair counts a move ({before['moves']} -> {after['moves']})")
        ok(after['left'] < before['left'], f"tapping a pair removes tiles ({before['left']} -> {after['left']})")

        # 3. drag a row
        load(screen='board', level=11)
        run = page.evaluate("""() => { const r = window.mj.session.runs.find(r => r.axis === 'row' && r.cells.length >= 3);
          return r ? {a: r.cells[0], n: r.cells.length} : null; }""")
        ok(run is not None, 'a slideable row exists')
        if run:
            b4 = state()
            drag_cells(run['a'], 1, 'row')
            a4 = state()
            ok(a4['moves'] > b4['moves'], f"dragging a row counts a move ({b4['moves']} -> {a4['moves']})")
            ok(a4['left'] <= b4['left'], f"dragging a row never adds tiles ({b4['left']} -> {a4['left']})")

        # 4. tools
        b5 = state()
        tap('hint')
        a5 = state()
        ok(a5['hints'] == b5['hints'] - 1, f"提示 spends a charge ({b5['hints']} -> {a5['hints']})")
        b6 = state()
        tap('undo')
        a6 = state()
        ok(a6['moves'] == b6['moves'], f"撤销 keeps spent moves ({b6['moves']} -> {a6['moves']})")
        if run:
            ok(a6['grid'] == b4['grid'], '撤销 restores the board before the drag, including all cascades')
        ok(a6['hints'] == b6['hints'], '撤销 does not refund a spent hint')
        b7 = state()
        tap('shuffle')
        a7 = state()
        ok(a7['shuffles'] == b7['shuffles'] - 1, f"洗牌 spends a charge ({b7['shuffles']} -> {a7['shuffles']})")

        # 5. pause
        tap('pause')
        ok(state()['screen'] == 'pause', 'the gear opens 已暂停')
        tap('resume')
        ok(state()['screen'] == 'board', '继续游戏 returns to the board')
        tap('pause')
        tap('home')
        ok(state()['screen'] == 'home', '返回首页 leaves the board')

        # 6. settings + help
        load(screen='settings', level=0)
        ok(state()['screen'] == 'settings', 'settings deep link works')
        vib = page.evaluate('() => window.mj.session.vibration')
        tap('toggle-vibration')
        ok(page.evaluate('() => window.mj.session.vibration') != vib, '震动 toggles')
        tap('about')
        ok(state()['screen'] == 'help', '关于我们 opens the rules screen')
        tap('back-home')
        ok(state()['screen'] == 'settings', 'the rules back button returns to settings')

        # 7. level select
        load(screen='levels', level=0)
        page.evaluate('() => { window.mj.session.maxLevel = 4; window.mj.session.stars = {"0": 3, "1": 2}; window.mj.invalidate(); }')
        page.wait_for_timeout(200)
        ok(hit('level:3') is not None, 'an unlocked level is hittable')
        ok(hit('level:9') is None, 'a locked level is not hittable')
        tap('level:3')
        st = state()
        ok(st['level'] == 3 and st['screen'] == 'board', f"picking level 4 starts it (level={st['level']})")

        # 8. clear a level with the certified solution, then 下一关
        load(screen='board', level=5)
        page.evaluate("""() => { const s = window.mj.session;
          for (let i = 0; i < 300 && s.modal !== 'win'; i++) { const a = s.solution[0]; if (!a) break;
            if (a.kind === 'match') s.tap(a.a); else s.slide(a.run, a.step); }
          window.mj.act(() => {}); window.mj.invalidate(); }""")
        page.wait_for_timeout(250)
        won = state()
        ok(won['modal'] == 'win' and won['screen'] == 'win', 'clearing the board shows 恭喜通关')
        ok(won['stars'].get('5') == 3, f"a no-assist clear records 3 stars ({won['stars']})")
        lvl = won['level']
        tap('next')
        st = state()
        ok(st['screen'] == 'board' and st['level'] == lvl + 1, f"下一关 advances (l{lvl} -> l{st['level']})")

        # 9. progress + persistence
        load(screen='progress', level=0)
        ok(state()['screen'] == 'progress', 'progress deep link works')
        ok(sum(state()['stars'].values()) >= 3, 'cleared stars show in 关卡进度')

        # 10. responsive canvas
        for vw, vh in [(360, 640), (420, 760), (768, 1024), (1280, 720)]:
            page.set_viewport_size({'width': vw, 'height': vh})
            page.wait_for_timeout(180)
            fits = page.evaluate("""() => { const c = document.getElementById('cv').getBoundingClientRect();
              return c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1; }""")
            ok(fits, f'canvas fits {vw}x{vh}')

        ok(not errors, 'no console or page errors: ' + str(errors[:3]))
        browser.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=None, help='base URL; a temporary server is started when omitted')
    args = ap.parse_args()
    server = None
    url = args.url
    if not url:
        port = '8097'
        server = subprocess.Popen(['node', str(DEMO / 'serve.cjs'), port], cwd=str(DEMO.parent.parent))
        time.sleep(1.2)
        url = f'http://127.0.0.1:{port}/'
    try:
        main(url)
    finally:
        if server:
            server.terminate()
    print()
    print(f'passed {count_ok}, failed {len(fails)}')
    for f in fails:
        print(' -', f)
    sys.exit(1 if fails else 0)
