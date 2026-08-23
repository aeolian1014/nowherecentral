/* ------------------------------------------------------------------
   NOWHERE CENTRAL — sound

   Nothing here is a file. Every noise is synthesised at runtime:
   filtered noise beds, detuned drone stacks, event generators, and one
   short click per flap.

   That matters more than it looks. A sample pack — even a hundred of
   them — eventually loops, and a brain trying to fall asleep is very
   good at noticing periodicity. Noise driven by slow LFOs at unrelated
   rates never repeats, and costs about eight kilobytes.
------------------------------------------------------------------ */

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ------------------------------------------------------------------
   Per-world recipes. `beds` are filtered noise, `drones` are pitched,
   `events` are the things that happen occasionally so an hour of it
   never settles into wallpaper.
------------------------------------------------------------------ */
const PRESETS = {
  concourse: {
    beds: [
      { type: 'lowpass', freq: 420, q: 0.7, gain: 0.055, lfo: [0.05, 120] },
      { type: 'bandpass', freq: 180, q: 1.4, gain: 0.035, lfo: [0.021, 60] },
    ],
    drones: [
      { f: 55, type: 'sine', gain: 0.055 },
      { f: 82.5, type: 'sine', gain: 0.022 },
      { f: 110.3, type: 'triangle', gain: 0.012 },
    ],
    events: { every: [22, 48], pool: ['rumble', 'clatter', 'tannoy', 'doorFar'] },
  },

  glass: {
    beds: [
      { type: 'highpass', freq: 1500, q: 0.6, gain: 0.085, lfo: [0.09, 400] },
      { type: 'bandpass', freq: 3800, q: 0.5, gain: 0.05, lfo: [0.23, 900] },
      { type: 'lowpass', freq: 260, q: 0.8, gain: 0.05, lfo: [0.03, 80] },
    ],
    drones: [
      { f: 48, type: 'sine', gain: 0.05 },
      { f: 96.4, type: 'sine', gain: 0.014 },
    ],
    events: { every: [26, 70], pool: ['thunder', 'swell', 'thunder', 'groan'] },
  },

  dunes: {
    beds: [
      { type: 'bandpass', freq: 640, q: 0.9, gain: 0.13, lfo: [0.07, 420] },
      { type: 'lowpass', freq: 180, q: 0.9, gain: 0.07, lfo: [0.019, 70] },
      { type: 'highpass', freq: 5200, q: 0.5, gain: 0.02, lfo: [0.15, 1200] },
    ],
    drones: [
      { f: 41, type: 'sawtooth', gain: 0.02 },
      { f: 61.7, type: 'sine', gain: 0.03 },
    ],
    events: { every: [12, 30], pool: ['gust', 'gust', 'gust', 'groan'] },
  },

  spire: {
    beds: [
      { type: 'highpass', freq: 900, q: 0.4, gain: 0.035, lfo: [0.04, 260] },
      { type: 'bandpass', freq: 300, q: 2.2, gain: 0.045, lfo: [0.013, 90] },
    ],
    drones: [
      { f: 65.4, type: 'sine', gain: 0.045 },
      { f: 98.0, type: 'sine', gain: 0.028 },
      { f: 130.8, type: 'sine', gain: 0.016 },
    ],
    events: { every: [9, 22], pool: ['chime', 'chime', 'doorFar', 'groan'] },
  },

  noon: {
    beds: [
      { type: 'lowpass', freq: 320, q: 0.7, gain: 0.05, lfo: [0.026, 70] },
      { type: 'bandpass', freq: 4600, q: 6.0, gain: 0.035, lfo: [5.2, 900] },
    ],
    drones: [
      { f: 87.3, type: 'sine', gain: 0.05 },
      { f: 131.0, type: 'sine', gain: 0.024 },
      { f: 174.6, type: 'triangle', gain: 0.01 },
    ],
    events: { every: [7, 20], pool: ['bird', 'bird', 'bird', 'cicada', 'swell'] },
  },

  null: {
    beds: [
      { type: 'highpass', freq: 60, q: 0.3, gain: 0.14, lfo: [0.4, 200] },
      { type: 'bandpass', freq: 1200, q: 0.4, gain: 0.06, lfo: [1.7, 700] },
    ],
    drones: [
      { f: 50, type: 'sine', gain: 0.05 },
      { f: 100, type: 'sine', gain: 0.018 },
    ],
    events: { every: [5, 15], pool: ['dropout', 'carrier', 'dropout'] },
  },

  inverted: {
    beds: [
      { type: 'lowpass', freq: 300, q: 1.6, gain: 0.12, lfo: [0.04, 140] },
      { type: 'bandpass', freq: 900, q: 1.1, gain: 0.03, lfo: [0.11, 300] },
    ],
    drones: [
      { f: 36.7, type: 'sine', gain: 0.06 },
      { f: 55.0, type: 'sine', gain: 0.03 },
      { f: 73.4, type: 'sine', gain: 0.018 },
    ],
    events: { every: [3, 9], pool: ['drip', 'drip', 'drip', 'groan', 'swell'] },
  },
};

/* ------------------------------------------------------------------
   Layers
------------------------------------------------------------------ */

class Bed {
  constructor(ctx, noise, out, cfg) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.level = 0;

    this.src = ctx.createBufferSource();
    this.src.buffer = noise;
    this.src.loop = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = cfg.type;
    this.filter.frequency.value = cfg.freq;
    this.filter.Q.value = cfg.q;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.target = cfg.gain;

    this.src.connect(this.filter).connect(this.gain).connect(out);
    this.src.start(ctx.currentTime + rand(0, 0.4));

    if (cfg.lfo) {
      const [rate, depth] = cfg.lfo;
      this.lfo = ctx.createOscillator();
      this.lfo.frequency.value = rate;
      this.lfoGain = ctx.createGain();
      this.lfoGain.gain.value = depth;
      this.lfo.connect(this.lfoGain).connect(this.filter.frequency);
      this.lfo.start();
    }
  }

  fade(v, t) {
    this.level = v;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(this.target * v, now, t);
  }

  /** Wander, slowly. This is what keeps hour two from sounding like
      hour one — the bed itself is never quite the same texture. */
  drift() {
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(this.cfg.freq * rand(0.78, 1.34), now, 9);
    this.gain.gain.setTargetAtTime(this.target * this.level * rand(0.75, 1.28), now, 11);
  }

  kill() {
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(0, now, 0.35);
    try { this.src.stop(now + 2.2); } catch (e) {}
    if (this.lfo) try { this.lfo.stop(now + 2.2); } catch (e) {}
  }
}

class Drone {
  constructor(ctx, out, cfg) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.level = 0;

    this.osc = ctx.createOscillator();
    this.osc.type = cfg.type;
    this.osc.frequency.value = cfg.f;
    this.osc.detune.value = rand(-7, 7);

    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 600;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.target = cfg.gain;

    // slow breathing
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = rand(0.03, 0.11);
    this.lfoG = ctx.createGain();
    this.lfoG.gain.value = cfg.gain * 0.45;
    this.lfo.connect(this.lfoG).connect(this.gain.gain);

    this.osc.connect(this.lp).connect(this.gain).connect(out);
    this.osc.start();
    this.lfo.start();
  }

  fade(v, t) {
    this.level = v;
    this.gain.gain.setTargetAtTime(this.target * v, this.ctx.currentTime, t);
  }

  drift() {
    const now = this.ctx.currentTime;
    this.osc.detune.setTargetAtTime(rand(-11, 11), now, 12);
    this.lfo.frequency.setTargetAtTime(rand(0.03, 0.12), now, 10);
  }

  kill() {
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, now, 0.4);
    try { this.osc.stop(now + 2.4); this.lfo.stop(now + 2.4); } catch (e) {}
  }
}

/* ------------------------------------------------------------------
   The station
------------------------------------------------------------------ */

export class Station {
  constructor() {
    this.ready = false;
    this.enabled = false;
    this.volume = 0.75;
    this.layers = [];
    this.preset = null;
    this.presetName = null;
    this._eventIn = 0;
    this._driftIn = 24;
    this._lastClick = 0;
    this._fading = false;
  }

  /* Must be called from a user gesture. */
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.22;

    // one cheap hall: a feedback tap, enough to imply a big room
    this.hall = ctx.createGain();
    this.hall.gain.value = 0.32;
    const d1 = ctx.createDelay(1.0);
    d1.delayTime.value = 0.21;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    this.hall.connect(d1).connect(damp).connect(fb).connect(d1);
    damp.connect(this.master);

    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.master.connect(this.limiter).connect(ctx.destination);

    /* Interface sounds — keystrokes, and anything the fingers touch —
       hang off the limiter directly rather than the ambient master, so
       they are audible the instant the context exists, before (and
       independent of) the station bed being switched on. */
    this.ui = ctx.createGain();
    this.ui.gain.value = 0.9;
    this.ui.connect(this.limiter);

    // shared pink-ish noise
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      ch[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    this.noise = buf;
    this.ready = true;

    if (this._pending) { const p = this._pending; this._pending = null; this.setWorld(p); }
    this._schedule();
  }

  /* ---- master ---------------------------------------------------- */

  _applyVolume(ramp = 0.35) {
    if (!this.ready) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(
      this.enabled ? this.volume : 0,
      this.ctx.currentTime,
      ramp
    );
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._fading = false;
    this._applyVolume(0.12);
    return this.volume;
  }

  toggle() {
    if (!this.ready) this.init();
    if (!this.ready) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.enabled = !this.enabled;
    this._fading = false;
    this._applyVolume();
    return this.enabled;
  }

  enable() {
    if (!this.enabled) return this.toggle();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  /* ------------------------------------------------------------------
     Staying alive in the background

     A bare AudioContext is not treated as media: hide the tab for five
     minutes and Chrome applies intensive throttling, clamping timers to
     once a minute, which starves the schedulers. Routing the graph
     through a MediaStream into a real <audio> element makes the browser
     class the page as *playing media* — the tab is exempted from
     throttling, the OS shows transport controls, and on a phone it can
     survive the screen locking.

     Only switched on for night service: the media element adds latency,
     which matters for flap clicks and not at all for a drone.
  ------------------------------------------------------------------ */

  goBackground(on) {
    if (!this.ready) return false;
    if (on === !!this._bg) return !!this._bg;

    try {
      if (on) {
        const dest = this.ctx.createMediaStreamDestination();
        this.limiter.disconnect();          // or it plays twice
        this.limiter.connect(dest);

        const el = document.createElement('audio');
        el.srcObject = dest.stream;
        el.autoplay = true;
        el.loop = true;
        el.setAttribute('playsinline', '');
        el.style.display = 'none';
        document.body.appendChild(el);
        el.play().catch(() => {});

        this._bg = { dest, el };
        this._mediaSession();
      } else {
        const { el, dest } = this._bg;
        this.limiter.disconnect();
        this.limiter.connect(this.ctx.destination);
        try { el.pause(); el.srcObject = null; el.remove(); dest.disconnect(); } catch (e) {}
        this._bg = null;
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      }
      return !!this._bg;
    } catch (e) {
      // if anything about the stream path fails, fall back to plain output
      try { this.limiter.disconnect(); this.limiter.connect(this.ctx.destination); } catch (e2) {}
      this._bg = null;
      return false;
    }
  }

  _mediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: 'Night Service',
        artist: 'Nowhere Central',
        album: 'Services that do not arrive',
        artwork: [{ src: this._artwork(512), sizes: '512x512', type: 'image/png' }],
      });
      ms.playbackState = 'playing';
      ms.setActionHandler('pause', () => { this.enabled && this.toggle(); ms.playbackState = 'paused'; });
      ms.setActionHandler('play', () => { this.enable(); ms.playbackState = 'playing'; });
      ms.setActionHandler('stop', () => { this.enabled && this.toggle(); });
    } catch (e) {}
  }

  /** lock-screen art, drawn rather than downloaded */
  _artwork(n) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, n, n);
    g.addColorStop(0, '#11161f');
    g.addColorStop(1, '#05070a');
    x.fillStyle = g;
    x.fillRect(0, 0, n, n);
    const glow = x.createRadialGradient(n * 0.3, n * 0.2, 0, n * 0.3, n * 0.2, n * 0.8);
    glow.addColorStop(0, 'rgba(255,179,71,0.30)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, n, n);
    x.fillStyle = '#ffb347';
    x.font = `${n * 0.34}px Georgia, serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('◈', n / 2, n * 0.44);
    x.fillStyle = '#f2efe6';
    x.font = `${n * 0.072}px monospace`;
    x.fillText('NOWHERE CENTRAL', n / 2, n * 0.72);
    return c.toDataURL('image/png');
  }

  /* ------------------------------------------------------------------
     The public address rig

     Her voice cannot be filtered. Web Speech writes to the output
     device, past this graph entirely — there is no node to put a
     bandpass on. What *can* be built is the equipment around her: the
     relay closing, the carrier hiss of a horn speaker, mains hum from
     an amplifier that has been warm since 1974, and the hall ringing
     for a moment after she stops.

     The ear fuses a voice with a noise bed that shares its band and
     its timing, and hears one tannoy. Pulsing that bed on her word
     boundaries is what makes the fusion hold — the hiss appears to be
     carrying her rather than sitting beside her.
  ------------------------------------------------------------------ */

  /** the contactor in the amplifier rack */
  _relay(level) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(0.7, 1.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = rand(900, 1500);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(lp).connect(g).connect(this.bus);
    const hs = ctx.createGain();
    hs.gain.value = 0.7;
    g.connect(hs).connect(this.hall);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.08);

    // the thump of a big cone moving
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(level * 1.3, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(this.bus);
    o.start(t);
    o.stop(t + 0.15);
  }

  /** key the system up: hiss, hum, and a relay */
  paOpen() {
    if (!this.ready || !this.enabled || this._pa) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(1, t + 0.05);
    out.connect(this.bus);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    out.connect(send).connect(this.hall);

    // carrier hiss, band-limited the way a horn speaker is
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 420;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    const hg = ctx.createGain();
    hg.gain.value = 0.042;
    hiss.connect(hp).connect(lp).connect(hg).connect(out);
    hiss.start(t, Math.random() * 2);

    // mains hum and its second harmonic
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 100;
    const humG = ctx.createGain();
    humG.gain.value = 0.013;
    const hum2 = ctx.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 200;
    const hum2G = ctx.createGain();
    hum2G.gain.value = 0.005;
    hum.connect(humG).connect(out);
    hum2.connect(hum2G).connect(out);
    hum.start(t);
    hum2.start(t);

    this._pa = { out, hiss, hum, hum2, hg };
    this._relay(0.085);
  }

  /** one word went through the system */
  paPulse(strength = 1) {
    if (!this._pa) return;
    const t = this.ctx.currentTime;
    const g = this._pa.hg.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.042 + 0.05 * strength, t, 0.02);
    g.setTargetAtTime(0.042, t + 0.10, 0.09);
  }

  /** key down, and let the room keep her for a moment */
  paClose() {
    if (!this._pa) return;
    const { out, hiss, hum, hum2 } = this._pa;
    const ctx = this.ctx, t = ctx.currentTime;
    this._pa = null;

    // the hall ringing on after the voice stops
    const tail = ctx.createBufferSource();
    tail.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.07, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    tail.connect(bp).connect(tg).connect(this.hall);
    tail.start(t, Math.random() * 2);
    tail.stop(t + 0.4);

    setTimeout(() => this.ready && this._relay(0.055), 180);

    out.gain.cancelScheduledValues(t);
    out.gain.setTargetAtTime(0.0001, t + 0.16, 0.10);
    try { hiss.stop(t + 1.4); hum.stop(t + 1.4); hum2.stop(t + 1.4); } catch (e) {}
  }

  /**
   * Pull the room down and let it back up. Used when the announcer
   * speaks, since her voice cannot be routed through this graph.
   * @param {number} to 0..1 @param {number} ramp seconds
   */
  duck(to, ramp = 0.4) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(to, now, ramp / 3);
  }

  /** The sleep timer's ending: a long, gentle taper to silence. */
  fadeOut(seconds = 90) {
    if (!this.ready || !this.enabled) return;
    this._fading = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.setTargetAtTime(0.0001, t, seconds / 4);
  }

  /* ---- worlds ---------------------------------------------------- */

  setWorld(name) {
    if (!this.ready) { this._pending = name; return; }
    const preset = PRESETS[name] || PRESETS.concourse;
    if (this.preset === preset) return;
    this.preset = preset;
    this.presetName = name;

    for (const l of this.layers) l.kill();
    this.layers = [];
    for (const cfg of preset.beds) this.layers.push(new Bed(this.ctx, this.noise, this.bus, cfg));
    for (const cfg of preset.drones) this.layers.push(new Drone(this.ctx, this.bus, cfg));
    for (const l of this.layers) l.fade(1, 1.6);

    this._eventIn = preset.events ? rand(...preset.events.every) * 0.4 : 0;
    this._driftIn = rand(18, 34);
  }

  /* ---- scheduler -------------------------------------------------
     setInterval, not requestAnimationFrame: rAF stops in a background
     tab and the whole point of night service is that it keeps going.
  ------------------------------------------------------------------ */
  _schedule() {
    const STEP = 0.25;
    setInterval(() => {
      if (!this.enabled || !this.preset) return;

      if (this.preset.events) {
        this._eventIn -= STEP;
        if (this._eventIn <= 0) {
          this._eventIn = rand(...this.preset.events.every);
          this._fire(pick(this.preset.events.pool));
        }
      }

      this._driftIn -= STEP;
      if (this._driftIn <= 0) {
        this._driftIn = rand(20, 45);
        for (const l of this.layers) l.drift();
      }
    }, STEP * 1000);
  }

  _fire(kind) {
    const f = this['_ev_' + kind];
    if (f) f.call(this);
  }

  /* ---- generators ------------------------------------------------ */

  _noiseVoice(dur, { type = 'bandpass', f0, f1, q = 1.2, gain = 0.1, attack = 0.3, hall = 0.5 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rand(0.7, 1.3);

    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(bp).connect(g);
    g.connect(this.bus);
    if (hall) {
      const hg = ctx.createGain();
      hg.gain.value = hall;
      g.connect(hg).connect(this.hall);
    }
    src.start(t, rand(0, 2));
    src.stop(t + dur + 0.2);
    return { g, t };
  }

  _tone(f, { dur = 1, type = 'sine', gain = 0.08, bend = 1, vibrato = 0, hall = 0.6, delay = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + dur);

    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vibrato;
      const lg = ctx.createGain();
      lg.gain.value = f * 0.012;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(g).connect(this.bus);
    if (hall) {
      const hg = ctx.createGain();
      hg.gain.value = hall;
      g.connect(hg).connect(this.hall);
    }
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  _bell(f, g, decay, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.76;                 // inharmonic partial: metal
    const gn = ctx.createGain();
    const gn2 = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    gn2.gain.setValueAtTime(0.0001, t);
    gn2.gain.linearRampToValueAtTime(g * 0.22, t + 0.004);
    gn2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.35);
    const hg = ctx.createGain();
    hg.gain.value = 0.7;
    o.connect(gn);
    o2.connect(gn2);
    gn.connect(this.bus);
    gn.connect(hg).connect(this.hall);
    gn2.connect(this.bus);
    o.start(t); o2.start(t);
    o.stop(t + decay + 0.1);
    o2.stop(t + decay * 0.4 + 0.1);
  }

  /* ---- events ---------------------------------------------------- */

  _ev_chime() { this._bell(pick([523.25, 659.25, 784.0, 987.77]), 0.05, rand(4, 7)); }
  _ev_drip() { this._tone(pick([1046, 1318, 1568, 2093]), { dur: rand(0.2, 0.5), gain: 0.035, bend: 0.45, hall: 0.9 }); }
  _ev_groan() { this._tone(rand(38, 62), { dur: rand(5, 10), type: 'sine', gain: 0.055, bend: rand(0.7, 1.3), hall: 0.5 }); }
  _ev_carrier() { this._tone(rand(400, 1400), { dur: rand(0.4, 1.6), type: 'square', gain: 0.012, bend: rand(0.9, 1.1), hall: 0 }); }
  _ev_swell() { this._noiseVoice(rand(6, 13), { f0: rand(200, 500), f1: rand(700, 1800), q: 0.8, gain: 0.055, attack: 0.5 }); }
  _ev_gust() { this._noiseVoice(rand(4, 9), { f0: rand(300, 700), f1: rand(900, 2600), q: 1.1, gain: rand(0.07, 0.14), attack: 0.45 }); }
  _ev_rumble() { this._noiseVoice(rand(7, 15), { type: 'lowpass', f0: 120, f1: rand(60, 200), q: 1.4, gain: 0.075, attack: 0.4 }); }
  _ev_thunder() {
    this._noiseVoice(rand(5, 11), { type: 'lowpass', f0: rand(180, 320), f1: rand(45, 90), q: 1.1, gain: rand(0.10, 0.19), attack: 0.06, hall: 1 });
  }
  _ev_dropout() { this._noiseVoice(rand(0.05, 0.25), { type: 'highpass', f0: 2000, f1: 6000, q: 0.5, gain: 0.09, attack: 0.05, hall: 0 }); }
  _ev_doorFar() { this._noiseVoice(0.35, { type: 'lowpass', f0: 700, f1: 120, q: 1.5, gain: 0.07, attack: 0.03, hall: 1 }); }
  _ev_tannoy() {
    // a voice too far away to be words: three vowel-ish formant blips
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const d = i * rand(0.22, 0.42);
      const f = rand(240, 620);
      const ctx = this.ctx, t = ctx.currentTime + d;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * rand(0.85, 1.2), t + 0.2);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(600, 1400);
      bp.Q.value = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.018, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(bp).connect(g);
      g.connect(this.hall);
      o.start(t);
      o.stop(t + 0.35);
    }
  }
  _ev_bird() {
    const base = rand(1800, 3400);
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      this._tone(base * rand(0.92, 1.12), {
        dur: rand(0.07, 0.16),
        gain: 0.02,
        bend: rand(0.75, 1.5),
        hall: 0.55,
        delay: i * rand(0.10, 0.22),
      });
    }
  }
  _ev_cicada() {
    const { g, t } = this._noiseVoice(rand(3, 7), { f0: 4200, f1: 4800, q: 9, gain: 0.03, attack: 0.4, hall: 0.2 });
    // tremolo on top of the swell
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rand(28, 46);
    const lg = this.ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + 8);
  }
  _ev_clatter() {
    const n = 6 + ((Math.random() * 8) | 0);
    for (let i = 0; i < n; i++) setTimeout(() => this.click(0.06), i * rand(45, 110));
  }

  /* ---- named cues ------------------------------------------------ */

  /** the platform announcement chime — two tones, a fifth apart */
  chime() {
    if (!this.ready || !this.enabled) return;
    this._bell(659.25, 0.10, 2.4);
    this._bell(493.88, 0.10, 3.0, 0.38);
  }

  /* ------------------------------------------------------------------
     A steam locomotive, a long way off

     Everything about this is a distance problem. Air absorbs high
     frequencies over a kilometre, so the whole train runs through one
     lowpass that opens as it nears and closes as it goes; the level
     follows an inverse-square swell rather than a fade; and almost all
     of it is sent to the hall, because at that range you hear the
     valley more than the engine.

     The exhaust is four beats to a wheel revolution, and the two
     cylinders are never quite matched — that limp in the rhythm is the
     whole reason a steam engine sounds like a steam engine.
  ------------------------------------------------------------------ */

  /** one exhaust beat */
  _chuff(when, strength) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(0.88, 1.16);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    // steam venting: a bright stab collapsing into a soft push
    bp.frequency.setValueAtTime(rand(950, 1500), when);
    bp.frequency.exponentialRampToValueAtTime(rand(240, 400), when + 0.20);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(strength, when + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rand(0.22, 0.38));

    src.connect(bp).connect(g).connect(this._trainBus);
    src.start(when, Math.random() * 2);
    src.stop(when + 0.45);
  }

  /**
   * The horn. Deep, warm, and consonant.
   *
   * Two things decide whether this lands as *big* or as *eerie*, and
   * neither is volume:
   *
   * - **The chord.** A minor stack (root, minor third, fifth, minor
   *   seventh) is the mournful one — beautiful, but it reads as dread.
   *   This is a major stack with an octave and a twelfth on top, which
   *   is the warm, wide, carrying sound.
   * - **The breath.** A band of noise around the tone is the whole
   *   difference between a horn and a church organ.
   *
   * The slight pitch rise on the attack and sag on the release is
   *   pressure building and falling in the pipes. Leave it out and it
   *   sounds synthetic immediately.
   */
  _horn(when, dur, level = 1) {
    const ctx = this.ctx;
    const root = rand(168, 208);
    const ratios = [1, 1.26, 1.5, 2.0, 3.0];
    const weights = [1, 0.66, 0.78, 0.5, 0.2];

    const out = ctx.createGain();
    const peak = 0.62 * level;
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(peak, when + rand(0.22, 0.38));
    out.gain.setValueAtTime(peak, when + Math.max(0.4, dur * 0.72));
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    out.connect(this._trainBus);

    const dest = this._trainHornBus || this._trainBus;
    out.disconnect();
    out.connect(dest);

    ratios.forEach((r, i) => {
      const f = root * r * rand(0.997, 1.003);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      // pressure builds, then sags as the valve closes
      o.frequency.setValueAtTime(f * 0.982, when);
      o.frequency.linearRampToValueAtTime(f, when + 0.32);
      o.frequency.setValueAtTime(f, when + dur * 0.8);
      o.frequency.linearRampToValueAtTime(f * 0.99, when + dur);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = f * 6.0;   // keep the harmonics that make it a horn

      const g = ctx.createGain();
      g.gain.value = (0.5 * weights[i]) / ratios.length;

      // the waver of a horn held open
      const vib = ctx.createOscillator();
      vib.frequency.value = rand(4.2, 5.8);
      const vg = ctx.createGain();
      vg.gain.value = f * 0.004;
      vib.connect(vg).connect(o.frequency);

      o.connect(lp).connect(g).connect(out);
      o.start(when);
      vib.start(when);
      o.stop(when + dur + 0.3);
      vib.stop(when + dur + 0.3);
    });

    // breath — without this it is an organ, not a horn
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = root * 2.6;
    bp.Q.value = 0.9;
    const bg = ctx.createGain();
    bg.gain.value = 0.2;
    src.connect(bp).connect(bg).connect(out);
    src.start(when, Math.random() * 2);
    src.stop(when + dur + 0.3);
  }

  /**
   * A steam train passes, a long way off.
   *
   * @param {{dur?:number, far?:number}} opts
   *   dur — the whole pass, first hearing it to losing it again.
   *   far — 0..1, how distant.
   */
  /* Cut a pass short. The train is wired straight to the master, past
     the ambience bus, precisely so ducking cannot reach it — which means
     leaving the concourse has to stop it explicitly or it plays on
     underneath a destination for its full fifteen to twenty seconds. */
  stopTrain(fade = 0.6) {
    if (!this.ready || !this._train) return;
    const now = this.ctx.currentTime;
    const bus = this._trainBus, horn = this._trainHornBus, lvl = this._trainLvl;
    clearInterval(this._train);
    this._train = null;
    this._trainBus = this._trainHornBus = this._trainLvl = null;
    try {
      if (lvl) {
        lvl.gain.cancelScheduledValues(now);
        lvl.gain.setTargetAtTime(0.0001, now, fade / 3);
      }
      // the pass ducks the ambience as it goes by; hand that back
      this.bus.gain.cancelScheduledValues(now);
      this.bus.gain.setTargetAtTime(1, now, 0.4);
    } catch (e) {}
    setTimeout(() => {
      try { bus && bus.disconnect(); horn && horn.disconnect(); lvl && lvl.disconnect(); } catch (e) {}
    }, (fade + 0.5) * 1000);
  }

  steamTrain({ dur = rand(15, 20), far = rand(0.74, 0.94) } = {}) {
    if (!this.ready || !this.enabled) return;
    if (this._train) return;                       // one at a time
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const peak = dur * 0.5;
    const tEnd = t0 + dur;

    /* ---- the sub-graph everything runs through ---- */
    const bus = ctx.createGain();
    const air = ctx.createBiquadFilter();          // distance eats the highs
    air.type = 'lowpass';
    air.Q.value = 0.5;
    const lvl = ctx.createGain();
    lvl.gain.value = 0.0001;

    /* The horn gets its own path. Running it through the same air
       filter as the exhaust muffles it into a hum, which is wrong
       twice over: a horn is pitched low and loud precisely so it
       carries further than anything else on the train. */
    const hornBus = ctx.createGain();
    const airH = ctx.createBiquadFilter();
    airH.type = 'lowpass';
    airH.Q.value = 0.4;
    hornBus.connect(airH).connect(lvl);
    this._trainHornBus = hornBus;

    bus.connect(air).connect(lvl);
    // straight to the master, past the ambience bus, so the ambience can
    // be ducked underneath it without ducking the train as well
    lvl.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.55 + far * 0.4;            // far away is mostly reverb
    lvl.connect(send).connect(this.hall);

    this._trainBus = bus;
    this._trainLvl = lvl;                          // needed to cut a pass short

    /* ---- distance envelope ----
       A gentle falloff, not a literal inverse square. True 1/r² spends
       most of the pass inaudible, which reads as a short event with a
       long silence around it rather than as a train crossing a valley.
       The filter has to open properly too: at a 500 Hz ceiling the
       exhaust has nowhere to live and the whistle becomes a hum.      */
    const N = 160;
    const level = new Float32Array(N);
    const cutoff = new Float32Array(N);
    const top = 0.92 * (1 - far * 0.30);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const d = Math.abs(t - 0.5) * 2;             // 0 at the pass, 1 at the ends
      const near = 1 / (1 + 4.2 * d * d);
      level[i] = Math.max(0.0001, top * near);
      cutoff[i] = 420 + (1 - far) * 900 + near * (1500 + (1 - far) * 2800);
    }
    const cutoffH = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const d = Math.abs(t - 0.5) * 2;
      const near = 1 / (1 + 4.2 * d * d);
      cutoffH[i] = 1100 + (1 - far) * 1400 + near * (2800 + (1 - far) * 3200);
    }

    lvl.gain.setValueCurveAtTime(level, t0, dur);
    air.frequency.setValueCurveAtTime(cutoff, t0, dur);
    airH.frequency.setValueCurveAtTime(cutoffH, t0, dur);

    /* Duck the room under it. A real distant train doesn't get louder
       than the wind so much as it takes the wind's place for a minute. */
    const floor = 1 / (1 + 4.2);
    const duck = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const d = Math.abs(t - 0.5) * 2;
      const near = 1 / (1 + 4.2 * d * d);
      duck[i] = 1 - 0.42 * Math.max(0, (near - floor) / (1 - floor));
    }
    try {
      this.bus.gain.cancelScheduledValues(t0);
      this.bus.gain.setValueCurveAtTime(duck, t0, dur);
    } catch (e) {}

    /* ---- the rumble underneath ---- */
    const rum = ctx.createBufferSource();
    rum.buffer = this.noise;
    rum.loop = true;
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 150;
    rlp.Q.value = 1.2;
    const rg = ctx.createGain();
    rg.gain.value = 0.8;
    rum.connect(rlp).connect(rg).connect(bus);
    rum.start(t0, Math.random() * 2);
    rum.stop(tEnd + 0.5);

    /* ---- the horn ----
       The real grade-crossing signal: long, long, short, LONG — with
       the last one sustained through the crossing itself. Worked
       backwards from the closest approach so the big one lands as the
       engine goes past. A quieter blast on the way out.            */
    const at = t0 + peak;
    // and the exhaust steps back under each blast, the way it does on
    // any recording of one
    const blast = (when, len, lvlv) => {
      this._horn(when, len, lvlv);
      bus.gain.setTargetAtTime(0.42, Math.max(t0, when - 0.15), 0.12);
      bus.gain.setTargetAtTime(1.0, when + len * 0.8, 0.3);
    };
    /* Offsets are fractions of the pass, not absolute seconds, so a
       short pass never schedules a blast in the past. */
    // Two. One at distance to announce itself, one as it goes through.
    for (const [frac, lenFrac, lv] of [
      [-0.38, 0.145, 0.80],
      [-0.11, 0.165, 1.00],
    ]) {
      blast(Math.max(t0 + 0.2, at + frac * dur), dur * lenFrac, lv);
    }

    /* ---- exhaust and bell, scheduled a little ahead at a time ----
       Four beats a revolution. The offsets are deliberately uneven:
       a two-cylinder engine limps, and that limp is the sound.     */
    const revolution = rand(1.08, 1.34);
    const beats = [0, 0.238, 0.5, 0.762];
    const punch = [1, 0.84, 0.96, 0.8];
    let nextRev = t0;
    let beat = 0;

    this._train = setInterval(() => {
      if (!this.ready) return;
      const now = ctx.currentTime;
      const horizon = now + 2.5;                   // survives a throttled tab

      while (nextRev <= tEnd && nextRev + beats[beat] * revolution < horizon) {
        const at = nextRev + beats[beat] * revolution;
        if (at > t0) this._chuff(at, 0.34 * punch[beat] * rand(0.88, 1.12));
        beat++;
        if (beat === 4) { beat = 0; nextRev += revolution; }
      }

      if (now > tEnd + 1) {
        clearInterval(this._train);
        this._train = null;
        this._trainBus = null;
        this._trainHornBus = null;
        try {
          this.bus.gain.cancelScheduledValues(now);
          this.bus.gain.setTargetAtTime(1, now, 0.4);
          bus.disconnect(); hornBus.disconnect(); lvl.disconnect(); send.disconnect();
        } catch (e) {}
      }
    }, 450);
  }

  /** one flap of one character (also used for rail joints) */
  click(gain = 0.10) {
    if (!this.ready || !this.enabled) return;
    const now = performance.now();
    if (now - this._lastClick < 9) return;
    this._lastClick = now;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(0.85, 1.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(1500, 3200);
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(bp).connect(g);
    g.connect(this.bus);
    const hg = ctx.createGain();
    hg.gain.value = 0.5;
    g.connect(hg).connect(this.hall);
    src.start(t, Math.random() * 2, 0.06);
    src.stop(t + 0.07);
  }

  /**
   * One keystroke on the terminal — the boot log typing itself out.
   * A dry mechanical clack: a filtered noise transient for the contact,
   * and one low tick under it for the key bottoming out. Cheaper and
   * tighter than the flap click, and it varies a little each press so a
   * line of text does not machine-gun.
   *
   * Routed through the UI path, so it plays during boot while the
   * ambient bed is still off.
   */
  key(gain = 0.09) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(1.4, 2.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(2400, 4200);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    const v = gain * rand(0.7, 1.15);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.012, 0.022));
    src.connect(bp).connect(g).connect(this.ui);
    src.start(t, Math.random() * 2, 0.04);
    src.stop(t + 0.05);

    // the thock of the key bottoming out
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(rand(150, 210), t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.03);
    const og = ctx.createGain();
    og.gain.setValueAtTime(v * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(og).connect(this.ui);
    o.start(t);
    o.stop(t + 0.05);
  }

  /** carriage return: a slightly heavier press for the end of a line */
  keyReturn() {
    this.key(0.13);
  }

  /**
   * Wake the audio engine from a user gesture without turning the
   * ambient bed on. Lets the boot log make noise while the station is
   * still nominally silent.
   */
  prime() {
    if (!this.ready) this.init();
    if (this.ready && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ready;
  }

  /** departure: a rising sweep that ends in a thud */
  depart(dur = 1.5) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(180, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.82);
    bp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + dur * 0.78);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    src.connect(bp).connect(g);
    g.connect(this.bus);
    const hg = ctx.createGain();
    hg.gain.value = 0.6;
    g.connect(hg).connect(this.hall);
    src.start(t);
    src.stop(t + dur + 0.6);

    // the sub thump underneath
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.30, t + dur * 0.7);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
    o.connect(og).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.8);
  }
}
