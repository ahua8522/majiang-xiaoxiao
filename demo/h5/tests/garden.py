"""Verify release/trial admission, 26 chapter buttons and native texture reuse."""
from pathlib import Path
import argparse
parser=argparse.ArgumentParser();parser.add_argument("--native-only",action="store_true");args=parser.parse_args()
from playwright.sync_api import sync_playwright
out=Path('temp/garden-verified');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 for native in ([True] if args.native_only else [False,True]):
  page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=native,has_touch=native)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{7456 if native else 8790}/?screen=home',wait_until='networkidle',timeout=60000)
  page.wait_for_function('typeof __mj === "function" && !!__mj().model' if native else 'window.__mjReady===true')
  page.evaluate("window.testApp=(()=>{let a;function walk(n){for(const c of n._components||[])if(c.session&&c.activate&&c.renderSunny)a=c;for(const k of n.children)walk(k);}walk(cc.director.getScene());return a;})()" if native else 'window.testApp=mj')
  if native:page.evaluate('testApp.safeTop=128;testApp.dirty=true')
  def repaint():
   page.evaluate('if(testApp.invalidate)testApp.invalidate();else testApp.dirty=true');page.wait_for_timeout(100)
  def at(id):
   if native:return page.evaluate("""id=>{const r=document.querySelector('#GameCanvas').getBoundingClientRect(),v=cc.view.getVisibleSize();let hit;function walk(n){if(n.activeInHierarchy&&n.name==='sunny:'+id){const ui=n._components.find(c=>c.getBoundingBoxToWorld);if(ui){const b=ui.getBoundingBoxToWorld();hit=[r.x+(b.x+b.width/2)*r.width/v.width,r.y+r.height-(b.y+b.height/2)*r.height/v.height];}}for(const c of n.children)walk(c);}walk(cc.director.getScene());return hit;}""",id)
   return page.evaluate("id=>{const a=mj,h=[...a.hits].reverse().find(h=>h.id===id&&h.enabled),r=a.canvas.getBoundingClientRect();return h?[r.x+(h.x+h.w/2)*a.s,r.y+(h.y+h.h/2)*a.s]:null}",id)
  def tap(pt):
   assert pt
   if native:page.touchscreen.tap(*pt)
   else:page.mouse.click(*pt)
   page.wait_for_timeout(90)
  def click(id):tap(at(id))
  click('levels')
  assert page.evaluate('testApp.screen')=='levels'
  if native:atlas_count=page.evaluate('__mjDiag().atlases.length')
  for i in range(25):
   edge=at('page-next');tap(edge);assert page.evaluate('testApp.page')==i+1
   if native:
    diag=page.evaluate('__mjDiag()');assert len(diag['atlases'])==atlas_count,diag;assert all(a['ok'] for a in diag['atlases']) and not diag['misses'],diag
  tap(edge);assert page.evaluate('testApp.page')==25
  page.evaluate("testApp.session.setEnvironment('trial')");repaint();point=at('level:519');assert point
  page.evaluate("testApp.session.setEnvironment('release')");repaint();tap(point)
  assert page.evaluate('testApp.screen')=='levels','release entered a locked level'
  page.screenshot(path=str(out/f'{native}-last-locked.png'))
  if native:
   page.evaluate('window.lastGarden=testApp.sunny.garden')
   repaint();assert page.evaluate('lastGarden===testApp.sunny.garden'),'unchanged chapter rebuilt its texture'
  page.evaluate("testApp.session.setEnvironment('trial')");repaint();tap(point)
  assert page.evaluate('testApp.session.levelIndex')==519
  assert page.evaluate('testApp.session.maxLevel')==0
  if page.evaluate('!!testApp.session.introTip'):click('tip-ok')
  click('pause');click('levels');assert page.evaluate('testApp.page')==25
  click('panel-close');assert page.evaluate('testApp.screen')=='board'
  click('pause');click('home');click('levels')
  for i in range(25):
   edge=at('page-prev');tap(edge);assert page.evaluate('testApp.page')==24-i
  tap(edge);assert page.evaluate('testApp.page')==0
  click('panel-close');assert page.evaluate('testApp.screen')=='home'
  for env in ['release','develop']:
   page.evaluate('env=>{testApp.session.setEnvironment(env);testApp.session.reset(0);testApp.session.maxLevel=0;testApp.setScreen("home")}',env);repaint();click('levels')
   page.screenshot(path=str(out/f'{native}-{env}.png'))
   click('panel-close')
  if native:
   # Add representative saved progress only in this disposable browser context.
   page.evaluate('testApp.session.maxLevel=6;testApp.session.stars={0:3,1:3,2:2,3:3,4:1,5:2};testApp.session.setEnvironment("release")')
   for sc in ['levels','workshop','album']:
    click(sc);page.screenshot(path=str(out/f'native-{sc}.png'));click('panel-close')
   for width,height in [(320,568),(430,932)]:
    page.set_viewport_size({'width':width,'height':height})
    page.evaluate("s=>{document.querySelector('#GameDiv').style.width=s.w+'px';document.querySelector('#GameDiv').style.height=(s.h-50)+'px';cc.view.setFrameSize(s.w,s.h-50);window.dispatchEvent(new Event('resize'));}",{'w':width,'h':height});page.wait_for_timeout(200)
    click('levels');page.screenshot(path=str(out/f'native-levels-{width}.png'));click('panel-close')
  if native:
   diag=page.evaluate('__mjDiag()');assert all(a['ok'] for a in diag['atlases']) and not diag['misses'],diag
  assert not errors,errors
  print('PASS',native,'chapter bounds, release lock, trial jump, close to board/home, atlas cache; no runtime errors',flush=True)
  page.close()
 b.close()
