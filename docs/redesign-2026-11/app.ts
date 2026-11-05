import {faceArt} from '../../cocos/assets/scripts/view/art';
import {Action, Pos, equal, key, partners, top} from '../../cocos/assets/scripts/core/Rules';
import {DesignSession, MODES, Mode} from './model';

type Screen = 'home' | 'board' | 'map' | 'workshop' | 'album';
const app = document.querySelector<HTMLDivElement>('#app')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const phone = document.querySelector<HTMLDivElement>('#phone')!;
const iconPaths: Record<string,string> = {
  home:'<path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-7h6v7"/>',
  map:'<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2ZM9 3v16M15 6v16"/>',
  flower:'<path d="M12 20v-6m0 4c-7 0-8-4-8-4 5-1 8 4 8 4Zm0-9c-8 2-7-6-3-5-1-6 7-5 6-1 6-2 8 6 3 7 5 5-2 10-5 5-5 5-10-2-5-5Z"/>',
  gear:'<path d="m10 3 4 0 1 3 3 1 3 2-2 4 0 3-3 3-3-1-3 3-3-2 0-3-3-3 2-3 0-3 4-1Z"/><circle cx="12" cy="12" r="3"/>',
  star:'<path d="m12 2 3.2 6.5 7.1 1-5.1 5 1.2 7.1L12 18.3l-6.4 3.3 1.2-7.1-5.1-5 7.1-1Z" fill="currentColor" stroke-width="1"/>',
  play:'<path d="m7 4 13 8-13 8Z" fill="currentColor"/>',
  back:'<path d="m14 5-7 7 7 7"/>',
  next:'<path d="m9 5 7 7-7 7"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  hint:'<path d="M8 16c0-3-3-4-3-7a7 7 0 0 1 14 0c0 3-3 4-3 7M8 17h8M9 20h6M12 2v2"/>',
  undo:'<path d="m8 3-5 5 5 5M4 8h9a7 7 0 0 1 0 14h-2"/>',
  reset:'<path d="M20 7v6h-6M20 12a8 8 0 1 0-2 6"/>',
  workshop:'<path d="m5 4 5 5-3 3-5-5v5l7 6 5-5 5 7 3-3-7-6 5-7-5 1-3 4-4-6Z"/>',
  tiles:'<rect x="3" y="4" width="10" height="15" rx="2"/><path d="m16 5 5 1v15H11v-1M6 8h4M6 12h4"/>',
  ice:'<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 4 4-4M8 20l4-4 4 4M3 11l5-1-1-5M17 19l-1-5 5-1"/>',
  order:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 8h8M8 12h8M8 16h4"/>',
  spark:'<path d="m13 2-8 12h6l-1 8 9-13h-7ZM3 4v3M1 5.5h4"/>',
  check:'<path d="m5 12 5 5L20 6"/>',
  book:'<path d="M12 6C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 2ZM12 6v15"/>',
};
function icon(name: string): string {return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.star}</svg>`;}
function btnIcon(name: string, action: string, label: string): string {return `<button class="icon-btn" data-action="${action}" aria-label="${label}">${icon(name)}</button>`;}
const faces = new Map<string,string>();
function faceImage(face: string): string {
  const bare = face.replace(/[~*]+$/, '');
  if (!faces.has(bare)) {
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 176;
    faceArt(canvas.getContext('2d')!, bare, 8, 9, 124, 154);
    faces.set(bare, canvas.toDataURL());
  }
  return faces.get(bare)!;
}
function faceName(face: string): string {
  const b=face.replace(/[~*]+$/,'');
  if (/^[1-9][psm]$/.test(b)) return '一二三四五六七八九'[Number(b[0])-1]+({p:'筒',s:'条',m:'万'}[b[1]]);
  if (b[0]==='z') return ['东','南','西','北','中','发','白'][Number(b[1])-1];
  return b;
}
function scene(): string {
  return `<div class="scene"><svg viewBox="0 0 390 275" role="img" aria-label="阳光、白色小花与乳白麻将环绕的青绿牌桌">
    <defs>
      <linearGradient id="garden-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b1ceab"/><stop offset=".48" stop-color="#78a48a"/><stop offset="1" stop-color="#3b745a"/></linearGradient>
      <linearGradient id="garden-edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fdfcf0"/><stop offset="1" stop-color="#c2d4b7"/></linearGradient>
      <linearGradient id="pot" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffef5"/><stop offset=".65" stop-color="#e9cbb6"/><stop offset="1" stop-color="#b5917a"/></linearGradient>
      <radialGradient id="sunlight"><stop stop-color="#fffef3"/><stop offset="1" stop-color="#e8f0d6" stop-opacity="0"/></radialGradient>
      <radialGradient id="felt"><stop stop-color="#79a785"/><stop offset="1" stop-color="#46795d"/></radialGradient>
      <g id="daisy"><g fill="#fffef2" stroke="#dce3cb" stroke-width=".6"><ellipse cy="-8" rx="4" ry="7"/><ellipse cy="8" rx="4" ry="7"/><ellipse cx="-8" rx="7" ry="4"/><ellipse cx="8" rx="7" ry="4"/><ellipse transform="rotate(45)" cy="-8" rx="4" ry="7"/><ellipse transform="rotate(45)" cy="8" rx="4" ry="7"/></g><circle r="4.5" fill="#dfb454"/><circle cx="-1" cy="-1" r="2.2" fill="#f5d87e"/></g>
    </defs>
    <ellipse cx="190" cy="110" rx="190" ry="126" fill="url(#sunlight)"/>
    <g fill="#c8ddc1" opacity=".45"><path d="M0 204Q48 137 111 163T257 161T390 181V251H0Z"/><ellipse cx="324" cy="98" rx="59" ry="54"/><ellipse cx="41" cy="101" rx="37" ry="45"/></g>
    <g stroke="#80a082" stroke-width="2" fill="none"><path d="M330 185q-4-73 20-134M344 119q-21-19-25-39M339 137q14-17 30-24"/><path d="M45 165q1-42-22-65"/></g>
    <g fill="#91b596"><path d="M339 95q-31-6-30-28 25 6 30 28M344 77q-10-28 2-45 11 26-2 45M346 85q28-26 39-10-16 15-39 10M336 137q-32-12-29-28 26 9 29 28M338 143q31-29 47-16-17 23-47 16"/></g>
    <g fill="#b0cba5"><path d="M38 128q-32-1-31-25 25 4 31 25M42 136q22-28 36-16-10 20-36 16M28 110q1-31-14-34-7 20 14 34"/></g>
    <g opacity=".75"><use href="#daisy" x="319" y="77" transform="rotate(-12 319 77) scale(1)"/><use href="#daisy" x="28" y="100"/></g>
    <ellipse cx="194" cy="231" rx="155" ry="23" fill="#41705c" opacity=".13"/>
    <path d="M57 176q0-6 11-10l122-38q10-3 20 0l118 39q9 3 9 9v22q0 7-11 11l-119 39q-10 3-20 0L68 209q-11-4-11-11Z" fill="url(#garden-edge)"/>
    <path d="m65 188 133 43 131-43v8l-131 43-133-43Z" fill="#faffed" opacity=".8"/>
    <path d="M57 160q0-6 11-10l122-38q10-3 20 0l118 39q9 3 9 9v18q0 6-11 10l-119 40q-10 3-20 0L68 188q-11-4-11-10Z" fill="url(#garden-rim)"/>
    <path d="m63 160 128-41q9-3 18 0l122 41-126 43q-7 2-13 0Z" fill="#c9dfbd" stroke="#edf4da" stroke-width="2"/>
    <path d="m80 161 113-34q7-2 14 0l107 34-114 37Z" fill="url(#felt)" stroke="#7ca185" stroke-width="2"/>
    <path d="m96 170 104 32 99-33" stroke="#d9e8c8" stroke-width="1.4" fill="none" opacity=".6"/>
    <g stroke="#eff6df" stroke-width="1.5" fill="none" opacity=".7"><path d="m73 163 8 3m231-3-8 3M192 214l7 2 7-2"/></g>
    <g transform="translate(304 185)"><ellipse cy="28" rx="23" ry="7" fill="#3d6953" opacity=".16"/><path d="M-19-1h38l-5 26q-15 9-29 0Z" fill="url(#pot)"/><ellipse cy="-1" rx="19" ry="6" fill="#fffdf0"/><ellipse cy="0" rx="14" ry="3.5" fill="#7f8c62"/><path d="M0 0q-4-26 2-44M-2-12q-14-14-19-13M0-24q13-10 20-10" stroke="#719467" stroke-width="2" fill="none"/><path d="M-3-13q-15-2-14-13 13 2 14 13M0-23q16 2 18-12-14-1-18 12" fill="#8bb181"/><use href="#daisy" x="2" y="-44"/><use href="#daisy" x="-21" y="-28" transform="rotate(-15 -21 -28)"/></g>
    <g transform="translate(75 194) rotate(-18)"><path d="M-24-9q23-8 44 0v24q-23 8-44 0Z" fill="#faeddc" stroke="#dbbbaa"/><path d="M-20 10q20 5 36 0" stroke="#e4cbba" fill="none"/><path d="M-9-6q7 3 8 11M9-6q-7 3-8 11" stroke="#cb9c85" fill="none"/><use href="#daisy" x="0" y="-1" transform="scale(.55)"/></g>
    <g fill="#e8bca0"><ellipse cx="119" cy="63" rx="5" ry="2.5" transform="rotate(-30 119 63)"/><ellipse cx="274" cy="108" rx="4" ry="2.5" transform="rotate(27 274 108)"/></g>
    <g stroke="#d4b879" stroke-width="1.6"><path d="M252 67v10m-5-5h10M139 99v7m-3.5-3.5h7"/></g>
  </svg><div class="hero-hand"><div class="hero-tile"><img src="${faceImage('4s')}" alt="四条"></div><div class="hero-tile"><img src="${faceImage('z6')}" alt="发财"></div><div class="hero-tile"><img src="${faceImage('6s')}" alt="六条"></div></div><div class="scene-tag">${icon('flower')}一桌好心情</div><span class="floating-petal" aria-hidden="true">✧</span></div>`;
}

const STORAGE='mahjong:design-study:v1';
const THEMES=[{id:'jade',name:'雨后薄荷',color:'#42795d'},{id:'blue',name:'月下青瓷',color:'#365e70'},{id:'rose',name:'杏桃夕照',color:'#916b65'}];
let earned: Record<string,number>={};
let theme='jade', reduced=false, sound=true;
try {
  const saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');
  if (saved && typeof saved==='object') {
    if(THEMES.some(t=>t.id===saved.theme)) theme=saved.theme;
    reduced=saved.reduced===true; sound=saved.sound!==false;
    MODES.forEach(m=>{const n=saved.earned?.[m.id];if(Number.isInteger(n)&&n>=1&&n<=3)earned[m.id]=n;});
  }
} catch {}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({theme,reduced,sound,earned}));}catch{}}
function setTheme(){phone.style.setProperty('--table',THEMES.find(t=>t.id===theme)!.color);phone.classList.toggle('reduce-motion',reduced);}
let screen:Screen='home';
let game=new DesignSession();
let toastTimer:ReturnType<typeof setTimeout>;
let audioCtx:AudioContext|undefined;
function plink(){if(!sound)return;try{audioCtx ||= new AudioContext();void audioCtx.resume();const t=audioCtx.currentTime;[660,880].forEach((f,i)=>{const osc=audioCtx!.createOscillator(),g=audioCtx!.createGain();osc.type='sine';osc.frequency.value=f;g.gain.setValueAtTime(.045,t+i*.065);g.gain.exponentialRampToValueAtTime(.001,t+i*.065+.2);osc.connect(g);g.connect(audioCtx!.destination);osc.start(t+i*.065);osc.stop(t+i*.065+.21);});}catch{}}
function toast(s:string){const t=document.querySelector('#toast')!;t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);}
const stars=()=>Object.values(earned).reduce((n,v)=>n+v,0);
function topbar(){return `<div class="topbar"><div class="profile"><div class="avatar">發</div><div><strong>今天也开心</strong><small>给自己一点放松时间</small></div></div><div class="currency" aria-label="${stars()}颗星">${icon('star')}${stars()}</div>${btnIcon('gear','settings','设置')}</div>`;}
function nav(){return `<nav class="bottom-nav" aria-label="游戏导航">${([['home','home','花园'],['map','map','游园'],['workshop','workshop','机关'],['album','book','收藏']] as [Screen,string,string][]).map(([s,i,t])=>`<button data-screen="${s}" class="${screen===s?'active':''}" ${screen===s?'aria-current="page"':''}>${icon(i)}${t}</button>`).join('')}</nav>`;}
const modeIcon=(m:Mode)=>({classic:'tiles',ice:'ice',garden:'flower',orders:'order',energy:'spark'}[m]);
function home(){const m=MODES.find(m=>m.id===game.mode)!;return `${topbar()}<div class="home-title"><div class="eyebrow">阳光正好 · 碰个开心</div><h2>快乐推麻<span>对对消</span></h2><p>推一推，同牌碰头就消</p></div>${scene()}<div class="home-content"><div class="destination"><div class="destination-top"><div><small>晴日花园 / 下一处好风景</small><strong>${m.title}</strong></div><div class="level-stamp"><span>${String(MODES.indexOf(m)+1).padStart(2,'0')}</span></div></div><button class="main-button" data-action="start">${icon('play')}${game.moves&&!game.won&&!game.lost?'继续这一桌':'开桌消一局'}<small>轻松动动脑</small></button></div><div class="home-cards"><button class="home-card" data-screen="workshop">${icon('workshop')}<b>机关工坊</b><small>五种玩法，随心试</small></button><button class="home-card" data-screen="album">${icon('flower')}<b>我的收藏</b><small>换张桌布，换个心情</small></button></div><div class="daily-strip">${icon('check')}不懂麻将，也能玩得开心<b>同牌消除</b></div></div>`;}
function board(){const m=MODES.find(m=>m.id===game.mode)!;
  const target=game.mode==='garden'?`<div class="target">${icon('flower')}<div class="target-text"><small>让花圃全部开花</small><b>${game.blooms.size} / ${game.flowerCells.size} 朵</b></div></div>`:game.mode==='orders'?`<div class="target-text"><small>心愿清单 · 每种一对</small><div style="display:flex;gap:13px">${game.orderFaces.map(f=>`<span class="order-item"><img src="${faceImage(f)}" alt="${faceName(f)}">${Math.min(2,game.collected[f]||0)}/2</span>`).join('')}</div></div>`:`<div class="target">${icon(game.mode==='ice'?'ice':'tiles')}<div class="target-text"><small>${game.mode==='ice'?'破冰后，收走所有牌':'收走这一桌麻将'}</small><b>${game.left} <span style="font-size:10px;font-weight:400">张待收</span></b></div></div>`;
  let hints:Pos[]=[];if(game.hint)hints=game.hint.kind==='match'?[game.hint.a,game.hint.b]:game.runs[game.hint.run].cells;
  const matches=game.selected?partners(game.grid,game.selected):[];
  return `<div class="backbar">${btnIcon('pause','pause','暂停')}<div class="board-heading"><b>${m.title}</b><small>${m.eyebrow}</small></div>${btnIcon('gear','settings','设置')}</div><div class="targets">${target}<div class="moves"><small>剩余步数</small><b>${Math.max(0,game.budget-game.moves)}</b></div></div><div class="energy-bar">${icon('spark')}灵感<div class="energy-dots">${[1,2,3,4].map(n=>`<i class="${game.charge>=n?'lit':''}"></i>`).join('')}</div><button data-action="energy" ${game.charge<4?'disabled':''}>${game.charge>=4?'用慧眼':'消对充能'}</button></div><div class="table-wrap"><div class="table-inner"><div class="board-grid" style="--cols:${game.grid[0].length}" role="group" aria-label="麻将牌桌">${game.grid.map((row,r)=>row.map((cell,c)=>{const f=top(game.grid,{r,c}),k=key({r,c}),floor=game.mode==='garden'&&game.flowerCells.has(k),bloom=game.blooms.has(k);return `<button class="cell ${equal(game.selected,{r,c})?'selected':''} ${matches.some(p=>equal(p,{r,c}))?'partner':''} ${hints.some(p=>equal(p,{r,c}))?'hinted':''} ${floor?'flower-floor':''} ${floor&&bloom?'bloomed':''}" data-cell="${r},${c}" aria-label="第${r+1}行第${c+1}列，${f?faceName(f)+(f.endsWith('~')?'，覆冰':''):'空位'}${floor?'，花圃':''}" ${f?'':'aria-disabled="true"'}>${floor?`<span class="floor-flower" aria-hidden="true">✿</span>`:''}${f?`<span class="tile ${f.endsWith('~')?'iced':''}"><img src="${faceImage(f)}" alt="" draggable="false"></span>`:''}</button>`;}).join('')).join('')}</div></div><div class="tile-count">同牌相邻 · 轻点或推移</div></div><div class="coach"><span class="mini-mascot">發</span><p aria-live="polite">${game.message}</p></div><div class="tools"><button class="tool" data-action="hint">${icon('hint')}看提示<small>只指路，不代玩</small></button><button class="tool" data-action="undo" ${game.history.length?'':'disabled'}>${icon('undo')}退一步<small>换个思路</small></button><button class="tool" data-action="restart">${icon('reset')}重新开桌<small>同一副牌</small></button></div><div class="board-mode-label">${game.streak>1?`连续 ${game.streak} 手有收获 · `:''}<button data-screen="workshop">去试试其他机关</button></div>`;
}
function map(){return `${topbar()}<div class="page-head"><div class="eyebrow">晴日花园</div><h2>下一站，好风景</h2><p>每走过一处小景，就认识一个新机关。</p></div><div class="map-body"><svg class="map-path" viewBox="0 0 330 460" aria-hidden="true"><path d="M63 48C66 96 186 81 180 140S47 164 65 224 184 258 180 317 41 342 66 412" fill="none" stroke="#c1cfaa" stroke-width="27"/><path d="M63 48C66 96 186 81 180 140S47 164 65 224 184 258 180 317 41 342 66 412" fill="none" stroke="#eff2d9" stroke-dasharray="2 8" stroke-width="3" stroke-linecap="round"/></svg>${MODES.map((m,i)=>`<button class="map-stop ${earned[m.id]?'done':''}" data-mode="${m.id}"><div class="stop-medal">${String(i+1).padStart(2,'0')}</div><div><b>${m.title}</b><small>${m.eyebrow}</small><i>${earned[m.id]?'★'.repeat(earned[m.id])+' 已留下一枚花笺':'点这里，去逛逛 →'}</i></div></button>`).join('')}</div><div class="map-foot">本次开放五处小景。<br>钥匙廊桥、转盘花园等新章节见完整改版方案。</div>`;}
function workshop(){return `${topbar()}<div class="page-head"><div class="eyebrow">一点就懂，一试就会</div><h2>机关工坊</h2><p>规则不用背。挑一个小机关，亲手玩明白。</p></div><div class="workshop-list">${MODES.map(m=>`<button class="mechanic" data-mode="${m.id}"><span class="mechanic-art">${m.id==='classic'?`<img src="${faceImage('z6')}" alt="发财">`:icon(modeIcon(m.id))}</span><span class="mechanic-copy"><small>${m.isNew?'新设计':'熟悉的玩法'}</small><h3>${m.title}</h3><p>${({classic:'同牌碰头，就能消除。',ice:'先碎冰，再收牌。',garden:'消一对，花圃开花。',orders:'看着目标，把目标凑齐。',energy:'消牌攒好运，满格领慧眼。'})[m.id]}</p></span>${icon('next')}</button>`).join('')}</div><div class="future-mechanics"><b>下一批机关 · 方案规划中</b><span>钥匙开门</span><span>转盘移位</span><span>锦盒藏珍</span><p>每次只遇见一种新变化，熟悉以后再组合。</p></div>`;}
function album(){return `${topbar()}<div class="page-head"><div class="eyebrow">把好手气，留在小院里</div><h2>我的花园</h2><p>过一处小景，收一枚花笺。</p></div><div class="album-scene">${scene()}</div><div class="album-info"><h3>今天，铺哪张桌布？</h3><p>三款桌布都可以自由试装，下次开桌就能看见。</p><div class="theme-choices">${THEMES.map(t=>`<button class="theme-choice ${theme===t.id?'active':''}" data-theme="${t.id}" aria-pressed="${theme===t.id}"><i style="--sample:${t.color}"></i>${t.name}</button>`).join('')}</div></div><div class="section-line" style="margin:23px 25px 0">游园花笺<small>${Object.keys(earned).length} / 5 枚</small></div><div class="stamp-row">${MODES.map((m,i)=>`<div class="stamp ${earned[m.id]?'earned':''}" title="${m.title}${earned[m.id]?'已获得':'未获得'}">${['风','冰','花','愿','光'][i]}</div>`).join('')}</div><p class="album-caption">花笺只记下已经完成的小景。<br>每次回来，都能看见自己的收获。</p>`;}
const notes:Record<Screen,{title:string;lines:[string,string][]}>={
  home:{title:'像一个放松的小角落',lines:[['有场景，有主角','明亮日光、小花和层叠的真实麻将构成主视觉，轻松又有层次。'],['开局只有一个主入口','暖橘按钮最醒目，游园与收集放在次级入口。'],['牌仍然是麻将','备案名称与麻将身份保持，万、筒、条与字牌清楚可辨。']]},
  board:{title:'每一步都有反馈',lines:[['看上面，知道做什么','目标用图标和数量表达；剩余步数独立成组。'],['看中间，知道怎么推','乳白牌面浮在深色绒面上，选中抬起，能消的同伴发光。'],['看下面，知道怎么救','提示指路、撤销纠错。攒满能量免费获得慧眼，奖励来自消除。']]},
  map:{title:'用风景组织进度',lines:[['章节有记忆点','冰晶花园、花圃初开，每章由一个代表机关带出主题。'],['通关有可见收获','章印记录走过的小景，星级只用于荣誉，不拦下一关。'],['这些是试玩小景','五个独立的机制样例可进入；完整 224 关的迁移计划见文档。']]},
  workshop:{title:'变化来自机关',lines:[['始终相信同牌能消','清单只影响过关目标，不禁止消除其他牌。'],['先给收获，再给压力','花圃、心愿清单、灵感都能看见进度。限时放到独立挑战中。'],['新旧机制明确区分','破冰沿用原规则；花圃、双份目标、灵感是本次的新样例。']]},
  album:{title:'给通关一个去处',lines:[['收集轻一点','无需复杂养成，过关获得花笺，逐步点亮庭院。'],['装饰看得见','桌布直接改变对局的牌桌颜色。此稿提供三款试装。'],['收获留在本机','星数与花笺只在实际获胜时增加，保存在当前设备，无需服务器。']]}
};
function render(){
  setTheme();
  app.innerHTML=`<section class="screen ${screen==='board'?'board-screen':''}" aria-label="${screen}">${({home,board,map,workshop,album})[screen]()}</section>${screen==='board'?'':nav()}`;
  document.querySelector('#reviewNav')!.innerHTML=([['home','花园首页'],['board','对局界面'],['map','游园地图'],['workshop','机关工坊'],['album','我的花园']] as [Screen,string][]).map(([s,t],i)=>`<button data-screen="${s}" class="${s===screen?'active':''}"><span>0${i+1}</span>${t}</button>`).join('');
  const note=notes[screen];document.querySelector('#noteTitle')!.textContent=note.title;document.querySelector('#noteBody')!.innerHTML=note.lines.map(([t,p])=>`<p><b>${t}</b>${p}</p>`).join('');
  bindBoard();
}
function navigate(s:Screen){overlay.innerHTML='';phone.querySelectorAll('.confetti').forEach(p=>p.remove());document.querySelector('#toast')!.classList.remove('show');screen=s;render();if(s==='board'&&(game.won||game.lost))result();}
function startMode(m:Mode){game=new DesignSession(m);navigate('board');}
function modal(body:string){overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="对话框">${btnIcon('close','close','关闭').replace('icon-btn','icon-btn modal-close')}${body}</section>`;overlay.querySelector<HTMLButtonElement>('button')?.focus();}
function pause(){modal(`<div class="eyebrow">休息一下</div><h2>这桌等你回来</h2><p>牌面和目标都在，慢慢想，不着急。</p><div class="modal-list"><button data-action="close">继续这一桌</button><button data-action="restart">重新开桌</button><button data-screen="workshop">去机关工坊</button><button data-screen="home">回到首页</button></div>`);}
function settings(){modal(`<div class="eyebrow">按你的节奏玩</div><h2>游戏设置</h2><div class="settings-row"><div>轻音效<small>消除时的清脆碰牌声</small></div><button class="switch ${sound?'on':''}" data-action="sound" role="switch" aria-checked="${sound}" aria-label="轻音效"></button></div><div class="settings-row"><div>减少动态效果<small>保留高亮，关闭入场与飘落效果</small></div><button class="switch ${reduced?'on':''}" data-action="motion" role="switch" aria-checked="${reduced}" aria-label="减少动态效果"></button></div><p>核心规则只有一句：<br>相邻同牌点掉，或者推到一起自动消。</p><p class="save-note">星级、花笺和偏好保存在当前设备。<br>本阶段不提供跨设备同步。</p><button class="main-button jade" data-action="close">知道啦</button>`);}
function result(){
  if(game.won){earned[game.mode]=Math.max(earned[game.mode]||0,game.stars);save();
    modal(`<div class="eyebrow">今日又添一份好手气</div><div class="win-seal">喜</div><h2>这一桌，收得漂亮！</h2><div class="win-stars">${[1,2,3].map(i=>`<span style="opacity:${i<=game.stars?1:.25}">${icon('star')}</span>`).join('')}</div><p>「${MODES.find(m=>m.id===game.mode)!.title}」花笺已放进小院。</p><div class="win-stats"><span>用了几步<b>${game.moves}</b></span><span>连续收牌<b>${game.bestStreak}</b></span></div><button class="main-button" data-action="next">去下一处小景 ${icon('next')}</button><button class="text-button" data-screen="album">看看我的花笺</button>`);
    if(!reduced)for(let i=0;i<18;i++){const p=document.createElement('i');p.className='confetti';p.style.left=(10+i*5)+'%';p.style.background=['#e7b986','#d27154','#92b59c'][i%3];p.style.animationDelay=i*.035+'s';p.style.setProperty('--drift',((i%5)-2)*25+'px');phone.append(p);setTimeout(()=>p.remove(),3000);}
  }else modal(`<div class="eyebrow">再想一想，就差一点</div><div class="win-seal">歇</div><h2>换个思路试试</h2><p>这桌步数用完了。<br>可以退回一步重新想，也可以免费重开。</p><button class="main-button jade" data-action="undo">退一步，再试试</button><button class="text-button" data-action="restart">重新开桌</button>`);
}
function afterAction(changed:boolean){render();if(changed){plink();if(game.won||game.lost)result();}}
document.addEventListener('click',(e)=>{
  const el=(e.target as Element).closest<HTMLElement>('button,a');if(!el)return;
  if(el.dataset.screen){navigate(el.dataset.screen as Screen);return;}
  if(el.dataset.mode){startMode(el.dataset.mode as Mode);return;}
  if(el.dataset.theme){theme=el.dataset.theme;save();render();toast('桌布铺好了，下次开桌就能看见。');return;}
  if(el.dataset.cell){if(e.detail!==0||suppressClick)return;const [r,c]=el.dataset.cell.split(',').map(Number);afterAction(game.tap({r,c}));return;}
  switch(el.dataset.action){
    case 'start':if(game.won||game.lost)game=new DesignSession(game.mode);navigate('board');break;
    case 'pause':pause();break;
    case 'settings':settings();break;
    case 'close':overlay.innerHTML='';break;
    case 'restart':startMode(game.mode);break;
    case 'hint':game.requestHint();render();break;
    case 'energy':if(game.useEnergy()){render();toast('灵感慧眼已点亮，跟着提示走。');}break;
    case 'undo':overlay.innerHTML='';afterAction(game.undo());break;
    case 'next':startMode(MODES[(MODES.findIndex(m=>m.id===game.mode)+1)%MODES.length].id);break;
    case 'motion':reduced=!reduced;save();setTheme();settings();break;
    case 'sound':sound=!sound;save();settings();if(sound)plink();break;
  }
});
let suppressClick=false;
function bindBoard(){const board=app.querySelector<HTMLElement>('.board-grid');if(!board)return;
  let press:{x:number;y:number;p:Pos;pointer:number}|null=null;
  board.addEventListener('pointerdown',e=>{if(overlay.innerHTML||game.won||game.lost)return;const cell=(e.target as Element).closest<HTMLElement>('[data-cell]');if(!cell)return;const [r,c]=cell.dataset.cell!.split(',').map(Number);press={x:e.clientX,y:e.clientY,p:{r,c},pointer:e.pointerId};board.setPointerCapture(e.pointerId);suppressClick=false;});
  board.addEventListener('pointermove',e=>{if(!press)return;const dx=e.clientX-press.x,dy=e.clientY-press.y;if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;const axis=Math.abs(dx)>Math.abs(dy)?'row':'col';const i=axis==='row'?press.p.r:press.p.c;const cells=board.querySelectorAll<HTMLElement>('[data-cell]');cells.forEach(c=>{const [r,col]=c.dataset.cell!.split(',').map(Number);const tile=c.querySelector<HTMLElement>('.tile');if(tile&&((axis==='row'?r:col)===i))tile.style.transform=`translate${axis==='row'?'X':'Y'}(${Math.max(-35,Math.min(35,axis==='row'?dx:dy))}px)`;});});
  board.addEventListener('pointerup',e=>{if(!press)return;const p=press;press=null;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<12){afterAction(game.tap(p.p));return;}
    suppressClick=true;const axis=Math.abs(dx)>Math.abs(dy)?'row':'col';const index=axis==='row'?p.p.r:p.p.c;const ri=game.runs.findIndex(r=>r.axis===axis&&r.index===index&&r.cells.some(q=>equal(q,p.p)));
    const first=board.querySelector<HTMLElement>('[data-cell]')!.getBoundingClientRect();const gaps=getComputedStyle(board);const step=Math.round((axis==='row'?dx:dy)/((axis==='row'?first.width:first.height)+parseFloat(axis==='row'?gaps.columnGap:gaps.rowGap)));
    if(ri>=0&&step)afterAction(game.apply({kind:'slide',run:ri,step}));else render();
    setTimeout(()=>{suppressClick=false;},0);
  });
  board.addEventListener('pointercancel',()=>{press=null;suppressClick=false;render();});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(overlay.innerHTML)overlay.innerHTML='';else if(screen==='board')pause();} });
// Read-only state and explicit navigation hooks support reproducible design checks.
(window as any).designStudy={get game(){return game;},get screen(){return screen;},get earned(){return {...earned};},startMode,navigate};
const q=new URLSearchParams(location.search);const initialMode=q.get('mode');if(MODES.some(m=>m.id===initialMode))game=new DesignSession(initialMode as Mode);const initialScreen=q.get('screen');if(['home','board','map','workshop','album'].includes(initialScreen||''))screen=initialScreen as Screen;
render();
