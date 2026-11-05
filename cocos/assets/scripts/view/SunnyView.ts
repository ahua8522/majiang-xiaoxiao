import {Graphics, Label, Node} from 'cc';
import {Atlas} from './atlas';
import {TileAtlas} from './assets';
import {SUNNY, drawSunnyHero, drawSunnyIcon, drawSunnySurface} from './sunnyArt';
import {SunnyItem} from './sunnyLayout';
import {bindPress, hex, makeLabel, makeNode, makeSprite} from './widgets';

/** 固定 1024² 小图集；重绘只建控件节点，不重建纹理。 */
export class SunnyView {
 readonly atlas=new Atlas(1024,1024);
 constructor(){
  const c=this.atlas.context;
  drawSunnyHero(c,0,0,700,475);this.atlas.region('hero',{x:0,y:0,w:700,h:475});
  ['paper','peach','jade','off'].forEach((kind,i)=>{const h=kind==='peach'||kind==='jade'?96:180;drawSunnySurface(c,i*246,480,240,h,kind);this.atlas.region(kind,{x:i*246,y:480,w:240,h});});
  ['home','map','flower','workshop','book','gear','pause','hint','undo','restart','back','next','spark','close','play','ice','tiles'].forEach((n,i)=>{const x=(i%16)*62,y=700+Math.floor(i/16)*62;drawSunnyIcon(c,n,x+5,y+5,48,'#FFFFFF');this.atlas.region(n,{x,y,w:58,h:58});});
  this.atlas.bake();
 }
 render(root:Node,items:SunnyItem[],W:number,H:number,tiles:TileAtlas,onTap:(id:string)=>void):Label|null{
  let message:Label|null=null;
  for(const it of items){
   const cx=it.x+it.w/2-W/2,cy=H/2-it.y-it.h/2;
   let n:Node|undefined;
   if(it.kind==='text'){
    const l=makeLabel(root,it.text||'',{x:it.x-W/2,y:H/2-it.y,size:it.size,color:it.color,align:it.align,bold:it.bold,serif:it.serif,name:it.name});
    if(it.name==='board-message')message=l;continue;
   }
   if(it.kind==='tile')n=makeSprite(root,tiles.face(it.name!),it.w,it.h,cx,cy).node;
   else if(it.kind==='circle'){
    n=makeNode(root,{x:cx,y:cy,w:it.w,h:it.h});const g=n.addComponent(Graphics);g.fillColor=hex('#C5D3B7');g.circle(0,-4,it.w/2-2);g.fill();g.fillColor=hex(it.color||SUNNY.paper);g.circle(0,1,it.w/2-3);g.fill();g.strokeColor=hex('#CEDABD');g.lineWidth=2;g.circle(0,1,it.w/2-3);g.stroke();
   }else if(it.kind==='line'){
    // 带 angle 的线以中心坐标定义；普通色块以左上角定义。
    const x=it.angle!==undefined?it.x-W/2:cx,y=it.angle!==undefined?H/2-it.y:cy;
    n=makeNode(root,{x,y,w:it.w,h:it.h});const g=n.addComponent(Graphics);g.fillColor=hex(it.color||'#D4DFC1');g.roundRect(-it.w/2,-it.h/2,it.w,it.h,Math.min(it.h/2,7));g.fill();if(it.angle!==undefined)n.angle=-it.angle*180/Math.PI;
   }else {
    // 彩色按钮只沿水平方向切片，竖向完整缩放，保持渐变连续；瓷白卡片仍保留九宫格圆角。
    const insets:[number,number,number,number]=it.kind==='peach'||it.kind==='jade'?[26,26,0,0]:[26,26,26,26];
    const key=it.kind==='icon'?it.name!:it.kind,sp=makeSprite(root,this.atlas.frame(key),it.w,it.h,cx,cy,!['icon','hero'].includes(it.kind),insets);n=sp.node;if(it.color)sp.color=hex(it.color);
   }
   if(n&&it.id){n.name='sunny:'+it.id;if(it.enabled!==false)bindPress(n,()=>onTap(it.id!));}
  }
  return message;
 }
 dispose(){this.atlas.dispose();}
}
