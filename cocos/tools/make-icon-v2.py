# -*- coding: utf-8 -*-
"""快乐推麻对对消图标：原生 Pillow 绘制，保留麻将身份，输出方形 PNG 与裁切预览。

Run: python cocos/tools/make-icon-v2.py
No image API, key, network, or new dependencies beyond the existing Pillow pipeline.
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'brand' / 'yuting-v2'
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path('C:/Windows/Fonts/STKAITI.TTF')
SANS = Path('C:/Windows/Fonts/msyh.ttc')
SIZE = 1536
S = SIZE / 1024


def rgb(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def grad(w, h, stops):
    strip = Image.new('RGB', (1, h))
    pix = strip.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            a, ca = stops[i]; b, cb = stops[i + 1]
            if t <= b:
                k = max(0, min(1, (t - a) / (b - a)))
                pix[0, y] = tuple(round(v + (u - v) * k) for v, u in zip(rgb(ca), rgb(cb)))
                break
    return strip.resize((w, h), Image.Resampling.BILINEAR).convert('RGBA')


def rounded_gradient(size, box, radius, colors):
    w, h = size
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    result = grad(w, h, colors)
    result.putalpha(mask)
    return result


def glow(img, center, radius, color, opacity):
    mask = Image.new('L', (256, 256))
    d = ImageDraw.Draw(mask)
    x, y = [n * 256 for n in center]
    for i in range(100, 0, -1):
        r = radius * 256 * i / 100
        alpha = int(opacity * (1 - i / 100) ** 1.8)
        d.ellipse((x-r, y-r, x+r, y+r), fill=alpha)
    lay = Image.new('RGBA', img.size, color)
    lay.putalpha(mask.resize(img.size, Image.Resampling.BILINEAR))
    return Image.alpha_composite(img, lay)


def tile(w, h, angle, muted=False):
    w, h = int(w*S), int(h*S)
    pad = int(70*S)
    size = (w+pad*2, h+pad*2)
    r = int(w*.12)
    lift = int(h*.085)
    img = Image.new('RGBA', size)
    # Smooth contact shadow plus a solid jade sidewall; the top face remains clean.
    mask = Image.new('RGBA', size)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((pad+8*S, pad+26*S, pad+w+10*S, pad+h+27*S), radius=r, fill=(6,39,34,100))
    img = Image.alpha_composite(img, mask.filter(ImageFilter.GaussianBlur(18*S)))
    side = rounded_gradient(size, (pad,pad+lift,pad+w,pad+h), r, [(0,'#a2c6a6'),(.55,'#659477'),(1,'#214f3e')])
    img = Image.alpha_composite(img, side)
    # A second thin ceramic layer makes the thickness readable at small sizes.
    ceramic = rounded_gradient(size, (pad,pad+9*S,pad+w,pad+h-lift*.60), r, [(0,'#fffff6'),(.5,'#e5e9d8'),(1,'#c4ceb7')])
    img = Image.alpha_composite(img, ceramic)
    body = rounded_gradient(size, (pad,pad,pad+w,pad+h-lift-8*S), r, [(0,'#ffffff'),(.26,'#fffff6'),(.72,'#f4f5e8'),(1,'#e0e6d2')])
    img = Image.alpha_composite(img, body)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((pad,pad,pad+w,pad+h-lift-8*S),radius=r,outline='#bdccb4',width=max(2,int(2*S)))
    d.rounded_rectangle((pad+6*S,pad+5*S,pad+w-6*S,pad+h-lift-14*S),radius=r-4*S,outline='#fffff8',width=int(3*S))
    # Clean crown highlight; blurring RGB on a transparent layer would produce a gray fringe.
    d.line((pad+r,pad+6*S,pad+w-r,pad+6*S),fill='#ffffff',width=int(3*S))
    # Real font outline ensures exact Chinese glyphs. Slight lower highlight suggests engraving.
    font = ImageFont.truetype(str(FONT),int(w*.75))
    center = (pad+w*.50,pad+(h-lift)*.51)
    d = ImageDraw.Draw(img)
    d.text((center[0]+1*S,center[1]+3*S),'發',font=font,fill='#fffdf0',anchor='mm',stroke_width=int(1*S))
    d.text(center,'發',font=font,fill='#275e46' if muted else '#1e7350',anchor='mm',stroke_width=int(1*S))
    return img.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)


def paste_center(img, lay, x, y):
    img.alpha_composite(lay, (round(x*S-lay.width/2), round(y*S-lay.height/2)))


def sparkle(img, x, y, r):
    layer = Image.new('RGBA',img.size)
    d = ImageDraw.Draw(layer)
    x,y,r=x*S,y*S,r*S
    points=[(x,y-r),(x+r*.28,y-r*.27),(x+r,y),(x+r*.28,y+r*.27),(x,y+r),(x-r*.28,y+r*.27),(x-r,y),(x-r*.28,y-r*.27)]
    d.polygon(points,fill='#ffe6a2')
    halo = layer.filter(ImageFilter.GaussianBlur(9*S))
    img = Image.alpha_composite(img,halo)
    img = Image.alpha_composite(img,layer)
    ImageDraw.Draw(img).polygon([(x,y-r*.62),(x+r*.15,y-r*.15),(x+r*.62,y),(x+r*.15,y+r*.15),(x,y+r*.62),(x-r*.15,y+r*.15),(x-r*.62,y),(x-r*.15,y-r*.15)],fill='#fff8dd')
    return img


def master():
    img=grad(SIZE,SIZE,[(0,'#9dc3a5'),(.36,'#6b9e7e'),(.72,'#37775b'),(1,'#235942')])
    img=glow(img,(.23,.13),.72,'#e5edbf',155)
    img=glow(img,(.88,.76),.55,'#529a79',65)
    # One understated circular arc suggests a gentle sliding movement.
    arcs=Image.new('RGBA',img.size)
    d=ImageDraw.Draw(arcs)
    d.arc(tuple(v*S for v in (-65,108,1095,1150)),20,160,fill=(204,202,140,105),width=int(13*S))
    d.arc(tuple(v*S for v in (-96,75,1126,1190)),20,157,fill=(150,187,135,55),width=int(4*S))
    d.arc(tuple(v*S for v in (28,85,1000,1057)),188,270,fill=(225,232,188,48),width=int(4*S))
    img=Image.alpha_composite(img,arcs)
    ground=Image.new('RGBA',img.size)
    ImageDraw.Draw(ground).ellipse(tuple(v*S for v in (155,753,890,911)),fill=(7,35,26,85))
    img=Image.alpha_composite(img,ground.filter(ImageFilter.GaussianBlur(30*S)))
    paste_center(img,tile(343,478,16,muted=True),302,504)
    paste_center(img,tile(448,585,-11),632,559)
    # Contact flash is a visual verb: two matching tiles meet and disappear.
    img=sparkle(img,506,236,52)
    img=sparkle(img,805,165,20)
    img=sparkle(img,187,177,14)
    d=ImageDraw.Draw(img)
    for x,y,r in [(731,142,4),(847,239,5),(225,142,3)]:
        d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill='#d4ce90')
    return img.convert('RGB')


def round_preview(img, radius=.225):
    out=img.convert('RGBA')
    m=Image.new('L',img.size)
    ImageDraw.Draw(m).rounded_rectangle((0,0,img.width-1,img.height-1),radius=round(img.width*radius),fill=255)
    out.putalpha(m)
    return out


def save():
    img=master()
    for size in [1024,512,256,144,128,64,40]:
        resized=img.resize((size,size),Image.Resampling.LANCZOS)
        target=OUT/f'icon-jade-pair-{size}.png'
        resized.save(target,optimize=True)
        # Keep the usual 512 px delivery lightweight while retaining a full-color master.
        if size==512 and target.stat().st_size>200_000:
            resized.quantize(colors=256,method=Image.Quantize.MEDIANCUT).save(target,optimize=True)
    round_preview(img.resize((512,512),Image.Resampling.LANCZOS)).save(OUT/'icon-rounded-preview.png',optimize=True)
    # Real-size checks: 144 / 64 / 40 px and both light/dark list surfaces.
    sheet=Image.new('RGB',(1140,750),'#f1f4ea')
    d=ImageDraw.Draw(sheet)
    title=ImageFont.truetype(str(FONT),39)
    label=ImageFont.truetype(str(SANS),18)
    small=ImageFont.truetype(str(SANS),15)
    d.text((38,24),'实体麻将 · 双牌相碰',font=title,fill='#245b46')
    d.text((40,78),'快乐推麻对对消 / 新版图标',font=label,fill='#8c957b')
    sheet.paste(round_preview(img.resize((512,512),Image.Resampling.LANCZOS)),(38,129),round_preview(img.resize((512,512),Image.Resampling.LANCZOS)))
    d.text((41,670),'512 px   乳白牌面 · 青绿牌背 · 相碰亮点',font=small,fill='#859078')
    for size,x in [(144,608),(64,815),(40,974)]:
        thumb=round_preview(img.resize((size,size),Image.Resampling.LANCZOS))
        sheet.paste(thumb,(x,143+144-size),thumb)
        d.text((x,309),f'{size} px',font=small,fill='#839178')
    for y,bg,fg,secondary in [(375,'#ffffff','#274f40','#9a9f8f'),(505,'#183c33','#f4ebd2','#8aa394')]:
        d.rounded_rectangle((592,y,1101,y+105),radius=18,fill=bg)
        thumb=round_preview(img.resize((64,64),Image.Resampling.LANCZOS))
        sheet.paste(thumb,(614,y+20),thumb)
        d.text((698,y+22),'快乐推麻对对消',font=label,fill=fg)
        d.text((698,y+55),'推一推，同牌碰头就消',font=small,fill=secondary)
    d.text((609,670),'浅色 / 深色背景缩略检验（示意）',font=small,fill='#859078')
    sheet.save(OUT/'icon-preview-sheet.png',optimize=True)
    for file in sorted(OUT.glob('*.png')):
        with Image.open(file) as check:
            print(f'{file.name}: {check.size} {check.mode} {file.stat().st_size:,} bytes')


if __name__=='__main__':
    if not FONT.exists() or not SANS.exists():
        raise SystemExit('Missing Windows Kaiti / Microsoft YaHei fonts; set FONT and SANS to local equivalents.')
    save()
