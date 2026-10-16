/* Bundles the H5 demo into a single self-contained index.html.
   Usage: node demo/h5/build.cjs            (one-shot)
          node demo/h5/build.cjs --watch    (rebuild on change) */
const fs = require('fs');
const path = require('path');
const {createRequire} = require('module');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '../..');
// esbuild ships with the Cocos toolchain; resolve it from there so the demo has no own deps.
const esbuild = createRequire(path.join(ROOT, 'cocos/package.json'))('esbuild');
const OUT = path.join(DIR, 'index.html');
const TEMPLATE = fs.readFileSync(path.join(DIR, 'template.html'), 'utf8');

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(DIR, 'src/entry.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: false,
    write: false,
    logLevel: 'warning'
  });
  const js = result.outputFiles[0].text;
  const html = TEMPLATE.replace('/*__BUNDLE__*/', () => js);
  fs.writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`built demo/h5/index.html  ${kb} KB`);
}

(async () => {
  await build();
  if (!process.argv.includes('--watch')) return;
  const watchDir = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) { watchDir(p); continue; }
      if (name.endsWith('.ts') || name.endsWith('.html')) {
        fs.watchFile(p, {interval: 400}, () => build().catch((e) => console.error(e.message)));
      }
    }
  };
  watchDir(DIR);
  console.log('watching demo/h5 ...');
})().catch((e) => { console.error(e); process.exit(1); });