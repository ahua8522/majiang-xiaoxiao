/** Audio sketch for the design preview. Production Cocos integration is still planned. */
type Scene = 'home' | 'board';
export type Cue = 'tap' | 'slide' | 'match' | 'combo' | 'ice' | 'bloom' | 'charge' | 'hint' | 'undo' | 'win' | 'lose' | 'ui';
type Voice = {source: AudioBufferSourceNode; gain: GainNode; key: string};
declare const AUDIO_ASSETS: Record<string, string>;

export class SoundStudy {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private voice: Voice | null = null;
  private effects = new Set<AudioBufferSourceNode>();
  private scene: Scene = 'home';
  private musicOn = true;
  private soundOn = true;
  private generation = 0;
  private effectEpoch = 0;
  private lastCue = new Map<string, number>();
  private ducked = false;
  private hidden = false;
  private failures = 0;
  private played: Partial<Record<Cue, number>> = {};
  private musicStarts = 0;

  get state() {return {context: this.ctx?.state || 'locked', music: this.musicOn, sound: this.soundOn, track: this.voice?.key || null, effects: this.effects.size, failures: this.failures, played: {...this.played}, musicStarts: this.musicStarts, ducked: this.ducked};}

  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 3;
        this.bus = this.ctx.createGain(); this.bus.gain.value = .75;
        this.bus.connect(compressor); compressor.connect(this.ctx.destination);
      }
      if (!this.hidden && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      if (!this.voice && this.musicOn) this.syncMusic();
    } catch {this.failures++;}
  }

  configure(music: boolean, sound: boolean): void {
    const musicChanged = this.musicOn !== music;
    this.musicOn = music; this.soundOn = sound;
    if (!sound) {
      this.effectEpoch++;
      this.effects.forEach(source => {try {source.stop();} catch {}});
      this.effects.clear();
    }
    if (musicChanged) this.syncMusic();
  }

  setScene(scene: Scene): void {if (scene !== this.scene) {this.scene = scene; this.syncMusic();}}

  duck(value: boolean): void {
    this.ducked = value;
    if (!this.voice || !this.ctx) return;
    const g = this.voice.gain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(value ? .10 : .38, this.ctx.currentTime, .12);
  }

  visibility(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) {
      this.effectEpoch++;
      this.effects.forEach(source => {try {source.stop();} catch {}});
      this.effects.clear();
      void this.ctx.suspend().catch(() => {});
    } else {void this.ctx.resume().catch(() => {}); this.syncMusic();}
  }

  private buffer(key: string): Promise<AudioBuffer> {
    if (!this.buffers.has(key)) {
      const data = AUDIO_ASSETS[key];
      if (!data || !this.ctx) return Promise.reject(new Error('Audio unavailable'));
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const pending = this.ctx.decodeAudioData(bytes.buffer).catch(error => {this.buffers.delete(key); throw error;});
      this.buffers.set(key, pending);
    }
    return this.buffers.get(key)!;
  }

  private retire(voice: Voice | null): void {
    if (!voice || !this.ctx) return;
    const t = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, .10);
    try {voice.source.stop(t + .4);} catch {}
    voice.source.onended = () => {voice.source.disconnect(); voice.gain.disconnect();};
  }

  private syncMusic(): void {
    const ticket = ++this.generation;
    if (!this.musicOn) {this.retire(this.voice); this.voice = null; return;}
    if (!this.ctx || this.hidden) return;
    const key = 'bgm-' + this.scene;
    if (this.voice?.key === key) return;
    void this.buffer(key).then(buffer => {
      if (ticket !== this.generation || !this.musicOn || this.hidden || !this.ctx) return;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = Math.min(48, buffer.duration);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.ducked ? .10 : .38, this.ctx.currentTime + .45);
      source.connect(gain); gain.connect(this.bus!);
      this.retire(this.voice); this.voice = {source, gain, key}; source.start(); this.musicStarts++;
    }).catch(() => {this.failures++;});
  }

  play(key: Cue): void {
    if (!this.ctx || !this.soundOn || this.hidden) return;
    const now = performance.now();
    if (now - (this.lastCue.get(key) ?? -1000) < 75) return;
    this.lastCue.set(key, now);
    const epoch = this.effectEpoch;
    void this.buffer(key).then(buffer => {
      // An old load must not sound after the user muted effects or left the page.
      if (!this.ctx || !this.soundOn || this.hidden || epoch !== this.effectEpoch || this.effects.size >= 6 || performance.now() - now > 1000) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer; source.connect(this.bus!); this.effects.add(source);
      source.onended = () => {this.effects.delete(source); source.disconnect();}; source.start();
      this.played[key] = (this.played[key] || 0) + 1;
    }).catch(() => {this.failures++;});
  }
}
