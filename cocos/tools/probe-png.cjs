/* 精确量几个已知设计尺寸的控件，反推实际缩放与布局偏移。
   用法： node tools/probe-png.cjs <file.png> */
const fs = require('fs');
const zlib = require('zlib');

function decode(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = color === 6 ? 4 : color === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  return {w, h, ch, px: out};
}

const {w, h, ch, px} = decode(process.argv[2]);
const at = (x, y) => { const i = (y * w + x) * ch; return [px[i], px[i + 1], px[i + 2]]; };

// 附加模式：probe-png.cjs <png> x1,y1 x2,y2 ... → 打印这些点的颜色（用来对比两张图同一位置）
const samples = process.argv.slice(3);
if (samples.length) {
  console.log(`image ${w} x ${h}  采样:`);
  for (const s of samples) {
    const [x, y] = s.split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= w || y >= h) { console.log(`   ${s}  越界`); continue; }
    const [r, g, b] = at(x, y);
    console.log(`   (${x},${y})  rgb(${r},${g},${b})  #${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  }
  process.exit(0);
}

function bbox(pred, x0, x1, y0, y1) {
  let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const [r, g, b] = at(x, y);
    if (!pred(r, g, b)) continue;
    n++;
    if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  return n ? {x0: mnx, x1: mxx, w: mxx - mnx + 1, y0: mny, y1: mxy, h: mxy - mny + 1, n} : null;
}

// 画布范围：用「非深色」的行/列投影，取最大连续段
const bright = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > 70;
const rowSpan = (y) => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (bright(...at(x, y))) { if (a < 0) a = x; b = x; } return [a, b]; };
const colSpan = (x) => { let a = -1, b = -1; for (let y = 0; y < h; y++) if (bright(...at(x, y))) { if (a < 0) a = y; b = y; } return [a, b]; };

console.log(`image ${w} x ${h}`);
for (const y of [40, 120, 300, 680, 1000, 1250]) {
  const [a, b] = rowSpan(y);
  console.log(`  row y=${String(y).padStart(4)}  x ${a}..${b}   width ${b - a + 1}`);
}
for (const x of [260, 470, 700]) {
  const [a, b] = colSpan(x);
  console.log(`  col x=${String(x).padStart(4)}  y ${a}..${b}   height ${b - a + 1}`);
}

// 标题匾额：深玉绿胶囊（设计 330x76）
const plate = bbox((r, g, b) => g > r + 22 && g > b + 22 && g > 78 && g < 150 && r < 95, 0, w - 1, 60, 340);
console.log('plate(设计330x76)  ', JSON.stringify(plate));

// 木框：木色大面积区域（设计宽 = cellW*cols + 2*pad）
const wood = bbox((r, g, b) => r > 120 && r < 200 && g > 70 && g < 150 && b < 100 && r - b > 60 && r - g > 35, 0, w - 1, 380, 1000);
console.log('wood (设计宽=棋盘宽+2pad)', JSON.stringify(wood));

// 金色高亮描边（设计 = cellW*0.98 x cellH*0.98）
const gold = bbox((r, g, b) => r > 200 && g > 160 && b < 130 && r - b > 90, 0, w - 1, 380, 1000);
console.log('gold hl            ', JSON.stringify(gold));

// 工具条深绿按钮（设计 每枚 158.5x116，4 枚）
const tools = bbox((r, g, b) => g > r + 12 && g > b + 12 && g > 55 && g < 120 && r < 90, 0, w - 1, 1020, 1358);
console.log('toolbar            ', JSON.stringify(tools));
