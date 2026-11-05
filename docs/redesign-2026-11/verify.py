"""Browser checks for the standalone design study; production storage is untouched."""
import json
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent
SHOTS = ROOT / 'screenshots'
SHOTS.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:8788/'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def shot(name):
        # Finish the finite screen/dialog entrance before capturing its actual colors.
        page.wait_for_timeout(330)
        page.screenshot(path=str(SHOTS / name), full_page=True)
    page.goto(URL, wait_until='networkidle')
    page.get_by_role('button', name='开桌消一局').wait_for()
    # The initial document is now loaded. No game action should require HTTP.
    requests_after_load = []
    page.on('request', lambda r: requests_after_load.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.context.set_offline(True)
    shot('home.png')
    page.get_by_role('button', name='机关工坊').first.click()
    page.get_by_role('button', name='新设计 花圃初开').click()
    page.locator('.board-grid').wait_for()
    shot('garden.png')
    coach, toolbar = page.locator('.coach').bounding_box(), page.locator('.tools').bounding_box()
    page.screenshot(path=str(SHOTS / 'toolbar-compact.png'), clip={
        'x':toolbar['x']-4, 'y':coach['y']-8, 'width':toolbar['width']+8,
        'height':toolbar['y']+toolbar['height']-coach['y']+20})
    # Real touch-equivalent pointer drags and clicks follow the certified route.
    actions = 0
    while not page.evaluate('designStudy.game.won'):
        assert actions < 60, 'certificate did not finish'
        a = page.evaluate('designStudy.game.solution[0]')
        assert a, 'UI action diverged from the certified plan'
        moves = page.evaluate('designStudy.game.moves')
        if a['kind'] == 'match':
            for name in ['a', 'b']:
                pos = a[name]
                page.locator(f'[data-cell="{pos["r"]},{pos["c"]}"]').click()
        else:
            run = page.evaluate('(i) => designStudy.game.runs[i]', a['run'])
            pos = run['cells'][len(run['cells']) // 2]
            cell = page.locator(f'[data-cell="{pos["r"]},{pos["c"]}"]')
            box = cell.bounding_box()
            horizontal = run['axis'] == 'row'
            gap = page.locator('.board-grid').evaluate('(el,h) => parseFloat(getComputedStyle(el)[h ? "columnGap" : "rowGap"])', horizontal)
            distance = (box['width'] if horizontal else box['height']) + gap
            distance *= a['step']
            x = box['x'] + box['width'] / 2
            y = box['y'] + box['height'] / 2
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + (distance if horizontal else 0), y + (0 if horizontal else distance), steps=8)
            page.mouse.up()
        assert page.evaluate('designStudy.game.moves') == moves + 1, f'gesture not committed: {a}'
        actions += 1
    page.get_by_role('heading', name='这一桌，收得漂亮！').wait_for()
    shot('win.png')
    assert page.evaluate('designStudy.earned.garden') >= 1
    page.get_by_role('button', name='看看我的花笺').click()
    page.get_by_role('button', name='月下青瓷').click()
    assert page.locator('.theme-choice.active').inner_text() == '月下青瓷'
    shot('album.png')
    assert not requests_after_load, requests_after_load
    # Reload the served document online, then continue without a network.
    page.context.set_offline(False)
    page.reload(wait_until='networkidle')
    page.context.set_offline(True)
    assert page.evaluate('designStudy.earned.garden') >= 1
    assert page.evaluate("getComputedStyle(document.querySelector('#phone')).getPropertyValue('--table').trim()") == '#365e70'
    # Navigation, settings, pause, resume, and undo use visible controls.
    page.locator('.bottom-nav').get_by_role('button', name='游园').click()
    shot('map.png')
    page.locator('.bottom-nav').get_by_role('button', name='机关').click()
    shot('workshop.png')
    page.get_by_role('button', name='熟悉的玩法 冰晶花园').click()
    page.get_by_role('button', name='暂停', exact=True).click()
    page.get_by_role('button', name='继续这一桌').click()
    assert page.locator('#overlay').inner_html() == ''
    page.get_by_role('button', name='设置', exact=True).click()
    page.get_by_role('switch', name='减少动态效果').click()
    assert 'reduce-motion' in page.locator('#phone').get_attribute('class')
    page.get_by_role('button', name='完成', exact=True).click()
    page.get_by_role('button', name='提示', exact=True).click()
    assert page.locator('.hinted').count() >= 2
    # Responsive bounds at three actual mobile sizes and a desktop review size.
    for width, height in [(320, 667), (390, 844), (430, 932), (1440, 1024)]:
        page.set_viewport_size({'width': width, 'height': height})
        for screen in ['home', 'board', 'map', 'workshop', 'album']:
            page.evaluate('(s) => designStudy.navigate(s)', screen)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width, height, screen, 'horizontal overflow')
            for b in page.locator('.screen button').all():
                box = b.bounding_box()
                assert box['width'] > 0 and box['height'] > 0
            if screen == 'board':
                bounds = page.locator('.board-grid').bounding_box()
                phone_bounds = page.locator('#phone').bounding_box()
                assert bounds['x'] >= phone_bounds['x'] and bounds['x'] + bounds['width'] <= phone_bounds['x'] + phone_bounds['width'] + 1
                tools = page.locator('.tools').bounding_box()
                assert tools['y'] + tools['height'] <= phone_bounds['y'] + phone_bounds['height'], (width, height, 'tools clipped')
                assert tools['height'] <= 56, 'tool area should remain compact'
                assert page.locator('.tool small').count() == 0
                assert page.locator('.tool').all_inner_texts() == ['提示', '撤销', '重开']
                for button in page.locator('.tool').all():
                    assert button.bounding_box()['height'] >= 44, 'small-looking tools still need a touch target'
                if width == 320:
                    shot('short-screen.png')
        if width == 1440:
            page.evaluate("designStudy.navigate('home')")
            shot('overview.png')
    assert not errors, errors
    # A cold local-file start, a win, and persisted rewards also work fully offline.
    offline_context = browser.new_context(offline=True, viewport={'width':390,'height':844})
    offline_page = offline_context.new_page()
    offline_requests = []
    offline_page.on('request', lambda r: offline_requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    offline_page.on('pageerror', lambda e: errors.append(str(e)))
    offline_page.goto((ROOT / 'index.html').as_uri())
    offline_page.get_by_role('button', name='开桌消一局').click()
    while not offline_page.evaluate('designStudy.game.won'):
        a = offline_page.evaluate('designStudy.game.solution[0]')
        assert a, 'offline certificate missing'
        offline_page.evaluate('(a) => designStudy.game.apply(a)', a)
    # Enter the result screen to commit the actual win reward through normal UI.
    offline_page.get_by_role('button', name='暂停', exact=True).click()
    offline_page.get_by_role('button', name='回到首页').click()
    offline_page.get_by_role('button', name='我的收藏').click()
    # Rendering a completed board commits rewards, including when returning to it.
    offline_page.evaluate("designStudy.navigate('board')")
    offline_page.get_by_role('heading', name='这一桌，收得漂亮！').wait_for()
    offline_page.get_by_role('button', name='看看我的花笺').click()
    offline_page.get_by_role('button', name='杏桃夕照').click()
    earned_offline = offline_page.evaluate('designStudy.earned.classic')
    assert earned_offline >= 1
    offline_page.reload()
    assert offline_page.evaluate('designStudy.earned.classic') == earned_offline
    assert offline_page.evaluate("getComputedStyle(document.querySelector('#phone')).getPropertyValue('--table').trim()") == '#916b65'
    assert not offline_requests, offline_requests
    assert not errors, errors
    offline_context.close()
    print(json.dumps({'status':'passed','certified_pointer_actions': actions,'responsive_viewports':4,'screens':5,'offline_cold_start_and_persistence':True,'browser_errors':errors},ensure_ascii=False))
    browser.close()
