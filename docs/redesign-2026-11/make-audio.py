"""Original score and synthesized audio studies, with no external samples.
Requires the available numpy/scipy and ffmpeg. WAV masters stay in ignored temp/.
"""
from pathlib import Path
import json
import math
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent/'audio'
WORK=ROOT/'temp'/'audio-masters'
OUT.mkdir(exist_ok=True)
WORK.mkdir(parents=True,exist_ok=True)
SR=32000
RNG=np.random.default_rng(20261105)
manifest={}

def freq(midi): return 440*2**((midi-69)/12)

def note(midi,seconds=1.6,kind='felt'):
    t=np.arange(round(seconds*SR))/SR
    f=freq(midi)
    attack=1-np.exp(-t/(.012 if kind=='felt' else .0035))
    if kind=='felt':
        y=sum(a*np.sin(2*np.pi*f*k*t+phase)*np.exp(-t/(1.15/(k**.34))) for k,a,phase in [(1,1,0),(2,.24,.2),(3,.10,.4),(4,.035,.1)])
        y+=.04*np.sin(2*np.pi*f*1.003*t)*np.exp(-t/.5)
    elif kind=='bass':
        y=(np.sin(2*np.pi*f*t)+.15*np.sin(4*np.pi*f*t))*np.exp(-t/.6)
    else:
        y=(np.sin(2*np.pi*f*t)*np.exp(-t/.45)+.15*np.sin(2*np.pi*f*2.002*t)*np.exp(-t/.13))
    tail=np.minimum(1,np.maximum(0,(seconds-t)/.075))
    return y*attack*tail*.35

def place(buf,y,seconds,amp=1,pan=0,wrap=False):
    stereo=np.column_stack((y*np.sqrt((1-pan)/2),y*np.sqrt((1+pan)/2)))*amp if y.ndim==1 else y*amp
    start=round(seconds*SR)
    if wrap:
        idx=(start+np.arange(len(stereo)))%len(buf)
        np.add.at(buf,idx,stereo)
    else:
        n=min(len(stereo),len(buf)-start)
        if n>0:buf[start:start+n]+=stereo[:n]

def room(buf,loop=False):
    wet=np.zeros_like(buf)
    for sec,gain in [(.057,.10),(.109,.07),(.181,.035)]:
        delay=round(sec*SR)
        delayed=np.roll(buf[:,::-1],delay,axis=0)
        if not loop:delayed[:delay]=0
        wet+=sosfilt(butter(1,2200,fs=SR,output='sos'),delayed,axis=0)*gain
    return buf+wet

def finish(y,target_db=-25,peak_db=-5,loop=False):
    y=room(y,loop)
    y-=np.mean(y,axis=0)
    rms=np.sqrt(np.mean(y*y))
    y*=10**(target_db/20)/max(rms,1e-8)
    y*=min(1,10**(peak_db/20)/max(np.max(np.abs(y)),1e-8))
    if not loop:
        ramp=np.linspace(0,1,min(256,len(y)//2))
        y[:len(ramp)]*=ramp[:,None];y[-len(ramp):]*=ramp[::-1,None]
    return y.astype(np.float32)

def save(key,title,y,kind,loop=False):
    wav=WORK/(key+'.wav')
    pcm=(np.clip(y,-1,1)*32767).astype('<i2')
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
    dst=OUT/(key+'.mp3')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','80k' if kind=='music' else '96k','-ar','32000',str(dst)],check=True)
    manifest[key]={'title':title,'kind':kind,'file':dst.name,'duration':round(len(y)/SR,3),'loop':loop,'bytes':dst.stat().st_size,'peakDbfs':round(float(20*np.log10(max(np.max(np.abs(y)),1e-9))),2),'rmsDbfs':round(float(20*np.log10(max(np.sqrt(np.mean(y*y)),1e-9))),2)}
    return y

# 16 bars, 4/4, 80 BPM. A shared D-major palette makes room/board changes coherent.
CHORDS=[[50,57,61,66],[49,57,59,64],[47,54,57,62],[43,50,54,59],
        [50,57,61,66],[49,57,59,64],[52,55,59,62],[45,52,57,61],
        [47,54,57,62],[43,50,54,59],[50,57,61,66],[49,57,59,64],
        [52,55,59,62],[45,52,57,61],[43,50,54,59],[45,52,57,61]]
MELODY=[[74,78,76,73],[76,73,71,69],[74,73,71,66],[71,69,66,69],
        [74,78,81,78],[76,73,71,73],[76,79,78,74],[73,71,69,73],
        [74,78,76,74],[71,74,73,69],[74,76,78,81],[78,76,73,71],
        [76,74,71,67],[73,76,74,71],[69,71,74,71],[73,71,69,73]]

def music(board=False):
    beat=.75;buf=np.zeros((round(48*SR),2))
    for bar,chord in enumerate(CHORDS):
        for i,pitch in enumerate(chord):
            place(buf,note(pitch+12,2.4),bar*3+i*.08,.18 if board else .21,(i-1.5)*.10,True)
        for at in [0,2]:place(buf,note(chord[0],1.4,'bass'),bar*3+at*beat,.26,0,True)
        arp=[chord[1]+12,chord[2]+12,chord[3]+12,chord[2]+12]
        for i,pitch in enumerate(arp):
            place(buf,note(pitch,1.0,'mallet'),bar*3+(i+.5)*beat,.055 if board else .08,(-1)**i*.18,True)
        for i,pitch in enumerate(MELODY[bar]):
            if board and (bar%4 in [1,3] or i not in [0,2]):continue
            if not board and bar in [3,7,11,15] and i==3:continue
            place(buf,note(pitch-12 if board else pitch,1.5),bar*3+i*beat,.16 if board else .23,.04,True)
    return finish(buf,-27 if board else -25,loop=True)

def tile_hit(seconds=.16,tone=1):
    t=np.arange(round(seconds*SR))/SR
    noise=sosfilt(butter(2,[700,6500],btype='bandpass',fs=SR,output='sos'),RNG.normal(0,1,len(t)))
    resonances=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t/d) for f,a,d in [(910*tone,.36,.018),(2120*tone,.25,.011),(3860*tone,.16,.006)])
    return (noise*.20*np.exp(-t/.006)+resonances)*(1-np.exp(-t/.0008))

def cue(key):
    duration={'tap':.16,'slide':.23,'match':.42,'combo':.75,'ice':.42,'bloom':.80,'charge':.85,'hint':.65,'undo':.30,'win':1.8,'lose':1.25,'ui':.12}[key]
    buf=np.zeros((round(duration*SR),2))
    if key in ['tap','ui','match','combo','undo']:
        place(buf,tile_hit(tone=.95),0,.8 if key=='tap' else .5,-.06)
        if key in ['match','combo','undo']:place(buf,tile_hit(tone=1.08),.055,.6,.08)
        if key=='combo':
            for i,n in enumerate([74,78,81]):place(buf,note(n,.48,'mallet'),.12+i*.09,.13,.07)
        if key=='undo':place(buf,tile_hit(tone=.8),.14,.22)
    elif key=='slide':
        t=np.arange(len(buf))/SR
        y=sosfilt(butter(2,[250,2300],btype='bandpass',fs=SR,output='sos'),RNG.normal(0,1,len(t)))
        place(buf,y*np.sin(np.pi*t/duration)**2,0,.04)
        place(buf,tile_hit(tone=.9),.15,.24)
    elif key=='ice':
        for i in range(4):
            n=round(.09*SR);t=np.arange(n)/SR
            y=sosfilt(butter(2,[1800,7000],btype='bandpass',fs=SR,output='sos'),RNG.normal(0,1,n))*np.exp(-t/.018)
            place(buf,y,.025*i,.08,(-1)**i*.18)
        place(buf,note(86,.35,'mallet'),.05,.065)
    else:
        sequence={'bloom':[74,78,81],'charge':[69,74,78,81],'hint':[74,81], 'win':[74,78,81,86], 'lose':[71,69]}[key]
        spacing={'win':.19,'lose':.24,'hint':.14}.get(key,.10)
        for i,n in enumerate(sequence):place(buf,note(n,duration-i*spacing,'felt' if key in ['win','lose'] else 'mallet'),i*spacing,.32 if key=='win' else .16)
    return finish(buf,-25 if key in ['tap','ui','slide'] else -23,peak_db=-7)

home=save('bgm-home','晴日小憩 · 首页',music(), 'music',True)
board=save('bgm-board','轻轻推一推 · 对局',music(True),'music',True)
names={'tap':'选牌','slide':'推移落位','match':'同牌消除','combo':'连续消除','ice':'破冰','bloom':'花圃开放','charge':'灵感充满','hint':'提示','undo':'撤销','win':'通关','lose':'暂未完成','ui':'界面轻点'}
effects={k:save(k,v,cue(k),'effect') for k,v in names.items()}
# A short listening study: a little of both scores, then a quiet demonstration of cues.
demo=np.zeros((round(30*SR),2))
intro=home[:round(12.5*SR)].copy();body=board[:18*SR].copy()
blend=round(.5*SR)
intro[-blend:]*=np.linspace(1,0,blend)[:,None]
body[:blend]*=np.linspace(0,1,blend)[:,None]
place(demo,intro,0,.75);place(demo,body,12,.7)
for i,key in enumerate(['tap','slide','match','ice','bloom','charge','win']):place(demo,effects[key],14+i*2,.75)
demo[:round(.25*SR)]*=np.linspace(0,1,round(.25*SR))[:,None]
demo[-round(.8*SR):]*=np.linspace(1,0,round(.8*SR))[:,None]
save('listening-study','30 秒音乐与音效试听',finish(demo,-23,peak_db=-4),'study')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(manifest),'totalBytes':sum(v['bytes'] for v in manifest.values()),'musicSeconds':48,'origin':'original code score and synthesized effects'},ensure_ascii=False))
