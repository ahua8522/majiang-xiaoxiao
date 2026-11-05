/** Render the real old/current source at large and actual phone sizes. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../..');
const esbuild = createRequire(path.join(root, 'cocos/package.json'))('esbuild');
async function bundle(contents, globalName) {
  const result = await esbuild.build({stdin: {contents, loader: 'ts', resolveDir: path.join(root, 'cocos/assets/scripts/view')}, bundle: true, write: false, format: 'iife', globalName, minify: true});
  return result.outputFiles[0].text;
}
(async () => {
  const before = execFileSync('git', ['show', '45524c5:cocos/assets/scripts/view/art.ts'], {cwd: root, encoding: 'utf8'});
  const after = fs.readFileSync(path.join(root, 'cocos/assets/scripts/view/art.ts'), 'utf8');
  const sources = await Promise.all([bundle(before, 'before'), bundle(after, 'after')]);
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>实体麻将牌 · 识别度对比</title>
  <style>*{box-sizing:border-box}body{margin:0;background:#f1f3ed;color:#254d40;font:14px 'Microsoft YaHei',sans-serif}main{width:960px;margin:auto;padding:32px 42px}h1{font-size:29px;margin:0 0 8px}p{color:#637d70;line-height:1.8;margin:0 0 20px}h2{font-size:15px;margin:0 0 14px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{padding:20px;border:1px solid #d0dccf;border-radius:18px;background:#e5ece1}.row{display:flex;justify-content:space-around;gap:12px}figure{margin:0;text-align:center}figcaption{font-size:12px;margin:8px 0 14px}.small{border-top:1px solid #c7d5c8;margin-top:8px;padding-top:14px}.small h2{font-weight:400;color:#63806d;font-size:12px}canvas{display:block}.family{padding:20px;margin-top:20px;border-radius:18px;background:#416d59;color:#f6f8ef}.family p{color:#d2e4d9;margin:0;font-size:12px}.family figcaption{margin-bottom:8px}footer{font-size:11px;line-height:1.8;color:#748677;margin-top:17px}</style>
  <main><h1>一眼认清，四条、六条、九条。</h1><p>乳白牌面 · 细倒角 · 青绿背板。用连续的竹节和清楚的行列区分点数。</p><div class="compare"></div><div class="family"><h2>整副条子 / 44 px 牌宽</h2><div class="row" id="family"></div><p>四条 2 × 2　·　六条 2 × 3，全绿　·　九条 3 × 3，中列红</p></div><footer>对比由同一份真实绘制函数输出；左侧使用修改前提交 45524c5。<br>小牌按 CSS 实际尺寸绘制，并以 2 倍像素密度导出；未通过缩放大牌冒充小尺寸效果。</footer></main>
  <script>${sources.join('\n')}
  function tile(renderer, face, width, parent, label) {
    const h = Math.round(width * 1.36), c = document.createElement('canvas');
    c.width=(width+8)*2;c.height=(h+9)*2;c.style.width=(width+8)+'px';c.style.height=(h+9)+'px';
    const ctx=c.getContext('2d');ctx.scale(2,2);renderer.drawTile(ctx,face,4,3,{w:width,h});
    const fig=document.createElement('figure');fig.append(c);const caption=document.createElement('figcaption');caption.textContent=label;fig.append(caption);parent.append(fig);
  }
  for(const [renderer,title] of [[before,'修改前'],[after,'现在 / 实体牌质感']]) {
    const panel=document.createElement('section');panel.className='panel';panel.innerHTML='<h2>'+title+'</h2><div class="row large"></div><div class="small"><h2>手机实际牌宽 / 44 px</h2><div class="row"></div></div>';document.querySelector('.compare').append(panel);
    for(const [face,label] of [['4s','四条'],['6s','六条'],['9s','九条']]) {tile(renderer,face,86,panel.querySelector('.large'),label);tile(renderer,face,44,panel.querySelector('.small .row'),label);}
  }
  for(let i=1;i<=9;i++)tile(after,i+'s',44,document.querySelector('#family'),'一二三四五六七八九'[i-1]+'条');
  </script></html>`;
  fs.writeFileSync(path.join(__dirname, 'tile-study.html'), html);
  console.log('Built tile-study.html from real before/after art.');
})().catch(e=>{console.error(e);process.exitCode=1;});
