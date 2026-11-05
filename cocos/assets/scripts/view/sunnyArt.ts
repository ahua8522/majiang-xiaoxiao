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
  const r=Math.min(28,h*.25);
  fillRR(c,x,y+7,w,h-7,r,peach?'#B7785F':jade?'#345F4C':'#BFCEAF');
  fillRR(c,x,y,w,h-8,r,linear(c,x,y,x,y+h,[[0,peach?'#EDA68A':jade?'#739D7A':off?'#E7ECD9':'#FFFEF7'],[1,peach?'#D58C70':jade?'#477B61':off?'#DDE5CE':'#F5F7E9']]));
  strokeRR(c,x+1,y+1,w-2,h-10,r,peach?'#D9987E':jade?'#658E70':'#CEDABD',2);
  strokeRR(c,x+5,y+5,w-10,h-18,Math.max(4,r-4),'rgba(255,255,245,.55)',1.5);
}
export function drawSunnyTable(c:Ctx2D,x:number,y:number,w:number,h:number,theme:TableTheme='jade'):void{
  const felt=TABLE_THEMES.find(t=>t.id===theme)!.felt;
  fillRR(c,x,y+9,w,h-9,32,'#527D65');
  fillRR(c,x,y,w,h-10,32,linear(c,x,y,x,y+h,[[0,'#BED5AA'],[1,'#83AA89']]));
  strokeRR(c,x+3,y+2,w-6,h-13,30,'#EAF1D7',3);
  fillRR(c,x+22,y+24,w-44,h-55,22,felt);
  strokeRR(c,x+22,y+24,w-44,h-55,22,'#D8E5C9',2);
  strokeRR(c,x+9,y+10,w-18,h-31,25,'rgba(250,255,234,.7)',1.5);
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
  else if(name==='play'){line([7,4,20,12,7,20,7,4]);c.fill();}
  else if(name==='ice'){for(let i=0;i<3;i++){const a=i*Math.PI/3;line([12-Math.cos(a)*10,12-Math.sin(a)*10,12+Math.cos(a)*10,12+Math.sin(a)*10]);}}
  else {line([5,3,19,3,19,21,5,21,5,3]);line([9,8,15,8]);line([9,13,15,13]);}
  c.stroke();c.restore();
}
