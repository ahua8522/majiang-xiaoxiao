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
    shot('home.png')
    page.get_by_role('button', name='机关工坊').first.click()
    page.get_by_role('button', name='新设计 花圃初开').click()
    page.locator('.board-grid').wait_for()
    shot('garden.png')
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
    page.reload(wait_until='networkidle')
    assert page.evaluate('designStudy.earned.garden') >= 1
    assert page.evaluate("getComputedStyle(document.querySelector('#phone')).getPropertyValue('--table').trim()") == '#365e70'
    # Navigation, settings, pause, resume, and undo use visible controls.
    page.locator('.bottom-nav').get_by_role('button', name='游园').click()
    shot('map.png')
    page.locator('.bottom-nav').get_by_role('button', name='机关').click()
    shot('workshop.png')
    page.get_by_role('button', name='熟悉的玩法 冰糖茶庭').click()
    page.get_by_role('button', name='暂停', exact=True).click()
    page.get_by_role('button', name='继续这一桌').click()
    assert page.locator('#overlay').inner_html() == ''
    page.get_by_role('button', name='设置', exact=True).click()
    page.get_by_role('switch', name='减少动态效果').click()
    assert 'reduce-motion' in page.locator('#phone').get_attribute('class')
    page.get_by_role('button', name='知道啦').click()
    page.get_by_role('button', name='看提示').click()
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
                if width == 320:
                    shot('short-screen.png')
        if width == 1440:
            page.evaluate("designStudy.navigate('home')")
            shot('overview.png')
    assert not errors, errors
    print(json.dumps({'status':'passed','certified_pointer_actions': actions,'responsive_viewports':4,'screens':5,'browser_errors':errors},ensure_ascii=False))
    browser.close()
