"""Exercise the shipped UI with real pointers, on H5 and Cocos preview."""
import argparse,json,pathlib
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--native',action='store_true');args=ap.parse_args()
out=pathlib.Path(__file__).resolve().parents[3]/'temp/sunny-visual';out.mkdir(parents=True,exist_ok=True)
native=args.native
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=native,has_touch=native)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{7456 if native else 8790}/?screen=home',wait_until='networkidle')
 page.wait_for_function('typeof __mj === "function" && !!__mj().model' if native else 'window.__mjReady===true')
 if native:page.evaluate("window.testApp=(()=>{let a;function walk(n){for(const c of n._components||[])if(c.session&&c.activate&&c.renderSunny)a=c;for(const k of n.children)walk(k);}walk(cc.director.getScene());return a;})()")
 else:page.evaluate('window.testApp=mj')
 def state():return page.evaluate('({screen:testApp.screen,level:testApp.session.levelIndex,moves:testApp.session.moves,grid:JSON.stringify(testApp.session.grid),stars:JSON.stringify(testApp.session.stars),practice:!!testApp.mainSession,theme:testApp.theme,music:testApp.music,sound:testApp.sound,page:testApp.page})')
 def click(id):
  if native:
   at=page.evaluate("""id=>{const r=document.querySelector('#GameCanvas').getBoundingClientRect(),v=cc.view.getVisibleSize();let hit;function walk(n){if(n.activeInHierarchy&&n.name==='sunny:'+id){const ui=n._components.find(c=>c.getBoundingBoxToWorld);if(ui){const b=ui.getBoundingBoxToWorld();hit=[r.x+(b.x+b.width/2)*r.width/v.width,r.y+r.height-(b.y+b.height/2)*r.height/v.height];}}for(const c of n.children)walk(c);}walk(cc.director.getScene());return hit;}""",id)
  else:at=page.evaluate("id=>{const a=mj,h=[...a.hits].reverse().find(h=>h.id===id&&h.enabled),r=a.canvas.getBoundingClientRect();return h?[r.x+(h.x+h.w/2)*a.s,r.y+(h.y+h.h/2)*a.s]:null}",id)
  assert at,('missing control',id,state())
  if native:page.touchscreen.tap(*at)
  else:page.mouse.click(*at)
  page.wait_for_timeout(160)
 def screen(s):assert state()['screen']==s,state()
 screen('home');click('start');screen('board')
 if page.evaluate('!!testApp.session.introTip'):click('tip-ok')
 click('settings');screen('settings');before=state();click('toggle-music');assert state()['music']!=before['music'];click('toggle-music');click('__back');screen('board')
 click('restart');screen('restart');click('resume');screen('board')
 before=state();click('pause');click('home');screen('home');click('start');screen('board');assert state()['grid']==before['grid']
 click('pause');click('levels');screen('levels');click('page-next');assert state()['page']==1;click('page-prev');assert state()['page']==0;click('panel-close');screen('board');click('pause');click('levels');click('level:0');screen('board')
 if page.evaluate('!!testApp.session.introTip'):click('tip-ok')
 click('pause');click('home');click('workshop');screen('workshop');main=state();click('practice:2');screen('board');assert state()['practice'];assert state()['level']==60
 if page.evaluate('!!testApp.session.introTip'):click('tip-ok')
 click('pause');click('workshop');screen('workshop');assert not state()['practice'];assert state()['grid']==main['grid'];assert state()['stars']==main['stars']
 click('panel-close');screen('home');click('album');screen('album')
 # Unlock cosmetic thresholds in the isolated test context; actual switching uses the visible button.
 page.evaluate("testApp.session.stars={0:3,1:3,2:3,3:3,4:3,5:3,6:3};if(testApp.invalidate)testApp.invalidate();else testApp.dirty=true")
 page.wait_for_timeout(100);click('theme:blue');assert state()['theme']=='blue';assert page.evaluate("localStorage.getItem('mj:sunny-theme')")=='blue'
 click('panel-close');click('start');screen('board');page.screenshot(path=str(out/f'{"native" if native else "h5"}-blue.png'))
 for w,h in [(320,568),(390,844),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(220)
  if native:
   page.evaluate("s=>{const el=document.querySelector('#GameDiv');el.style.width=s.w+'px';el.style.height=(s.h-50)+'px';cc.view.setFrameSize(s.w,s.h-50);window.dispatchEvent(new Event('resize'));}",{'w':w,'h':h});page.wait_for_timeout(180)
   rect=page.locator('#GameCanvas').bounding_box();assert abs(rect['x'])<1 and abs(rect['width']-w)<1,rect
  for sc in ['home','levels','workshop','album']:
   page.evaluate("s=>{testApp.activate(s)}",sc);page.wait_for_timeout(150);screen(sc)
   if native:
    geo=page.evaluate("""()=>{let r=[];function walk(n){if(n.activeInHierarchy&&n.name.startsWith('sunny:')){const ui=n._components.find(c=>c.getBoundingBoxToWorld);if(ui){const b=ui.getBoundingBoxToWorld();r.push({name:n.name,y:b.y,h:b.height});}}for(const c of n.children)walk(c);}walk(cc.director.getScene());return {h:cc.view.getVisibleSize().height,r};}""")
    assert all(g['y']>=-2 and g['y']+g['h']<=geo['h']+2 for g in geo['r']),geo
   else:
    geo=page.evaluate('({h:mj.H,r:mj.hits})');assert all(g['y']>=-2 and g['y']+g['h']<=geo['h']+2 for g in geo['r']),geo
   page.screenshot(path=str(out/f'{"native" if native else "h5"}-{sc}-{w}.png'))
  print('PASS', 'native' if native else 'h5',w,h,flush=True)
 assert not errors,errors
 print('PASS navigation, settings, restart, workshop isolation, cosmetics, three viewports; no page errors',flush=True)
 b.close()
