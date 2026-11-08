'use strict';
// Local procedural ambience with a bundled CC0 laugh recording.
class SpookyAmbience {
  constructor(context) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(context.destination);
    this.nodes = new Set();
    this.active = false;
    this.volume = 20;
    this.duckUntil = 0;
  }
  async loadLaugh() {
    if (this.laughBuffer) return;
    const response = await fetch('audio/risada-maligna.mp3');
    if (!response.ok) throw new Error('Não foi possível carregar a risadinha.');
    this.laughBuffer = await this.context.decodeAudioData(await response.arrayBuffer());
  }
  scheduleLaugh(delay = 14000 + Math.random() * 14000) {
    this.laughTimer = setTimeout(() => {
      if (!this.active) return;
      this.laugh();
      this.scheduleLaugh();
    }, delay);
  }
  laugh() {
    if (!this.active || !this.laughBuffer) return;
    const ctx = this.context, now = ctx.currentTime;
    const voice = this.track(ctx.createBufferSource());
    voice.buffer = this.laughBuffer;
    voice.playbackRate.value = .8 + Math.random() * .18;
    const duration = Math.min(3.5, this.laughBuffer.duration / voice.playbackRate.value);
    const level = ctx.createGain();
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(.15, now + .25);
    level.gain.setValueAtTime(.15, now + Math.max(.25, duration - .65));
    level.gain.linearRampToValueAtTime(0, now + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1600;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() < .5 ? -.65 : .65;
    const echo = ctx.createDelay(); echo.delayTime.value = .28;
    const reflection = ctx.createGain(); reflection.gain.value = .25;
    voice.connect(level).connect(filter).connect(pan).connect(this.output);
    pan.connect(echo).connect(reflection).connect(this.output);
    voice.onended = () => {
      this.nodes.delete(voice); voice.disconnect();
      const cleanup = setTimeout(() => {
        level.disconnect(); filter.disconnect(); pan.disconnect(); echo.disconnect(); reflection.disconnect();
        this.cleanupTimers.delete(cleanup);
      }, 400);
      this.cleanupTimers.add(cleanup);
    };
    voice.start(now);
    voice.stop(now + duration);
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(100, Number(value)));
    this.updateGain();
  }
  updateGain() {
    const now = this.context.currentTime;
    const ducked = now < this.duckUntil;
    this.output.gain.setTargetAtTime(this.active ? this.volume / 100 * (ducked ? .16 : 1) : 0, now, .15);
  }
  duck(seconds) {
    if (!this.active) return;
    this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + seconds);
    this.updateGain();
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => this.updateGain(), (this.duckUntil - this.context.currentTime) * 1000 + 50);
  }
  track(node) {
    this.nodes.add(node);
    node.onended = () => { this.nodes.delete(node); node.disconnect(); };
    return node;
  }
  start() {
    if (this.active) return;
    this.active = true;
    const ctx = this.context;
    const noise = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      low = (low + (Math.random() * 2 - 1) * .025) / 1.025;
      data[i] = low * 3;
    }
    const wind = this.track(ctx.createBufferSource());
    wind.buffer = noise;
    wind.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 460;
    const windGain = ctx.createGain();
    windGain.gain.value = .018;
    wind.connect(filter).connect(windGain).connect(this.output);
    wind.onended = () => { this.nodes.delete(wind); wind.disconnect(); filter.disconnect(); windGain.disconnect(); };
    wind.start();
    // Quiet beating drones keep a low bed underneath sparse distant sounds.
    for (const frequency of [61, 62.3, 91.7]) {
      const tone = this.track(ctx.createOscillator());
      tone.frequency.value = frequency;
      const level = ctx.createGain();
      level.gain.value = .014;
      tone.connect(level).connect(this.output);
      tone.onended = () => { this.nodes.delete(tone); tone.disconnect(); level.disconnect(); };
      tone.start();
    }
    this.updateGain();
    this.schedule(1600);
    this.scheduleLaugh(5000 + Math.random() * 3000);
  }
  schedule(delay = 4000 + Math.random() * 6000) {
    this.timer = setTimeout(() => {
      if (!this.active) return;
      this.distantSound();
      this.schedule();
    }, delay);
  }
  distantSound() {
    const ctx = this.context;
    const now = ctx.currentTime;
    const duration = 2.5 + Math.random() * 3;
    const creak = Math.random() < .55;
    const oscillator = this.track(ctx.createOscillator());
    oscillator.type = creak ? 'triangle' : 'sine';
    const base = creak ? 140 + Math.random() * 150 : 430 + Math.random() * 250;
    oscillator.frequency.setValueAtTime(base, now);
    oscillator.frequency.exponentialRampToValueAtTime(base * .65, now + duration);
    const flutter = this.track(ctx.createOscillator());
    flutter.frequency.value = creak ? 13 : .7;
    const modulation = ctx.createGain();
    modulation.gain.value = creak ? 14 : 25;
    flutter.connect(modulation).connect(oscillator.frequency);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(creak ? .12 : .09, now + .7);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - .8;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    oscillator.connect(envelope).connect(lowpass).connect(panner).connect(this.output);
    // One dark reflection makes each sound feel farther from the listener.
    const delay = ctx.createDelay();
    delay.delayTime.value = .23;
    const reflection = ctx.createGain();
    reflection.gain.value = .28;
    panner.connect(delay).connect(reflection).connect(this.output);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      // Keep the last reflection alive, then release the graph.
      const cleanup = setTimeout(() => {
        envelope.disconnect(); lowpass.disconnect(); panner.disconnect(); delay.disconnect(); reflection.disconnect(); modulation.disconnect();
        this.cleanupTimers.delete(cleanup);
      }, 400);
      this.cleanupTimers.add(cleanup);
    };
    oscillator.start(now); flutter.start(now);
    oscillator.stop(now + duration); flutter.stop(now + duration);
  }
  cleanupTimers = new Set();
  stop() {
    this.active = false;
    clearTimeout(this.timer);
    clearTimeout(this.laughTimer);
    clearTimeout(this.duckTimer);
    this.duckUntil = 0;
    this.output.gain.cancelScheduledValues(this.context.currentTime);
    this.output.gain.setValueAtTime(0, this.context.currentTime);
    for (const node of this.nodes) { try { node.stop(); } catch {} }
    this.nodes.clear();
  }
}
