/**
 * 纹理烘焙：把 `art.ts` 画出来的离屏画布变成 cc 的 SpriteFrame。
 *
 * 这是「让引擎真正干活」的关键一步。之前每个图元都靠 Graphics 现算贝塞尔，牌桌 28 个 Graphics 层
 * = 28 个 draw call + 7MB 顶点缓冲；烘焙成图集后，**所有牌共用 1 张贴图、所有 UI 素材共用 1 张贴图**，
 * 合批之后整屏只剩个位数 draw call，一张牌只占 1 个四边形（4 顶点）。
 *
 * 平台差异只在这一层处理：微信小游戏没有 DOM，但适配层提供 `wx.createCanvas()`；
 * 浏览器侧用 `document.createElement('canvas')`。两边拿到的都是可上传的 canvas。
 */
import {ImageAsset, Rect, Size, SpriteFrame, Texture2D} from 'cc';
import {Ctx2D} from './art';

/** 取一个可以画 2D 的离屏画布（微信小游戏 / 浏览器 / 编辑器预览都覆盖）。 */
function makeCanvas(w: number, h: number): any {
  const g = globalThis as any;
  let canvas: any = null;
  try {
    if (g.wx?.createCanvas) canvas = g.wx.createCanvas();
  } catch { /* 不是小游戏环境 */ }
  if (!canvas && g.document?.createElement) canvas = g.document.createElement('canvas');
  if (!canvas) throw new Error('当前环境没有可用的离屏画布（既没有 wx.createCanvas 也没有 document.createElement）');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
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

  constructor(readonly width: number, readonly height: number) {
    this.canvas = makeCanvas(width, height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('离屏画布没有 2D context');
    this.ctx = ctx as Ctx2D;
  }

  /** 直接用 2D context 画（调用方负责落在分配好的区域内）。 */
  get context(): Ctx2D { return this.ctx; }

  /** 登记一个已画好的子区域。 */
  region(name: string, r: Region): void {
    this.regions.set(name, r);
  }

  /** 把画布上传成纹理。所有 `frame()` 必须在 `bake()` 之后调用。 */
  bake(): void {
    const image = new ImageAsset(this.canvas);
    const tex = new Texture2D();
    tex.image = image;
    tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    tex.setMipFilter(Texture2D.Filter.NONE);
    this.texture = tex;
    this.frames.clear();
  }

  /**
   * 取某个子区域的 SpriteFrame（共享同一张纹理 → 可合批）。
   *
   * ⚠️ 查不到是**抛异常**：调用方要么保证名字登记过，要么先用 `has()` 兜底。
   * （牌面走 `TileAtlas.face()`，那里有兜底 —— 未登记的牌面绝不能再把整帧炸掉。）
   */
  frame(name: string): SpriteFrame {
    const hit = this.frames.get(name);
    if (hit) return hit;
    const r = this.regions.get(name);
    if (!r || !this.texture) throw new Error(`图集里没有 ${name}（或还没 bake）`);
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