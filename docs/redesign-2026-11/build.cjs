const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const esbuild=createRequire(path.resolve(__dirname,'../../cocos/package.json'))('esbuild');
(async()=>{
  const result=await esbuild.build({entryPoints:[path.join(__dirname,'app.ts')],bundle:true,format:'iife',target:'es2020',write:false,minify:true});
  const icon=size=>'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,`../brand/yuting-v2/icon-jade-pair-${size}.png`)).toString('base64');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'audio/manifest.json'),'utf8'));
  const audio=Object.fromEntries(Object.entries(manifest).filter(([,v])=>v.kind!=='study').map(([key,v])=>[key,fs.readFileSync(path.join(__dirname,'audio',v.file)).toString('base64')]));
  const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(__dirname,'style.css'),'utf8')).replace('/*__ICON64__*/',()=>icon(64)).replace('/*__ICON144__*/',()=>icon(144)).replace('/*__AUDIO__*/',()=>JSON.stringify(audio)).replace('/*__BUNDLE__*/',()=>result.outputFiles[0].text);
  fs.writeFileSync(path.join(__dirname,'index.html'),html);
  await esbuild.build({entryPoints:[path.join(__dirname,'model.ts')],bundle:true,platform:'node',format:'cjs',target:'es2020',outfile:path.resolve(__dirname,'../../temp/redesign-model.cjs')});
  console.log(`Design preview built: ${(Buffer.byteLength(html)/1024).toFixed(0)} KB, self-contained.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
