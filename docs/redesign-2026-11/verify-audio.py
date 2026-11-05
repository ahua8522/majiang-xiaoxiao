"""Audio lifecycle/interaction checks in Chromium; visibility events are simulated.
Checks actual decoded MP3 assets too. This is not a substitute for device listening.
"""
import json
import pathlib
import subprocess
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'audio/manifest.json').read_text(encoding='utf-8'))
decoded = {}
for key, asset in manifest.items():
    result = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i',
        str(ROOT / 'audio' / asset['file']), '-f', 'f32le', '-ac', '2', '-ar', '32000', '-'],
        check=True, capture_output=True)
    samples = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
    duration = len(samples) / 32000
    peak = float(np.abs(samples).max())
    assert abs(duration - asset['duration']) < .01, (key, duration)
    assert 0 < peak < .9 and np.isfinite(samples).all(), (key, peak)
    item = {'seconds': duration, 'peakDbfs': round(float(20 * np.log10(peak)), 2)}
    if asset['loop']:
        # Check the decoded splice against a conservative single-sample jump bound.
        seam = float(np.abs(samples[-1] - samples[0]).max())
        assert seam < .02, (key, 'loop discontinuity', seam)
        item['loopSeamDelta'] = round(seam, 6)
    decoded[key] = item

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    context = browser.new_context(offline=True, viewport={'width':390, 'height':844})
    page = context.new_page()
    errors, remote_requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: remote_requests.append(r.url) if r.url.startswith(('https:', 'http:')) else None)
    page.goto((ROOT / 'index.html').as_uri())
    assert page.evaluate('designStudy.audio.context') == 'locked'
    page.get_by_role('button', name='开桌消一局').click()
    page.wait_for_function("designStudy.audio.context === 'running' && designStudy.audio.track === 'bgm-board'")
    starts = page.evaluate('designStudy.audio.musicStarts')
    for _ in range(3):
        page.evaluate("designStudy.navigate('board')")
    page.wait_for_timeout(150)
    assert page.evaluate('designStudy.audio.musicStarts') == starts, 'render restarted music'
    page.get_by_role('button', name='暂停', exact=True).click()
    assert page.evaluate('designStudy.audio.ducked')
    page.get_by_role('button', name='继续这一桌').click()
    assert not page.evaluate('designStudy.audio.ducked')

    def fixture(mode='classic', ice=False, charge=0, budget=50):
        page.evaluate('''({mode,ice,charge,budget})=>{
            designStudy.startMode(mode); const g=designStudy.game;
            g.grid=[[[ice?'1p~':'1p'],[ice?'1p~':'1p']],[['2s'],['2s']],[['3m'],['3m']]];
            g.solution=[];g.charge=charge;g.budget=budget;g.flowerCells=new Set(['0,0','2,0']);
            designStudy.navigate('board');
        }''', {'mode':mode,'ice':ice,'charge':charge,'budget':budget})

    def played(key):
        return page.evaluate('(key)=>designStudy.audio.played[key]||0', key)

    def wait_cue(key, count):
        page.wait_for_function('([key,count])=>(designStudy.audio.played[key]||0)===count', arg=[key,count])

    def pair(row=0):
        page.locator(f'[data-cell="{row},0"]').click()
        page.locator(f'[data-cell="{row},1"]').click()

    fixture()
    match = played('match')
    pair()
    wait_cue('match', match+1)
    assert played('tap') >= 1
    undo = played('undo')
    page.get_by_role('button', name='撤销', exact=True).click()
    wait_cue('undo', undo+1)
    assert played('match') == match+1, 'undo replayed match sound'

    for mode, ice, charge, cue in [('ice', True, 0, 'ice'), ('garden', False, 0, 'bloom'), ('energy', False, 3, 'charge')]:
        fixture(mode, ice, charge)
        before = played(cue)
        pair()
        wait_cue(cue, before+1)
    fixture(budget=1)
    lose = played('lose')
    pair()
    wait_cue('lose', lose+1)
    fixture()
    win = played('win')
    pair(0); pair(1); pair(2)
    wait_cue('win', win+1)
    page.evaluate("designStudy.navigate('home');designStudy.navigate('board')")
    page.wait_for_timeout(200)
    assert played('win') == win+1, 'render replayed win sound'
    page.get_by_role('button', name='关闭', exact=True).click()

    page.get_by_role('button', name='设置', exact=True).click()
    page.get_by_role('switch', name='背景音乐', exact=True).click()
    assert page.evaluate('designStudy.audio.track') is None
    assert page.evaluate('designStudy.audio.sound'), 'music switch muted effects'
    page.get_by_role('button', name='完成', exact=True).click()
    fixture()
    match = played('match')
    pair()
    wait_cue('match', match+1)
    page.get_by_role('button', name='设置', exact=True).click()
    page.get_by_role('switch', name='音效', exact=True).click()
    page.get_by_role('button', name='完成', exact=True).click()
    before_muted = page.evaluate('designStudy.audio.played')
    fixture(); pair()
    page.wait_for_timeout(200)
    assert page.evaluate('designStudy.audio.played') == before_muted
    assert page.evaluate('designStudy.audio.effects') == 0
    page.reload()
    assert page.evaluate('designStudy.audio.context') == 'locked'
    assert not page.evaluate('designStudy.audio.music || designStudy.audio.sound')
    page.get_by_role('button', name='设置', exact=True).click()
    page.get_by_role('switch', name='背景音乐', exact=True).click()
    page.wait_for_function("designStudy.audio.track === 'bgm-home'")
    assert not page.evaluate('designStudy.audio.sound'), 'music switch enabled effects'
    page.get_by_role('button', name='完成', exact=True).click()
    # Simulate the browser lifecycle event; check that the Web Audio context really suspends.
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("designStudy.audio.context === 'suspended'")
    starts = page.evaluate('designStudy.audio.musicStarts')
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("designStudy.audio.context === 'running'")
    assert page.evaluate('designStudy.audio.musicStarts') == starts
    assert not remote_requests, remote_requests
    assert page.evaluate('designStudy.audio.failures') == 0

    lab = context.new_page()
    lab.on('pageerror', lambda e: errors.append(str(e)))
    lab.goto((ROOT / 'sound-lab.html').as_uri())
    lab.get_by_role('button', name='花圃开放').click()
    lab.wait_for_function("document.querySelector('#effect-player').currentTime > 0")
    lab.locator('audio').first.evaluate('(audio)=>audio.play()')
    assert lab.locator('#effect-player').evaluate('(audio)=>audio.paused')
    lab.locator('audio').nth(1).evaluate('(audio)=>audio.play()')
    assert lab.locator('audio').first.evaluate('(audio)=>audio.paused')
    assert lab.evaluate('document.documentElement.scrollWidth <= innerWidth')
    lab.screenshot(path=str(ROOT / 'screenshots/sound-lab.png'), full_page=True)
    assert not errors, errors
    print(json.dumps({'status':'passed', 'decoded_assets':len(decoded), 'loops':{k:v for k,v in decoded.items() if k.startswith('bgm-')},
        'offline_audio':True,'independent_saved_switches':True,'visibility_event_simulated':True,'result_cue_deduplication':True,'browser_errors':errors},ensure_ascii=False))
    browser.close()
