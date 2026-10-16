# -*- coding: utf-8 -*-
"""
麻将小游戏品牌头像生成器（离线、可复跑）。

为什么用 Python + PIL 而不是浏览器探针：头像是一次性品牌素材，不需要进游戏包，
用 PIL 直接按 `view/theme.ts` 的色板与 `view/art.ts` 的牌面几何重画一遍即可，
无浏览器依赖、可重复生成、结果稳定。

画法与游戏内一致的三条约定：
  - 牌 = 象牙牌身（白→#FDF8E4→#F0E7CC 竖向渐变）+ 底部花色脚 + 实心向下投影（不是模糊阴影）
  - 字体用华文楷体 STKAITI.TTF，与 art.ts 的 SERIF 字体栈首项一致
  - 全部色值取自 theme.ts 的 palette，不另起一套

产物写入 docs/brand/：
  icon-<name>-512.png  512×512，圆角方形 + 透明四角（微信「游戏图标」素材口径）
  icon-<name>-144.png  144×144，满幅方图（后台「头像」口径，圆角由微信自己裁）
  icon-sheet.png       候选对比图（512 / 144 / 64 / 40 四档缩略，检查小尺寸可读性）
"""
import os
from PIL import Image, ImageDraw, ImageFont

# ── 路径 ──────────────────────────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'docs', 'brand'))
FONT_SERIF = 'C:/Windows/Fonts/STKAITI.TTF'   # 华文楷体 = art.ts SERIF 首项
FONT_SANS = 'C:/Windows/Fonts/msyh.ttc'       # 对比图标签用

MASTER = 1024   # 先按 1024 画，再降采样出 512 / 144，边缘才干净

# ── 色板（逐条来自 view/theme.ts 的 palette） ──────────────────────────
P = dict(
    cream='#FBF3DE', creamDeep='#F3E6C6', creamEdge='#E4D2A6',
    gold='#D8A94E', goldDeep='#A87C2C', goldLight='#F3DC9B',
    jade='#2E7D4F', jadeDeep='#1C5B37', jadeLight='#4FA46A', jadeBright='#43A860',
    tile='#FDF8E4', tileEdge='#E8DCBC',
    red='#C0392B', navy='#2B4A7A', blue='#2E7FB8',
    ink='#2B3A28',
)
SERIF_GREEN = '#2E8B57'   # 字牌「發」与花牌同色


def hx(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def rgba(s, a=255):
    return hx(s) + (a,)


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def stop_color(stops, t):
    """stops = [(pos, '#hex'), ...] 线性插值。"""
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if t <= p1 or i == len(stops) - 2:
            k = 0.0 if p1 == p0 else (t - p0) / (p1 - p0)
            return mix(hx(c0), hx(c1), max(0.0, min(1.0, k)))
    return hx(stops[-1][1])


def vgrad(w, h, stops):
    strip = Image.new('RGB', (1, h))
    px = strip.load()
    for y in range(h):
        px[0, y] = stop_color(stops, y / max(1, h - 1))
    return strip.resize((w, h), Image.BILINEAR)


def rmask(w, h, r):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(r), fill=255)
    return m


def radial_mask(size, cx, cy, r, a_in, a_out, power=1.6, res=192):
    """低分辨率画径向渐变再放大——1024² 逐像素太慢。"""
    m = Image.new('L', (res, res), 0)
    d = ImageDraw.Draw(m)
    for i in range(48, 0, -1):
        t = i / 48.0
        a = int(a_in + (a_out - a_in) * (t ** power))
        rr = r * t * res
        d.ellipse([cx * res - rr, cy * res - rr, cx * res + rr, cy * res + rr], fill=a)
    return m.resize((size, size), Image.BILINEAR)


def text_layer(size, s, font, xy, color, anchor='mm', rot=0):
    """把字画在独立透明层上再合成——保证字与底图正确混合、带抗锯齿。"""
    lay = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).text(xy, s, font=font, fill=rgba(color), anchor=anchor)
    if rot:
        lay = lay.rotate(rot, resample=Image.BICUBIC, center=xy)
    return lay


# ── 牌（复刻 art.ts#drawTile） ─────────────────────────────────────────
def tile_layer(face, w, h):
    """返回一张独立 RGBA 牌（含向下投影），左上角牌身对齐 (pad, pad)。"""
    lift = max(2.0, h * .07)
    r = min(w, h) * .17
    pad = int(w * .14)
    W, H = int(w + pad * 2), int(h + pad * 2)
    ox, oy = pad, pad
    body_h = h - lift

    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1) 实心向下投影
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [ox + w * .02, oy + h * .05, ox + w * .02 + w, oy + h * .05 + body_h],
        radius=r, fill=rgba('#1E3A22', 46))
    img = Image.alpha_composite(img, sh)

    # 2) 花色脚
    ft = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ft).rounded_rectangle(
        [ox, oy + lift, ox + w, oy + lift + body_h], radius=r, fill=rgba(foot_color(face)))
    img = Image.alpha_composite(img, ft)

    # 3) 象牙牌身（竖向渐变）
    gw, gh = int(w) + 1, int(body_h) + 1
    g = vgrad(gw, gh, [(0, '#FFFFFF'), (.55, P['tile']), (1, '#F0E7CC')]).convert('RGBA')
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    body.paste(g, (int(ox), int(oy)), rmask(gw, gh, r))
    img = Image.alpha_composite(img, body)

    # 4) 牌身描边
    st = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(st).rounded_rectangle(
        [ox, oy, ox + w, oy + body_h], radius=r,
        outline=rgba(P['tileEdge']), width=max(1, int(w * .022)))
    img = Image.alpha_composite(img, st)

    # 5) 顶部高光
    hl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(hl).rounded_rectangle(
        [ox + w * .08, oy + h * .07, ox + w * .92, oy + h * .07 + body_h * .16],
        radius=r * .6, fill=rgba('#FFFFFF', 191))
    img = Image.alpha_composite(img, hl)

    # 6) 牌面花纹
    img = Image.alpha_composite(img, face_layer(face, ox + w * .09, oy + h * .07, w * .82, body_h * .84, W, H))
    return img


def foot_color(face):
    key = face[0]
    return {'p': P['blue'], 's': SERIF_GREEN, 'm': P['red'], 'z': '#6B4FA0',
            'f': '#C2678F', 'x': P['blue']}.get(key, P['ink'])


def face_layer(face, x, y, w, h, W, H):
    """牌面花纹，坐标与 art.ts#faceArt 一致（x/y/w/h 为花纹框）。"""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    kind, n = face[0], face[1:]

    if face in ('x1', 'x2', 'x3'):                       # 大厅装饰字牌 萬/乐/筒
        ch, col = {'x1': ('萬', P['red']), 'x2': ('乐', SERIF_GREEN), 'x3': ('筒', P['blue'])}[face]
        size = min(h * .56, w * .86)
        f = ImageFont.truetype(FONT_SERIF, int(size))
        d.text((x + w / 2, y + h / 2), ch, font=f, fill=rgba(col), anchor='mm')

    elif kind == 'p' and n == '1':                       # 一筒：同心环
        cx, cy, r = x + w / 2, y + h / 2, w * .37
        for rr, col in ((r, SERIF_GREEN), (r * .78, P['tile']), (r * .6, P['red']),
                        (r * .36, P['tile']), (r * .2, P['blue'])):
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=rgba(col))

    elif kind == 'p' and n == '5':                       # 五筒：四绿一红
        for i, (px, py) in enumerate(((.28, .26), (.72, .26), (.5, .5), (.28, .74), (.72, .74))):
            cx, cy, r = x + px * w, y + py * h, w * .15
            col = P['red'] if i == 2 else SERIF_GREEN
            for rr, cc in ((r, col), (r * .62, P['tile']), (r * .32, col)):
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=rgba(cc))

    elif kind in ('z', 'm', 'f'):                        # 字牌 / 万子 / 花牌（大字）
        if face == 'z5':
            ch, col = '中', P['red']
        elif face == 'z6':
            ch, col = '發', SERIF_GREEN
        elif face == 'z3':
            ch, col = '西', P['navy']
        elif kind == 'm':
            ch, col = '萬', P['red']
        else:
            ch, col = '梅', SERIF_GREEN
        size = min(h * .56 if kind == 'z' else h * .5, w * .86)
        f = ImageFont.truetype(FONT_SERIF, int(size))
        d.text((x + w / 2, y + h / 2), ch, font=f, fill=rgba(col), anchor='mm')

    else:
        f = ImageFont.truetype(FONT_SANS, int(min(h * .4, w * .6)))
        d.text((x + w / 2, y + h / 2), '?', font=f, fill=rgba('#8A957E'), anchor='mm')
    return lay


def place_tile(base, face, cx, cy, w, h, rot=0.0):
    """把一张牌按中心点 + 旋转角贴到 base 上。"""
    lay = tile_layer(face, w, h)
    if rot:
        lay = lay.rotate(rot, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))


# ── 底：玉色方章 ───────────────────────────────────────────────────────
def jade_ground(size, frame=True):
    base = vgrad(size, size, [(0, P['jadeLight']), (.32, P['jade']),
                              (.76, P['jadeDeep']), (1, '#123A24')]).convert('RGBA')

    # 左上暖光
    glow = Image.new('RGBA', (size, size), (255, 252, 235, 0))
    glow.putalpha(radial_mask(size, .40, .16, .78, 92, 0))
    base = Image.alpha_composite(base, glow)

    # 底部庭院弧线（两重远山剪影，极低对比，只为 512 尺寸加一点层次）
    arc = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arc)
    for i, (yy, col, a) in enumerate(((0.86, '#0F3220', 70), (0.95, '#0B2819', 90))):
        ad.ellipse([-size * .35, size * yy, size * 1.35, size * (yy + .9)], fill=rgba(col, a))
    base = Image.alpha_composite(base, arc)

    # 暗角
    vig = Image.new('RGBA', (size, size), (10, 40, 26, 0))
    vig.putalpha(radial_mask(size, .5, .46, .92, 0, 86, power=2.0))
    base = Image.alpha_composite(base, vig)

    # 金线内框（单线 + 极淡内衬，与 drawPanel 的「金边 + 内细线」同构；贴着边放，把中间让给牌）
    if frame:
        m = size * .042
        fr = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fr)
        fd.rounded_rectangle([m, m, size - m, size - m], radius=size * .115,
                             outline=rgba(P['gold'], 150), width=max(2, int(size * .008)))
        fd.rounded_rectangle([m * 1.62, m * 1.62, size - m * 1.62, size - m * 1.62], radius=size * .105,
                             outline=rgba(P['goldLight'], 48), width=max(1, int(size * .0035)))
        base = Image.alpha_composite(base, fr)
    return base


def seal(base, cx, cy, s, ch='对', rot=-7.0):
    """红印章（首页标题旁「对对消」印章的同款元素）。"""
    lay = Image.new('RGBA', (int(s * 2), int(s * 2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    o = s * .5
    d.rounded_rectangle([o, o, o + s, o + s], radius=s * .22, fill=rgba(P['red']))
    d.rounded_rectangle([o + s * .08, o + s * .08, o + s * .92, o + s * .92],
                        radius=s * .16, outline=rgba('#F6E3C8', 130), width=max(1, int(s * .035)))
    f = ImageFont.truetype(FONT_SERIF, int(s * .62))
    d.text((o + s / 2, o + s / 2 + s * .02), ch, font=f, fill=rgba('#FDF8E4'), anchor='mm')
    lay = lay.rotate(rot, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))


# ── 四个候选 ──────────────────────────────────────────────────────────
def icon_three():
    """A 三牌斜靠（与启动页 logo 同构，品牌延续性最强）。"""
    b = jade_ground(MASTER)
    t = MASTER * .352
    place_tile(b, 'x1', MASTER * .272, MASTER * .500, t, t * 1.26, rot=-7)
    place_tile(b, 'x2', MASTER * .500, MASTER * .472, t * 1.06, t * 1.36, rot=-2)
    place_tile(b, 'x3', MASTER * .730, MASTER * .505, t * .96, t * 1.22, rot=6)
    return b


def icon_pair():
    """B 双牌前后叠放 + 印章：直译「碰个对」（两张同牌贴在一起）。"""
    b = jade_ground(MASTER)
    t = MASTER * .395
    place_tile(b, 'z6', MASTER * .378, MASTER * .432, t * .96, t * 1.22, rot=-9)
    place_tile(b, 'z6', MASTER * .622, MASTER * .572, t, t * 1.26, rot=7)
    seal(b, MASTER * .228, MASTER * .788, MASTER * .195, '对', rot=-8)
    return b


def icon_le():
    """C 单牌「乐」+ 红印章：牌面最大、最像「茶馆」的闲适，小尺寸也认得。"""
    b = jade_ground(MASTER)
    t = MASTER * .552
    place_tile(b, 'x2', MASTER * .478, MASTER * .468, t, t * 1.26, rot=-3)
    seal(b, MASTER * .752, MASTER * .770, MASTER * .208, '对', rot=-7)
    return b


def icon_fa():
    """D 单牌「發」+ 红印章：麻将最标志性的一个字，绿字象牙牌，远看也立得住。"""
    b = jade_ground(MASTER)
    t = MASTER * .552
    place_tile(b, 'z6', MASTER * .478, MASTER * .468, t, t * 1.26, rot=-3)
    seal(b, MASTER * .752, MASTER * .770, MASTER * .208, '对', rot=-7)
    return b


CANDS = [('A-three', icon_three), ('B-pair', icon_pair),
         ('C-le', icon_le), ('D-fa', icon_fa)]


def list_preview(rounded, name='快乐推麻对对消', sub='推一推，碰个对'):
    """把四个候选按微信列表里的真实尺寸摆出来——头像选型只能这么看。"""
    W, H = 660, 780
    bg = Image.new('RGBA', (W, H), rgba('#EDEDED'))
    d = ImageDraw.Draw(bg)
    f_name = ImageFont.truetype(FONT_SANS, 34)
    f_sub = ImageFont.truetype(FONT_SANS, 26)
    f_tip = ImageFont.truetype(FONT_SANS, 24)
    f_hint = ImageFont.truetype(FONT_SANS, 22)
    d.text((34, 26), '微信列表里的实际观感（图标 96px / 40px）', font=f_tip, fill=rgba('#5D6B52'), anchor='lm')

    top, row_h, icon = 70, 138, 96
    panel = Image.new('RGBA', (W - 40, row_h * 4 + 16), rgba('#FFFFFF'))
    pd = ImageDraw.Draw(panel)
    for i, (nm, _) in enumerate(CANDS):
        y = 8 + i * row_h
        ic = rounded[nm].resize((icon, icon), Image.LANCZOS)
        ic.putalpha(Image.composite(ic.getchannel('A'), Image.new('L', (icon, icon), 0),
                                    rmask(icon, icon, int(icon * .21))))
        panel.alpha_composite(ic, (30, y + (row_h - icon) // 2))
        pd.text((152, y + 46), name, font=f_name, fill=rgba('#1A1A1A'), anchor='lm')
        pd.text((152, y + 86), sub, font=f_sub, fill=rgba('#9A9A9A'), anchor='lm')
        pd.text((W - 40 - 30, y + 66), nm, font=f_hint, fill=rgba('#B8B8B8'), anchor='rm')
        if i < 3:
            pd.line([(30, y + row_h), (W - 40 - 30, y + row_h)], fill=rgba('#EDEDED'), width=2)
    bg.alpha_composite(panel, (20, top))

    # 搜索结果的 40px 档
    y = top + panel.height + 24
    d.text((34, y), '搜索结果 40px', font=f_tip, fill=rgba('#5D6B52'), anchor='lm')
    for i, (nm, _) in enumerate(CANDS):
        ic = rounded[nm].resize((40, 40), Image.LANCZOS)
        bg.alpha_composite(ic, (230 + i * 96, y - 20))
    bg.convert('RGB').save(os.path.join(OUT, 'icon-preview.png'))


def save_all():
    os.makedirs(OUT, exist_ok=True)
    rounded = {}
    for name, fn in CANDS:
        m = fn()
        # 512：圆角方 + 透明四角（微信「游戏图标」素材口径）
        cut = Image.new('RGBA', (MASTER, MASTER), (0, 0, 0, 0))
        cut.paste(m, (0, 0), rmask(MASTER, MASTER, int(MASTER * .21)))
        rounded[name] = cut
        cut.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'icon-{name}-512.png'))
        # 144：满幅（后台头像，圆角交给微信裁）
        m.resize((144, 144), Image.LANCZOS).save(os.path.join(OUT, f'icon-{name}-144.png'))

    # 对比图：四档缩略 + 标签（512 档用圆角版，才是微信里的真实观感）
    pad, cols = 26, len(CANDS)
    steps = [512, 144, 64, 40]
    cell_w = max(steps) + pad * 2
    sheet_h = pad + 40 + sum(s + pad for s in steps) + 20
    sheet = Image.new('RGBA', (cols * cell_w + pad, sheet_h), rgba('#F2F2F0'))
    sd = ImageDraw.Draw(sheet)
    lab = ImageFont.truetype(FONT_SANS, 22)
    small = ImageFont.truetype(FONT_SANS, 18)
    for i, (name, _) in enumerate(CANDS):
        x0 = pad + i * cell_w
        sd.text((x0 + cell_w / 2 - pad, pad + 8), name, font=lab, fill=rgba('#2B3A28'), anchor='mm')
        y = pad + 40
        for s in steps:
            src = rounded[name] if s == 512 else rounded[name]
            th = src.resize((s, s), Image.LANCZOS)
            sheet.alpha_composite(th, (int(x0 + (cell_w - pad * 2 - s) / 2), int(y)))
            sd.text((x0 + cell_w - pad - 4, y + s - 14), f'{s}px', font=small,
                    fill=rgba('#8A957E'), anchor='rs')
            y += s + pad
    sheet.convert('RGB').save(os.path.join(OUT, 'icon-sheet.png'))
    list_preview(rounded)
    print('written ->', OUT)
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print(f'  {f}  {os.path.getsize(p) / 1024:.1f} KB')


if __name__ == '__main__':
    save_all()
