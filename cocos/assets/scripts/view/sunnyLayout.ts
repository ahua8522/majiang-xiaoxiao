/** 正式 Cocos 与 H5 共用布局和文案，尺寸以 750 宽的可见区域为基准。 */
import type {Session} from '../core/Session';
import {CHAPTER_LENGTH, CHAPTERS} from '../core/Campaign';
import {SUNNY, TABLE_THEMES, TableTheme, gardenPoints, GARDEN_PALETTES} from './sunnyArt';

export type SunnyKind='paper'|'peach'|'jade'|'off'|'circle'|'hero'|'line'|'text'|'icon'|'tile'|'garden'|'stage'|'veil';
export interface SunnyItem {kind:SunnyKind;x:number;y:number;w:number;h:number;text?:string;size?:number;color?:string;bold?:boolean;serif?:boolean;align?:'left'|'center'|'right';id?:string;enabled?:boolean;name?:string;angle?:number;chapter?:number;frontier?:number}
export interface SunnyState {w:number;h:number;safe:number;s:Session;page:number;theme:TableTheme;practice:boolean;cssScale?:number}
export interface SunnyBoardLayout {items:SunnyItem[];x:number;y:number;cellW:number;cellH:number}
/** 首页留给未来横幅的独立区域；当前只留白，不创建广告或占位按钮。 */
export function sunnyBannerArea(a:Pick<SunnyState,'w'|'h'>){return {x:0,y:a.h-144,w:a.w,h:120};}
export const BOARD_PAD=18;
/** 牌面保持实物比例，先扣除窄桌沿，再同时适配横纵空间。 */
function fitBoard(a:SunnyState,rows:number,cols:number,top:number,bottom:number,margin=28){
 const cellW=Math.min((a.w-2*margin)/cols,(bottom-top-2*BOARD_PAD)/rows/1.24,156),cellH=cellW*1.24;
 return {x:(a.w-cols*cellW)/2,y:top+(bottom-top-rows*cellH)/2,cellW,cellH};
}
function boardTools(a:SunnyState){const h=Math.max(84,Math.min(104,44/(a.cssScale||.52))),y=a.h-36-h;return {h,y,messageY:y-44,bottom:y-60};}
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
 return {out,box,txt,ico,button,circle,tile,top};
}
export function sunnyHome(a:SunnyState):SunnyItem[]{
 const {out,box,txt,button,ico,top}=kit(a);top();
 const sy=a.safe,free=a.h-sy,short=free<1420;
 txt('阳光正好 · 碰个开心',a.w/2,sy+179,20,SUNNY.soft,'center');
 const logoX=(a.w-433)/2;
 for(const [dy,col]of [[5,'#C9DAC0'],[2,'#FFFEF4'],[0,'#315F49']] as [number,string][]){txt('快乐推麻',logoX,sy+221+dy,68,col,'left',true);txt('对对消',logoX+280,sy+241+dy,51,dy?col:'#4D7959','left',true);}
 txt('推一推，同牌碰头就消',a.w/2,sy+317,23,SUNNY.soft,'center');
 const cardY=sunnyBannerArea(a).y-396,heroY=sy+(short?334:360),heroH=Math.max(140,Math.min(480,cardY-heroY-18)),heroW=Math.min(a.w-50,heroH*700/475);
 box('hero',(a.w-heroW)/2,heroY,heroW,heroH);
 box('paper',44,cardY,a.w-88,248);
 const chapter=CHAPTERS[Math.floor(a.s.levelIndex/CHAPTER_LENGTH)];
 txt('晴日花园 / 下一处好风景',76,cardY+28,20,'#A49878');
 txt(chapter[0],76,cardY+68,38,SUNNY.ink,'left',true,true);
 txt(String(a.s.levelIndex+1).padStart(2,'0'),a.w-97,cardY+46,42,SUNNY.jade,'center',true,true);
 button(a.s.moves?'继续这一桌':'开桌消一局','start',76,cardY+133,a.w-152,92,'peach');
 const cy=cardY+266,cw=(a.w-120)/3;
 [['levels','map','游园选关'],['workshop','workshop','机关工坊'],['album','flower','我的收藏']].forEach(([id,icon,label],i)=>{
  const x=44+i*(cw+16);box('paper',x,cy,cw,108,id);ico(icon,x+cw/2-17,cy+17,34,i===1?'#B38A51':SUNNY.jade);txt(label,x+cw/2,cy+65,24,SUNNY.ink,'center',true);
 });return out;
}
/** 三个入口共用浮层边界；底部横幅区域与面板内容互不遮挡。 */
export function sunnyPanelArea(a:Pick<SunnyState,'w'|'h'|'safe'>){const y=a.safe+24,bottom=sunnyBannerArea(a).y-22;return {x:24,y,w:a.w-48,h:bottom-y,bottom};}
function panelKit(a:SunnyState,title:string,eyebrow:string){
 const k=kit(a),p=sunnyPanelArea(a);
 // 保留首页轮廓作为底图，但背景入口不可点击。
 k.out.push(...sunnyHome(a).map(i=>({...i,id:undefined,enabled:false})));
 k.box('veil',0,0,a.w,sunnyBannerArea(a).y-2,'__panel-block');k.box('paper',p.x,p.y,p.w,p.h);k.out[k.out.length-1].name='garden-panel';
 k.txt(eyebrow,54,p.y+24,18,'#9B9675');k.txt(title,54,p.y+58,38,SUNNY.ink,'left',true,true);
 k.circle('close','panel-close',a.w-116,p.y+23);
 return {...k,p};
}
export function sunnyMap(a:SunnyState):SunnyItem[]{
 const ci=Math.max(0,Math.min(CHAPTERS.length-1,a.page)),S=a.s,palette=GARDEN_PALETTES[Math.floor(ci/2)%4];
 const {out,box,txt,ico,button,p}=panelKit(a,'下一站，好风景','游园手记  /  GARDEN WALK');
 const titleY=p.y+124;box('paper',48,titleY,a.w-96,92);ico('flower',65,titleY+24,38,palette.deep);
 txt(CHAPTERS[ci][0],116,titleY+15,30,SUNNY.ink,'left',true,true);txt(`第 ${ci+1} 章 · ${ci*20+1}—${ci*20+20} 关`,116,titleY+55,20,SUNNY.soft);
 txt(`${S.chapterStars(ci)} / 60 ★`,a.w-70,titleY+33,23,'#A88951','right',true);
 const map={x:48,y:titleY+108,w:a.w-96,h:p.bottom-(titleY+108)-163};
 out.push({kind:'garden',...map,chapter:ci,frontier:S.maxLevel});
 const points=gardenPoints(map.w,map.h),d=Math.min(108,Math.max(80,(map.h-158)/4*.89));
 points.forEach((pos,j)=>{
  const idx=ci*20+j,unlocked=S.isLevelUnlocked(idx),stars=S.stars[idx]||0,current=unlocked&&idx===S.maxLevel;
  const state=!unlocked?'locked':current?'current':stars?'done':'open',x=map.x+pos.x,y=map.y+pos.y;
  out.push({kind:'stage',x:x-d/2,y:y-d/2,w:d,h:d,name:state,id:'level:'+idx,enabled:S.canEnter(idx)});
  txt(String(idx+1),x,y-17,idx>=99?26:30,unlocked?SUNNY.ink:'#859477','center',true,true);
  if(!unlocked)ico('lock',x-9,y+d*.19,18,'#889779');
  else if(stars)txt('★'.repeat(stars)+'☆'.repeat(3-stars),x,y+d*.23,17,'#A48243','center');
  else txt(current?'出发':'可挑战',x,y+d*.23,16,current?'#99623F':SUNNY.soft,'center',true);
 });
 const fy=p.bottom-145,done=Array.from({length:20},(_,j)=>S.stars[ci*20+j]||0).filter(Boolean).length;
 txt(`本章留花 ${done} / 20`,58,fy,20,SUNNY.ink,'left',true);
 txt(S.unlockAll?'体验游园 · 锁定关卡也可试玩':'循着花径，通关前一关开启下一关',a.w-58,fy,19,SUNNY.soft,'right');
 button('‹ 上一章','page-prev',52,p.bottom-99,184,76,'paper',ci>0);
 txt(`${String(ci+1).padStart(2,'0')} / ${CHAPTERS.length}`,a.w/2,p.bottom-77,23,SUNNY.soft,'center',true);
 button('下一章 ›','page-next',a.w-236,p.bottom-99,184,76,'jade',ci<CHAPTERS.length-1);return out;
}
export function sunnyWorkshop(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,button,p}=panelKit(a,'机关工坊','先试一桌  /  LITTLE WORKSHOP');
 txt('跟着小机关，发现推麻的新乐趣',54,p.y+127,23,SUNNY.soft);
 const start=p.y+185,end=p.bottom-135,rowH=Math.min(218,(end-start)/4),cw=(a.w-124)/2;
 WORKSHOP.forEach((m,i)=>{const x=52+(i%2)*(cw+20),y=start+Math.floor(i/2)*rowH;box('paper',x,y,cw,rowH-14,'practice:'+i);
  box('circle',x+18,y+16,52,52);out[out.length-1].color=i%2?'#F4E5C6':'#DFEBCF';ico(m.icon,x+29,y+27,30,i%2?'#AF8850':'#6B926A');
  txt(m.name,x+83,y+25,25,SUNNY.ink,'left',true);txt(m.note,x+20,y+79,21,SUNNY.soft);txt('试一桌  ›',x+20,y+rowH-49,22,SUNNY.jade,'left',true);
 });
 button('独立挑战','challenge',52,p.bottom-110,a.w-104,84,'jade');return out;
}
export function sunnyAlbum(a:SunnyState):SunnyItem[]{
 const {out,box,txt,ico,p}=panelKit(a,'把好心情收起来','花园收藏  /  MY KEEPSAKES'),stars=totalStars(a.s);
 txt('通关留花笺，星星换桌布',54,p.y+128,23,SUNNY.soft);txt(`已收集 ${stars} ★`,a.w-56,p.y+128,23,'#A88951','right',true);
 const start=p.y+183,rh=Math.min(170,(p.h-465)/3);
 TABLE_THEMES.forEach((t,i)=>{const y=start+i*rh,open=stars>=t.stars;box('paper',52,y,a.w-104,rh-14,'theme:'+t.id,open);box('circle',70,y+19,72,72);out[out.length-1].color=t.felt;ico('flower',89,y+38,34,'#FFFDEE');
  txt(t.name,163,y+23,29,SUNNY.ink,'left',true);txt(open?'已经收藏':`收集 ${t.stars} 颗星解锁`,163,y+67,21,SUNNY.soft);txt(a.theme===t.id?'使用中':open?'换上':'未解锁',a.w-78,y+40,24,open?SUNNY.jade:'#A3AA95','right',true);
 });
 const fy=start+3*rh+19;txt('旅途花笺',54,fy,28,SUNNY.ink,'left',true,true);const completed=CHAPTERS.map((c,ci)=>({name:c[0],ci})).filter(c=>Array.from({length:20},(_,j)=>a.s.stars[c.ci*20+j]||0).some(Boolean));
 if(!completed.length){box('paper',52,fy+49,a.w-104,154);ico('flower',a.w/2-24,fy+66,48,'#92AA80');txt('第一桌通关，留下一枚花笺',a.w/2,fy+131,23,SUNNY.soft,'center');}
 else completed.slice(-6).forEach((c,i)=>{const x=52+(i%3)*(a.w-104)/3,y=fy+49+Math.floor(i/3)*86;box('paper',x,y,(a.w-128)/3,75);txt(c.name,x+(a.w-128)/6,y+25,21,SUNNY.ink,'center',true);});
 return out;
}
export function sunnyBoard(a:SunnyState,message:string):SunnyBoardLayout{
 const {out,box,txt,ico,circle,tile}=kit(a),S=a.s,W=a.w,safe=a.safe,tools=boardTools(a);
 circle('pause','pause',24,safe+12);circle('gear','settings',W-106,safe+12);
 txt(a.practice?'机关试玩':`第 ${S.levelIndex+1} 关 · ${CHAPTERS[Math.floor(S.levelIndex/20)][0]}`,W/2,safe+32,30,SUNNY.ink,'center',true,true);
 const cy=safe+111;box('paper',24,cy,W-48,82);
 const goal=S.goal,target=goal?.kind==='collect'?goal.faces||[]:goal?.kind==='face'?[goal.face!]:[];
 ico(goal?.kind==='garden'?'flower':target.length?'book':'tiles',43,cy+22,31,'#AE8D50');
 if(target.length)target.slice(0,4).forEach((f,i)=>{tile(f,88+i*81,cy+9,44);txt((S.mechanics.collected[f.replace(/[~*]+$/,'')]||0)>=2?'✓':'2',139+i*81,cy+27,23,SUNNY.ink);});
 else txt(goal?S.objectiveText:`${S.remaining} 张待收`,89,cy+25,26,SUNNY.ink,'left',true);
 txt(S.moveLimit?`余 ${S.movesLeft} 步`:`${S.moves} 步`,W-45,cy+25,27,S.moveLimit&&S.movesLeft<4?'#BF755E':SUNNY.jade,'right',true);
 txt(message.slice(0,29),W/2,tools.messageY,20,SUNNY.soft,'center');out[out.length-1].name='board-message';
 const tw=(W-72)/3;
 ['提示','撤销','重开'].forEach((text,i)=>{const id=['hint','undo','restart'][i],bx=24+i*(tw+12),charged=id==='hint'&&S.def.energy;
  box('paper',bx,tools.y,tw,tools.h,id);const labelY=tools.y+tools.h/2-(charged?23:17);ico(id,bx+tw/2-50,labelY,30,charged&&S.mechanics.charge>=4?'#AD8747':SUNNY.jade);
  txt(text,bx+tw/2+20,labelY,26,SUNNY.ink,'center');
  if(charged)for(let j=0;j<4;j++){box('line',bx+tw/2-30+j*18,tools.y+tools.h-17,12,4);out[out.length-1].color=j<S.mechanics.charge?'#7AA181':'#DFE6D6';}
 });
 return {items:out,...fitBoard(a,S.grid.length,S.grid[0].length,safe+211,tools.bottom,40)};
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
 const {out,txt,ico,button,circle}=kit(a),W=a.w,safe=a.safe,tools=boardTools(a);
 circle('back','challenge-home',24,safe+12);txt(`独立挑战 · 第 ${c.level} 盘`,W/2,safe+32,32,SUNNY.ink,'center',true,true);
 ico('tiles',34,safe+115,30,SUNNY.jade);txt(`${c.remaining} 张待收`,79,safe+116,26,SUNNY.ink,'left',true);txt(`${c.moves} 步`,W-34,safe+116,27,SUNNY.jade,'right',true);
 txt(c.message.slice(0,29),W/2,tools.messageY,20,SUNNY.soft,'center');out[out.length-1].name='board-message';
 const tw=(W-72)/3;['提示','洗牌','重开'].forEach((label,i)=>{const id=['challenge-hint','challenge-shuffle','challenge-restart'][i];button(label,id,24+i*(tw+12),tools.y,tw,tools.h);});
 return {items:out,...fitBoard(a,c.rows,c.cols,safe+168,tools.bottom)};
}
export function sunnyChallengeResult(a:SunnyState,c:ChallengeView):SunnyItem[]{
 const {out,box,txt,ico,button}=kit(a),h=505,y=(a.h+a.safe-h)/2;box('paper',67,y,a.w-134,h);ico('flower',a.w/2-30,y+32,60,'#A79961');txt(c.won?'这一桌，收得漂亮！':'换个思路试试',a.w/2,y+140,39,SUNNY.ink,'center',true,true);txt(`第 ${c.level} 盘 · ${c.moves} 步`,a.w/2,y+219,27,SUNNY.soft,'center');button(c.won?'去下一桌':'重新开这一桌',c.won?'challenge-next':'challenge-restart',108,y+295,a.w-216,88,'peach');button('返回花园','challenge-home',108,y+410,a.w-216,59);return out;
}
