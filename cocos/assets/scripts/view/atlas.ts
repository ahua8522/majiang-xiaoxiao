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

export interface AtlasInfo {name: string; w: number; h: number; ok: boolean; error?: string; ink?: string}
const INFO: {impl: string; maxTexture: number; atlases: AtlasInfo[]; misses: string[]} = {
  impl: 'none', maxTexture: 0, atlases: [], misses: [],
};

/**
 * 把一块画布的倍率压进设备能吃的范围：单边不超过 `min(设备上限, 2048)`。
 *
 * 为什么连 2048 都要写死当二次上限：鸿蒙真机上牌桌整屏只剩文字、选关弹框却正常，
 * 差别就在牌桌会**懒加载第三张大图集**（牌面 2000x1860 + 场景 1128x3276 ≈ 30MB 显存）。
 * 那种"贴图集体消失"是 WebGL 上下文被回收的典型表现，而上下文丢失在 JS 侧不抛异常，
 * 只能一边降显存、一边装探针（见 watchContext）把它变成能读到的数字。
 */
export function fitScale(w: number, h: number, want: number): number {
  const cap = Math.min(maxTextureSize(), 2048);
  return Math.max(0.4, Math.min(want, cap / Math.max(w, h)));
}

/** 上下文丢失次数：真机上只要 >0，"贴图全不见"就有了确定解释。 */
let contextLost = 0;
let glError = '';

/** 装一次 WebGL 上下文探针（幂等）。 */
export function watchContext(): void {
  if (contextLost || glError) return;
  try {
    const canvas: any = (globalThis as any).cc?.game?.canvas;
    if (!canvas?.addEventListener || !canvas?.getContext) return;
    canvas.addEventListener('webglcontextlost', (e: any) => {
      contextLost++;
      glError = 'webglcontextlost';
      try { e.preventDefault?.(); } catch { /* 让引擎自己走恢复流程 */ }
    }, false);
    // 主动读一次 gl 错误码：尺寸超限这类问题在这里是静默的，只有 getError 会说。
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl?.getError) {
      const err = gl.getError();
      if (err) glError = 'glGetError=' + err;
    }
  } catch { /* 探针本身不能把游戏弄崩 */ }
}

/** 诊断快照：真机出问题时就靠这一格信息判断是画布、纹理上限还是缺帧。 */
export function atlasReport(): {impl: string; maxTexture: number; atlases: AtlasInfo[]; misses: string[]; contextLost: number; glError: string} {
  return {impl: INFO.impl, maxTexture: INFO.maxTexture, atlases: INFO.atlases.slice(), misses: INFO.misses.slice(0, 12), contextLost, glError};
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
   * **走 `getImageData` + `uploadData` 喂原始字节，而不是 `new ImageAsset(canvas)`**：
   * 鸿蒙真机日志给的正是这种组合——`ok:true`、`contextLost:0`、`glError:""`、场景图自检无异常，
   * 但屏上只有文字。也就是"引擎说传成功了，实际传上去是空的"。把像素自己读出来再上传，
   * 就绕开了引擎对 canvas 的处理，并且能顺便量出画布到底有没有画上东西（`ink`）。
   * 读不到像素（老基础库没有 getImageData）才退回 ImageAsset。
   */
  bake(): void {
    const w = this.canvas.width | 0;
    const h = this.canvas.height | 0;
    try {
      const tex = new Texture2D();
      const raw = this.rawPixels(w, h);
      if (raw) {
        tex.reset({width: w, height: h, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 1});
        tex.uploadData(raw);
      } else {
        tex.image = new ImageAsset(this.canvas);
      }
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

  /**
   * 读出画布像素，**按原样（自上而下）交给 uploadData**。
   * 实测：这里自己再做一次垂直翻转会把整屏画颠倒（牌面上下倒、木桌跑到屏幕顶上），
   * 也就是说引擎对裸字节数据源已经处理过行序，不需要调用方插手。
   * 同时统计不透明像素占比：`filled=0` 就是"2D 根本没画出来"，与"纹理上传失败"是两种病。
   */
  private rawPixels(w: number, h: number): Uint8Array | null {
    try {
      const ctx: any = this.ctx;
      if (!ctx.getImageData) return null;
      const src = ctx.getImageData(0, 0, w, h);
      if (!src || !src.data) return null;
      const d: Uint8ClampedArray = src.data;
      let filled = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) filled++;
      const rec = INFO.atlases.find((a) => a.name === this.tag);
      if (rec) rec.ink = `${Math.round(filled / (w * h) * 100)}%`;
      return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    } catch { return null; }
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