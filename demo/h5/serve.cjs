/* Static server for the H5 demo (also serves over LAN so a phone can open it).
   Usage: node demo/h5/serve.cjs [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = __dirname;
const PORT = Number(process.argv[2]) || 8090;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg'};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(DIR, rel);
  if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
    res.end('404');
    return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'});
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log(`H5 demo: http://127.0.0.1:${PORT}/`);
  for (const ip of lan) console.log(`  phone : http://${ip}:${PORT}/   (same Wi-Fi)`);
  console.log('tips: ?screen=board&level=11 opens a level directly; ?screen=home|levels|settings|progress|win|lose|pause|help');
});