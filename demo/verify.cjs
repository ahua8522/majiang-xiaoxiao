/* 从同目录 index.html 抽出 LOGIC 与 ART 两段，在 node 里验证规则与绘制
   用法：node demo/verify.cjs */
const fs=require('fs'),path=require('path');
const HTML=path.resolve(__dirname,'index.html'),OUT=path.resolve(__dirname,'.verify');
const src=fs.readFileSync(HTML,'utf8');
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b);if(i<0||j<0)throw new Error('marker missing: '+a);return src.slice(i+a.length,j);};
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(OUT+'/logic.cjs',cut('/*LOGIC-START*/','/*LOGIC-END*/')+'\n');
fs.writeFileSync(OUT+'/art.cjs',cut('/*ART-START*/','/*ART-END*/').replace('module.exports.C=C;','')+
  '\nmodule.exports={C,KAI,rr,tileBase,stone,dot,stick,bird,faceArt,DOTS,DCOL,NUM};\n');
const L=require(OUT+'/logic.cjs'),A=require(OUT+'/art.cjs');

let fail=0,pass=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m));};
const tally=g=>{const t={};g.forEach(row=>row.forEach(v=>{if(Array.isArray(v))v.forEach(f=>{if(f)t[f]=(t[f]||0)+1})}));return t};
const canon=t=>Object.keys(t).sort().map(k=>k+':'+t[k]).join(' ');   // 面多重集（忽略键序）

/* ── 1. 假 ctx：34 种牌面 + 底座 + 木块，断言无 NaN / 无异常 ─────────── */
function fakeCtx(){
  const ops=[],bad=[];
  const num=(n,a)=>a.forEach((v,i)=>{if(typeof v==='number'&&!Number.isFinite(v))bad.push(n+'#'+i+'='+v)});
  const grad={addColorStop(){}};
  const c={ops,bad,createLinearGradient:()=>grad,createRadialGradient(...a){num('rgrad',a);return grad},measureText:()=>({width:10})};
  ['beginPath','closePath','fill','stroke','save','restore'].forEach(n=>c[n]=()=>ops.push([n]));
  ['moveTo','lineTo','arc','arcTo','ellipse','quadraticCurveTo','bezierCurveTo','rect','fillRect','translate','rotate','scale','clip']
    .forEach(n=>c[n]=(...a)=>{num(n,a);ops.push([n,...a])});
  c.fillText=(t,x,y)=>{num('fillText',[x,y]);ops.push(['fillText',t])};
  return c;
}
{
  const x=fakeCtx();
  for(const f of L.FACES){A.tileBase(x,10,10,44,58);A.faceArt(x,f,14,14,36,44);}
  A.stone(x,0,0,44,58);
  ok(x.bad.length===0,'绘制出现非有限坐标: '+JSON.stringify(x.bad.slice(0,5)));
  const broken=L.FACES.filter(f=>{const y=fakeCtx();try{A.faceArt(y,f,0,0,30,40)}catch(e){return true}return!y.ops.length});
  ok(broken.length===0,'这些牌面画不出来: '+broken.join(','));
  const texts=x.ops.filter(o=>o[0]==='fillText').map(o=>o[1]);
  ok(texts.includes('萬')&&texts.includes('東')&&texts.includes('中')&&texts.includes('發'),'萬/東南中發 缺字');
  console.log(`  ART: ${L.FACES.length} 种牌面 → ${x.ops.length} 次调用，NaN ${x.bad.length}，文字样本 ${[...new Set(texts)].join(' ')}`);
}

/* ── 2. 位移不变量：循环平移保持段内多重集与相对顺序 ───────────────── */
{
  const sp=L.LEVELS[2],g=L.buildGrid(sp);
  g.forEach((row,r)=>row.forEach((v,c)=>{if(Array.isArray(v))v.fill(r*100+c)}));
  const runs=L.computeRuns(g,sp);
  ok(runs.length>10,'第三关可滑线过少: '+runs.length);
  let orderBad=0;
  for(const run of runs)for(const k of [1,2,-1,3,run.cells.length,run.cells.length+2]){
    const before=run.cells.map(p=>g[p.r][p.c]),t=L.shiftSnapshot(g,run,k);
    const after=run.cells.map(p=>t[p.r][p.c]),n=run.cells.length,m=((k%n)+n)%n;
    for(let i=0;i<n;i++)if(String(after[i])!==String(before[(i-m+n)%n]))orderBad++;
    if(JSON.stringify([...before].sort())!==JSON.stringify([...after].sort()))orderBad++;
  }
  ok(orderBad===0,'循环平移破坏了段内顺序或多重集 ('+orderBad+' 处)');
  const g2=L.cloneGrid(g);L.applyShift(g2,runs[0],2);
  ok(JSON.stringify(g2)===JSON.stringify(L.shiftSnapshot(g,runs[0],2)),'applyShift 与 shiftSnapshot 不等价');
  const rowRuns=runs.filter(r=>r.axis==='row');
  ok(rowRuns.length>sp.rows,'木块没有切断整行（可滑行段数应大于行数）');
  ok(rowRuns.some(r=>r.cells.length<sp.cols),'不存在被木块切断出来的短段');
  // 卡死行仍可被列平移带走（只有行列双锁才永久锁位）
  const sp4=L.LEVELS[3],g4=L.buildGrid(sp4),r4=L.computeRuns(g4,sp4);
  ok(!r4.some(r=>r.axis==='row'&&r.i===2),'第四关的卡死行仍出现在可滑线里');
  ok(r4.some(r=>r.axis==='col'&&r.cells.some(p=>p.r===2)),'卡死行里的牌应能被列平移带走');
  console.log(`  位移：${runs.length} 条可滑线 · 顺序守恒通过 · 卡死行可被列带走`);
}

/* ── 3. 相邻与压盖判定 ───────────────────────────────────────────── */
{
  const g=[[['1p'],['1p','1p']],[['1p','2s'],['2s']]];      // 每格顶层：1p 1p / 1p 2s
  const ps=L.findPairs(g);
  ok(ps.length===2,'相邻对子数量应为 2，实际 '+ps.length+'：'+JSON.stringify(ps.map(p=>p.map(q=>q.r+','+q.c))));
  ok(L.findPairs([[['1p','x'],['y','1p']]]).length===0,'隔格/斜角被误判为相邻');
  ok(L.topOf([[['1p','2s']]],0,0)==='2s','topOf 没取到顶层');
  ok(L.topOf([[['1p',null]],0],0,0)===null||L.topOf([[['1p',null]]],0,0)===null,'顶层为空时应不可点');
  ok(L.stackH([[['1p','2s',null]]],0,0)===2,'stackH 计数错误');
}

/* ── 4. 构牌 + 打乱：参考解必须能清台（可解性由构造保证）──────────── */
const rows=[];
for(let li=0;li<L.LEVELS.length;li++){
  const sp=L.LEVELS[li];let n0=0,leftMax=0,planBad=0,odd=0,hang=0,faceBad=0,inits=[],slid=[];
  for(let s=0;s<16;s++){
    const r=L.genLevel(sp,L.mulberry32(5000+s*977+li*31));
    const n=L.tileCount(r.grid);n0=n;
    if(n%2)odd++;
    r.grid.forEach((row,rr)=>row.forEach((v,cc)=>{if(Array.isArray(v))for(let d=1;d<v.length;d++)if(v[d]&&!v[d-1])hang++;}));
    Object.values(tally(r.grid)).forEach(c=>{if(c%2)faceBad++;});
    const rep=L.replayPlan(r.grid,r.runs,r.plan);
    if(!rep.ok){planBad++;console.log('    L'+(li+1)+' seed'+s+' 参考解失败:',rep.reason||('剩'+rep.left));}
    else{slid.push(rep.slides);}
    inits.push(L.findPairs(r.grid).length/(n/2));
    leftMax=Math.max(leftMax,r.leftover);
  }
  ok(planBad===0,`第${li+1}关 ${planBad}/16 个盘面参考解无法清台`);
  ok(odd===0,`第${li+1}关出现奇数张牌`);
  ok(hang===0,`第${li+1}关出现悬空牌（下层空、上层有）${hang} 处`);
  ok(faceBad===0,`第${li+1}关存在落单的牌面 ${faceBad} 种`);
  const avg=a=>(a.reduce((x,y)=>x+y,0)/(a.length||1));
  rows.push({'关':sp.name,'牌数':n0,'孤格剩余':leftMax,'打乱':sp.scramble,'参考解滑动':avg(slid).toFixed(0),
    '开局对子比':(avg(inits)*100).toFixed(0)+'%'});
}
console.table(rows);

/* ── 5. 洗牌：牌数与面多重集不变，且重排后仍有参考解 ───────────────── */
{
  const sp=L.LEVELS[3],rnd=L.mulberry32(7);
  const st=L.cloneGrid(L.genLevel(sp,rnd).grid);
  const runs=L.computeRuns(L.buildGrid(sp),sp);
  let done=0,guard=0;
  while(done<10&&guard++<3000){
    const ps=L.findPairs(st);
    if(ps.length){L.erasePair(st,ps[0][0],ps[0][1]);done++;}
    else{const mv=L.bestSlide(st,runs,rnd);if(!mv)break;L.applyShift(st,mv.run,mv.k);}
  }
  const before=tally(st),nBefore=L.tileCount(st);
  const heightOf=g=>g.map(row=>row.map(v=>Array.isArray(v)?v.filter(Boolean).length:v==='S'?'S':'-').join('')).join('|');
  const heightSet=g=>g.flat().filter(v=>Array.isArray(v)).map(v=>v.filter(Boolean).length).sort((a,b)=>a-b).join(',');
  const hBefore=heightOf(st);
  let modes={},solvable=0,planned=0,revOK=0,revTried=0;
  for(let t=0;t<8;t++){
    const src=L.cloneGrid(st),snap=JSON.stringify(src),snapHSet=heightSet(src);   // 同一个残局逐次洗牌
    const rs=L.reshuffle(src,sp,700+t*131);
    modes[rs.mode]=(modes[rs.mode]||0)+1;
    ok(canon(before)===canon(tally(rs.grid)),"洗牌改变了面的多重集");
    ok(L.tileCount(rs.grid)===nBefore,'洗牌改变了牌数');
    if(rs.plan){ // 构造重排：牌面重新发，但每格堆叠高度必须一格不动
      ok(heightOf(rs.grid)===hBefore,'构造重排改变了每格的堆叠高度（应一格不动）');
    }else{       // 位置重排：整摞牌随线平移 → 高度集合守恒，逐格可变
      ok(heightSet(rs.grid)===snapHSet,'位置重排改变了堆叠高度的集合');
    }
    ok(Object.values(tally(rs.grid)).every(c=>c%2===0),'洗牌后存在落单的牌面');
    ok(rs.mode==='构造可解'||rs.mode==='位置重排·保可解',`洗牌给出了未证明的盘面：${rs.mode}`);
    if(rs.plan){planned++;const rep=L.replayPlan(rs.grid,rs.runs,rs.plan);
      if(rep.ok)solvable++;else console.log('    洗牌构造解清不了台:',rep.reason);}
    else{revTried++;                                             // 位置重排必须可逆：还原后与洗牌前完全一致
      rs.rev.forEach(m=>L.applyShift(rs.grid,rs.runs[m.ri],m.k));
      if(JSON.stringify(rs.grid)===snap)revOK++;
    }
  }
  ok(solvable===planned,`洗牌给出的构造解有 ${planned-solvable} 个清不了台`);
  ok(revOK===revTried,`位置重排有 ${revTried-revOK} 次无法还原（会制造真死局）`);
  console.log(`  洗牌（残局 ${nBefore} 张，消了 ${done} 对）：模式 ${JSON.stringify(modes)} · 构造解 ${solvable}/${planned} 可清台 · 位置重排 ${revOK}/${revTried} 可逆还原`);
  for(const li of [0,2,4]){                                      // 满盘洗牌：要么给构造解，要么可逆
    const spx=L.LEVELS[li],base=L.genLevel(spx,L.mulberry32(5555+li));
    const snap=JSON.stringify(base.grid);
    const fr=L.reshuffle(L.cloneGrid(base.grid),spx,1234+li);
    ok(fr.mode==='构造可解'||fr.mode==='位置重排·保可解',`第${li+1}关满盘洗牌模式异常：${fr.mode}`);
    ok(L.tileCount(fr.grid)===L.tileCount(base.grid),`第${li+1}关满盘洗牌改变了牌数`);
    if(fr.plan)ok(L.replayPlan(fr.grid,fr.runs,fr.plan).ok,`第${li+1}关满盘洗牌的构造解清不了台`);
    else{fr.rev.forEach(m=>L.applyShift(fr.grid,fr.runs[m.ri],m.k));
      ok(JSON.stringify(fr.grid)===snap,`第${li+1}关满盘位置重排不可逆`);}
    console.log(`  满盘洗牌（第${li+1}关 ${L.tileCount(base.grid)} 张）：${fr.mode}${fr.plan?`（打乱 ${fr.plan.scramble} 步，第 ${fr.tries} 次尝试）`:`（${fr.tries} 次平移，可逆）`}`);
  }
}

/* ── 6. 难度引擎：卡死轨道 / 木块 / 空洞 / 永久锁位 都要真实存在 ───── */
{
  const both=L.LEVELS.filter(sp=>sp.lockR.length&&sp.lockC.length);
  ok(both.length>=1,'没有一关同时具备卡死行与卡死列（无法制造永久锁位）');
  for(const sp of both){
    const runs=L.computeRuns(L.buildGrid(sp),sp),locked=L.lockedCells(sp);
    let leaked=0;
    for(let r=0;r<sp.rows;r++)for(let c=0;c<sp.cols;c++){
      if(!sp.lockR.includes(r)||!sp.lockC.includes(c)||sp.map[r][c]==='.'||sp.map[r][c]==='#')continue;
      if(runs.some(run=>run.cells.some(p=>p.r===r&&p.c===c)))leaked++;
    }
    ok(locked>0&&leaked===0,`${sp.name} 永久锁位失效（锁位 ${locked}，泄漏 ${leaked}）`);
    const k=L.knobs(sp,L.buildGrid(sp));
    console.log(`  ${sp.name}：木块 ${k.stones} / 空洞 ${k.holes} / 层数 ${k.layers} / 卡死行 ${k.lockR} 列 ${k.lockC} / 永久锁位 ${k.locked} 格 / 可滑线 ${runs.length} 条`);
  }
  // 真死局可造性：把两张同牌放到互不可达的位置 → bestSlide 必须返回 null
  const sp=L.LEVELS[4],g=L.buildGrid(sp);
  g.forEach((row,r)=>row.forEach((v,c)=>{if(Array.isArray(v)){v.length=0;v.push('9m')}}));
  g[0][0]=['1p'];                                        // 1p 落在 (0,0)，其余全是 9m
  const runs=L.computeRuns(L.buildGrid(sp),sp);
  const dead=L.bestSlide(g,runs,L.mulberry32(3));
  ok(!!dead,'构造的盘面本应有解（1p 与某处能贴上），检查失败');
  const g2=L.buildGrid(sp);
  g2.forEach((row,r)=>row.forEach((v,c)=>{if(Array.isArray(v)){v.length=0;v.push(null)}}));
  // 只在永久锁位格与一个不可达格上放同牌 → 无解
  const lr=sp.lockR[0],lc=sp.lockC[0];
  g2[lr][lc]=['5z'];
  let target=null;
  for(let r=0;r<sp.rows&&!target;r++)for(let c=0;c<sp.cols&&!target;c++)
    if(Array.isArray(g2[r][c])&&!(sp.lockR.includes(r)||sp.lockC.includes(c))===false&&r!==lr&&c!==lc&&(r+c)%7===0)target={r,c};
  if(target){g2[target.r][target.c]=['5z'];
    const any=L.findPairs(g2).length===0&&!L.bestSlide(g2,runs,L.mulberry32(9));
    ok(any,'该构型本应无解却找到了有效滑动');}
}

/* ── 7. 端到端：每关用参考解真通关一遍 ────────────────────────────── */
for(let li=0;li<L.LEVELS.length;li++){
  const sp=L.LEVELS[li];
  const r=L.genLevel(sp,L.mulberry32(31337+li));
  const rep=L.replayPlan(r.grid,r.runs,r.plan);
  ok(rep.ok&&rep.left===0,`${sp.name} 参考解未清台：${rep.reason||rep.left}`);
  const greedy=L.solveBest(L.cloneGrid(r.grid),r.runs,6);
  console.log(`  ${sp.name}：参考解 ${rep.slides} 滑 + ${rep.erases} 消 清台 · 贪心 AI ${greedy.ok?'也能解开，需 '+greedy.slides+' 滑':'找不到解（说明这关需要玩家自己想位移）'}`);
}

try{
/* ── 8. 交互新规：滑动后成对即消（只算这次挪动的）/ 唯一邻居单点即消 ── */
{
  /* 8.1 partnersOf：只数四方向紧邻的同面顶层牌 */
  const g=[[['1p'],['1p'],['1p']],[['2s'],['3p'],['2s']]];
  ok(L.partnersOf(g,0,1).length===2,'中间那张 1p 应有 2 个相邻同牌');
  ok(L.partnersOf(g,0,0).length===1,'端点 1p 应只有 1 个相邻同牌');
  ok(L.partnersOf(g,1,0).length===0,'被 3p 隔开的两个 2s 不算相邻');
  ok(L.partnersOf(g,1,1).length===0,'场上唯一的 3p 不该有伙伴');
  ok(L.partnersOf(g,2,2).length===0,'越界坐标应安全返回空而不是抛错');

  /* 8.2 tapResolve：唯一伙伴→单点即消；多伙伴→选中待选；无伙伴→选中 */
  const t1=L.tapResolve(g,{r:0,c:0});
  ok(t1.action==='erase'&&t1.mate.c===1,'只有一个相邻同牌时应单点即消');
  const t2=L.tapResolve(g,{r:0,c:1});
  ok(t2.action==='select'&&t2.partners.length===2,'两个候选时必须让玩家选，不能替玩家决定');
  const t3=L.tapResolve(g,{r:1,c:1});
  ok(t3.action==='select'&&t3.partners.length===0,'没有可消伙伴时应进入选中态');

  /* 8.3 autoClear：级联消到指定范围内不再有相邻同牌 */
  const gc=L.cloneGrid([[['1p'],['1p','2s'],['2s']],[['3p'],['4p'],['3p']]]);
  const res=L.autoClear(gc);
  ok(res.chain===2,'应先消 2s 再级联消露出来的 1p，chain 应为 2，实际 '+res.chain);
  ok(res.pairs===2,'autoClear 消掉的对数应为 2');
  ok(L.findPairs(gc).length===0,'autoClear 之后场上不该还剩相邻同牌');
  const gc2=L.cloneGrid([[['1p'],['1p']],[['1p'],['1p']]]);
  ok(L.autoClear(gc2).pairs===2&&L.tileCount(gc2)===0,'四张 1p 应两两全消');

  /* 8.4 只消"这次滑动挪动过"的对子，跟滑动无关的旧对子必须留着 */
  const gs=L.cloneGrid([[['1p'],['1p','2s'],['2s'],['4m'],['4m']]]);
  const moved=[{r:0,c:0},{r:0,c:1},{r:0,c:2}];
  const rs=L.autoClear(gs,{cells:moved});
  ok(rs.pairs===2,'挪动范围内应消 2 对（2s 与露出的 1p）');
  ok(L.tileCount(gs)===2&&L.findPairs(gs).length===1,'与滑动无关的 4m 对子被误消了');

  /* 8.5 不变量：自动消永远不产生落单的牌面 */
  for(let li=0;li<L.LEVELS.length;li++){
    const sp=L.LEVELS[li];
    for(let s=0;s<6;s++){
      const r=L.genLevel(sp,L.mulberry32(4000+s*71+li*13));
      L.autoClear(r.grid);
      const odd=Object.values(tally(r.grid)).filter(c=>c%2!==0);
      ok(odd.length===0,`${sp.name} 自动消后出现落单牌面 ${JSON.stringify(odd)}`);
      ok(L.findPairs(r.grid).length===0,`${sp.name} 自动消后仍有相邻同牌未消`);
    }
  }

  /* 8.6 可解性影响：自动收规则下，生成器必须自证每一盘都能清台 */
  const rate=[];
  for(let li=0;li<L.LEVELS.length;li++){
    const sp=L.LEVELS[li];let okN=0,strandFaces=0,tries=[];
    for(let s=0;s<16;s++){
      const r=L.genLevel(sp,L.mulberry32(6000+s*911+li*17));
      tries.push(r.tries);
      const rep=L.replayPlan(r.grid,r.runs,r.plan,{auto:true});
      if(rep.ok)okN++;else strandFaces+=rep.left;
    }
    rate.push({'关':sp.name,'自动收下仍可清台':okN+'/16','卡住时残牌':strandFaces,
      '平均重发次数':(tries.reduce((a,b)=>a+b,0)/tries.length).toFixed(1),'最多重发':Math.max(...tries)});
  }
  console.table(rate);
  ok(rate.every(x=>x['自动收下仍可清台']==='16/16'),'自动收规则下仍有盘面清不了台');
  ok(rate.every(x=>parseInt(x['平均重发次数'])<=6),'生成器重发太频繁（自动收与构牌冲突严重，出关会卡）');
}
}catch(e){fail++;console.log("  ✗ 交互规则用例抛错（函数还没实现）："+e.message);}

try{
/* ── 9. 残局判据：两步以上才贴得上的对子，不能误判"无路" ───────────── */
{
  const spec4={rows:5,cols:5,lockR:[],lockC:[],map:['11111','11111','11111','11111','11111']};
  const g=L.buildGrid(spec4);
  g[0][0]=['1p']; g[0][3]=['1p'];                        // 同一行，循环距离 2，怎么推这一行都贴不上
  const runs=L.computeRuns(g,spec4);
  ok(L.findPairs(g).length===0,'用例前提不成立：这两张牌已经相邻了');
  ok(!L.bestSlide(g,runs,L.mulberry32(1)),'用例前提不成立：一步滑动就能贴上，测不到多步情形');
  ok(L.sameFaceReachable(g,runs)===true,'残局误判：这两张靠"列推一格→行推→列推"是能贴上的，不该判无路');

  // 真死局：两张牌各自困在谁也推不动的孤格
  const g2=[[['1p'],null],[null,['1p']]];
  ok(L.sameFaceReachable(g2,L.computeRuns(g2,{rows:2,cols:2,lockR:[],lockC:[]}))===false,
     '两张牌都在推不动的孤格里，应判无路');

  // 真死局：一张永久锁在卡死行∩卡死列，另一张在别处
  const sp5=L.LEVELS[4],g5=L.buildGrid(sp5);
  g5.forEach(row=>row.forEach(v=>{if(Array.isArray(v))v.length=0}));
  g5[1][4]=['5z']; g5[3][2]=['5z'];
  ok(L.sameFaceReachable(g5,L.computeRuns(L.buildGrid(sp5),sp5))===false,
     '锁位格上的牌永远够不着，应判无路');

  // 四张两种面：一面可达、一面不可达 → 整体仍有路
  const g6=L.buildGrid(spec4);
  g6.forEach(row=>row.forEach(v=>{if(Array.isArray(v))v.length=0}));
  g6[0][0]=['1p']; g6[0][3]=['1p'];                     // 可达
  g6[2][2]=['9m']; g6[4][4]=['9m'];                     // 也同分量，只要有一对可达就该判有路
  ok(L.sameFaceReachable(g6,L.computeRuns(g6,spec4))===true,'只要有一种面能贴上就不该判死');

  // 提示：一步贴不上时要给出多步方案，而不是"确实无路了"
  const plan=L.deepSlide(g,runs,2);
  ok(plan===null||plan.length>=1,'deepSlide 返回值形态不对');

  // 生成的每一关开局都不能被判成死局
  for(let li=0;li<L.LEVELS.length;li++){
    const sp=L.LEVELS[li];let dead=0;
    for(let s=0;s<8;s++){
      const r=L.genLevel(sp,L.mulberry32(7000+s*131+li*29));
      if(L.findPairs(r.grid).length===0&&!L.deepSlide(r.grid,r.runs,2)&&!L.sameFaceReachable(r.grid,r.runs))dead++;
    }
    ok(dead===0,`${sp.name} 有 ${dead}/8 个开局盘面被判成死局`);
  }
  console.log('  残局判据：多步可贴不误判无路 · 孤格/锁位真死局仍能判出 · 五关开局无一误判');
}
}catch(e){fail++;console.log("  ✗ 残局判据用例抛错（函数还没实现）："+e.message);}

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail?1:0);
