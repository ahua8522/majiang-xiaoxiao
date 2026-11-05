/** 晴日花园背景，原生和 H5 共用；静态画面按可见尺寸缓存。 */
import {Ctx2D} from './art';
import {drawSunnyBackdrop} from './sunnyArt';
export function drawGarden(ctx:Ctx2D,w:number,h:number):void{drawSunnyBackdrop(ctx,w,h);}
