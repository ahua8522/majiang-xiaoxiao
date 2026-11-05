/** H5 uses the same daylit garden painting as the Cocos game. */
import {drawGarden} from '../../../cocos/assets/scripts/view/garden';
const cache=new Map<string,HTMLCanvasElement>();
export function gardenBg(w:number,h:number){
 const key=Math.round(w)+'x'+Math.round(h);let c=cache.get(key);
 if(!c){c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);drawGarden(c.getContext('2d')!,c.width,c.height);cache.set(key,c);if(cache.size>6)cache.delete(cache.keys().next().value!);}
 return c;
}
