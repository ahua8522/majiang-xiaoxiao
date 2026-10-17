/**
 * 纹理烘焙：把 `art.ts` 画出来的离屏画布变成 cc 的 SpriteFrame。
 *
 * 这是「让引擎真正干活」的关键一步。之前每个图元都靠 Graphics 现算贝塞尔，牌桌 28 个 Graphics 层
 * = 28 个 draw call + 7MB 顶点缓冲；烘焙成图集后，**所有牌共用 1 张贴图、所有 UI 素材共用 1 张贴图**，
 * 合批之后整屏只剩个位数 draw call，一张牌只占 1 个四边形（4 顶点）。
 *
 * 平台差异只在这一层处理。**只能用 `wx.createOffscreenCanvas`，绝不能用 `wx.createCanvas`**：
 * 小游戏里第一次 `wx.createCanvas()` 返回的是**主画布**，改它的宽高并请求 2d 上下文会让主画布的
 * WebGL 上下文失效（README「硬约束」第 3 条、`build-templates/wechatgame/first-screen.js` 同段注释）。
 * 华为鸿蒙真机上就是这个症状：Label 全在、所有生成贴图全不见。
 */
import {ImageAsset, Rect, Size, SpriteFrame, Texture2D} from 'cc';
import {Ctx2D} from './art';

/** 向上取到 4 的倍数：WebGL 默认 UNPACK_ALIGNMENT=4，非 4 倍行宽会让 texImage2D 错位。 */
const align4 = (n: number) => Math.max(2, Math.ceil(n / 4) * 4);

export interface AtlasInfo {name: string; w: number; h: number; ok: boolean; error?: string}
const INFO: {impl: string; maxTexture: number; atlases: AtlasInfo[]; misses: string[]} = {
  impl: 'none', maxTexture: 0, atlases: [], misses: [],
};

/** 诊断快照：真机出问题时就靠这一格信息判断是画布、纹理上限还是缺帧。 */
export function atlasReport(): {impl: string; maxTexture: number; atlases: AtlasInfo[]; misses: string[]} {
  return {impl: INFO.impl, maxTexture: INFO.maxTexture, atlases: INFO.atlases.slice(), misses: INFO.misses.slice(0, 12)};
}

/**
 * 这台机器的纹理边长上限。查不到就按 2048 保守取——超上限的纹理在部分 GPU 上不是变糊，
 * 而是**整张画不出来**（贴图静默消失），正是鸿蒙那台的表现。
 */
export function maxTextureSize(): number {
  if (INFO.maxTexture) return INFO.maxTexture;
  let cap = 0;
  try {
    const canvas: any = (globalThis as any).cc?.game?.canvas;
    const gl = canvas?.getContext?.('webgl2') || canvas?.getContext?.('webgl');
    if (gl?.getParameter) cap = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
  } catch { /* 拿不到就当未知 */ }
  if (!cap) {
    // 引擎 3.8 的类型里没有公开的"纹理上限"接口（查过 cc.d.ts：没有 getMaxTextureSize），
    // 所以查不到就保守取 2048，而不是当成无限制。
    INFO.maxTexture = 2048;
    return INFO.maxTexture;
  }
  INFO.maxTexture = cap;
  return cap;
}

/** 取一个可以画 2D 的离屏画布（微信小游戏 / 浏览器 / 编辑器预览都覆盖）。 */
function makeCanvas(w: number, h: number): any {
  const g = globalThis as any;
  const W = align4(w);
  const H = align4(h);
  let canvas: any = null;
  try {
    if (g.wx?.createOffscreenCanvas) {
      try { canvas = g.wx.createOffscreenCanvas({type: '2d', width: W, height: H}); }
      catch { canvas = g.wx.createOffscreenCanvas(); }        // 老基础库只认无参形式
      if (canvas) INFO.impl = 'wx.createOffscreenCanvas';
    }
  } catch { /* 不是小游戏环境 */ }
  if (!canvas && g.document?.createElement) {
    canvas = g.document.createElement('canvas');
    INFO.impl = 'document.createElement';
  }
  if (!canvas) throw new Error('当前环境没有可用的离屏画布（wx.createOffscreenCanvas 与 document.createElement 都没有）');
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

export interface Region {x: number; y: number; w: number; h: number}

/** 一张图集：一块画布 + 烘焙后的 Texture2D，以及按名字索引的子区域。 */
export class Atlas {
  private canvas: any;
  private ctx: Ctx2D;
  private texture: Texture2D | null = null;
  private regions = new Map<string, Region>();
  private frames = new Map<string, SpriteFrame>();
  private tag = '';

  constructor(readonly width: number, readonly height: number) {
    this.tag = `atlas ${width}x${height}`;
    this.canvas = makeCanvas(width, height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('离屏画布没有 2D context');
    this.ctx = ctx as Ctx2D;
    INFO.atlases.push({name: this.tag, w: this.canvas.width, h: this.canvas.height, ok: false});
  }

  /** 直接用 2D context 画（调用方负责落在分配好的区域内）。 */
  get context(): Ctx2D { return this.ctx; }

  /** 登记一个已画好的子区域。 */
  region(name: string, r: Region): void {
    this.regions.set(name, r);
  }

  /**
   * 把画布上传成纹理。所有 `frame()` 必须在 `bake()` 之后调用。
   *
   * 这里**不抛**：上传失败只记进诊断并让 `frame()` 走兜底帧。以前 bake/frame 一抛，
   * `update → render` 没有 try/catch，整屏就只剩文字（鸿蒙真机就是这么表现的）。
   */
  bake(): void {
    try {
      const image = new ImageAsset(this.canvas);
      const tex = new Texture2D();
      tex.image = image;
      tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
      tex.setMipFilter(Texture2D.Filter.NONE);
      this.texture = tex;
      this.frames.clear();
      const rec = INFO.atlases.find((a) => a.name === this.tag);
      if (rec) rec.ok = true;
    } catch (e) {
      const rec = INFO.atlases.find((a) => a.name === this.tag);
      if (rec) { rec.ok = false; rec.error = String((e as Error)?.message || e); }
    }
  }

  /** 兜底帧：4x4 纯白，能被 `Sprite.color` 染色，所以最坏情况是"色块 UI"而不是空白。 */
  private static blank: SpriteFrame | null = null;
  private static blankFrame(): SpriteFrame | null {
    if (Atlas.blank) return Atlas.blank;
    try {
      const c = makeCanvas(4, 4);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 4, 4);
      const tex = new Texture2D();
      tex.image = new ImageAsset(c);
      const f = new SpriteFrame();
      f.texture = tex;
      Atlas.blank = f;
    } catch { return null; }
    return Atlas.blank;
  }

  /**
   * 取某个子区域的 SpriteFrame（共享同一张纹理 → 可合批）。
   *
   * 查不到**不再抛异常**：记一次 miss 并返回纯色兜底帧。牌面那条路径（`TileAtlas.face()`）
   * 本来就有 z7 兜底，这里补齐其余素材——一个名字写错不该让整屏不再绘制。
   */
  frame(name: string): SpriteFrame {
    const hit = this.frames.get(name);
    if (hit) return hit;
    const r = this.regions.get(name);
    if (!r || !this.texture) {
      if (INFO.misses.indexOf(name) < 0) INFO.misses.push(name);
      return Atlas.blankFrame() || new SpriteFrame();
    }
    const f = new SpriteFrame();
    f.texture = this.texture;
    f.rect = new Rect(r.x, r.y, r.w, r.h);
    f.originalSize = new Size(r.w, r.h);
    f.packable = false;
    this.frames.set(name, f);
    return f;
  }

  /**
   * 释放纹理。`Texture2D` 占的是**显存**，GC 收不掉：微信小游戏（尤其低配安卓机）显存吃紧时
   * 表现就是黑屏 / 只画出部分牌。所以**替换纹理之前必须先 dispose 旧的**，
   * 光把引用置空（`this.texture = null`）等于什么都没释放。
   */
  dispose(): void {
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }
    this.frames.clear();
  }

  has(name: string): boolean { return this.regions.has(name); }
}