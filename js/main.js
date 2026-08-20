/* ------------------------------------------------------------------
   NOWHERE CENTRAL — conductor
------------------------------------------------------------------ */

import { DESTINATIONS, STATUSES, LOST_AND_FOUND, NOTICES } from './data.js';
import { FlapLine } from './board.js';
import { Renderer } from './gl.js';
import { Station } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const COLS = { time: 5, dest: 16, plat: 2, status: 9 };

/* ================================================================
   Tiny tween engine — enough for shader uniforms and nothing more.
   ================================================================ */
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

function tween({ from, to, dur, ease = easeInOut, onUpdate, onDone }) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      onUpdate(from + (to - from) * ease(t), t);
      if (t < 1) requestAnimationFrame(step);
      else { onDone && onDone(); resolve(); }
    };
    requestAnimationFrame(step);
  });
}

/* ================================================================
   State
   ================================================================ */
const gl = new Renderer($('#gl'));
const station = new Station();
const rows = [];
let entered = false;
let inTransit = false;
let currentDest = null;
/* the click that opens the station must not also buy a ticket */
let gateUntil = 0;

if (!gl.ok) document.body.classList.add('no-gl');

/* ================================================================
   Boot sequence
   ================================================================ */
const BOOT_LINES = [
  ['SYS ', 'terminal authority · node 7', 220],
  ['NET ', 'uplink established — <b>latency 0 ms</b>', 260],
  ['CLK ', 'station clock synchronised', 200],
  ['BRD ', 'departure board — <b>6 services listed</b>', 300],
  ['AUD ', 'concourse ambience armed', 220],
  ['WRN ', '<b>platform 0 accessible only from platform 0</b>', 420],
  ['OK  ', 'ready. <span class="dim">the trains are already here.</span>', 260],
];

async function boot() {
  const log = $('#boot-log');
  if (REDUCED) {
    log.innerHTML = BOOT_LINES.map(([t, m]) => `<b>${t}</b> ${m}`).join('\n');
    $('#boot-cta').classList.add('in');
    return;
  }
  for (const [tag, msg, hold] of BOOT_LINES) {
    const line = document.createElement('div');
    log.appendChild(line);
    const plain = msg.replace(/<[^>]+>/g, '');
    for (let i = 0; i <= plain.length; i++) {
      line.innerHTML = `<b>${tag}</b> ${plain.slice(0, i)}`;
      await wait(7);
    }
    line.innerHTML = `<b>${tag}</b> ${msg}`;
    await wait(hold * 0.35);
  }
  await wait(240);
  $('#boot-cta').classList.add('in');
}

function enterStation() {
  if (entered) return;
  entered = true;
  gateUntil = performance.now() + 1200;
  scrollTo(0, 0);
  gl.ok && gl.start();          // nothing was drawn behind the boot veil
  station.init();
  station.enable();
  station.setWorld('concourse');
  updateSoundBtn();
  $('#boot').classList.add('gone');
  $('#boot').inert = true;
  $('#concourse').inert = false;
  $('#topbar').inert = false;
  document.body.classList.add('ready');
  setTimeout(() => {
    announce('Welcome to Nowhere Central. The board is live.');
    station.chime();
  }, 900);
  setTimeout(() => {
    buildBoard();
    // if the board is already on screen there is nothing to wait for
    const shell = $('#board-shell').getBoundingClientRect();
    if (shell.top < innerHeight - 60) populateBoard();
  }, 500);
}

/* ================================================================
   Board
   ================================================================ */
function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/* The board is 192 cells and 960 elements. Building it on load is a
   third of a second of parser time for something two screens down, so
   it is built when the section comes within a screen of the viewport
   — and always before the visitor can reach it. */
let boardBuilt = false;
function buildBoard() {
  if (boardBuilt) return;
  boardBuilt = true;
  const host = $('#board-rows');
  DESTINATIONS.forEach((d, i) => {
    const row = document.createElement('button');
    row.className = 'board-row';
    row.type = 'button';
    row.dataset.id = d.id;
    row.setAttribute('aria-label', `Service ${i + 1} to ${d.name}, platform ${d.platform}`);

    const idx = document.createElement('span');
    idx.className = 'idx w-idx';
    idx.textContent = String(i + 1).padStart(2, '0');
    row.appendChild(idx);

    const onFlip = () => station.click();
    const time = new FlapLine(row, COLS.time, { role: 'time', onFlip });
    const dest = new FlapLine(row, COLS.dest, { role: 'dest', onFlip });
    const plat = new FlapLine(row, COLS.plat, { role: 'plat', align: 'center', onFlip });
    const stat = new FlapLine(row, COLS.status, { role: 'status', onFlip });

    const depart = new Date(Date.now() + d.offset * 60000);
    rows.push({ d, row, time, dest, plat, stat, depart, status: d.status });

    row.addEventListener('click', () => depart_to(d.id));
    row.addEventListener('pointerenter', () => station.click());
    host.appendChild(row);
  });
}

let boardFilled = false;
function populateBoard() {
  if (boardFilled || !rows.length) return;
  boardFilled = true;
  rows.forEach((r, i) => {
    const base = i * 90;
    r.time.set(hhmm(r.depart), { from: base });
    r.dest.set(r.d.name, { from: base + 60 });
    r.plat.set(r.d.platform, { from: base + 120 });
    r.stat.set(r.status, { from: base + 150 });
  });
}

/* the board is never quite still */
function driftBoard() {
  setInterval(() => {
    if (!entered || inTransit || document.hidden) return;
    const r = rows[Math.floor(Math.random() * rows.length)];
    const next = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    if (next === r.status) return;
    r.status = next;
    r.stat.set(next, { stagger: 16 });
  }, 7200);

  // and the times creep forward
  setInterval(() => {
    if (!entered || inTransit || document.hidden) return;
    const r = rows[Math.floor(Math.random() * rows.length)];
    r.depart = new Date(r.depart.getTime() + 60000);
    r.time.set(hhmm(r.depart), { stagger: 20 });
  }, 19000);
}

/* ================================================================
   Departure → arrival
   ================================================================ */
async function depart_to(id) {
  if (inTransit || !entered || performance.now() < gateUntil) return;
  buildBoard();
  populateBoard();
  const entry = rows.find((r) => r.d.id === id);
  if (!entry) return;
  const d = entry.d;
  inTransit = true;
  currentDest = d;

  station.enable();
  station.chime();
  announce(`Platform ${d.platform}. The service to ${d.name} is ready to depart.`);

  const shell = $('#board-shell');
  $$('.board-row').forEach((el) => el.classList.remove('chosen'));
  entry.row.classList.add('chosen');
  shell.classList.add('departing');

  entry.status = 'BOARDING';
  entry.stat.set('BOARDING', { stagger: 14 });

  await wait(REDUCED ? 60 : 900);
  station.depart(1.6);

  if (REDUCED || !gl.ok) {
    openArrival(d);
    gl.ok && gl.setWorld(d.world);
    station.setWorld(d.world);
    shell.classList.remove('departing');
    inTransit = false;
    return;
  }

  // pull the frame apart
  await tween({
    from: 0, to: 1, dur: 1250, ease: easeIn,
    onUpdate: (v) => { gl.warp = v; gl.fade = Math.max(0, (v - 0.72) / 0.28) * 0.9; },
  });

  gl.flash = 0.85;
  gl.setWorld(d.world);
  station.setWorld(d.world);
  openArrival(d);
  shell.classList.remove('departing');

  await tween({
    from: 1, to: 0, dur: 1400, ease: easeOut,
    onUpdate: (v) => { gl.warp = v * 0.55; gl.fade = v * 0.5; gl.flash = v * 0.85; },
  });
  gl.warp = 0; gl.fade = 0; gl.flash = 0;
  inTransit = false;
}

async function returnHome() {
  if (inTransit || !currentDest) return;
  inTransit = true;
  station.depart(1.1);

  if (REDUCED || !gl.ok) {
    closeArrival();
    gl.ok && gl.setWorld('concourse');
    station.setWorld('concourse');
    inTransit = false;
    currentDest = null;
    return;
  }

  // pull apart first, then swap — the content never blinks out
  await tween({
    from: 0, to: 1, dur: 760, ease: easeIn,
    onUpdate: (v) => { gl.warp = v * 0.85; gl.fade = Math.max(0, (v - 0.55) / 0.45); },
  });
  closeArrival();
  gl.setWorld('concourse');
  station.setWorld('concourse');
  await tween({
    from: 1, to: 0, dur: 900, ease: easeOut,
    onUpdate: (v) => { gl.warp = v * 0.4; gl.fade = v; },
  });
  gl.warp = 0; gl.fade = 0;
  inTransit = false;
  currentDest = null;
  announce('You are back at Nowhere Central. Nothing was recorded.');
}

function openArrival(d) {
  const arr = $('#arrival');
  $('#arr-code').textContent = `${d.code} · SERVICE ${String(DESTINATIONS.indexOf(d) + 1).padStart(2, '0')}`;
  $('#arr-name').textContent = d.name;
  $('#arr-strap').textContent = d.strap;
  $('#arr-prose').textContent = d.prose;
  $('#arr-ref').textContent = `${d.code} · Platform ${d.platform}`;
  $('#arr-obs').textContent = `OBS ${hhmm(new Date())}`;
  $('#arr-advisory').textContent = d.advisory;

  const cond = $('#arr-cond');
  cond.innerHTML = '';
  d.conditions.forEach(([k, v, note], i) => {
    const row = document.createElement('div');
    row.className = 'crow';
    row.innerHTML = `<span class="k">${k}<i>${note}</i></span><span class="v">${v}</span>`;
    cond.appendChild(row);
    setTimeout(() => row.classList.add('in'), 380 + i * 70);
  });

  const nav = $('#arr-nav');
  nav.innerHTML = '';
  DESTINATIONS.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.code;
    b.title = o.name;
    if (o.id === d.id) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      if (o.id === d.id || inTransit) return;
      closeArrival();
      setTimeout(() => depart_to(o.id), 260);
    });
    nav.appendChild(b);
  });

  arr.classList.add('open');
  arr.setAttribute('aria-hidden', 'false');
  arr.inert = false;
  document.body.classList.add('away');
  // the concourse is invisible; make it untabbable too
  $('#concourse').inert = true;
  $('#topbar').inert = true;
  document.documentElement.style.overflow = 'hidden';
  $('#arr-back').focus({ preventScroll: true });
}

function closeArrival() {
  const arr = $('#arrival');
  arr.classList.remove('open');
  arr.setAttribute('aria-hidden', 'true');
  arr.inert = true;
  document.body.classList.remove('away');
  $('#concourse').inert = false;
  $('#topbar').inert = false;
  document.documentElement.style.overflow = '';
}

/* ================================================================
   Chrome: clock, notices, PA, cursor, reveals
   ================================================================ */
/* The clock ticks once a second, not once a frame, and writes into two
   stable text nodes instead of re-parsing innerHTML. */
function clock() {
  const el = $('#clock');
  el.textContent = '';
  const hm = document.createTextNode('--:--');
  const sec = document.createElement('span');
  sec.className = 'ms';
  sec.textContent = ':--';
  el.append(hm, sec);

  let lastMin = -1;
  const p = (v) => String(v).padStart(2, '0');
  const paint = () => {
    const n = new Date();
    if (n.getMinutes() !== lastMin) {
      lastMin = n.getMinutes();
      hm.nodeValue = `${p(n.getHours())}:${p(lastMin)}`;
    }
    sec.textContent = `:${p(n.getSeconds())}`;
  };
  paint();
  setInterval(paint, 500);
}

let paTimer;
function announce(text) {
  const pa = $('#pa');
  $('.txt', pa).textContent = text;
  pa.classList.add('show');
  clearTimeout(paTimer);
  paTimer = setTimeout(() => pa.classList.remove('show'), 5200);
}

function notices() {
  const el = $('#notice-line');
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    el.classList.add('swap');
    setTimeout(() => {
      i = (i + 1) % NOTICES.length;
      el.textContent = NOTICES[i];
      el.classList.remove('swap');
    }, 340);
  }, 9000);
}

let lfBuilt = false;
function lostAndFound() {
  if (lfBuilt) return;
  lfBuilt = true;
  const ul = $('#lf-list');
  const frag = document.createDocumentFragment();
  LOST_AND_FOUND.forEach(([ref, desc]) => {
    const li = document.createElement('li');
    li.className = 'lf-row';
    li.innerHTML = `<span class="ref">${ref}</span><span class="desc">${desc}</span><span class="arrow">↗</span>`;
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

/* Run something once, when its section approaches the viewport. */
function lazySection(selector, run, rootMargin = '900px 0px') {
  const el = $(selector);
  if (!el) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    },
    { rootMargin }
  );
  io.observe(el);
}

/* one pointer, read by the shaders, the cursor and the hero */
const ptr = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2 };
addEventListener(
  'pointermove',
  (e) => {
    ptr.px = e.clientX;
    ptr.py = e.clientY;
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = 1 - (e.clientY / innerHeight) * 2;
    gl.pointer(ptr.x, ptr.y);
  },
  { passive: true }
);

function cursor() {
  if (matchMedia('(hover: none)').matches || REDUCED) return;
  const c = $('#cursor');
  const title = $('.hero-title');
  const kicker = $('.hero-kicker');
  let x = innerWidth / 2, y = innerHeight / 2, ex = 0, ey = 0;

  const loop = () => {
    requestAnimationFrame(loop);

    const dx = ptr.px - x, dy = ptr.py - y;
    if (dx * dx + dy * dy > 0.02) {
      x += dx * 0.22;
      y += dy * 0.22;
      c.style.transform = `translate3d(${x}px,${y}px,0)`;
    }

    // the hero leans toward you — but only while the hero is on screen
    if (scrollY < innerHeight) {
      const ndx = ptr.x - ex, ndy = ptr.y - ey;
      if (ndx * ndx + ndy * ndy > 1e-6) {
        ex += ndx * 0.045;
        ey += ndy * 0.045;
        title.style.transform = `translate3d(${ex * 15}px, ${-ey * 9}px, 0)`;
        kicker.style.transform = `translate3d(${ex * 30}px, ${-ey * 16}px, 0)`;
      }
    }
  };
  loop();

  const hot = 'a, button, .board-row, .lf-row';
  addEventListener('pointerover', (e) => {
    c.classList.toggle('hot', !!(e.target.closest && e.target.closest(hot)));
  }, { passive: true });
}

function reveals() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.18 }
  );
  $$('.reveal').forEach((el) => io.observe(el));
}

function scrollFx() {
  const bar = $('#topbar');
  const onScroll = () => {
    const y = scrollY;
    bar.classList.toggle('stuck', y > 40);
    const max = document.body.scrollHeight - innerHeight;
    gl.scroll = max > 0 ? clamp(y / max, 0, 1) : 0;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function updateSoundBtn() {
  const btn = $('#sound-btn');
  btn.classList.toggle('on', station.enabled);
  btn.setAttribute('aria-pressed', String(station.enabled));
  $('#sound-label').textContent = station.enabled ? 'Sound on' : 'Sound off';
}

/* ================================================================
   Night service

   Sleep audio has requirements a pretty page does not: it has to be
   able to end on its own, it must not burn a screen or a battery for
   six hours, and the volume has to be reachable in the dark.
   ================================================================ */

const DIM_1_AFTER = 55000;    // screen steps back
const DIM_2_AFTER = 105000;   // screen goes out, GPU goes to sleep
const FADE_SECONDS = 90;

const night = {
  on: false,
  minutes: 0,
  endsAt: 0,
  ending: false,
  lastTouch: 0,
  dim: 0,
};

function nightOn() {
  return night.on;
}

function toggleNight(force) {
  const on = force === undefined ? !night.on : force;
  if (on === night.on) return;
  night.on = on;
  document.body.classList.toggle('night', on);
  $('#night').classList.toggle('open', on);
  $('#night').setAttribute('aria-hidden', String(!on));
  $('#night-btn').setAttribute('aria-pressed', String(on));
  night.lastTouch = performance.now();

  if (on) {
    station.enable();
    updateSoundBtn();
    setDim(0);
    announce('Night service. The station stays open.');
  } else {
    setDim(0);
    setTimer(0);
    night.ending = false;
    station.setVolume(station.volume);
    gl.ok && gl.setQuality(gl.quality);
    announce('Night service ended.');
  }
  paintNightStatus();
}

function setDim(level) {
  if (night.dim === level) return;
  night.dim = level;
  document.body.classList.toggle('dim-1', level >= 1);
  document.body.classList.toggle('dim-2', level >= 2);
  if (!gl.ok) return;
  // NIGHT is the last tier: a handful of frames a second at a quarter
  // of the pixels, so a laptop left on the nightstand stays cold.
  if (level >= 2) gl.setNight(true);
  else gl.setNight(false);
}

function setTimer(minutes) {
  night.minutes = minutes;
  night.ending = false;
  night.endsAt = minutes ? Date.now() + minutes * 60000 : 0;
  $$('#timer-chips button').forEach((b) =>
    b.setAttribute('aria-pressed', String(+b.dataset.min === minutes))
  );
  if (minutes) station.setVolume(station.volume);
  paintNightStatus();
}

function paintNightStatus() {
  const el = $('#night-status');
  if (!el) return;
  if (!night.on) { el.textContent = 'Station open. No timer set.'; return; }
  if (!night.minutes) { el.textContent = 'Station open. No timer set.'; return; }
  const left = Math.max(0, night.endsAt - Date.now());
  if (night.ending) { el.textContent = 'Last service. Fading out.'; return; }
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  el.textContent = `Last service in ${m}:${String(s).padStart(2, '0')}.`;
}

function nightTick() {
  const nc = $('#nightclock');
  const time = $('.nc-time', nc);
  const where = $('.nc-where', nc);
  const timer = $('.nc-timer', nc);

  setInterval(() => {
    if (!night.on) return;

    const idle = performance.now() - night.lastTouch;
    if (idle > DIM_2_AFTER) setDim(2);
    else if (idle > DIM_1_AFTER) setDim(1);
    else setDim(0);

    const n = new Date();
    const p = (v) => String(v).padStart(2, '0');
    time.textContent = `${p(n.getHours())}:${p(n.getMinutes())}`;
    where.textContent = currentDest ? currentDest.name : 'Nowhere Central';

    if (night.minutes) {
      const left = Math.max(0, night.endsAt - Date.now());
      const m = Math.ceil(left / 60000);
      timer.textContent = night.ending ? 'Fading out' : `Last service in ${m}m`;
      if (!night.ending && left <= FADE_SECONDS * 1000) {
        night.ending = true;
        station.fadeOut(FADE_SECONDS);
      }
      if (left <= 0) {
        setTimer(0);
        toggleNight(false);
        station.enabled && station.toggle();
        updateSoundBtn();
      }
    } else {
      timer.textContent = 'No timer';
    }
    paintNightStatus();
  }, 1000);

  // anything at all counts as being awake
  const wake = () => {
    night.lastTouch = performance.now();
    if (night.dim) setDim(0);
  };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    addEventListener(ev, wake, { passive: true })
  );
}

function nightWiring() {
  $('#night-btn').addEventListener('click', () => toggleNight());
  $('#night-close').addEventListener('click', () => toggleNight(false));

  const vol = $('#vol');
  const out = $('#vol-out');
  vol.value = String(Math.round(station.volume * 100));
  out.value = vol.value;
  vol.addEventListener('input', () => {
    out.value = vol.value;
    station.enable();
    station.setVolume(+vol.value / 100);
    updateSoundBtn();
  });

  $$('#timer-chips button').forEach((b) =>
    b.addEventListener('click', () => {
      setTimer(+b.dataset.min);
      station.enable();
      updateSoundBtn();
      announce(b.dataset.min === '0' ? 'Sleep timer off.' : `Sleep timer set for ${b.dataset.min} minutes.`);
    })
  );

  nightTick();
}

/* ================================================================
   Something passes the platform

   The concourse shader sweeps a light across the floor once every
   ~22 seconds. This watches that same clock so the crossing bell and
   the rail joints land with it instead of near it.
   ================================================================ */
const SWEEP_PERIOD = 1 / 0.0455;
function trainWatch() {
  let lastCycle = -1;
  setInterval(() => {
    if (!gl.ok || gl.current !== 'concourse' || !station.enabled) return;
    if (document.hidden || inTransit) return;
    const cycle = Math.floor(gl.time / SWEEP_PERIOD);
    if (cycle === lastCycle) return;
    lastCycle = cycle;
    // the sweep peaks halfway through the cycle
    station.trainPass(SWEEP_PERIOD * 0.5);
  }, 400);
}

/* ================================================================
   Wiring
   ================================================================ */
function keys() {
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { currentDest ? returnHome() : null; return; }
    if (!entered && (e.key === 'Enter' || e.key === ' ')) { enterStation(); return; }
    if (e.key === 'm' || e.key === 'M') { station.toggle(); updateSoundBtn(); return; }
    if (e.key === 'q' || e.key === 'Q') {
      if (!gl.ok) return;
      announce(`Rendering quality — ${gl.setQuality(gl.quality + 1)}`);
      return;
    }
    if (e.key === 'n' || e.key === 'N') { toggleNight(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= DESTINATIONS.length && entered && !currentDest) {
      depart_to(DESTINATIONS[n - 1].id);
    }
  });
}

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  $('#arrival').inert = true;
  $('#concourse').inert = true;   // until the gate opens
  $('#topbar').inert = true;

  /* Deferred work. The cells are built while the board is still a
     screen away; the flip itself waits until you are actually looking
     at it, because a departure board that has already finished
     flipping is just a table. */
  lazySection('#departures', buildBoard, '420px 0px');
  lazySection('#board-shell', () => entered && populateBoard(), '-60px 0px');
  lazySection('#lost', lostAndFound);

  clock();
  notices();
  cursor();
  reveals();
  scrollFx();
  keys();
  driftBoard();
  nightWiring();
  trainWatch();

  if (gl.ok) {
    gl.restoreQuality();
    gl.setWorld('concourse');
    addEventListener('resize', () => gl.resize(), { passive: true });
    // the boot veil is opaque — there is nothing to draw behind it
    gl.preload(['glass', 'noon', 'null', 'dunes', 'spire', 'inverted']);
  }

  $('#boot-cta').addEventListener('click', enterStation);
  $('#arr-back').addEventListener('click', returnHome);
  $('#sound-btn').addEventListener('click', () => { station.toggle(); updateSoundBtn(); });

  document.addEventListener('visibilitychange', () => {
    if (!gl.ok) return;
    document.hidden ? gl.stop() : gl.start();
  });

  // signalbox: for anyone who opens the console
  window.NC = { gl, station, rows, night, go: depart_to, home: returnHome, sleep: toggleNight };

  boot();
}

init();
