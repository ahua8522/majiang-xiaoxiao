const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const esbuild=createRequire(path.resolve(__dirname,'../../cocos/package.json'))('esbuild');
(async()=>{
  const result=await esbuild.build({entryPoints:[path.join(__dirname,'app.ts')],bundle:true,format:'iife',target:'es2020',write:false,minify:true});
  const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(__dirname,'style.css'),'utf8')).replace('/*__BUNDLE__*/',()=>result.outputFiles[0].text);
  fs.writeFileSync(path.join(__dirname,'index.html'),html);
  await esbuild.build({entryPoints:[path.join(__dirname,'model.ts')],bundle:true,platform:'node',format:'cjs',target:'es2020',outfile:path.resolve(__dirname,'../../temp/redesign-model.cjs')});
  console.log(`Design preview built: ${(Buffer.byteLength(html)/1024).toFixed(0)} KB, self-contained.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
