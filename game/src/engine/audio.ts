// All sound is synthesised with WebAudio: no audio files, nothing to license.

type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  private step = 0;
  private nextTime = 0;
  muted = false;
  musicOn = false;

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC() as Ctx;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    return this.ctx;
  }

  unlock() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, dest?: AudioNode) {
    const c = this.ensure();
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'bandpass') {
    const c = this.ensure();
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() {
    this.tone(1400, 0.12, 'square', 0.12, 220);
    this.tone(700, 0.09, 'sawtooth', 0.08, 120);
    this.noise(0.08, 0.25, 2600, 0.8);
  }
  correct() {
    this.tone(660, 0.1, 'triangle', 0.25);
    this.tone(990, 0.14, 'triangle', 0.22, undefined, 0.07);
    this.tone(1320, 0.22, 'triangle', 0.18, undefined, 0.14);
  }
  wrong() {
    this.tone(220, 0.25, 'sawtooth', 0.16, 110);
    this.tone(233, 0.25, 'square', 0.08, 115);
  }
  clank() {
    this.tone(1800, 0.06, 'square', 0.06, 900);
    this.noise(0.06, 0.18, 4000, 2);
  }
  powerDown() {
    this.tone(600, 0.9, 'sawtooth', 0.14, 40);
    this.noise(0.5, 0.35, 900, 0.7, 0.05, 'lowpass');
    this.tone(90, 0.5, 'sine', 0.35, 30, 0.3);
  }
  zap() {
    this.noise(0.35, 0.4, 1800, 3);
    this.tone(120, 0.3, 'sawtooth', 0.2, 60);
  }
  reload() {
    this.tone(500, 0.05, 'square', 0.08, 300);
    this.tone(900, 0.06, 'square', 0.08, 1200, 0.35);
  }
  step1() {
    this.noise(0.05, 0.05, 400, 1, 0, 'lowpass');
  }
  waveStart() {
    for (let i = 0; i < 3; i++) this.tone(330 + i * 110, 0.18, 'square', 0.1, undefined, i * 0.16);
    this.tone(880, 0.5, 'sawtooth', 0.08, 440, 0.5);
  }
  waveClear() {
    const notes = [523, 659, 784, 1046];
    for (let i = 0; i < notes.length; i++) this.tone(notes[i], 0.3, 'triangle', 0.2, undefined, i * 0.1);
  }
  victory() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    for (let i = 0; i < notes.length; i++) this.tone(notes[i], 0.35, 'triangle', 0.22, undefined, i * 0.13);
  }
  defeat() {
    const notes = [440, 392, 349, 262];
    for (let i = 0; i < notes.length; i++) this.tone(notes[i], 0.4, 'triangle', 0.18, undefined, i * 0.2);
  }
  ui() {
    this.tone(880, 0.05, 'square', 0.06, 1100);
  }

  /** Driving synthwave loop: bass + arpeggio, scheduled ahead with a look-ahead timer. */
  startMusic() {
    const c = this.ensure();
    if (!c || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = c.currentTime + 0.1;
    const bass = [55, 55, 65.4, 49];
    const arp = [0, 7, 12, 15, 12, 7, 3, 7];
    const tick = () => {
      if (!this.ctx || !this.musicOn || !this.musicGain) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const bar = Math.floor(this.step / 16) % 4;
        const s = this.step % 16;
        const root = bass[bar];
        const t0 = this.nextTime - this.ctx.currentTime;
        if (s % 2 === 0) this.tone(root, 0.2, 'sawtooth', 0.35, root * 0.98, t0, this.musicGain);
        const semi = arp[s % 8];
        this.tone(root * 4 * Math.pow(2, semi / 12), 0.12, 'square', 0.1, undefined, t0, this.musicGain);
        if (s % 4 === 0) this.tone(140, 0.12, 'sine', 0.6, 45, t0, this.musicGain);
        this.nextTime += 0.125;
        this.step++;
      }
    };
    this.musicTimer = window.setInterval(tick, 50);
  }

  stopMusic() {
    this.musicOn = false;
    window.clearInterval(this.musicTimer);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}
