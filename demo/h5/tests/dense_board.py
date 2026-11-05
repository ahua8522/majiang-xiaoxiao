"""Native large-board regression: capsule clearance, readable area and real drags."""
import json,pathlib
from playwright.sync_api import sync_playwright

out=pathlib.Path(__file__).resolve().parents[3]/'temp/dense-board';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 cdp=page.context.new_cdp_session(page);report=[]
 for w,h in [(320,568),(390,844),(430,932)]:
  page.set_viewport_size({'width':w,'height':h})
  page.goto('http://127.0.0.1:7456/?screen=challenge&clevel=2&seed=721',wait_until='networkidle')
  page.wait_for_function('typeof __mj === "function" && !!__mj().challenge')
  page.evaluate("s=>{const el=document.querySelector('#GameDiv');el.style.width=s.w+'px';el.style.height=(s.h-50)+'px';cc.view.setFrameSize(s.w,s.h-50);window.dispatchEvent(new Event('resize'));}",{'w':w,'h':h})
  page.wait_for_timeout(180)
  rect=page.locator('#GameCanvas').bounding_box();assert abs(rect['x'])<1 and abs(rect['width']-w)<1,rect
  page.evaluate("window.testApp=(()=>{let a;function walk(n){for(const c of n._components||[])if(c.session&&c.activate&&c.renderSunny)a=c;for(const k of n.children)walk(k);}walk(cc.director.getScene());return a;})()")
  # Include the WeChat capsule clearance missing from Creator's browser preview.
  page.evaluate('testApp.safeTop=128;testApp.dirty=true');page.wait_for_timeout(180)
  for level in [2,50]:
   page.evaluate('level=>{testApp.cs.startAt(level);testApp.dirty=true}',level);page.wait_for_timeout(180)
   geo=page.evaluate("""()=>{const a=__mj(),b=a.board,c=a.challenge;return {w:a.size.w,h:a.size.h,rows:c.rows,cols:c.cols,x:a.size.w/2+b.origin.x,y:a.size.h/2-b.origin.y,cellW:b.cellW,cellH:b.cellH};}""")
   assert (geo['cols'],geo['rows'])==(10,14),geo
   assert geo['x']>=20 and geo['y']>=128+168,geo
   assert geo['y']+geo['rows']*geo['cellH']<geo['h']-170,geo
   # Compare actual rendered geometry against the old layout on this same viewport.
   old=min((geo['w']-94)/10,(geo['h']-128-528)/(14.65*1.24),156)
   gain=geo['cellW']*.90/(old*.84)-1
   assert gain>.15,(gain,geo)
   def point(r,c):
    return page.evaluate("""p=>{const a=__mj(),b=a.board,r=document.querySelector('#GameCanvas').getBoundingClientRect();return {x:r.x+(a.size.w/2+b.origin.x+(p.c+.5)*b.cellW)*r.width/a.size.w,y:r.y+(a.size.h/2-b.origin.y+(p.r+.5)*b.cellH)*r.height/a.size.h};}""",{'r':r,'c':c})
   for turn in range(3):
    move=page.evaluate('testApp.cs.solution[0]');assert move
    grid=page.evaluate('testApp.cs.grid');axis=move['axis'];step=move['step'];idx=move['index']
    # Start on a real tile and keep the entire drag inside the canvas.
    candidates=[(r,c) for r,row in enumerate(grid) for c,tile in enumerate(row) if tile and (r if axis=='row' else c)==idx and 0<=(c if axis=='row' else r)+step<(10 if axis=='row' else 14)]
    assert candidates,move
    r,c=candidates[len(candidates)//2];start=point(r,c);end=point(r+(step if axis=='col' else 0),c+(step if axis=='row' else 0))
    before=page.evaluate('testApp.cs.moves')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[start]})
    for n in range(1,11):
     pos={k:start[k]+(end[k]-start[k])*n/10 for k in ['x','y']}
     cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[pos]});page.wait_for_timeout(20)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(180)
    assert page.evaluate('testApp.cs.moves')==before+1,(move,geo)
   assert not page.evaluate('__mj().model.atlas.misses.length')
   page.screenshot(path=str(out/f'challenge-{level}-{w}.png'))
   report.append({'viewport':[w,h],'level':level,'faceWidthPx':round(geo['cellW']*.9*w/750,1),'gainPercent':round(gain*100,1)})
   print('PASS challenge',level,w,h,report[-1],flush=True)
  page.evaluate("testApp.activate('challenge-home')");page.wait_for_timeout(150)
  # No bottom navigation or clickable area may occupy the future banner zone.
  home=page.evaluate("""()=>{const H=cc.view.getVisibleSize().height,r=[];function walk(n){if(n.activeInHierarchy&&n.name.startsWith('sunny:')){const ui=n._components.find(c=>c.getBoundingBoxToWorld);if(ui){const b=ui.getBoundingBoxToWorld();r.push({id:n.name.slice(6),bottom:H-b.y});}}for(const c of n.children)walk(c);}walk(cc.director.getScene());return {H,r};}""")
  ids=[r['id'] for r in home['r']]
  assert all(ids.count(x)==1 for x in ['levels','workshop','album','start']) and 'home' not in ids,ids
  assert all(r['bottom']<=home['H']-144 for r in home['r']),home
 assert not errors,errors
 (out/'metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('PASS capsule clearance, home banner exclusion, real challenge drags, no runtime errors',flush=True)
 b.close()
