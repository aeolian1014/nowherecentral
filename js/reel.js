/* ------------------------------------------------------------------
   NOWHERE CENTRAL — the reel

   An arrival is entered, not opened. The choreography lives in
   main.js and matches a departure exactly: chime, board dims, frame
   pulls apart, flash, and you are through. This module only owns what
   is on the other side — the footage the service was carrying.

   Where a destination hands the frame to a GLSL world, an arrival
   hands it to a screen. The stage is a centred 16:9 box rather than a
   full-bleed cover, so the vignette tracks the picture at every
   viewport shape, and what surrounds it is the black of a room with
   one screen lit in it.

   Both boomerang files are baked forward-then-reversed at encode time
   rather than reversed here: negative playbackRate is not usable in
   any browser. Each is 121 frames out and 119 back, so neither the
   join nor the wrap repeats a frame.
------------------------------------------------------------------ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let panel, stage, mediaBox;
let titleEl, noteEl, lineEl, refEl, codeEl, navEl;
let raf = 0;
let cur = null;
let onPick = null;                       // main.js hands us the switcher
let items = [];
let soundOn = () => false;
let duck = () => {};
let getCtx = null;
let wantHd = () => false;   // main.js answers from the renderer's quality tier
let shownHd = null;         // the tier the element on screen was built with
let curBase = null;         // the SD path, so either tier can be derived

/* ---- the music bed -----------------------------------------------
   Streamed through an <audio> element rather than decoded into an
   AudioBuffer: decodeAudioData would hold ninety seconds of 48 kHz
   stereo PCM resident (~33 MB) for the sake of a 600 KB file, and
   nothing here needs sample-accurate scheduling. */
const MUSIC_VOL = 0.55;
let music = null, musicFade = 0;

function fadeMusic(to, ms, done) {
  if (!music) return;
  clearInterval(musicFade);
  const from = music.volume, t0 = performance.now();
  musicFade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    music.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(musicFade); musicFade = 0; done && done(); }
  }, 40);
}

function startMusic(src) {
  if (!music || music.dataset.src !== src) {
    stopMusic(true);
    music = new Audio(src);
    music.loop = true;                   // the file is crossfaded, so this is seamless
    music.preload = 'auto';
    music.dataset.src = src;
  }
  music.volume = 0;
  if (!soundOn()) return;                // armed but silent until sound is on
  music.play().catch(() => {});
  fadeMusic(MUSIC_VOL, 4000);
  duck(0, 2.5);                          // station engine silent: bed + cues only
}

function stopMusic(immediate) {
  if (!music) return;
  const m = music;
  if (immediate) { clearInterval(musicFade); m.pause(); m.removeAttribute('src'); music = null; return; }
  fadeMusic(0, 2200, () => { m.pause(); });
  duck(1, 2.5);
}

/* ---- the night programme -----------------------------------------
   One voice cue a minute over the bed. The opener runs first with its
   own held pauses, then the lines play in order; when the last one has
   been heard the opener comes back and the cycle repeats.

   The first cue waits out the music's 4s fade-in plus a little, so the
   bed is established before anything speaks into it. */
const FIRST_CUE = 15000;   // after entering, before the opener starts
const CUE_GAP   = 60000;   // held between every cue after the opener
let cueGen = 0;            // bumped to cancel any loop still in flight
let say = null, opener = [], lines = [];
let cancelSpeech = null;
let curCue = null;          // the cue currently sounding, so it can be cut

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A cue is either a recorded file (`src` — ogg, opus, wav, mp3, m4a or
   flac) or a line of text falling back to speech synthesis.

   Files are routed through the audio graph, not just played: 440–2800 Hz,
   compressed, with a short tail. Blending is mostly subtraction — the
   chest below 440 and the air above 2800 are what mark a voice as a
   separate, close-mic'd thing sitting on top of the music.

   But it is a level relationship first. A cue at 0.95 against a bed at
   0.55 is simply louder than the music, and no filtering hides that; it
   just makes a loud thin voice. So the cue sits BELOW the bed, and the
   bed dips only slightly to make room — a deep dip would pump, which is
   its own kind of unblended. */
const VOICE_VOL  = 0.30;   // well under MUSIC_VOL, deliberately
const MUSIC_DUCK = 0.46;   // from 0.55 — barely over 1 dB, just enough room
let chain = null;

function voiceChain(ctx) {
  if (!ctx) return null;
  if (chain && chain.ctx === ctx) return chain;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 440; hp.Q.value = 0.7;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2800; lp.Q.value = 0.7;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.008; comp.release.value = 0.18;

  const out = ctx.createGain(); out.gain.value = VOICE_VOL;

  // a short room, so she is somewhere rather than nowhere
  const len = Math.floor(ctx.sampleRate * 1.1);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lpv = 0;
    for (let i = 0; i < len; i++) {
      lpv += ((Math.random() * 2 - 1) - lpv) * 0.35;
      d[i] = lpv * Math.pow(1 - i / len, 2.4);
    }
  }
  const rev = ctx.createConvolver(); rev.buffer = buf;
  const wet = ctx.createGain(); wet.gain.value = 0.38;   // further back in the room

  hp.connect(lp).connect(comp).connect(out).connect(ctx.destination);
  comp.connect(wet).connect(rev).connect(out);

  chain = { ctx, input: hp };
  return chain;
}

/* While a reel is open the station bed is already held down under the
   music, so a cue must hand it back to THAT level and not to 1 —
   otherwise every line ends by swelling the whole concourse ambience
   up to full underneath the music, which is heard as a whoosh. */
const BED_DUCK = 0;    // silent in a reel, so cues restore to silence
const bedLevel = () => (music && !music.paused ? BED_DUCK : 1);

function playCue(cue) {
  if (cue && cue.src) {
    return new Promise((resolve) => {
      const el = new Audio(cue.src);
      el.crossOrigin = 'anonymous';

      let ducked = false, settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (curCue && curCue.el === el) curCue = null;
        if (ducked) {
          duck(bedLevel(), 1.4);
          if (music) fadeMusic(MUSIC_VOL, 1600);   // ease back, do not snap
        }
        resolve(true);
      };
      /* Cut, not faded: leaving a section must silence it now. Levels are
         deliberately NOT restored here — whoever tears the section down
         owns them, and restoring would fight stopMusic's fade-out. */
      curCue = { el, kill: () => {
        settled = true;
        if (curCue && curCue.el === el) curCue = null;
        try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
        resolve(false);
      } };
      /* Duck on `playing`, not before `play()`. A missing or unplayable
         file fires `error` immediately, and ducking for it would pump
         the bed down and back for a cue nobody ever hears. */
      el.addEventListener('playing', () => {
        ducked = true;
        duck(BED_DUCK, 0.3);
        if (music) fadeMusic(MUSIC_DUCK, 400);     // the music makes room too
      }, { once: true });
      el.addEventListener('ended', done, { once: true });
      el.addEventListener('error', done, { once: true });

      const ctx = getCtx && getCtx();
      const c = voiceChain(ctx);
      if (c) {
        try {
          if (ctx.state === 'suspended') ctx.resume();
          ctx.createMediaElementSource(el).connect(c.input);
        } catch (e) { el.volume = VOICE_VOL; }   // already routed, or no graph
      } else {
        el.volume = VOICE_VOL;
      }

      el.play().catch(done);
    });
  }
  if (!say) return Promise.resolve(false);
  duck(BED_DUCK, 0.3);
  return say(cue && cue.text ? cue.text : cue).then((v) => {
    duck(bedLevel(), 1.4);
    return v;
  });
}

/* Every cue in order, a minute apart, then round again. The first one
   waits 15s after entering so the bed is established before anything
   speaks into it; from then on the gap is uniform.

   Written as a sequential loop rather than a repeating timer because
   the gap is held BETWEEN cues — an interval measures from the previous
   cue's start, so a three-second clip would leave only fifty-seven.

   `gen` is the cancellation token. Leaving the reel bumps cueGen, and
   every await re-checks it on the way out, so a loop sitting in a
   sixty-second sleep cannot wake up and speak into a closed panel. */
async function cueLoop(gen) {
  const alive = () => gen === cueGen && reelOpen();
  const all = [...opener, ...lines];
  if (!all.length) return;

  await sleep(FIRST_CUE);
  let i = 0;
  while (alive()) {
    if (soundOn()) await playCue(all[i]);     // muted: lose the line, keep the clock
    i = (i + 1) % all.length;
    if (!alive()) return;
    await sleep(CUE_GAP);
  }
}

function startCues() {
  cueGen++;                                     // cancel anything still running
  if (!opener.length && !lines.length) return;
  cueLoop(cueGen);
}

function stopCues() {
  cueGen++;                                     // no further cues
  if (curCue) curCue.kill();                    // and silence the one mid-flight
  if (cancelSpeech) cancelSpeech();             // including a spoken fallback
}

/** Sound was toggled — follow it without restarting the schedule.
    Silencing has to happen before the early return below: a cue can be
    mid-sentence with no music up at all, and "sound off" must mean the
    whole site, not just the bed. The cue schedule keeps its clock; it
    simply plays nothing while muted. */
export function reelAudio(on) {
  if (!on) {
    if (curCue) curCue.kill();                  // cut a line already speaking
    if (cancelSpeech) cancelSpeech();           // and any synthesised fallback
  }
  if (!music || !reelOpen()) return;
  if (on) { music.play().catch(() => {}); fadeMusic(MUSIC_VOL, 1200); duck(0.22, 1.5); }
  else fadeMusic(0, 600, () => music && music.pause());
}

const P = { x: 0, y: 0, tx: 0, ty: 0 };

function frame() {
  const dx = P.tx - P.x, dy = P.ty - P.y;
  P.x += dx * 0.06;
  P.y += dy * 0.06;
  if (cur) {
    cur.style.transform =
      `scale(1.08) translate3d(${(-P.x * 1.6).toFixed(3)}%, ${(-P.y * 1.6).toFixed(3)}%, 0)`;
  }
  /* Once it has caught the pointer there is nothing left to animate.
     Park rather than burn a frame a tick on a picture that is not moving;
     the next pointermove wakes it. */
  if (dx * dx + dy * dy < 2.5e-7) { raf = 0; return; }
  raf = requestAnimationFrame(frame);
}
const wake = () => { if (!raf && reelOpen()) raf = requestAnimationFrame(frame); };
const onMove = (e) => {
  const r = stage.getBoundingClientRect();
  P.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  P.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  wake();
};
const onLeave = () => { P.tx = 0; P.ty = 0; wake(); };

export function initReel({ list = [], onSelect = null, onBack = null,
                           isSoundOn = null, onDuck = null,
                           onSay = null, onCancelSpeech = null, isHd = null,
                           cueOpener = [], cueLines = [],
                           audioCtx = null } = {}) {
  if (isSoundOn) soundOn = isSoundOn;
  if (onDuck) duck = onDuck;
  if (onSay) say = onSay;
  if (onCancelSpeech) cancelSpeech = onCancelSpeech;
  if (isHd) wantHd = isHd;
  if (audioCtx) getCtx = audioCtx;
  opener = cueOpener;
  lines = cueLines;
  panel    = document.getElementById('reel');
  stage    = document.getElementById('reel-stage');
  mediaBox = document.getElementById('reel-media');
  titleEl  = document.getElementById('reel-title');
  noteEl   = document.getElementById('reel-note');
  lineEl   = document.getElementById('reel-line');
  refEl    = document.getElementById('reel-ref');
  codeEl   = document.getElementById('reel-code');
  navEl    = document.getElementById('reel-nav');
  items    = list;
  onPick   = onSelect;
  document.getElementById('reel-back').addEventListener('click', () => onBack && onBack());
}

/** assets/media/foo.mp4 -> assets/media/foo-hd.mp4 */
const hdSrc = (src) => src.replace(/\.mp4$/, '-hd.mp4');

/** Swap the showing video to the currently selected tier, in place.

    Q has to change the picture, not just a setting — so this reloads the
    element with the other encode and restores the playhead, rather than
    waiting for the next service. The seek matters: without it the clip
    snaps back to frame one, which reads as a glitch rather than a
    quality change. Returns false when there is nothing to do. */
export function reelRetier() {
  if (!cur || cur.tagName !== 'VIDEO' || !curBase) return false;
  const hd = wantHd();
  if (hd === shownHd) return false;
  shownHd = hd;

  const at = cur.currentTime;
  const wasPlaying = !cur.paused;
  const el = cur;
  el.addEventListener('loadedmetadata', () => {
    try { el.currentTime = at; } catch (e) {}
    if (wasPlaying) el.play().catch(() => {});
  }, { once: true });
  el.src = hd ? hdSrc(curBase) : curBase;
  el.load();
  return true;
}

/** Swap in the footage. The transition around this is main.js's job. */
export function showReel(a) {
  if (!a || !a.media) return false;

  mediaBox.replaceChildren();
  cur = null;

  if (a.media.type === 'video') {
    const v = document.createElement('video');
    /* A <video> carries one fixed encode, so quality cannot be a live
       uniform the way the shader's resolution is. Two files are shipped
       per clip and the tier is chosen here, when the element is built —
       which is why changing Q mid-service only takes effect on the next
       one, and why main.js says so rather than appearing to do nothing. */
    shownHd = wantHd();
    curBase = a.media.src;
    v.src = shownHd ? hdSrc(curBase) : curBase;
    v.muted = true;                     // the files carry no audio track either
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.play().catch(() => {});
    cur = v;
  } else {
    const img = document.createElement('img');
    img.src = a.media.src;
    img.alt = '';
    img.decoding = 'async';
    cur = img;
  }
  mediaBox.appendChild(cur);

  stage.classList.toggle('tape', a.media.fx === 'tape' && !REDUCED);

  if (a.media.audio) startMusic(a.media.audio); else stopMusic();
  if (a.media.cues) startCues(); else stopCues();   // per-section, not per-bed

  codeEl.textContent  = `${a.code} · SERVICE ${String(items.indexOf(a) + 1).padStart(2, '0')}`;
  titleEl.textContent = a.name;
  noteEl.textContent  = a.note;
  lineEl.textContent  = a.line;
  refEl.textContent   = `${a.code} · Platform ${a.platform || '—'}`;

  navEl.replaceChildren();
  items.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.code;
    b.title = o.name;
    if (o.id === a.id) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => { if (o.id !== a.id && onPick) onPick(o.id); });
    navEl.appendChild(b);
  });

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.inert = false;
  document.body.classList.add('away');
  document.getElementById('concourse').inert = true;
  document.getElementById('topbar').inert = true;
  document.documentElement.style.overflow = 'hidden';

  P.x = P.y = P.tx = P.ty = 0;
  if (!REDUCED) {
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  document.getElementById('reel-back').focus({ preventScroll: true });
  return true;
}

export function hideReel() {
  if (!panel || !panel.classList.contains('open')) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  document.body.classList.remove('away');
  document.getElementById('concourse').inert = false;
  document.getElementById('topbar').inert = false;
  document.documentElement.style.overflow = '';

  stage.removeEventListener('pointermove', onMove);
  stage.removeEventListener('pointerleave', onLeave);
  cancelAnimationFrame(raf); raf = 0;
  stopMusic();
  stopCues();

  setTimeout(() => {
    if (panel.classList.contains('open')) return;      // re-entered during the fade
    if (cur && cur.tagName === 'VIDEO') { cur.pause(); cur.removeAttribute('src'); cur.load(); }
    mediaBox.replaceChildren();
    cur = null;
    shownHd = null;
    curBase = null;
  }, 480);
}

export function reelOpen() { return !!panel && panel.classList.contains('open'); }

/* Nothing decodes in a tab nobody is looking at. */
document.addEventListener('visibilitychange', () => {
  if (music && reelOpen()) {
    if (document.hidden) music.pause();
    else if (soundOn()) music.play().catch(() => {});
  }
  if (!cur || cur.tagName !== 'VIDEO') return;
  if (document.hidden) cur.pause();
  else if (reelOpen()) cur.play().catch(() => {});
});
