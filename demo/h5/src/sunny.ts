import {SunnyItem} from '../../../cocos/assets/scripts/view/sunnyLayout';
import {drawSunnyHero,drawSunnyIcon,drawSunnySurface,drawSunnyGarden,drawSunnyStage,SUNNY} from '../../../cocos/assets/scripts/view/sunnyArt';
import {drawTile} from '../../../cocos/assets/scripts/view/art';
import {FONT_SANS,FONT_SERIF} from './theme';
import {Hit} from './ui';

export function renderSunny(ctx:CanvasRenderingContext2D,items:SunnyItem[],hits:Hit[]):void{
 for(const it of items){
  if(it.id&&it.enabled!==false)hits.push({id:it.id,x:it.x,y:it.y,w:it.w,h:it.h,enabled:true});
  ctx.save();
  if(it.kind==='text'){
   ctx.font=`${it.bold?'700 ':''}${it.size}px ${it.serif?FONT_SERIF:FONT_SANS}`;ctx.textAlign=it.align||'left';ctx.textBaseline='top';ctx.fillStyle=it.color||SUNNY.ink;ctx.fillText(it.text||'',it.x,it.y);
  }else if(it.kind==='garden'){ctx.beginPath();ctx.rect(it.x,it.y,it.w,it.h);ctx.clip();drawSunnyGarden(ctx,it.x,it.y,it.w,it.h,it.chapter!,it.frontier!);}
  else if(it.kind==='stage')drawSunnyStage(ctx,it.x,it.y,it.w,it.h,it.name!);
  else if(it.kind==='veil'){ctx.fillStyle='rgba(53,82,66,.67)';ctx.fillRect(it.x,it.y,it.w,it.h);}
  else if(it.kind==='tile')drawTile(ctx,it.name!,it.x+it.w*.05,it.y+it.h*.05,{w:it.w*.90,h:it.h*.90,lift:it.h*.07});
  else if(it.kind==='hero')drawSunnyHero(ctx,it.x,it.y,it.w,it.h);
  else if(it.kind==='icon')drawSunnyIcon(ctx,it.name!,it.x,it.y,it.w,it.color||SUNNY.ink);
  else if(it.kind==='line'){
   ctx.fillStyle=it.color||'#D4DFC1';if(it.angle!==undefined){ctx.translate(it.x,it.y);ctx.rotate(it.angle);ctx.fillRect(-it.w/2,-it.h/2,it.w,it.h);}else ctx.fillRect(it.x,it.y,it.w,it.h);
  }else if(it.kind==='circle'){
   const cx=it.x+it.w/2,cy=it.y+it.h/2;ctx.beginPath();ctx.arc(cx,cy+4,it.w/2-2,0,Math.PI*2);ctx.fillStyle='#C5D3B7';ctx.fill();ctx.beginPath();ctx.arc(cx,cy-1,it.w/2-3,0,Math.PI*2);ctx.fillStyle=it.color||SUNNY.paper;ctx.fill();ctx.strokeStyle='#CEDABD';ctx.lineWidth=2;ctx.stroke();
  }else drawSunnySurface(ctx,it.x,it.y,it.w,it.h,it.kind);
  ctx.restore();
 }
}
