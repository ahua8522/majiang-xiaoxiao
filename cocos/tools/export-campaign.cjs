/** Campaign documentation comes from the actual playable definitions. */
const fs=require('node:fs'),path=require('node:path');
const core=n=>require(path.join(__dirname,'../.test/core',n));
const {LEVELS,generate}=core('Generator'),{CHAPTERS,CHAPTER_LENGTH}=core('Campaign');
const R=core('Rules'),M=core('Mechanics');
const tags=d=>[d.map.some(r=>r.includes('2'))?'双层牌':'',d.map.some(r=>r.includes('3'))?'三层牌':'',d.ice?'冰牌':'',d.ice2?'厚冰':'',d.map.some(r=>r.includes('#'))?'木块':'',d.oneWay?.length?'单向轨':'',d.lockR.length||d.lockC.length?'固定锁轨':'',d.unlock?.length?'计数解锁':'',d.keyLocks?.length?'钥匙解锁':'',d.wild?'百搭':'',d.bombs?'爆竹':'',d.energy?'灵感充能':''].filter(Boolean).join('、')||'基础配对';
const goal=d=>d.floors?.length?`${{flower:'定点开花',dew:'邻格浇水',bud:'两次花苞'}[d.floors[0].kind]} ${d.floors.length} 格`:d.goal?.kind==='collect'?`收集 ${d.goal.faces.join(' / ')} 各两张`:d.goal?.kind==='face'?`收集 ${d.goal.face} ${d.goal.count} 对`:'清空牌桌';
const lines=['# 520 关全量表','','> 由正式代码生成。尺寸为「列 × 行」。通关参考步数来自真实目标重放，不代表最优解。',''],summary=[];
for(let ci=0;ci<CHAPTERS.length;ci++){
 const first=ci*CHAPTER_LENGTH,list=LEVELS.slice(first,first+CHAPTER_LENGTH),sizes=[];
 lines.push(`## ${ci+1}. ${CHAPTERS[ci][0]} · ${first+1}–${first+list.length} 关`,'',CHAPTERS[ci][2]+' '+CHAPTERS[ci][3],'','| 关 | 列×行 | 牌数 | 机关 | 目标 | 步数上限 | 通关参考步数 |','|---|---|---|---|---|---|---|');
 list.forEach((d,k)=>{
   const deal=generate(first+k,d.seed);let grid=deal.grid,state=M.freshMechanics(d),cleared=0,steps=0;
   for(const a of deal.solution){const l=M.mechanicLocks(d,cleared,state),out=R.transition(grid,R.runsFor(grid,l.lockR,l.lockC,d.oneWay),a);state=M.advanceMechanics(d,state,out);cleared+=(R.count(grid)-R.count(out.grid))/2;grid=out.grid;steps++;if(d.goal?M.mechanicGoal(d,state)>=d.goal.count:!R.count(grid))break;}
   const size=`${d.map[0].length}×${d.map.length}`;sizes.push(size);
   lines.push(`| ${first+k+1} | ${size} | ${R.count(deal.grid)} | ${tags(d)} | ${goal(d)} | ${d.moveLimit||'不限'} | ${steps} |`);
 });
 lines.push('');summary.push(`| ${first+1}–${first+20} | ${CHAPTERS[ci][0]} | ${CHAPTERS[ci][2]} | ${Array.from(new Set(sizes)).join(' / ')} |`);
}
const dir=path.join(__dirname,'../../docs');fs.writeFileSync(path.join(dir,'关卡全量表.md'),lines.join('\n'));
const plan=path.join(dir,'redesign-2026-11/CAMPAIGN-520.md');const text=fs.readFileSync(plan,'utf8');
fs.writeFileSync(plan,text.replace(/<!-- CHAPTERS -->[\s\S]*?<!-- END CHAPTERS -->/,'<!-- CHAPTERS -->\n| 关卡 | 章节 | 学习重点 | 列×行 |\n|---|---|---|---|\n'+summary.join('\n')+'\n<!-- END CHAPTERS -->'));
console.log(`Exported ${LEVELS.length} levels and ${CHAPTERS.length} chapters.`);
