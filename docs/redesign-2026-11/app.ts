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
  cup:'<path d="M4 8h13v6a6 6 0 0 1-12 0ZM17 9h2a3 3 0 0 1 0 6h-2M3 21h16M8 2v3M13 2v3"/>',
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
  return `<div class="scene"><svg viewBox="0 0 390 275" role="img" aria-label="灯笼、竹叶环绕的立体玉色麻将桌">
    <defs>
      <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8cb797"/><stop offset=".4" stop-color="#457f64"/><stop offset="1" stop-color="#20533f"/></linearGradient>
      <linearGradient id="wood" x1="0" x2="0" y2="1"><stop stop-color="#d3b77e"/><stop offset="1" stop-color="#a4824e"/></linearGradient>
      <linearGradient id="lantern" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3b187"/><stop offset=".4" stop-color="#d88159"/><stop offset="1" stop-color="#aa503a"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#fffae1"/><stop offset="1" stop-color="#e4eacb" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="200" cy="120" rx="184" ry="120" fill="url(#glow)"/>
    <path d="M0 159Q60 126 108 145T246 153T390 133V250H0Z" fill="#cedabc" opacity=".5"/>
    <path d="M0 201Q62 161 156 192T390 179V245H0Z" fill="#bacbb0" opacity=".45"/>
    <g opacity=".75" fill="#94af80"><path d="M19 189 34 94l4 1-13 96Z"/><path d="M31 124C5 120 7 102 10 96c16 6 22 16 21 28ZM36 108c2-26 18-34 24-35 1 20-8 29-24 35ZM29 144c-25-1-28-19-28-23 20 1 27 13 28 23ZM32 145c12-24 27-23 31-22-5 19-17 23-31 22Z"/></g>
    <g stroke="#70805b" stroke-width="2" fill="none"><path d="M327 186Q332 81 350 31M330 118l-13-28M336 83l25-24"/></g>
    <g fill="#77966c"><path d="M334 95q-34-5-32-28 25 5 32 28M338 74q-17-22-8-40 16 17 8 40M340 78q29-25 42-15-10 20-42 15M332 119q24-27 41-18-8 17-41 18M347 53q2-23 19-31 4 22-19 31"/></g>
    <g transform="translate(70 15) rotate(-9)"><path d="M22-16v24" stroke="#bea372" stroke-width="2"/><ellipse cx="22" cy="36" rx="23" ry="28" fill="url(#lantern)"/><ellipse cx="22" cy="36" rx="13" ry="27" fill="none" stroke="#f0b483" opacity=".75"/><path d="M0 33h44M4 47h35" stroke="#f2b98a" opacity=".55"/><path d="M13 8h18M13 65h18" stroke="#aa7046" stroke-width="5"/><path d="M22 66v18m-4-5v13m4-13v13m4-13v13" stroke="#b9774f" stroke-width="2"/></g>
    <g opacity=".5" stroke="#b5b59a" fill="none"><circle cx="294" cy="50" r="28"/><circle cx="294" cy="50" r="23"/><path d="M264 50h60M294 22v55"/></g>
    <ellipse cx="203" cy="226" rx="153" ry="23" fill="#42694b" opacity=".16"/>
    <path d="m61 180 140-44 132 44v22l-133 45-139-45Z" fill="url(#wood)"/>
    <path d="m65 185 135 44 129-43v8l-129 44-135-44Z" fill="#ead1a1" opacity=".55"/>
    <path d="m60 161 140-46 135 45v25l-135 47-140-46Z" fill="url(#stone)"/>
    <path d="m60 161 140-46 135 45-135 48Z" fill="#95b898" stroke="#d1d4a6" stroke-width="2"/>
    <path d="m77 162 123-38 117 37-117 39Z" fill="#38735b" stroke="#bcba79" stroke-width="2"/>
    <path d="m84 163 116-33 108 32-108 36Z" fill="#417e62"/>
    <path d="m97 172 103 31 98-33" stroke="#cbd3a1" fill="none" opacity=".3"/>
    <g fill="#b7a06d"><path d="m66 166 12 4v11l-12-4ZM322 166l-12 5v10l12-4ZM194 208h12v12h-12Z"/></g>
    <g transform="translate(293 176)"><ellipse cx="0" cy="21" rx="28" ry="9" fill="#1b5544" opacity=".2"/><ellipse cx="0" cy="10" rx="24" ry="8" fill="#afbe9c"/><ellipse cx="0" cy="7" rx="25" ry="8" fill="#f0e5bf"/><path d="M-17-5q0 28 32 2L16-5Z" fill="#e7d6a4"/><ellipse cy="-5" rx="17" ry="6" fill="#fff5d4"/><ellipse cy="-5" rx="12" ry="4" fill="#bba470"/><path d="M16-1q16-3 10 7l-10 3" fill="none" stroke="#dfcb9b" stroke-width="4"/><path d="M-5-19q-6-7 1-12m10 12q8-7 0-14" fill="none" stroke="#fffdf0" stroke-width="3" opacity=".75"/></g>
    <g fill="#f7e1b2" stroke="#cab78b"><ellipse cx="83" cy="204" rx="18" ry="6"/><ellipse cx="91" cy="211" rx="18" ry="6"/><ellipse cx="91" cy="207" rx="18" ry="6"/><ellipse cx="79" cy="199" rx="18" ry="6"/></g>
    <g fill="#e6b095"><ellipse cx="137" cy="66" rx="6" ry="3" transform="rotate(-24 137 66)"/><ellipse cx="276" cy="115" rx="6" ry="3" transform="rotate(37 276 115)"/></g>
    <g stroke="#c5a06a" stroke-width="1.7"><path d="M252 79v10m-5-5h10M131 106v6m-3-3h6"/></g>
  </svg><div class="hero-hand"><div class="hero-tile"><img src="${faceImage('1p')}" alt="一筒"></div><div class="hero-tile"><img src="${faceImage('z6')}" alt="发财"></div><div class="hero-tile"><img src="${faceImage('2s')}" alt="二条"></div></div><div class="scene-tag">${icon('cup')}一桌好心情</div><span class="floating-petal" aria-hidden="true">✧</span></div>`;
}

const STORAGE='mahjong:design-study:v1';
const THEMES=[{id:'jade',name:'雨后青玉',color:'#266b59'},{id:'blue',name:'月下青瓷',color:'#365e70'},{id:'rose',name:'暖木夕照',color:'#825a4e'}];
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
function topbar(){return `<div class="topbar"><div class="profile"><div class="avatar">發</div><div><strong>小小掌柜</strong><small>今日也有好手气</small></div></div><div class="currency" aria-label="${stars()}颗星">${icon('star')}${stars()}</div>${btnIcon('gear','settings','设置')}</div>`;}
function nav(){return `<nav class="bottom-nav" aria-label="游戏导航">${([['home','home','茶庭'],['map','map','游园'],['workshop','workshop','机关'],['album','book','收藏']] as [Screen,string,string][]).map(([s,i,t])=>`<button data-screen="${s}" class="${screen===s?'active':''}" ${screen===s?'aria-current="page"':''}>${icon(i)}${t}</button>`).join('')}</nav>`;}
const modeIcon=(m:Mode)=>({classic:'cup',ice:'ice',garden:'flower',orders:'order',energy:'spark'}[m]);
function home(){const m=MODES.find(m=>m.id===game.mode)!;return `${topbar()}<div class="home-title"><div class="eyebrow">一方小院 · 满桌欢喜</div><h2>快乐推麻<span>对对消</span></h2><p>推一推，同牌碰头就消</p></div>${scene()}<div class="home-content"><div class="destination"><div class="destination-top"><div><small>玉庭游记 / 下一处好风景</small><strong>${m.title}</strong></div><div class="level-stamp"><span>${String(MODES.indexOf(m)+1).padStart(2,'0')}</span></div></div><button class="main-button" data-action="start">${icon('play')}${game.moves&&!game.won&&!game.lost?'继续这一桌':'开桌消一局'}<small>轻松动动脑</small></button></div><div class="home-cards"><button class="home-card" data-screen="workshop">${icon('workshop')}<b>机关工坊</b><small>五种玩法，随心试</small></button><button class="home-card" data-screen="album">${icon('flower')}<b>我的小院</b><small>换张桌布，换个心情</small></button></div><div class="daily-strip">${icon('check')}不懂麻将，也能玩得开心<b>同牌消除</b></div></div>`;}
function board(){const m=MODES.find(m=>m.id===game.mode)!;
  const target=game.mode==='garden'?`<div class="target">${icon('flower')}<div class="target-text"><small>让花圃全部开花</small><b>${game.blooms.size} / ${game.flowerCells.size} 朵</b></div></div>`:game.mode==='orders'?`<div class="target-text"><small>今日茶单 · 每种一对</small><div style="display:flex;gap:13px">${game.orderFaces.map(f=>`<span class="order-item"><img src="${faceImage(f)}" alt="${faceName(f)}">${Math.min(2,game.collected[f]||0)}/2</span>`).join('')}</div></div>`:`<div class="target">${icon(game.mode==='ice'?'ice':'cup')}<div class="target-text"><small>${game.mode==='ice'?'破冰后，收走所有牌':'收走这一桌麻将'}</small><b>${game.left} <span style="font-size:10px;font-weight:400">张待收</span></b></div></div>`;
  let hints:Pos[]=[];if(game.hint)hints=game.hint.kind==='match'?[game.hint.a,game.hint.b]:game.runs[game.hint.run].cells;
  const matches=game.selected?partners(game.grid,game.selected):[];
  return `<div class="backbar">${btnIcon('pause','pause','暂停')}<div class="board-heading"><b>${m.title}</b><small>${m.eyebrow}</small></div>${btnIcon('gear','settings','设置')}</div><div class="targets">${target}<div class="moves"><small>剩余步数</small><b>${Math.max(0,game.budget-game.moves)}</b></div></div><div class="energy-bar">${icon('spark')}开运<div class="energy-dots">${[1,2,3,4].map(n=>`<i class="${game.charge>=n?'lit':''}"></i>`).join('')}</div><button data-action="energy" ${game.charge<4?'disabled':''}>${game.charge>=4?'用慧眼':'消对充能'}</button></div><div class="table-wrap"><div class="table-inner"><div class="board-grid" style="--cols:${game.grid[0].length}" role="group" aria-label="麻将牌桌">${game.grid.map((row,r)=>row.map((cell,c)=>{const f=top(game.grid,{r,c}),k=key({r,c}),floor=game.mode==='garden'&&game.flowerCells.has(k),bloom=game.blooms.has(k);return `<button class="cell ${equal(game.selected,{r,c})?'selected':''} ${matches.some(p=>equal(p,{r,c}))?'partner':''} ${hints.some(p=>equal(p,{r,c}))?'hinted':''} ${floor?'flower-floor':''} ${floor&&bloom?'bloomed':''}" data-cell="${r},${c}" aria-label="第${r+1}行第${c+1}列，${f?faceName(f)+(f.endsWith('~')?'，覆冰':''):'空位'}${floor?'，花圃':''}" ${f?'':'aria-disabled="true"'}>${floor?`<span class="floor-flower" aria-hidden="true">✿</span>`:''}${f?`<span class="tile ${f.endsWith('~')?'iced':''}"><img src="${faceImage(f)}" alt="" draggable="false"></span>`:''}</button>`;}).join('')).join('')}</div></div><div class="tile-count">同牌相邻 · 轻点或推移</div></div><div class="coach"><span class="mini-mascot">發</span><p aria-live="polite">${game.message}</p></div><div class="tools"><button class="tool" data-action="hint">${icon('hint')}看提示<small>只指路，不代玩</small></button><button class="tool" data-action="undo" ${game.history.length?'':'disabled'}>${icon('undo')}退一步<small>换个思路</small></button><button class="tool" data-action="restart">${icon('reset')}重新开桌<small>同一副牌</small></button></div><div class="board-mode-label">${game.streak>1?`连续 ${game.streak} 手有收获 · `:''}<button data-screen="workshop">去试试其他机关</button></div>`;
}
function map(){return `${topbar()}<div class="page-head"><div class="eyebrow">玉庭游记</div><h2>下一站，好风景</h2><p>每走过一处小景，就认识一个新机关。</p></div><div class="map-body"><svg class="map-path" viewBox="0 0 330 460" aria-hidden="true"><path d="M63 48C66 96 186 81 180 140S47 164 65 224 184 258 180 317 41 342 66 412" fill="none" stroke="#c1cfaa" stroke-width="27"/><path d="M63 48C66 96 186 81 180 140S47 164 65 224 184 258 180 317 41 342 66 412" fill="none" stroke="#eff2d9" stroke-dasharray="2 8" stroke-width="3" stroke-linecap="round"/></svg>${MODES.map((m,i)=>`<button class="map-stop ${earned[m.id]?'done':''}" data-mode="${m.id}"><div class="stop-medal">${String(i+1).padStart(2,'0')}</div><div><b>${m.title}</b><small>${m.eyebrow}</small><i>${earned[m.id]?'★'.repeat(earned[m.id])+' 已留下一枚花笺':'点这里，去逛逛 →'}</i></div></button>`).join('')}</div><div class="map-foot">本次开放五处小景。<br>钥匙廊桥、转盘花园等新章节见完整改版方案。</div>`;}
function workshop(){return `${topbar()}<div class="page-head"><div class="eyebrow">一点就懂，一试就会</div><h2>机关工坊</h2><p>规则不用背。挑一个小机关，亲手玩明白。</p></div><div class="workshop-list">${MODES.map(m=>`<button class="mechanic" data-mode="${m.id}"><span class="mechanic-art">${m.id==='classic'?`<img src="${faceImage('z6')}" alt="发财">`:icon(modeIcon(m.id))}</span><span class="mechanic-copy"><small>${m.isNew?'新设计':'熟悉的玩法'}</small><h3>${m.title}</h3><p>${({classic:'同牌碰头，就能消除。',ice:'先碎冰，再收牌。',garden:'消一对，花圃开花。',orders:'看着茶单，把目标凑齐。',energy:'消牌攒好运，满格领慧眼。'})[m.id]}</p></span>${icon('next')}</button>`).join('')}</div><div class="future-mechanics"><b>下一批机关 · 方案规划中</b><span>钥匙开门</span><span>转盘移位</span><span>锦盒藏珍</span><p>每次只遇见一种新变化，熟悉以后再组合。</p></div>`;}
function album(){return `${topbar()}<div class="page-head"><div class="eyebrow">把好手气，留在小院里</div><h2>我的玉庭</h2><p>过一处小景，收一枚花笺。</p></div><div class="album-scene">${scene()}</div><div class="album-info"><h3>今天，铺哪张桌布？</h3><p>三款桌布都可以自由试装，下次开桌就能看见。</p><div class="theme-choices">${THEMES.map(t=>`<button class="theme-choice ${theme===t.id?'active':''}" data-theme="${t.id}" aria-pressed="${theme===t.id}"><i style="--sample:${t.color}"></i>${t.name}</button>`).join('')}</div></div><div class="section-line" style="margin:23px 25px 0">游园花笺<small>${Object.keys(earned).length} / 5 枚</small></div><div class="stamp-row">${MODES.map((m,i)=>`<div class="stamp ${earned[m.id]?'earned':''}" title="${m.title}${earned[m.id]?'已获得':'未获得'}">${['风','冰','花','茶','灯'][i]}</div>`).join('')}</div><p class="album-caption">花笺只记下已经完成的小景。<br>每次回来，都能看见自己的收获。</p>`;}
const notes:Record<Screen,{title:string;lines:[string,string][]}>={
  home:{title:'让首页像一间小院',lines:[['有场景，有主角','灯笼、竹叶、茶盏与斜放的厚麻将构成主视觉，告别大片空底。'],['开局只有一个主入口','暖橘按钮最醒目，游园与收集放在次级入口。'],['牌仍然是麻将','保留万、筒、条与字牌，只取消清一色等配对限制。']]},
  board:{title:'每一步都有反馈',lines:[['看上面，知道做什么','目标用图标和数量表达；剩余步数独立成组。'],['看中间，知道怎么推','暖瓷牌面浮在深色绒面上，选中抬起，能消的同伴发光。'],['看下面，知道怎么救','提示指路、撤销纠错。攒满能量免费获得慧眼，奖励来自消除。']]},
  map:{title:'用风景组织进度',lines:[['章节有记忆点','冰糖茶庭、花圃初开，每章由一个代表机关带出主题。'],['通关有可见收获','章印记录走过的小景，星级只用于荣誉，不拦下一关。'],['这些是试玩小景','五个独立的机制样例可进入；完整 224 关的迁移计划见文档。']]},
  workshop:{title:'变化来自机关',lines:[['始终相信同牌能消','订单只影响过关目标，不禁止消除其他牌。'],['先给收获，再给压力','花圃、茶单、开运都能看见进度。限时放到独立挑战中。'],['新旧机制明确区分','破冰沿用原规则；花圃、双份订单、开运是本次的新样例。']]},
  album:{title:'给通关一个去处',lines:[['收集轻一点','无需复杂养成，过关获得花笺，逐步点亮庭院。'],['装饰看得见','桌布直接改变对局的牌桌颜色。此稿提供三款试装。'],['记录真实试玩结果','星数与花笺只在实际获胜时增加，保存在独立设计稿存档中。']]}
};
function render(){
  setTheme();
  app.innerHTML=`<section class="screen ${screen==='board'?'board-screen':''}" aria-label="${screen}">${({home,board,map,workshop,album})[screen]()}</section>${screen==='board'?'':nav()}`;
  document.querySelector('#reviewNav')!.innerHTML=([['home','茶庭首页'],['board','对局界面'],['map','游园地图'],['workshop','机关工坊'],['album','我的茶庭']] as [Screen,string][]).map(([s,t],i)=>`<button data-screen="${s}" class="${s===screen?'active':''}"><span>0${i+1}</span>${t}</button>`).join('');
  const note=notes[screen];document.querySelector('#noteTitle')!.textContent=note.title;document.querySelector('#noteBody')!.innerHTML=note.lines.map(([t,p])=>`<p><b>${t}</b>${p}</p>`).join('');
  bindBoard();
}
function navigate(s:Screen){overlay.innerHTML='';phone.querySelectorAll('.confetti').forEach(p=>p.remove());document.querySelector('#toast')!.classList.remove('show');screen=s;render();if(s==='board'&&(game.won||game.lost))result();}
function startMode(m:Mode){game=new DesignSession(m);navigate('board');}
function modal(body:string){overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="对话框">${btnIcon('close','close','关闭').replace('icon-btn','icon-btn modal-close')}${body}</section>`;overlay.querySelector<HTMLButtonElement>('button')?.focus();}
function pause(){modal(`<div class="eyebrow">茶歇一下</div><h2>这桌等你回来</h2><p>牌面和目标都在，慢慢想，不着急。</p><div class="modal-list"><button data-action="close">继续这一桌</button><button data-action="restart">重新开桌</button><button data-screen="workshop">去机关工坊</button><button data-screen="home">回到小院</button></div>`);}
function settings(){modal(`<div class="eyebrow">按你的节奏玩</div><h2>小院设置</h2><div class="settings-row"><div>轻音效<small>消除时的清脆碰牌声</small></div><button class="switch ${sound?'on':''}" data-action="sound" role="switch" aria-checked="${sound}" aria-label="轻音效"></button></div><div class="settings-row"><div>减少动态效果<small>保留高亮，关闭入场与飘落效果</small></div><button class="switch ${reduced?'on':''}" data-action="motion" role="switch" aria-checked="${reduced}" aria-label="减少动态效果"></button></div><p>核心规则只有一句：<br>相邻同牌点掉，或者推到一起自动消。</p><button class="main-button jade" data-action="close">知道啦</button>`);}
function result(){
  if(game.won){earned[game.mode]=Math.max(earned[game.mode]||0,game.stars);save();
    modal(`<div class="eyebrow">今日又添一份好手气</div><div class="win-seal">喜</div><h2>这一桌，收得漂亮！</h2><div class="win-stars">${[1,2,3].map(i=>`<span style="opacity:${i<=game.stars?1:.25}">${icon('star')}</span>`).join('')}</div><p>「${MODES.find(m=>m.id===game.mode)!.title}」花笺已放进小院。</p><div class="win-stats"><span>用了几步<b>${game.moves}</b></span><span>连续收牌<b>${game.bestStreak}</b></span></div><button class="main-button" data-action="next">去下一处小景 ${icon('next')}</button><button class="text-button" data-screen="album">看看我的花笺</button>`);
    if(!reduced)for(let i=0;i<18;i++){const p=document.createElement('i');p.className='confetti';p.style.left=(10+i*5)+'%';p.style.background=['#e7b986','#d27154','#92b59c'][i%3];p.style.animationDelay=i*.035+'s';p.style.setProperty('--drift',((i%5)-2)*25+'px');phone.append(p);setTimeout(()=>p.remove(),3000);}
  }else modal(`<div class="eyebrow">再想一想，就差一点</div><div class="win-seal">茶</div><h2>先喝口茶吧</h2><p>这桌步数用完了。<br>可以退回一步重新想，也可以免费重开。</p><button class="main-button jade" data-action="undo">退一步，再试试</button><button class="text-button" data-action="restart">重新开桌</button>`);
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
    case 'energy':if(game.useEnergy()){render();toast('开运慧眼已点亮，跟着提示走。');}break;
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
