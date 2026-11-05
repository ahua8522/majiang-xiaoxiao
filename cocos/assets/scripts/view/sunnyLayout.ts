/** 正式 Cocos 与 H5 共用布局和文案，尺寸以 750 宽的可见区域为基准。 */
import type {Session} from '../core/Session';
import {CHAPTER_LENGTH, CHAPTERS} from '../core/Campaign';
import {SUNNY, TABLE_THEMES, TableTheme} from './sunnyArt';

export type SunnyKind='paper'|'peach'|'jade'|'off'|'circle'|'hero'|'line'|'text'|'icon'|'tile';
export interface SunnyItem {kind:SunnyKind;x:number;y:number;w:number;h:number;text?:string;size?:number;color?:string;bold?:boolean;serif?:boolean;align?:'left'|'center'|'right';id?:string;enabled?:boolean;name?:string;angle?:number}
export interface SunnyState {w:number;h:number;safe:number;s:Session;page:number;theme:TableTheme;practice:boolean;cssScale?:number}
export interface SunnyBoardLayout {items:SunnyItem[];x:number;y:number;cellW:number;cellH:number}
export const WORKSHOP=[
  {name:'轻推碰对',icon:'tiles',note:'同牌相邻，就能配对',level:0},
  {name:'叠影与冰',icon:'ice',note:'先破冰，再收走',level:40},
  {name:'花圃开花',icon:'flower',note:'把对子送到花圃',level:60},
  {name:'心愿清单',icon:'book',note:'收齐画出来的牌',level:80},
  {name:'灵感充能',icon:'spark',note:'消四对，换一次提示',level:100},
  {name:'露珠与花苞',icon:'flower',note:'邻格浇水，分次开花',level:220},
  {name:'钥匙开路',icon:'workshop',note:'收钥匙，打开锁轨',level:180},
  {name:'机关合奏',icon:'map',note:'花圃、钥匙与叠牌',level:479}
];
export function totalStars(s:Session){return Object.values(s.stars).reduce((a,b)=>a+b,0);}
function kit(a:SunnyState){
 const out:SunnyItem[]=[];
 const box=(kind:SunnyKind,x:number,y:number,w:number,h:number,id?:string,enabled=true)=>{out.push({kind,x,y,w,h,id,enabled});};
 const txt=(text:string,x:number,y:number,size=25,color=SUNNY.ink,align:'left'|'center'|'right'='left',bold=false,serif=false)=>out.push({kind:'text',x,y,w:0,h:0,text,size,color,align,bold,serif});
 const ico=(name:string,x:number,y:number,size=34,color=SUNNY.ink)=>out.push({kind:'icon',name,x,y,w:size,h:size,color});
 const button=(text:string,id:string,x:number,y:number,w:number,h=88,kind:SunnyKind='paper',enabled=true)=>{box(enabled?kind:'off',x,y,w,h,id,enabled);txt(text,x+w/2,y+(h-32)/2-2,30,enabled?(kind==='peach'||kind==='jade'?'#FFFEF4':SUNNY.ink):'#8EA085','center',true);};
 const circle=(icon:string,id:string,x:number,y:number)=>{box('circle',x,y,82,82,id);ico(icon,x+24,y+24,34);};
 const tile=(name:string,x:number,y:number,w:number)=>out.push({kind:'tile',name,x,y,w,h:w*1.24});
 const top=()=>{tile('z6',35,a.safe+43,72);txt('今天也开心',120,a.safe+51,26,SUNNY.ink,'left',true);txt('给自己一点放松时间',120,a.safe+88,20,SUNNY.soft);box('paper',a.w-234,a.safe+51,116,64);txt('★ '+totalStars(a.s),a.w-176,a.safe+64,27,SUNNY.ink,'center',true);circle('gear','settings',a.w-105,a.safe+40);};
 const nav=(active:string)=>{box('line',0,a.h-112,a.w,112);out[out.length-1].color='#FFFDF5';const tabs=[['home','home','花园'],['levels','map','游园'],['workshop','workshop','机关'],['album','book','收藏']];tabs.forEach(([id,icon,label],i)=>{const x=i*a.w/4;box('line',x,a.h-112,a.w/4,106,id);out[out.length-1].color='#FFFDF5';if(id===active){box('line',x+a.w/8-24,a.h-112,48,4);out[out.length-1].color=SUNNY.jade;}ico(icon,x+a.w/8-20,a.h-89,40,id===active?SUNNY.ink:'#9AA086');txt(label,x+a.w/8,a.h-37,19,id===active?SUNNY.ink:'#9AA086','center',id===active);});};
 return {out,box,txt,ico,button,circle,tile,top,nav};
}
export function sunnyHome(a:SunnyState):SunnyItem[]{
 const {out,box,txt,button,ico,top,nav}=kit(a);top();
 const sy=a.safe,free=a.h-sy,short=free<1420;
 txt('阳光正好 · 碰个开心',a.w/2,sy+179,20,SUNNY.soft,'center');
 const logoX=(a.w-433)/2;
 for(const [dy,col]of [[5,'#C9DAC0'],[2,'#FFFEF4'],[0,'#315F49']] as [number,string][]){txt('快乐推麻',logoX,sy+221+dy,68,col,'left',true);txt('对对消',logoX+280,sy+241+dy,51,dy?col:'#4D7959','left',true);}
 txt('推一推，同牌碰头就消',a.w/2,sy+317,23,SUNNY.soft,'center');
 const cardY=a.h-558,heroY=sy+(short?334:360),heroH=Math.max(140,Math.min(480,cardY-heroY-18)),heroW=Math.min(a.w-50,heroH*700/475);
 box('hero',(a.w-heroW)/2,heroY,heroW,heroH);
 box('paper',44,cardY,a.w-88,248);
 const chapter=CHAPTERS[Math.floor(a.s.levelIndex/CHAPTER_LENGTH)];
 txt('晴日花园 / 下一处好风景',76,cardY+28,20,'#A49878');
 txt(chapter[0],76,cardY+68,38,SUNNY.ink,'left',true,true);
 txt(String(a.s.levelIndex+1).padStart(2,'0'),a.w-97,cardY+46,42,SUNNY.jade,'center',true,true);
 button(a.s.moves?'继续这一桌':'开桌消一局','start',76,cardY+133,a.w-152,92,'peach');
 const cy=cardY+275,cw=(a.w-114)/2;
 box('paper',44,cy,cw,111,'workshop');ico('workshop',64,cy+33,40,'#BD8D48');txt('机关工坊',119,cy+23,27,SUNNY.ink,'left',true);txt('新机关，随心试',119,cy+66,19,SUNNY.soft);
 box('paper',70+cw,cy,cw,111,'album');ico('flower',90+cw,cy+33,40,'#7A9B6C');txt('我的收藏',145+cw,cy+23,27,SUNNY.ink,'left',true);txt('换张桌布，换个心情',145+cw,cy+66,18,SUNNY.soft);
 if(a.h-(cy+111)>154)txt('同牌消除 · 轻松动动脑',a.w/2,cy+138,20,SUNNY.soft,'center');nav('home');return out;
}
export function sunnyMap(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button,circle,top,nav}=kit(a);top();const ci=a.page;
 txt('下一站，好风景',44,a.safe+168,46,SUNNY.ink,'left',true,true);
 txt(`第 ${ci+1} 章 · ${CHAPTERS[ci][0]}`,44,a.safe+241,29,SUNNY.ink,'left',true);
 txt(`${ci+1} / 26`,a.w-44,a.safe+245,23,SUNNY.soft,'right');
 txt(CHAPTERS[ci][2],44,a.safe+290,21,SUNNY.soft);
 const y0=a.safe+388,y1=a.h-385,stepY=(y1-y0)/4,stepX=(a.w-220)/3,d=Math.min(96,stepY*.62);
 const points=Array.from({length:20},(_,j)=>{const row=Math.floor(j/4),col=row%2?3-j%4:j%4;return {x:110+col*stepX,y:y0+row*stepY};});
 points.forEach((p,j)=>{if(j<19){const q=points[j+1],dx=q.x-p.x,dy=q.y-p.y;out.push({kind:'line',x:(p.x+q.x)/2,y:(p.y+q.y)/2,w:Math.hypot(dx,dy),h:14,color:'#D4DFC1',angle:Math.atan2(dy,dx)});}});
 points.forEach((p,j)=>{const idx=ci*20+j,st=a.s.stars[idx]||0,open=a.s.canEnter(idx),current=idx===a.s.levelIndex;box('circle',p.x-d/2,p.y-d/2,d,d,'level:'+idx,open);out[out.length-1].color=current?'#DEA080':st?'#8FB38E':open?'#FFFDF4':'#E2E9D5';txt(String(idx+1),p.x,p.y-21,31,open?SUNNY.ink:'#9AA68D','center',true,true);if(st)txt('★'.repeat(st),p.x,p.y+d/2+8,20,'#B58D46','center');else if(!open)txt('待开启',p.x,p.y+d/2+8,17,'#97A089','center');});
 box('paper',44,a.h-305,a.w-88,82);txt(`已走过 ${Object.keys(a.s.stars).length} 处小景`,74,a.h-282,25,SUNNY.ink,'left',true);txt('通关前一关即可继续',a.w-73,a.h-278,20,SUNNY.soft,'right');
 button('上一章','page-prev',44,a.h-206,220,74,'paper',ci>0);button('下一章','page-next',a.w-264,a.h-206,220,74,'paper',ci<25);nav('levels');return out;
}
export function sunnyWorkshop(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button,top,nav}=kit(a);top();txt('机关工坊',44,a.safe+172,46,SUNNY.ink,'left',true,true);txt('先玩一小桌，再去闯关',44,a.safe+244,24,SUNNY.soft);
 const start=a.safe+307,end=a.h-269,rowH=Math.min(197,(end-start)/4),cw=(a.w-108)/2;
 WORKSHOP.forEach((m,i)=>{const x=44+(i%2)*(cw+20),y=start+Math.floor(i/2)*rowH;box('paper',x,y,cw,rowH-17,'practice:'+i);ico(m.icon,x+23,y+23,39,i%2?'#BA9460':'#6C966F');txt(m.name,x+79,y+24,27,SUNNY.ink,'left',true);txt(m.note,x+23,y+79,21,SUNNY.soft);txt('试一桌  ›',x+23,y+rowH-57,23,SUNNY.jade,'left',true);});
 button('独立挑战','challenge',44,a.h-231,a.w-88,83,'jade');nav('workshop');return out;
}
export function sunnyAlbum(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button,top,nav}=kit(a);top();const stars=totalStars(a.s);
 txt('把好心情收起来',44,a.safe+170,44,SUNNY.ink,'left',true,true);txt('通关留花笺，星星换桌布',44,a.safe+245,23,SUNNY.soft);
 const start=a.safe+311,rh=Math.min(165,(a.h-a.safe-750)/3);
 TABLE_THEMES.forEach((t,i)=>{const y=start+i*rh,open=stars>=t.stars;box('paper',44,y,a.w-88,rh-17,'theme:'+t.id,open);box('circle',64,y+20,76,76);out[out.length-1].color=t.felt;ico('flower',84,y+40,36,'#FFFDEE');txt(t.name,163,y+24,30,SUNNY.ink,'left',true);txt(open?'已经收藏':`收集 ${t.stars} 颗星解锁`,163,y+72,21,SUNNY.soft);txt(a.theme===t.id?'使用中':open?'换上':'未解锁',a.w-82,y+42,25,open?SUNNY.jade:'#A3AA95','right',true);});
 const fy=start+3*rh+27;txt('旅途花笺',44,fy,29,SUNNY.ink,'left',true,true);const completed=CHAPTERS.map((c,ci)=>({name:c[0],ci})).filter(c=>Array.from({length:20},(_,j)=>a.s.stars[c.ci*20+j]||0).some(Boolean));
 if(!completed.length){box('paper',44,fy+57,a.w-88,174);ico('flower',a.w/2-24,fy+78,48,'#92AA80');txt('第一桌通关，留下一枚花笺',a.w/2,fy+155,24,SUNNY.soft,'center');}
 else completed.slice(-6).forEach((c,i)=>{const x=44+(i%3)*(a.w-88)/3,y=fy+57+Math.floor(i/3)*91;box('paper',x,y,(a.w-112)/3,78);txt(c.name,x+(a.w-112)/6,y+25,22,SUNNY.ink,'center',true);});
 nav('album');return out;
}
export function sunnyBoard(a:SunnyState,message:string):SunnyBoardLayout{
 const {out,box,txt,ico,circle,tile}=kit(a),S=a.s,W=a.w,H=a.h,safe=a.safe,dense=H-safe<1450&&S.grid.length>=8;
 circle('pause','pause',35,safe+29);circle('gear','settings',W-117,safe+29);
 txt(a.practice?'机关试玩':dense?`第 ${S.levelIndex+1} 关 · ${CHAPTERS[Math.floor(S.levelIndex/20)][0]}`:CHAPTERS[Math.floor(S.levelIndex/20)][0],W/2,safe+35,dense?30:37,SUNNY.ink,'center',true,true);
 txt(dense?message.slice(0,23):a.practice?'不计主线进度':`第 ${S.levelIndex+1} 关 · ${S.grid[0].length} × ${S.grid.length}`,W/2,safe+89,dense?18:21,SUNNY.soft,'center');if(dense)out[out.length-1].name='board-message';
 const cy=safe+148;box('paper',36,cy,W-72,dense?106:130);
 const goal=S.goal,target=goal?.kind==='collect'?goal.faces||[]:goal?.kind==='face'?[goal.face!]:[];
 ico(goal?.kind==='garden'?'flower':target.length?'book':'tiles',62,cy+44,43,'#BB9552');
 txt(target.length?'心愿清单 · 每种一对':goal?(S.def.floors?.[0]?.kind==='dew'?'在露珠旁消牌':S.def.floors?.[0]?.kind==='bud'?'分两次唤醒花苞':'让花圃全部开花'):'收走这一桌麻将',122,cy+24,22,'#92937C');
 if(target.length)target.slice(0,4).forEach((f,i)=>{tile(f,119+i*73,cy+51,40);txt((S.mechanics.collected[f.replace(/[~*]+$/,'')]||0)>=2?'✓':'2',166+i*73,cy+66,23,SUNNY.ink);});
 else txt(goal?S.objectiveText:`${S.remaining} 张待收`,122,cy+65,dense?28:32,SUNNY.ink,'left',true);
 box('line',W-169,cy+23,2,79);out[out.length-1].color='#D9DCC2';txt(S.moveLimit?'剩余步数':'已用步数',W-107,cy+23,20,SUNNY.soft,'center');txt(String(S.moveLimit?S.movesLeft:S.moves),W-106,cy+58,dense?35:45,S.moveLimit&&S.movesLeft<4?'#BF755E':SUNNY.jade,'center',true,true);
 if(S.def.energy&&!dense){ico('spark',45,safe+304,29,'#BA934D');txt('灵感',88,safe+304,22,SUNNY.soft);for(let i=0;i<4;i++){box('paper',154+i*83,safe+303,75,18);if(i<S.mechanics.charge){box('line',158+i*83,safe+307,67,8);out[out.length-1].color='#92B48A';}}box('paper',W-219,safe+293,181,46,'energy-hint');txt(S.mechanics.charge>=4?'用一次提示':'消对充能',W-129,safe+303,20,S.mechanics.charge>=4?SUNNY.jade:'#A4AC91','center');}
 const top=safe+(dense?288:S.def.energy?376:328),bottom=H-(dense?175:233),avail=bottom-top,rows=S.grid.length,cols=S.grid[0].length;
 const cellW=Math.min((W-94)/cols,avail/(rows+.65)/1.24,156),cellH=cellW*1.24,x=(W-cols*cellW)/2,y=top+(avail-rows*cellH)/2;
 if(!dense){txt(message.slice(0,29),W/2,H-192,23,SUNNY.soft,'center');out[out.length-1].name='board-message';}
 const toolH=Math.max(88,Math.min(104,44/(a.cssScale||.52))),toolY=H-43-toolH;const tw=(W-102)/3;['提示','撤销','重开'].forEach((text,i)=>{const id=['hint','undo','restart'][i],bx=36+i*(tw+15);box('paper',bx,toolY,tw,toolH,id);ico(id,bx+tw/2-51,toolY+toolH/2-17,30,SUNNY.jade);txt(dense&&id==='hint'&&S.def.energy?`提示 ${S.mechanics.charge}/4`:text,bx+tw/2+16,toolY+toolH/2-17,dense&&id==='hint'&&S.def.energy?20:25,SUNNY.ink,'center');});
 return {items:out,x,y,cellW,cellH};
}
export function sunnyWin(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),S=a.s,h=666,y=(a.h+a.safe-h)/2;
 box('paper',67,y,a.w-134,h);txt('今日又添一份好手气',a.w/2,y+43,21,SUNNY.soft,'center');ico('flower',a.w/2-38,y+95,76,'#B59052');txt('这一桌，收得漂亮！',a.w/2,y+206,39,SUNNY.ink,'center',true,true);txt('★'.repeat(S.rating)+'☆'.repeat(3-S.rating),a.w/2,y+277,52,'#C4A05D','center');
 txt(`${a.practice?'机关试玩':`第 ${S.levelIndex+1} 关`} · ${S.moves} 步`,a.w/2,y+357,27,SUNNY.ink,'center');txt(a.practice?'已经掌握，去主线试试吧':'一枚新的旅途花笺，已放进收藏',a.w/2,y+405,22,SUNNY.soft,'center');
 const last=S.levelIndex===519;button(a.practice?'回到机关工坊':last?'再逛一次':'去下一处小景',a.practice?'workshop':last?'replay':'next',108,y+474,a.w-216,90,'peach');button('返回花园','home',108,y+580,a.w-216,58);return out;
}
export function sunnySettings(a:SunnyState,music:boolean,sound:boolean,version:string):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),h=654,y=(a.h+a.safe-h)/2,x=65,w=a.w-130;
 box('paper',x,y,w,h);txt('游戏设置',a.w/2,y+37,40,SUNNY.ink,'center',true,true);
 [['背景音乐','toggle-music',music],['音效','toggle-sound',sound],['轻触震动','toggle-vibration',a.s.vibration]].forEach(([label,id,on],i)=>{
  const yy=y+128+i*98;txt(String(label),x+40,yy+13,28,SUNNY.ink);box(on?'jade':'off',x+w-151,yy,112,57,String(id));txt(on?'开':'关',x+w-95,yy+12,25,on?'#FFFDF4':SUNNY.soft,'center',true);
 });
 button('玩法说明','about',x+36,y+435,w-72,66);button('完成','__back',x+36,y+524,w-72,78,'jade');txt('版本 '+version,a.w/2,y+620,19,SUNNY.soft,'center');return out;
}
export function sunnyPause(a:SunnyState):SunnyItem[]{
 const {out,box,txt,button}=kit(a),hasShuffle=!a.s.shuffleBlocked,h=hasShuffle?694:602,y=(a.h+a.safe-h)/2;
 box('paper',70,y,a.w-140,h);txt('这桌等你回来',a.w/2,y+39,40,SUNNY.ink,'center',true,true);txt('慢慢想，不着急',a.w/2,y+102,23,SUNNY.soft,'center');
 const rows=[['继续这一桌','resume'],['重新开桌','restart'],...(hasShuffle?[[`洗牌 · ${a.s.shufflesLeft}`,'shuffle']]:[]),[a.practice?'回机关工坊':'游园选关',a.practice?'workshop':'levels'],['回到首页','home']];
 rows.forEach(([label,id],i)=>button(label,id,108,y+165+i*93,a.w-216,77,i===0?'jade':'paper'));return out;
}
export function sunnyLose(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),S=a.s,h=602,y=(a.h+a.safe-h)/2,dead=S.failReason==='dead';
 box('paper',70,y,a.w-140,h);ico('flower',a.w/2-34,y+38,68,'#AEAA7C');txt('换个思路试试',a.w/2,y+151,41,SUNNY.ink,'center',true,true);
 txt(dead?'再整理一下，给对子让条路':S.failReason==='time'?'休息一会，再开一桌':'就差一点，继续想一想',a.w/2,y+228,24,SUNNY.soft,'center');
 const primary=dead?(S.shuffleBlocked?{label:S.canUndo?'撤销一步':'重新开桌',id:S.canUndo?'undo':'restart-lose',on:true}:{label:'重新整理牌桌',id:'rescue',on:true}):{label:S.canRevive?(S.failReason==='time'?'补 30 秒':`补 ${S.reviveBonus} 步`):'本局续玩已用完',id:'revive',on:S.canRevive};
 button(primary.label,primary.id,108,y+299,a.w-216,88,'jade',primary.on);button('重新开桌','restart-lose',108,y+405,a.w-216,77);button('回到首页','home',108,y+502,a.w-216,59);return out;
}
export function sunnyIntro(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),c=CHAPTERS[Math.floor(a.s.levelIndex/20)],h=526,y=(a.h+a.safe-h)/2;
 box('paper',60,y,a.w-120,h);ico('flower',a.w/2-27,y+37,54,'#A39562');txt(c[0],a.w/2,y+126,41,SUNNY.ink,'center',true,true);
 txt(c[2],a.w/2,y+217,25,SUNNY.ink,'center');txt(c[3],a.w/2,y+266,24,SUNNY.soft,'center');button('知道了，开一桌','tip-ok',100,y+382,a.w-200,88,'peach');return out;
}
export function sunnyRestart(a:SunnyState):SunnyItem[]{
 const {out,box,txt,button}=kit(a),h=431,y=(a.h+a.safe-h)/2;box('paper',70,y,a.w-140,h);txt('重新开这一桌？',a.w/2,y+49,39,SUNNY.ink,'center',true,true);txt('牌面会回到开局，提示次数恢复',a.w/2,y+133,24,SUNNY.soft,'center');button('重新开桌','confirm-restart',110,y+214,a.w-220,84,'jade');button('再想一想','resume',110,y+325,a.w-220,64);return out;
}
interface ChallengeView {level:number;rows:number;cols:number;remaining:number;total:number;moves:number;won:boolean;message:string}
export function sunnyChallenge(a:SunnyState,c:ChallengeView):SunnyBoardLayout{
 const {out,box,txt,ico,button,circle}=kit(a),W=a.w,H=a.h,safe=a.safe;
 circle('back','challenge-home',35,safe+30);txt(`独立挑战 · 第 ${c.level} 盘`,W/2,safe+42,35,SUNNY.ink,'center',true,true);txt('整线推移，同线配对',W/2,safe+95,21,SUNNY.soft,'center');
 box('paper',36,safe+150,W-72,116);txt('收走这一桌麻将',66,safe+169,21,SUNNY.soft);txt(`${c.remaining} 张待收`,66,safe+207,29,SUNNY.ink,'left',true);txt(`${c.moves} 步`,W-69,safe+198,37,SUNNY.jade,'right',true,true);
 const top=safe+310,bottom=H-218,cellW=Math.min((W-94)/c.cols,(bottom-top)/(c.rows+.65)/1.24,156),cellH=cellW*1.24;
 txt(c.message.slice(0,29),W/2,H-188,22,SUNNY.soft,'center');out[out.length-1].name='board-message';
 const tw=(W-102)/3;['提示','洗牌','重开'].forEach((label,i)=>{const id=['challenge-hint','challenge-shuffle','challenge-restart'][i];button(label,id,36+i*(tw+15),H-138,tw,94);});
 return {items:out,x:(W-cellW*c.cols)/2,y:top+(bottom-top-cellH*c.rows)/2,cellW,cellH};
}
export function sunnyChallengeResult(a:SunnyState,c:ChallengeView):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),h=505,y=(a.h+a.safe-h)/2;box('paper',67,y,a.w-134,h);ico('flower',a.w/2-30,y+32,60,'#A79961');txt(c.won?'这一桌，收得漂亮！':'换个思路试试',a.w/2,y+140,39,SUNNY.ink,'center',true,true);txt(`第 ${c.level} 盘 · ${c.moves} 步`,a.w/2,y+219,27,SUNNY.soft,'center');button(c.won?'去下一桌':'重新开这一桌',c.won?'challenge-next':'challenge-restart',108,y+295,a.w-216,88,'peach');button('返回花园','challenge-home',108,y+410,a.w-216,59);return out;
}
