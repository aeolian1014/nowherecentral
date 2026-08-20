/* ------------------------------------------------------------------
   NOWHERE CENTRAL — renderer
   One fullscreen triangle-pair, one world shader into an FBO, one
   post pass to the screen. Adaptive resolution, no dependencies.
------------------------------------------------------------------ */

import { VERT, WORLDS, POST } from './shaders.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* Not all worlds cost the same. Dunes is the only real raymarcher on the
   site, so it gets fewer pixels; nobody notices on a scene whose whole
   subject is soft haze and a rim light. */
const WORLD_SCALE = {
  dunes: 0.70,
  glass: 0.88,
  inverted: 0.90,
};

/* Auto is the default, but the visitor's machine is the only one whose
   opinion counts — Q cycles these and the choice is remembered. */
export const QUALITY = [
  { name: 'AUTO', scale: null, budget: null, grain: 1, fps: 0, auto: true },
  { name: 'HIGH', scale: 0.9, budget: 1800000, grain: 1, fps: 0 },
  { name: 'MEDIUM', scale: 0.62, budget: 820000, grain: 1, fps: 0 },
  { name: 'LOW', scale: 0.45, budget: 460000, grain: 0, fps: 30 },
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.ok = !!this.gl;
    if (!this.ok) return;

    this.programs = new Map();
    this.current = null;
    /* The canvas is an out-of-focus background, not a photograph.
       A ratio alone is not enough — on a 4K panel 0.8x is still eight
       million pixels a frame — so the cost is capped in absolute pixels
       and the ratio only ever makes it smaller. */
    const small = window.innerWidth < 900;
    this.scale = small ? 0.60 : 0.80;
    this.worldScale = 1;
    this.maxDpr = 1.5;
    this.budget = small ? 520000 : 1250000;

    if (this._weakGpu()) {
      this.scale *= 0.75;
      this.budget *= 0.6;
    }
    this._autoScale = this.scale;
    this._autoBudget = this.budget;
    this.minFrameMs = 0;
    this.quality = 0;

    this.time = 0;
    this.t0 = performance.now();
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scroll = 0;

    this.warp = 0;
    this.fade = 0;
    this.flash = 0;
    this.grain = 1;

    this._frames = 0;
    this._acc = 0;
    this._degraded = 0;
    this._running = false;

    this._initGeometry();
    this._initTarget();
    this.post = this._program(VERT, POST);
    this.resize();
  }

  /* ---- setup ---------------------------------------------------- */

  /** Start low on integrated and software renderers rather than
      discovering they are slow two seconds in. */
  _weakGpu() {
    try {
      const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
      const r = dbg ? String(this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      this.renderer = r;
      return /swiftshader|basic render|llvmpipe|software|intel\S*\s*(hd|uhd)\s*graphics|mali|powervr|adreno \(tm\) [1-5]/i.test(r);
    } catch (e) {
      return false;
    }
  }

  _initGeometry() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), // one oversized triangle
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
  }

  _initTarget() {
    const gl = this.gl;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _shader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n');
      const m = /ERROR:\s*\d+:(\d+)/.exec(log || '');
      const near = m ? lines.slice(Math.max(0, +m[1] - 3), +m[1] + 2).join('\n') : '';
      console.error('[shader]', log, '\n---\n', near);
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  _program(vs, fs) {
    const gl = this.gl;
    const v = this._shader(gl.VERTEX_SHADER, vs);
    const f = this._shader(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[link]', gl.getProgramInfoLog(p));
      return null;
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      uniforms[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u: uniforms };
  }

  /* ---- worlds --------------------------------------------------- */

  setWorld(name) {
    if (!this.ok) return false;
    if (!this.programs.has(name)) {
      const src = WORLDS[name];
      if (!src) return false;
      const prog = this._program(VERT, src);
      if (!prog) return false;
      this.programs.set(name, prog);
    }
    this.current = name;
    // the swap happens at the peak of the warp flash, so a resolution
    // change here is never seen
    this.worldScale = WORLD_SCALE[name] || 1;
    this.resize();
    return true;
  }

  /** Compile ahead of time so a departure never stutters. */
  preload(names) {
    if (!this.ok) return;
    const queue = names.filter((n) => !this.programs.has(n));
    const idle = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 800 })
      : (fn) => setTimeout(fn, 60);
    const step = () => {
      const n = queue.shift();
      if (!n) return;
      const prog = this._program(VERT, WORLDS[n]);
      if (prog) this.programs.set(n, prog);
      if (queue.length) idle(step);
    };
    idle(step);
  }

  /* ---- quality --------------------------------------------------- */

  /** @param {number} i index into QUALITY; wraps. @returns {string} name */
  setQuality(i) {
    const q = QUALITY[((i % QUALITY.length) + QUALITY.length) % QUALITY.length];
    this.quality = QUALITY.indexOf(q);
    this.scale = q.auto ? this._autoScale : q.scale;
    this.budget = q.auto ? this._autoBudget : q.budget;
    this.grain = q.grain;
    this.minFrameMs = q.fps ? 1000 / q.fps : 0;
    this._degraded = 0;
    this._slow = this._fast = 0;
    this.w = this.h = -1;
    this.resize();
    try { localStorage.setItem('nc-quality', String(this.quality)); } catch (e) {}
    return q.name;
  }

  /**
   * Night mode is not a quality tier — it sits on top of whichever one
   * is chosen, and restores it exactly. Six frames a second at a third
   * of the pixels is roughly 1/40th the work.
   */
  setNight(on) {
    if (on === !!this._night) return;
    this._night = on;
    if (on) {
      this._preNight = { scale: this.scale, budget: this.budget, fps: this.minFrameMs };
      this.scale = Math.min(this.scale, 0.34);
      this.budget = Math.min(this.budget, 300000);
      this.minFrameMs = 1000 / 6;
    } else if (this._preNight) {
      this.scale = this._preNight.scale;
      this.budget = this._preNight.budget;
      this.minFrameMs = this._preNight.fps;
    }
    this.w = this.h = -1;
    this.resize();
  }

  restoreQuality() {
    let i = 0;
    try { i = parseInt(localStorage.getItem('nc-quality') || '0', 10) || 0; } catch (e) {}
    if (i) this.setQuality(i);
    return QUALITY[this.quality].name;
  }

  /* ---- frame ---------------------------------------------------- */

  resize() {
    if (!this.ok) return;
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    let bw = window.innerWidth * dpr * this.scale;
    let bh = window.innerHeight * dpr * this.scale;
    const px = bw * bh;
    if (px > this.budget) {
      const k = Math.sqrt(this.budget / px);
      bw *= k;
      bh *= k;
    }
    const w = Math.max(2, Math.floor(bw * this.worldScale));
    const h = Math.max(2, Math.floor(bh * this.worldScale));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  pointer(nx, ny) {
    this.mouse.tx = nx;
    this.mouse.ty = ny;
  }

  start() {
    if (!this.ok || this._running) return;
    this._running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      const elapsed = now - this._last;
      if (this.minFrameMs && elapsed < this.minFrameMs - 1) return;
      const dt = Math.min(0.05, elapsed / 1000);
      this._last = now;
      // a hand-picked quality is not second-guessed, nor is night mode
      if (QUALITY[this.quality].auto && !this._night) this._adapt(dt);
      this.render(dt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  /* Resolution follows the frame budget: drop it when we miss, and
     claw it back once the machine proves it can keep up. */
  _adapt(dt) {
    this._acc += dt;
    this._frames++;
    if (this._frames < 45) return;
    const avg = this._acc / this._frames;
    this._frames = 0;
    this._acc = 0;

    if (avg > 0.026) {
      this._slow = (this._slow || 0) + 1;
      this._fast = 0;
      // drop on the first bad window — waiting to be sure just means
      // the visitor watches it stutter for longer
      if (this._degraded < 4) {
        this._slow = 0;
        this._degraded++;
        this.scale = clamp(this.scale * 0.82, 0.34, 1);
        this.w = this.h = -1;
        this.resize();
      }
    } else if (avg < 0.0135 && this._degraded > 0) {
      this._fast = (this._fast || 0) + 1;
      this._slow = 0;
      if (this._fast >= 6) {
        this._fast = 0;
        this._degraded--;
        this.scale = clamp(this.scale / 0.82, 0.34, 1);
        this.w = this.h = -1;
        this.resize();
      }
    } else {
      this._slow = 0;
      this._fast = 0;
    }
  }

  render(dt) {
    const gl = this.gl;
    this.time = (performance.now() - this.t0) / 1000;

    // pointer easing gives the worlds their momentum
    const k = 1 - Math.pow(0.0015, dt);
    this.mouse.x += (this.mouse.tx - this.mouse.x) * k;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * k;

    const world = this.programs.get(this.current);
    if (!world) return;

    /* The post chain only exists for departures. While nothing is
       warping, fading or flashing, draw the world straight to the
       screen: one pass, no render target, no texture reads. */
    const transitioning = this.warp > 0.003 || this.fade > 0.003 || this.flash > 0.003;

    gl.bindVertexArray(this.vao);

    // ---- world
    gl.bindFramebuffer(gl.FRAMEBUFFER, transitioning ? this.fbo : null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(world.p);
    const u = world.u;
    if (u.uRes) gl.uniform2f(u.uRes, this.w, this.h);
    if (u.uTime) gl.uniform1f(u.uTime, this.time);
    if (u.uMouse) gl.uniform2f(u.uMouse, this.mouse.x, this.mouse.y);
    if (u.uScroll) gl.uniform1f(u.uScroll, this.scroll);
    if (u.uGrain) gl.uniform1f(u.uGrain, this.grain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!transitioning) return;

    // ---- post -> screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.post.p);
    const q = this.post.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (q.uScene) gl.uniform1i(q.uScene, 0);
    if (q.uRes) gl.uniform2f(q.uRes, this.w, this.h);
    if (q.uTime) gl.uniform1f(q.uTime, this.time);
    if (q.uWarp) gl.uniform1f(q.uWarp, this.warp);
    if (q.uFade) gl.uniform1f(q.uFade, this.fade);
    if (q.uFlash) gl.uniform1f(q.uFlash, this.flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
