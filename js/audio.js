const AudioFx = {
  ctx: null,
  muted: false,
  moving: false,
  motor: null,
  bgmOn: false,
  step: 0,
  lastBgm: 0,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  setMuted(flag) {
    this.muted = flag;
    if (flag) this.stopMotor();
  },

  master(gain) {
    const g = this.ctx.createGain();
    g.gain.value = this.muted ? 0 : gain;
    g.connect(this.ctx.destination);
    return g;
  },

  tone(freq, dur, type, gain, slide) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.master(gain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise(dur, gain, hp) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp || 600;
    const g = this.master(gain);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + dur);
  },

  coin() {
    this.tone(880, 0.08, "square", 0.05);
    this.tone(1320, 0.12, "square", 0.04);
  },

  grab() {
    this.noise(0.08, 0.04, 400);
    this.tone(220, 0.1, "triangle", 0.05, 140);
  },

  close() {
    this.tone(180, 0.09, "square", 0.045);
    this.noise(0.06, 0.035, 900);
  },

  slip() {
    this.tone(320, 0.22, "sawtooth", 0.04, 90);
    this.noise(0.12, 0.03, 300);
  },

  strain() {
    this.tone(140, 0.08, "sawtooth", 0.02, 90);
    this.noise(0.05, 0.015, 500);
  },

  win() {
    this.tone(523, 0.12, "triangle", 0.055);
    setTimeout(() => this.tone(659, 0.12, "triangle", 0.055), 90);
    setTimeout(() => this.tone(784, 0.12, "triangle", 0.055), 180);
    setTimeout(() => this.tone(1046, 0.22, "triangle", 0.06), 280);
  },

  bump() {
    this.noise(0.04, 0.02, 200);
  },

  over() {
    this.tone(392, 0.18, "triangle", 0.04, 220);
    setTimeout(() => this.tone(294, 0.28, "triangle", 0.04, 160), 160);
  },

  startMotor() {
    if (!this.ctx || this.muted || this.motor) return;
    const osc = this.ctx.createOscillator();
    const g = this.master(0.018);
    osc.type = "sawtooth";
    osc.frequency.value = 78;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 240;
    osc.connect(f);
    f.connect(g);
    osc.start();
    this.motor = { osc, g };
  },

  stopMotor() {
    if (!this.motor) return;
    try {
      this.motor.osc.stop();
    } catch (_) {
      /* already stopped */
    }
    this.motor = null;
  },

  tickBgm(now) {
    if (!this.ctx || this.muted || !this.bgmOn) return;
    if (now - this.lastBgm < 280) return;
    this.lastBgm = now;
    const scale = [523, 587, 659, 784, 880, 784, 659, 587];
    this.tone(scale[this.step % scale.length], 0.18, "sine", 0.018);
    this.step += 1;
  },
};
