"""Real pointer play and mobile geometry for the shared 520-level campaign.
Run after demo:build with a running H5 server, or --native for Creator preview.
"""
import argparse,json,pathlib
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8790/');ap.add_argument('--native',action='store_true');args=ap.parse_args()
out=pathlib.Path(__file__).resolve().parents[3]/'temp/campaign-visual';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=args.native,has_touch=args.native)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));cdp=page.context.new_cdp_session(page)
 def wait():page.wait_for_timeout(90)
 def state():
  return page.evaluate("() => {const a="+('__mj()' if args.native else 'mj')+";const s="+('a.model' if args.native else 'a.session')+";return {level:s.levelIndex,moves:s.moves,goal:"+('s.objective' if args.native else 's.objectiveText')+",screen:a.screen,solution:s.solution,grid:s.grid,runs:s.runs,audio:"+('a.audio' if args.native else 'a.audio.state')+"};}")
 def center(rc):
  return page.evaluate("""p=>{const n=NATIVE;
   if(n){const a=__mj(),b=a.board,v=a.size,r=document.querySelector('#GameCanvas').getBoundingClientRect();return [r.x+(v.w/2+b.origin.x+(p.c+.5)*b.cellW)/v.w*r.width,r.y+(v.h/2-b.origin.y+(p.r+.5)*b.cellH)/v.h*r.height];}
   const a=mj,b=a.boardBox,r=a.canvas.getBoundingClientRect();return [r.x+(b.x+(p.c+.5)*b.w/a.session.grid[0].length)*a.s,r.y+(b.y+(p.r+.5)*b.h/a.session.grid.length)*a.s];}
  """.replace('NATIVE',str(args.native).lower()),rc)
 def tap(rc):
  x,y=center(rc)
  if args.native:page.touchscreen.tap(x,y)
  else:page.mouse.click(x,y)
  wait()
 def action(a):
  before=state()['moves']
  if a['kind']=='match':
   tap(a['a'])
   if state()['moves']==before:tap(a['b'])
  else:
   s=state();run=s['runs'][a['run']];start=run['cells'][0 if a['step']>0 else -1];x,y=center(start)
   other=dict(start);other['c' if run['axis']=='row' else 'r']+=1
   ox,oy=center(other);dx,dy=(ox-x)*a['step'],(oy-y)*a['step']
   if args.native:cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
   else:page.mouse.move(x,y);page.mouse.down()
   for i in range(1,9):
    nx,ny=x+dx*i/8,y+dy*i/8
    if args.native:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':nx,'y':ny}]})
    else:page.mouse.move(nx,ny)
    page.wait_for_timeout(16)
   if args.native:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:page.mouse.up()
   wait()
  assert state()['moves']==before+1,(a,state())
 levels=[60,160,180,220,479,519]
 for w,h in [(320,568),(390,844),(430,932)]:
  page.set_viewport_size({'width':w,'height':h})
  for index in levels:
   page.goto(args.url+f'?screen=board&level={index}&preview=1',wait_until='domcontentloaded')
   page.wait_for_function('typeof __mj === "function" && !!__mj().model' if args.native else 'window.__mjReady===true')
   page.evaluate("__mjTap('tip-ok')" if args.native else "mj.session.dismissTip();mj.invalidate()")
   if not args.native:page.wait_for_function("mj.hits.filter(h=>['hint','undo','restart'].includes(h.id)).length===3")
   wait();s=state();assert s['level']==index
   if args.native:assert not page.evaluate('__mj().model.atlas.misses')
   else:
    geo=page.evaluate("() => ({b:mj.boardBox,H:mj.H,tools:mj.hits.filter(h=>['hint','undo','restart'].includes(h.id)),s:mj.s})")
    b=geo['b'];assert b['x']>=0 and b['y']>=280 and b['y']+b['h']<geo['H']-132
    assert len(geo['tools'])==3 and all(t['h']*geo['s']<=56 for t in geo['tools'])
    assert b['w']/len(s['grid'][0])*geo['s']>=28,'tiles too small'
   if w==390:
    # Actually play the certified route via touch/mouse, checking all new targets.
    limit=3 if args.native else 90
    for n in range(limit):
     s=state()
     if s['screen']=='win':break
     assert s['solution'],f'Lost route at level {index+1}'
     action(s['solution'][0])
    s=state()
    if not args.native:assert s['screen']=='win',(index,s)
    assert s['audio']['failures']==0
    page.screenshot(path=str(out/f'{"native" if args.native else "h5"}-{index+1}-{w}.png'))
   print(f'PASS {"native" if args.native else "h5"} level {index+1} {w}x{h}',flush=True)
 assert not errors,errors
 print('PASS no runtime errors',flush=True);browser.close()
