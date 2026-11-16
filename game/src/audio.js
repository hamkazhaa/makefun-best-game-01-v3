// Every sound in Harbour Line is synthesised with WebAudio: no audio
// files, no network, just oscillators and filtered noise.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, cutoff, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t0);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shot(pitch = 520, heavy = false) {
    this._noise(heavy ? 0.22 : 0.12, heavy ? 0.9 : 0.55, heavy ? 2400 : 3600, 300);
    this._tone(pitch, 0.09, 'square', 0.16, pitch * 0.4);
  }

  dryClick() {
    this._tone(1400, 0.03, 'square', 0.1);
  }

  reload() {
    this._tone(900, 0.04, 'square', 0.12);
    setTimeout(() => this._tone(620, 0.05, 'square', 0.12), 160);
  }

  hit() {
    this._tone(1900, 0.05, 'sine', 0.2);
  }

  kill() {
    this._tone(880, 0.07, 'sine', 0.2);
    setTimeout(() => this._tone(1320, 0.1, 'sine', 0.2), 80);
  }

  hurt() {
    this._tone(220, 0.12, 'sawtooth', 0.14, 110);
  }

  step() {
    this._noise(0.05, 0.05, 700, 200);
  }

  plantBeep(final = false) {
    this._tone(final ? 1500 : 1050, final ? 0.3 : 0.09, 'sine', 0.22);
  }

  defuseBeep() {
    this._tone(760, 0.08, 'sine', 0.18);
  }

  explosion() {
    this._noise(0.9, 1.0, 900, 60);
    this._tone(90, 0.7, 'sine', 0.5, 32);
  }

  horn() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    [174, 220, 261].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.11, t0 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    });
  }

  winJingle() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.2), i * 110));
  }

  buyClick() {
    this._tone(1200, 0.04, 'triangle', 0.15);
  }

  denied() {
    this._tone(180, 0.14, 'square', 0.14, 120);
  }
}
