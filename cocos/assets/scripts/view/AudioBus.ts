import {AudioClip, AudioSource, Node, resources, sys} from 'cc';
import type {Session} from '../core/Session';
import {hasIce} from '../core/Rules';

type Cue='tap'|'slide'|'match'|'combo'|'ice'|'bloom'|'charge'|'hint'|'undo'|'win'|'lose'|'ui';
const KEY='majiang-xiaoxiao:audio:v1';
/** Local audio only. A gesture unlocks playback; async loads cannot unmute an old cue. */
export class AudioBus {
  music=true;sound=true;
  private bg:AudioSource;
  private effects:AudioSource[]=[];
  private clips=new Map<string,Promise<AudioClip>>();
  private unlocked=false;private hidden=false;private disposed=false;
  private scene='home';private track='';private ticket=0;private epoch=0;
  private cursor=0;private last=new Map<string,number>();
  private moves=0;private marks=0;private charge=0;
  private failures=0;private played:Partial<Record<Cue,number>>={};
  get state(){return {music:this.music,sound:this.sound,unlocked:this.unlocked,hidden:this.hidden,track:this.track,playing:this.bg.playing,failures:this.failures,played:{...this.played}};}
  constructor(parent:Node){
    const make=()=>{const n=new Node('audio');parent.addChild(n);const a=n.addComponent(AudioSource);a.playOnAwake=false;return a;};
    this.bg=make();this.bg.loop=true;this.bg.volume=.28;
    for(let i=0;i<6;i++)this.effects.push(make());
    try{const p=JSON.parse(sys.localStorage.getItem(KEY)||'{}');this.music=p.music!==false;this.sound=p.sound!==false;}catch{/* Use defaults. */}
  }
  configure(music:boolean,sound:boolean){
    this.music=music;this.sound=sound;
    if(!sound){this.epoch++;this.effects.forEach(a=>a.stop());}
    if(!music){this.ticket++;this.bg.stop();this.track='';}else this.sync();
    try{sys.localStorage.setItem(KEY,JSON.stringify({music,sound}));}catch{/* Optional persistence. */}
  }
  unlock(){if(this.disposed)return;this.unlocked=true;this.sync();}
  setScene(scene:string){const next=scene==='board'||scene==='challenge'||scene==='win'||scene==='lose'||scene==='pause'?'board':'home';if(next!==this.scene){this.scene=next;this.sync();}this.bg.volume=scene==='win'||scene==='lose'||scene==='pause'?.10:.28;}
  visibility(hidden:boolean){
    this.hidden=hidden;this.epoch++;
    if(hidden){this.ticket++;this.bg.pause();this.effects.forEach(a=>a.stop());}
    else if(this.music&&this.unlocked){if(this.track==='bgm-'+this.scene)this.bg.play();else this.sync();}
  }
  private load(key:string){
    let p=this.clips.get(key);if(!p){p=new Promise<AudioClip>((resolve,reject)=>resources.load('audio/'+key,AudioClip,(err,clip)=>err?reject(err):resolve(clip)));this.clips.set(key,p);}
    return p;
  }
  private sync(){
    if(!this.unlocked||!this.music||this.hidden||this.disposed)return;
    const key='bgm-'+this.scene;if(this.track===key)return;
    const ticket=++this.ticket;
    void this.load(key).then(clip=>{if(this.disposed||this.hidden||!this.music||ticket!==this.ticket)return;this.bg.stop();this.bg.clip=clip;this.track=key;this.bg.play();}).catch(()=>{this.failures++;this.clips.delete(key);});
  }
  play(key:Cue){
    if(!this.unlocked||!this.sound||this.hidden||this.disposed)return;
    const now=Date.now();if(now-(this.last.get(key)||0)<75)return;this.last.set(key,now);const epoch=this.epoch;
    void this.load(key).then(clip=>{
      if(this.disposed||this.hidden||!this.sound||epoch!==this.epoch||Date.now()-now>1000)return;
      const a=this.effects[this.cursor++%this.effects.length];a.stop();a.clip=clip;a.volume=.7;a.play();this.played[key]=(this.played[key]||0)+1;
    }).catch(()=>{this.failures++;this.clips.delete(key);});
  }
  baseline(s:Session){this.moves=s.moves;this.marks=s.mechanics.marks.reduce((a,b)=>a+b,0);this.charge=s.mechanics.charge;}
  observe(s:Session){
    if(s.moves>this.moves){
      this.play(s.lastErased.some(p=>hasIce(p.face)||hasIce(p.other))?'ice':s.lastChain>1?'combo':s.lastErased.length?'match':'slide');
      if(s.mechanics.marks.reduce((a,b)=>a+b,0)>this.marks)this.play('bloom');
      if(s.mechanics.charge>=4&&this.charge<4)this.play('charge');
    }
    this.baseline(s);
  }
  dispose(){this.disposed=true;this.ticket++;this.epoch++;this.bg.stop();this.effects.forEach(a=>a.stop());this.clips.clear();}
}
