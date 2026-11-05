/** 晴日花园的共用美术。原生烘焙成图集，H5 复用画法。 */
import {Ctx2D, drawTile, fillRR, linear, strokeRR} from './art';

export const SUNNY = {ink:'#214F43',soft:'#82947B',paper:'#FFFDF4',edge:'#D3DEC1',jade:'#477B61',peach:'#DE9476'};
export type TableTheme='jade'|'blue'|'rose';
export const TABLE_THEMES: {id:TableTheme;name:string;stars:number;felt:string}[]=[
  {id:'jade',name:'雨后薄荷',stars:0,felt:'#477B61'},
  {id:'blue',name:'月下青瓷',stars:20,felt:'#477488'},
  {id:'rose',name:'杏桃夕照',stars:60,felt:'#AA7D79'}
];
export function drawSunnySurface(c:Ctx2D,x:number,y:number,w:number,h:number,kind='paper'):void{
  const peach=kind==='peach',jade=kind==='jade',off=kind==='off';
  const r=Math.min(23,h*.25),depth=peach||jade?5:3;
  fillRR(c,x,y+depth,w,h-depth,r,peach?'#B97358':jade?'#39644E':'#CCD6BF');
  // 卡片用干净的瓷白；彩色按钮用连续的纵向渐变，避免奶油色带。
  const fill=peach||jade?linear(c,x,y,x,y+h-depth,[[0,peach?'#EDA789':'#7CA387'],[.5,peach?'#E39878':'#648F73'],[1,peach?'#D88968':'#507D63']]):off?'#E4EAD9':'#FFFEF7';
  fillRR(c,x,y,w,h-depth-1,r,fill);
  strokeRR(c,x+1,y+1,w-2,h-depth-3,r,peach?'#CF886A':jade?'#547E63':'#D1DAC4',1.5);
  if(peach||jade)strokeRR(c,x+3,y+3,w-6,h-depth-7,Math.max(3,r-3),'rgba(255,255,245,.25)',1);
}
export function drawSunnyTable(c:Ctx2D,x:number,y:number,w:number,h:number,theme:TableTheme='jade'):void{
  const felt=TABLE_THEMES.find(t=>t.id===theme)!.felt;
  fillRR(c,x,y+5,w,h-5,22,'#527D65');
  fillRR(c,x,y,w,h-5,22,'#B5CCA8');
  strokeRR(c,x+2,y+2,w-4,h-9,20,'#EAF1D7',2);
  fillRR(c,x+9,y+9,w-18,h-23,15,felt);
  strokeRR(c,x+9,y+9,w-18,h-23,15,'#D8E5C9',1.5);
}
function ellipse(c:Ctx2D,x:number,y:number,rx:number,ry:number,col:string,angle=0){c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=col;c.fill();}
function flower(c:Ctx2D,x:number,y:number,r:number){for(let i=0;i<6;i++){const a=i*Math.PI/3;ellipse(c,x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,r*.48,r*.3,'#FFFEF0',a);}ellipse(c,x,y,r*.25,r*.25,'#E0B857');}
export function drawSunnyBackdrop(c:Ctx2D,w:number,h:number):void{
  c.fillStyle=linear(c,0,0,w,h,[[0,'#F9FAEF'],[.48,'#F3F7E9'],[1,'#E9F0DF']]);c.fillRect(0,0,w,h);
  const sun=c.createRadialGradient(w*.25,h*.23,0,w*.25,h*.23,w*.8);sun.addColorStop(0,'rgba(255,252,229,.9)');sun.addColorStop(1,'rgba(255,252,229,0)');c.fillStyle=sun;c.fillRect(0,0,w,h);
  c.save();c.globalAlpha=.15;
  for(let i=0;i<7;i++){const right=i%2===0,x=right?w+12:-12,y=h*(.18+i*.12);ellipse(c,x,y,60,23,'#A2BA94',right?-1:1);}
  c.restore();
}
/** 与设计稿一致的白花、立体托盘和四条/发财/六条主视觉。 */
export function drawSunnyHero(c:Ctx2D,x:number,y:number,w:number,h:number):void{
  c.save();c.translate(x,y);c.scale(w/700,h/475);
  const glow=c.createRadialGradient(350,210,0,350,210,300);glow.addColorStop(0,'#FFFBE7');glow.addColorStop(1,'rgba(241,246,226,0)');c.fillStyle=glow;c.fillRect(0,0,700,475);
  ellipse(c,110,232,78,92,'#DCE8CD');ellipse(c,589,197,90,98,'#DAE7CC');
  c.strokeStyle='#8BAE8D';c.lineWidth=3;c.beginPath();c.moveTo(570,360);c.bezierCurveTo(610,275,575,190,610,90);c.moveTo(80,346);c.quadraticCurveTo(97,260,60,218);c.stroke();
  for(const [lx,ly,a]of [[604,141,-1.6],[625,180,-.4],[577,218,.6],[615,255,-.5],[88,280,-.4],[60,246,1]])ellipse(c,lx,ly,34,12,'#95B896',a);
  flower(c,571,171,24);flower(c,66,230,24);ellipse(c,347,416,268,36,'rgba(65,112,92,.13)');
  const diamond=(cy:number,col:string)=>{c.beginPath();c.moveTo(95,cy);c.lineTo(350,cy-88);c.lineTo(615,cy);c.lineTo(350,cy+90);c.closePath();c.fillStyle=col;c.fill();};
  diamond(347,'#C3D5B9');diamond(330,'#F6F8E8');diamond(313,'#6F9D81');diamond(298,'#C1D6AE');diamond(298,'#B3CAA6');
  c.beginPath();c.moveTo(123,298);c.lineTo(350,225);c.lineTo(584,298);c.lineTo(350,374);c.closePath();c.fillStyle=linear(c,0,230,0,380,[[0,'#8DB18D'],[1,'#467B60']]);c.fill();c.strokeStyle='#E7F0D2';c.lineWidth=3;c.stroke();
  const tile=(f:string,cx:number,cy:number,a:number)=>{c.save();c.translate(cx,cy);c.rotate(a);drawTile(c,f,-72,-99,{w:144,h:180,lift:12});c.restore();};
  tile('4s',222,287,-.27);tile('6s',476,284,.22);tile('z6',350,263,-.045);
  c.fillStyle=linear(c,570,320,619,385,[[0,'#FFFDF1'],[1,'#CFA98F']]);c.beginPath();c.moveTo(556,324);c.lineTo(624,324);c.lineTo(615,378);c.quadraticCurveTo(590,393,566,378);c.closePath();c.fill();ellipse(c,590,324,34,10,'#FFFDF2');ellipse(c,590,326,24,5,'#8B9D75');
  c.strokeStyle='#789D75';c.lineWidth=3;c.beginPath();c.moveTo(590,325);c.lineTo(593,270);c.stroke();flower(c,593,270,25);
  c.save();c.translate(130,400);c.rotate(-.09);drawSunnySurface(c,-95,-25,190,58);c.font='22px serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=SUNNY.ink;c.fillText('一桌好心情',3,0);c.restore();
  ellipse(c,238,123,8,4,'#EAB799',-.5);flower(c,523,345,12);c.restore();
}
export function drawSunnyIcon(c:Ctx2D,name:string,x:number,y:number,size:number,col:string):void{
  c.save();c.translate(x,y);c.scale(size/24,size/24);c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.7;c.lineCap='round';c.lineJoin='round';c.beginPath();
  const line=(pts:number[])=>{c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);};
  if(name==='home'){line([3,11,12,3,21,11]);line([5,10,5,21,19,21,19,10]);line([9,21,9,14,15,14,15,21]);}
  else if(name==='map'){line([3,5,9,3,15,6,21,4,21,20,15,22,9,19,3,21,3,5]);line([9,3,9,19]);line([15,6,15,22]);}
  else if(name==='flower'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.moveTo(16+Math.cos(a)*4,10+Math.sin(a)*4);c.arc(12+Math.cos(a)*4,10+Math.sin(a)*4,4,0,Math.PI*2);}line([12,14,12,22]);}
  else if(name==='workshop'){line([4,3,9,8,6,11,2,7,3,12,10,18,15,13,20,21,23,18,15,11,20,4,15,5,12,9,7,2,4,3]);}
  else if(name==='book'){line([12,6,7,3,2,4,2,20,7,19,12,22,17,19,22,20,22,4,17,3,12,6,12,22]);}
  else if(name==='gear'){c.arc(12,12,6,0,Math.PI*2);for(let i=0;i<8;i++){const a=i*Math.PI/4;line([12+Math.cos(a)*7,12+Math.sin(a)*7,12+Math.cos(a)*9,12+Math.sin(a)*9]);}c.moveTo(14.5,12);c.arc(12,12,2.5,0,Math.PI*2);}
  else if(name==='pause'){line([8,5,8,19]);line([16,5,16,19]);c.lineWidth=3;}
  else if(name==='hint'){c.moveTo(8,17);c.bezierCurveTo(8,13,4,13,4,9);c.arc(12,9,8,Math.PI,0);c.bezierCurveTo(20,13,16,13,16,17);line([8,18,16,18]);line([9,22,15,22]);}
  else if(name==='undo'){line([8,3,3,8,8,13]);c.moveTo(3,8);c.lineTo(13,8);c.bezierCurveTo(23,8,23,22,13,22);}
  else if(name==='restart'){c.arc(12,12,8,.2,Math.PI*1.8);line([20,4,20,11,13,11]);}
  else if(name==='back'){line([15,4,7,12,15,20]);}
  else if(name==='next'){line([9,4,17,12,9,20]);}
  else if(name==='spark'){line([14,2,4,14,11,14,10,22,21,9,13,9,14,2]);}
  else if(name==='close'){line([5,5,19,19]);line([19,5,5,19]);}
  else if(name==='lock'){c.moveTo(7,11);c.lineTo(7,7);c.arc(12,7,5,Math.PI,0);c.lineTo(17,11);line([5,11,19,11,19,22,5,22,5,11]);line([12,15,12,18]);}
  else if(name==='play'){line([7,4,20,12,7,20,7,4]);c.fill();}
  else if(name==='ice'){for(let i=0;i<3;i++){const a=i*Math.PI/3;line([12-Math.cos(a)*10,12-Math.sin(a)*10,12+Math.cos(a)*10,12+Math.sin(a)*10]);}}
  else {line([5,3,19,3,19,21,5,21,5,3]);line([9,8,15,8]);line([9,13,15,13]);}
  c.stroke();c.restore();
}


/** 园路与装饰只绘制一次；关卡文字和点击区域留给各端原生控件。 */
export function gardenPoints(w:number,h:number){
 const left=82,right=w-82,dy=(h-158)/4;
 return Array.from({length:20},(_,i)=>{const row=Math.floor(i/4),col=row%2?3-i%4:i%4;
  return {x:left+(right-left)*col/3+(row%2?-10:10),y:72+row*dy+([8,-9,5,-3][col])};});
}
export const GARDEN_PALETTES=[
 {top:'#F2F4DA',bottom:'#D9E7C3',leaf:'#8EAF73',deep:'#557F61',petal:'#ECA687',water:'#A0CDD0',name:'晴日花径'},
 {top:'#EDF4E8',bottom:'#CDDDD3',leaf:'#89ADA0',deep:'#547F78',petal:'#DFB0BA',water:'#92BFCF',name:'薄雾水岸'},
 {top:'#FFF0DF',bottom:'#E6DEBC',leaf:'#AAA578',deep:'#788566',petal:'#E2A06E',water:'#ACCBC1',name:'暖阳小园'},
 {top:'#EFEEDD',bottom:'#D8E0D6',leaf:'#9DAAA1',deep:'#607C78',petal:'#CAB5C4',water:'#A6BCD5',name:'月色花庭'}
];
export function drawSunnyGarden(c:Ctx2D,x:number,y:number,w:number,h:number,chapter:number,frontier:number):void{
 const p=GARDEN_PALETTES[Math.floor(chapter/2)%4];c.save();c.translate(x,y);
 fillRR(c,0,7,w,h-7,28,'#C3CDAE');fillRR(c,0,0,w,h-9,28,linear(c,0,0,w,h,[[0,p.top],[1,p.bottom]]));
 strokeRR(c,3,3,w-6,h-15,25,'#FCFBEA',3);
 // 松散草坡、纸面颗粒与草丛。固定序列避免重绘时装饰跳动。
 for(let i=0;i<8;i++)ellipse(c,(i*157+35)%w,40+(i*139)%(h-85),75,26,i%2?'#D6E2BF':'#E5EACB',-.18);
 for(let i=0;i<115;i++){const xx=14+(i*137)%(w-28),yy=18+(i*83)%(h-45);ellipse(c,xx,yy,1.4,.8,'rgba(103,133,82,.13)');}
 const pts=gardenPoints(w,h),dy=(h-158)/4;
 const path=(to:number,col:string,width:number,offset=0)=>{c.beginPath();c.moveTo(pts[0].x,pts[0].y+offset);
  for(let i=1;i<=to;i++){const a=pts[i-1],b=pts[i];if(Math.floor(i/4)!==Math.floor((i-1)/4)){const bend=i%8===4?48:-48;c.bezierCurveTo(a.x+bend,a.y+dy*.45+offset,b.x+bend,b.y-dy*.45+offset,b.x,b.y+offset);}
   else c.bezierCurveTo(a.x+(b.x-a.x)*.5,a.y-15+offset,a.x+(b.x-a.x)*.5,b.y+15+offset,b.x,b.y+offset);}
  c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();};
 path(19,'#B8C69F',32,5);path(19,'#FFFAE5',30);path(19,'#E9DFBB',18);
 const end=Math.max(0,Math.min(19,frontier-chapter*20));if(end>0){path(end,'#93B598',16);path(end,'#C2D9A6',7);}
 const bush=(xx:number,yy:number,scale=1)=>{c.save();c.translate(xx,yy);c.scale(scale,scale);ellipse(c,0,11,39,12,'rgba(70,105,72,.12)');ellipse(c,-20,0,20,22,p.leaf);ellipse(c,9,-10,25,27,p.leaf);ellipse(c,26,5,17,17,p.deep);ellipse(c,3,-19,16,13,'#B6CD90');flower(c,-18,-8,9);flower(c,20,-8,7);c.restore();};
 const bed=(xx:number,yy:number)=>{c.save();c.translate(xx,yy);fillRR(c,-50,7,100,22,9,'#B99271');fillRR(c,-53,-3,106,22,10,'#E6C39E');ellipse(c,0,1,45,9,'#879466');
  for(let i=0;i<5;i++){const bx=-34+i*17,by=-15-(i%2)*10;c.strokeStyle=p.deep;c.lineWidth=2;c.beginPath();c.moveTo(bx,0);c.lineTo(bx,by);c.stroke();ellipse(c,bx+4,by+8,7,3,p.leaf,-.5);for(let k=0;k<5;k++){const a=k*Math.PI*.4;ellipse(c,bx+Math.cos(a)*5,by+Math.sin(a)*5,4,4,i%2?'#FFFBEA':p.petal);}ellipse(c,bx,by,2.5,2.5,'#CFAD58');}c.restore();};
 const pond=(xx:number,yy:number)=>{ellipse(c,xx,yy+7,67,27,'#BCCAA6',-.14);ellipse(c,xx,yy,67,27,'#F7F2D9',-.14);ellipse(c,xx,yy-2,59,21,p.water,-.14);ellipse(c,xx-20,yy-7,22,3,'rgba(255,255,242,.6)',-.14);ellipse(c,xx+28,yy+3,14,7,p.leaf);flower(c,xx+29,yy,8);};
 // 景物布置在两排关卡之间，避开数字、锁和星星。
 const middle=(row:number)=>72+row*dy+dy*.56;
 pond(w*.48,middle(0));bush(w*.18,middle(0),.75);bed(w*.71,middle(1));bush(w*.2,middle(2),1);pond(w*.66,middle(3));
 // 小木桥横跨第一湾池水。
 c.save();c.translate(w*.48,middle(0));c.rotate(-.12);fillRR(c,-17,-32,34,62,4,'#AB8A65');for(let i=0;i<7;i++)fillRR(c,-19,-31+i*8,38,6,2,'#DFC39A');c.restore();
 // 花架与挂灯。
 const ax=w*.26,ay=middle(1);fillRR(c,ax-35,ay-17,6,43,2,'#B49771');fillRR(c,ax+31,ay-17,6,43,2,'#B49771');fillRR(c,ax-43,ay-27,86,8,3,'#DEC49D');
 for(let i=0;i<6;i++){ellipse(c,ax-35+i*14,ay-27+(i%2)*3,11,8,p.leaf);if(i%2)flower(c,ax-35+i*14,ay-27,6);}
 fillRR(c,ax-7,ay-9,14,18,4,'#E7B767');ellipse(c,ax,ay,4,6,'#FFF1B0');
 // 园椅、路牌、蝴蝶与终点花篮。
 const bx=w*.7,by=middle(2);for(let i=0;i<3;i++)fillRR(c,bx-31,by-17+i*8,62,5,2,'#BA9B78');fillRR(c,bx-34,by+8,68,9,3,'#DFC29D');fillRR(c,bx-27,by+17,5,12,1,'#A5896B');fillRR(c,bx+22,by+17,5,12,1,'#A5896B');
 const sx=w*.25,sy=middle(3);fillRR(c,sx-3,sy-10,6,40,2,'#B6946B');fillRR(c,sx-33,sy-23,65,24,5,'#F5DFB8');c.strokeStyle='#A78C60';c.lineWidth=2;c.beginPath();c.moveTo(sx-11,sy-11);c.lineTo(sx+13,sy-11);c.lineTo(sx+6,sy-17);c.moveTo(sx+13,sy-11);c.lineTo(sx+6,sy-5);c.stroke();
 for(const [xx,yy]of [[w*.84,middle(0)-12],[w*.5,middle(2)+4]]){ellipse(c,xx-5,yy-2,7,4,p.petal,.6);ellipse(c,xx+5,yy-2,7,4,p.petal,-.6);ellipse(c,xx,yy+1,1.5,5,p.deep);}
 bush(28,h-46,.56);bush(w-30,32,.53);bed(w/2,h-35);c.restore();
}
export function drawSunnyStage(c:Ctx2D,x:number,y:number,w:number,h:number,state:string):void{
 c.save();c.translate(x,y);c.scale(w/108,h/108);
 const locked=state==='locked',current=state==='current',done=state==='done';
 ellipse(c,54,89,44,12,'rgba(57,84,48,.14)');
 if(current){ellipse(c,54,56,50,44,'rgba(235,178,125,.25)');}
 const edge=locked?'#BBC7A6':current?'#BA805C':done?'#4F7F60':'#ACAD83';
 const top=locked?'#DEE5CC':current?'#F4BF90':done?'#B4D1A0':'#FFFBE5';
 ellipse(c,54,65,41,34,edge);fillRR(c,13,53,82,13,2,edge);ellipse(c,54,55,41,34,top);
 c.beginPath();c.ellipse(54,54,35,28,0,0,Math.PI*2);c.strokeStyle=locked?'#EEF1E1':'#FFFADE';c.lineWidth=2.5;c.stroke();
 c.beginPath();c.ellipse(54,51,30,24,0,Math.PI,Math.PI*2);c.strokeStyle=locked?'#C4CEB2':current?'#D59E72':done?'#8DAD81':'#DDD3AE';c.lineWidth=1.3;c.stroke();
 if(current){c.beginPath();c.moveTo(47,6);c.lineTo(61,6);c.lineTo(54,15);c.closePath();c.fillStyle='#C08762';c.fill();}
 c.restore();
}
