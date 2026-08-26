/* ------------------------------------------------------------------
   NOWHERE CENTRAL — conductor
------------------------------------------------------------------ */

import {
  DESTINATIONS, STATUSES, LOST_AND_FOUND, NOTICES, COUNTER_PROMPTS,
  ARRIVALS, NIGHT_OPENER, NIGHT_LINES,
} from './data.js';
import { FlapLine } from './board.js';
import { Renderer } from './gl.js';
import { Station } from './audio.js';
import { Announcer, welcomeLine } from './voice.js';
import { SCENE_OF } from './scenes.js';
import { initReel, showReel, hideReel, reelOpen, reelAudio, reelRetier } from './reel.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
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
const announcer = new Announcer();
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

  // characters land every 7ms, far faster than a clack can ring; throttle
  // the keystroke sound to a realistic fast-typist cadence and skip spaces
  let lastKey = 0;
  const strike = (ch, force) => {
    if (ch === ' ' && !force) return;
    const now = performance.now();
    if (!force && now - lastKey < 42) return;
    lastKey = now;
    station.key();
  };

  for (const [tag, msg, hold] of BOOT_LINES) {
    const line = document.createElement('div');
    log.appendChild(line);
    const plain = msg.replace(/<[^>]+>/g, '');
    for (let i = 0; i <= plain.length; i++) {
      line.innerHTML = `<b>${tag}</b> ${plain.slice(0, i)}`;
      if (i > 0) strike(plain[i - 1]);
      await wait(7);
    }
    line.innerHTML = `<b>${tag}</b> ${msg}`;
    station.keyReturn();                    // the carriage return at line end
    await wait(hold * 0.35);
  }
  await wait(240);
  $('#boot-cta').classList.add('in');
}

/* The boot log types on load, before any click — but browsers block
   audio until a gesture. So the log waits behind one: the first tap or
   key press wakes the audio engine and then the terminal starts typing,
   with sound. */
let bootStarted = false;
function beginBoot() {
  if (bootStarted) return;
  bootStarted = true;
  station.prime();
  $('#boot-begin').classList.add('gone');
  boot();
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
  document.documentElement.classList.remove('boot-lock');
  $('#boot').classList.add('gone');
  $('#boot').inert = true;
  $('#concourse').inert = false;
  $('#topbar').inert = false;
  document.body.classList.add('ready');

  /* The arrival sequence: two-tone chime, then the announcer reads the
     next service off the board she is standing under. Fifteen seconds
     after she finishes, the first train comes through. */
  /* The welcome sits behind ~3s of timers, so cancelling the announcer on
     boarding does nothing — at that point she has not started, and the
     queued line fires afterwards from inside a destination. The gate has
     to be re-checked at every step, not just once. */
  const stillOnConcourse = () => !currentDest && !currentArrival && !reelOpen();

  setTimeout(async () => {
    if (!stillOnConcourse()) return;
    station.chime();
    await wait(2100);                       // let the chime ring out
    if (!stillOnConcourse()) return;        // boarded while the chime rang
    buildArrivals();                        // the board she is standing under
    const next = arrRows[0];
    await announce(
      'Welcome to Nowhere Central. The board is live.',
      { speak: next ? welcomeLine(next.a, next.depart) : 'Welcome to Nowhere Central.' }
    );
    trainDueIn(15000);
  }, 900);

  setTimeout(() => {
    buildBoard();
    // if the board is already on screen there is nothing to wait for
    const shell = $('#board-shell').getBoundingClientRect();
    if (shell.top < innerHeight - 60) populateVisible();
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

function fillDepartures(from = 0) {
  rows.forEach((r, i) => {
    const base = from + i * 90;
    r.time.set(hhmm(r.depart), { from: base });
    r.dest.set(r.d.name, { from: base + 60 });
    r.plat.set(r.d.platform, { from: base + 120 });
    r.stat.set(r.status, { from: base + 150 });
  });
}

let boardFilled = false;
function populateBoard() {
  if (boardFilled || !rows.length) return;
  boardFilled = true;
  fillDepartures(0);
}

let arrFilled = false;
function populateArrivals() {
  if (arrFilled || !arrRows.length) return;
  arrFilled = true;
  fillArrivals(0);
}

/* Fill whichever board is actually on screen. The default view is the
   media board now, so filling `rows` on entry would have flapped up a
   board sitting behind a hidden tab while the visible one stayed blank. */
function populateVisible() {
  if (boardView === 'media') { buildArrivals(); populateArrivals(); }
  else { buildBoard(); populateBoard(); }
}

/* ================================================================
   The other board

   Departures sends you somewhere invented. Arrivals lists services
   from places you actually had, and not one of them lands — so these
   rows navigate nowhere. Pressing one gets the announcer saying no,
   which is the entire content of the panel.
   ================================================================ */
const arrRows = [];
let arrBuilt = false;

function buildArrivals() {
  if (arrBuilt) return;
  arrBuilt = true;
  const host = $('#arr-rows');
  ARRIVALS.forEach((a, i) => {
    const row = document.createElement('button');
    row.className = 'board-row arr';
    row.type = 'button';
    row.dataset.id = a.id;
    row.setAttribute('aria-label', `Arrival ${i + 1} from ${a.name}. ${a.status}.`);

    const idx = document.createElement('span');
    idx.className = 'idx w-idx';
    idx.textContent = String(i + 1).padStart(2, '0');
    row.appendChild(idx);

    const onFlip = () => station.click();
    const time = new FlapLine(row, COLS.time, { role: 'time', onFlip });
    const dest = new FlapLine(row, COLS.dest, { role: 'dest', onFlip });
    const plat = new FlapLine(row, COLS.plat, { role: 'plat', align: 'center', onFlip });
    const stat = new FlapLine(row, COLS.status, { role: 'status', onFlip });

    const depart = new Date(Date.now() + a.offset * 60000);
    arrRows.push({ a, row, time, dest, plat, stat, depart, status: a.status });

    row.addEventListener('click', () => arrive_at(a.id));
    row.addEventListener('pointerenter', () => station.click());
    host.appendChild(row);
  });
}

function fillArrivals(from = 0) {
  arrRows.forEach((r, i) => {
    const base = from + i * 90;
    r.time.set(hhmm(r.depart), { from: base });
    r.dest.set(r.a.name, { from: base + 60 });
    r.plat.set(r.a.platform, { from: base + 120 });
    r.stat.set(r.status, { from: base + 150 });
  });
}

/* ---- entering an arrival -----------------------------------------
   The same choreography as a departure, beat for beat, because it is
   the same act: the board dims, the chosen row stays lit, the frame
   pulls apart and lets go. The only difference is what is on the far
   side — a destination hands the frame to a GLSL world, an arrival
   hands it to a screen with footage on it. */
let currentArrival = null;

async function arrive_at(id) {
  if (inTransit || quietOpen || !entered || performance.now() < gateUntil) return;
  if (boardView !== 'media') return;             // only from the board showing it
  buildArrivals();
  populateArrivals();
  const entry = arrRows.find((r) => r.a.id === id);
  if (!entry) return;
  const a = entry.a;
  inTransit = true;
  currentArrival = a;
  pushOverlayState();                            // so Back returns to the board

  station.enable();
  station.stopTrain();                           // a pass in flight does not follow you
  announcer.cancel();                            // she does not follow you out
  /* No chime, and no setWorld: setWorld tears down every layer and
     fades the new ones up over 1.6s, which is the sound that grows in
     after you enter. In a reel the station bus is muted outright, so
     only the music bed and the voice cues are audible. */
  announce(`${a.name}. ${a.note}`);

  const shell = $('#board-shell');
  $$('.board-row').forEach((el) => el.classList.remove('chosen'));
  entry.row.classList.add('chosen');
  shell.classList.add('departing');

  entry.stat.set('ARRIVING', { stagger: 14 });   // the one time it ever does

  await wait(REDUCED ? 60 : 900);
  /* No station.depart() here — that is the rising sweep, and over a
     music bed it reads as a whoosh rather than a train. The world
     board keeps it; a reel is a screen, not a departure. */

  if (REDUCED || !gl.ok) {
    showReel(a);
    shell.classList.remove('departing');
    gl.ok && gl.stop();
    inTransit = false;
    return;
  }

  await tween({
    from: 0, to: 1, dur: 1250, ease: easeIn,
    onUpdate: (v) => { gl.warp = v; gl.fade = Math.max(0, (v - 0.72) / 0.28) * 0.9; },
  });

  gl.flash = 0.85;
  showReel(a);
  shell.classList.remove('departing');

  await tween({
    from: 1, to: 0, dur: 1400, ease: easeOut,
    onUpdate: (v) => { gl.warp = v * 0.55; gl.fade = v * 0.5; gl.flash = v * 0.85; },
  });
  gl.warp = 0; gl.fade = 0; gl.flash = 0;
  /* The reel covers the canvas completely, so from here the shader is
     drawing a full-screen frame nobody can see. Park it until we leave. */
  gl.stop();
  inTransit = false;
}

async function leaveArrival() {
  if (inTransit || !currentArrival) return;
  inTransit = true;

  const back = () => {
    const r = arrRows.find((x) => x.a.id === currentArrival.id);
    if (r) r.stat.set(r.status, { stagger: 16 });   // it never actually arrived
    currentArrival = null;
  };

  gl.ok && gl.start();                            // wake it before it is needed

  if (REDUCED || !gl.ok) {
    hideReel(); back();
    station.setWorld('concourse');
    inTransit = false;
    return;
  }

  await tween({
    from: 0, to: 1, dur: 900, ease: easeIn,
    onUpdate: (v) => { gl.warp = v * 0.7; gl.fade = Math.max(0, (v - 0.7) / 0.3) * 0.85; },
  });
  hideReel(); back();
  station.setWorld('concourse');
  await tween({
    from: 1, to: 0, dur: 1100, ease: easeOut,
    onUpdate: (v) => { gl.warp = v * 0.4; gl.fade = v * 0.45; },
  });
  gl.warp = 0; gl.fade = 0;
  inTransit = false;
}

/* ---- switching ---------------------------------------------------
   The incoming board is blanked and allowed to flap back up, because
   a real one cannot cut. Cell.to replaces its queue rather than
   appending to it, so the blank pass and the fill pass have to be
   separated in time or the second cancels the first. */
/* The view tokens name the CONTENT, not the tab, because the two were
   swapped: the tab labelled Departures now carries the media services
   and the one labelled Arrivals carries the shader worlds. Naming these
   'dep' and 'arr' after the swap would mean `boardView === 'dep'` was
   true while an arrivals board was on screen. */
let boardView = 'media';

function showBoard(which) {
  if (which === boardView || inTransit || quietOpen || reelOpen()) return;
  boardView = which;
  const isMedia = which === 'media';         // media -> #panel-dep, worlds -> #panel-arr
  if (isMedia) buildArrivals(); else buildBoard();

  const tD = $('#tab-dep'), tA = $('#tab-arr');
  tD.classList.toggle('on', isMedia);
  tA.classList.toggle('on', !isMedia);
  tD.setAttribute('aria-selected', String(isMedia));
  tA.setAttribute('aria-selected', String(!isMedia));
  tD.tabIndex = isMedia ? 0 : -1;
  tA.tabIndex = isMedia ? -1 : 0;
  $('#tabs-ink').style.transform = isMedia ? 'translateX(0%)' : 'translateX(100%)';

  $('#panel-dep').hidden = !isMedia;
  $('#panel-arr').hidden = isMedia;
  $('#board-foot-note').textContent = isMedia
    ? 'No service on this board is expected.'
    : 'Board refreshed continuously';

  station.chime();

  const target = isMedia ? arrRows : rows;
  target.forEach((r) => {
    r.time.set('', { from: 0 });
    r.dest.set('', { from: 30 });
    r.plat.set('', { from: 60 });
    r.stat.set('', { from: 80 });
  });
  setTimeout(() => {
    if (boardView !== which) return;                 // switched again mid-flap
    /* The world board's times are offsets from now, not fixed clock values,
       so they are re-derived on the way back in. Otherwise the column shows
       times that have quietly gone past. Statuses carry over untouched. */
    if (isMedia) arrRows.forEach((r) => { r.depart = new Date(Date.now() + r.a.offset * 60000); });
    else rows.forEach((r) => { r.depart = new Date(Date.now() + r.d.offset * 60000); });
    (isMedia ? fillArrivals : fillDepartures)(0);
  }, REDUCED ? 0 : 430);
}

function boardWiring() {
  $('#tab-dep').addEventListener('click', () => showBoard('media'));
  $('#tab-arr').addEventListener('click', () => showBoard('worlds'));
  $('.board-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = boardView === 'media' ? 'worlds' : 'media';
    showBoard(next);
    $(next === 'media' ? '#tab-dep' : '#tab-arr').focus();
  });
}

/* the board is never quite still */
function driftBoard() {
  setInterval(() => {
    if (!entered || inTransit || document.hidden || reelOpen()) return;
    const r = rows[Math.floor(Math.random() * rows.length)];
    const next = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    if (next === r.status) return;
    r.status = next;
    r.stat.set(next, { stagger: 16 });
  }, 7200);

  // and the times creep forward
  setInterval(() => {
    if (!entered || inTransit || document.hidden || reelOpen()) return;
    const r = rows[Math.floor(Math.random() * rows.length)];
    r.depart = new Date(r.depart.getTime() + 60000);
    r.time.set(hhmm(r.depart), { stagger: 20 });
  }, 19000);

  /* The media board drifts the same way the world board does — times
     creep forward, statuses shuffle — so both read as live clocks
     rather than one live board and one frozen one. */
  setInterval(() => {
    if (!entered || inTransit || document.hidden || reelOpen()) return;
    if (!arrBuilt || boardView !== 'media') return;
    const r = arrRows[Math.floor(Math.random() * arrRows.length)];
    const worse = ['DELAYED', 'HELD', 'LATE', 'NO REPORT', 'NOT KNOWN', 'CANCELLED'];
    const next = worse[Math.floor(Math.random() * worse.length)];
    if (next !== r.status) {
      r.status = next;
      r.stat.set(next, { stagger: 16 });
    }
    if (Math.random() < 0.4) {
      r.depart = new Date(r.depart.getTime() + 60000);
      r.time.set(hhmm(r.depart), { stagger: 20 });
    }
  }, 11000);
}

/* ================================================================
   Departure → arrival
   ================================================================ */
async function depart_to(id) {
  if (inTransit || quietOpen || !entered || performance.now() < gateUntil) return;
  if (boardView !== 'worlds') return;           // the other board goes nowhere
  buildBoard();
  populateBoard();
  const entry = rows.find((r) => r.d.id === id);
  if (!entry) return;
  const d = entry.d;
  inTransit = true;
  currentDest = d;
  pushOverlayState();                            // so Back returns to the board

  station.enable();
  station.stopTrain();                           // a pass in flight does not follow you
  announcer.cancel();                            // the welcome does not follow you out
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

/**
 * @param {string} text shown on the PA strip
 * @param {{speak?:string}} opts when `speak` is given, she says that
 *   instead — the written line is terse, the spoken one is not.
 */
function announce(text, opts = {}) {
  const pa = $('#pa');
  $('.txt', pa).textContent = text;
  pa.classList.add('show');
  clearTimeout(paTimer);
  paTimer = setTimeout(() => pa.classList.remove('show'), opts.speak ? 9000 : 5200);
  if (opts.speak && station.enabled) return speak(opts.speak);
  return Promise.resolve(false);
}

/**
 * Her voice cannot be filtered — Web Speech bypasses the audio graph
 * entirely — so the equipment gets built around her instead: the relay
 * keys up, the carrier hiss and mains hum run underneath, and every
 * word she reaches pulses the amplifier. The ear fuses a voice with a
 * noise bed sharing its band and its timing and hears one tannoy.
 */
function speak(line) {
  return announcer.say(line, {
    gap: 640,
    onStart: () => { station.duck(0.22, 0.3); station.paOpen(); },
    onWord: () => station.paPulse(0.6 + Math.random() * 0.6),
    onEnd: () => { station.paClose(); station.duck(1, 1.4); },
  });
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

/* ================================================================
   The counter

   The lost property list was decoration that looked interactive. It
   is now the one part of this station that is actually of use.

   Writing down what is on your mind before bed — cognitive
   offloading, or "constructive worry" — measurably shortens how long
   it takes to fall asleep: a mind stops rehearsing something once it
   trusts that something else is holding it. So the counter takes it,
   gives it a reference, and keeps it until morning.

   It never leaves the device. There is no server to send it to.
   ================================================================ */

const HELD_KEY = 'nc-counter';

function held() {
  try { return JSON.parse(localStorage.getItem(HELD_KEY) || '[]'); } catch (e) { return []; }
}
function saveHeld(list) {
  try { localStorage.setItem(HELD_KEY, JSON.stringify(list)); } catch (e) {}
}

/** The reference comes out of what you left, the way a real one would. */
function makeRef(text) {
  const word = (text.trim().split(/\s+/)[0] || 'ITM').replace(/[^a-z]/gi, '').toUpperCase();
  return (word + 'XXX').slice(0, 3) + '-' + Math.floor(1000 + Math.random() * 9000);
}

function heldSince(ts) {
  const then = new Date(ts);
  const now = new Date();
  if (then.toDateString() === now.toDateString()) {
    const p = (v) => String(v).padStart(2, '0');
    return `Held since ${p(then.getHours())}:${p(then.getMinutes())}`;
  }
  const days = Math.floor((now - then) / 86400000);
  if (days <= 1) return 'Held since yesterday';
  if (days < 7) return `Held ${days} days`;
  return `Held since ${then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

let lfBuilt = false;
function lostAndFound() {
  if (lfBuilt) return;
  lfBuilt = true;
  const ul = $('#lf-list');
  const frag = document.createDocumentFragment();
  LOST_AND_FOUND.forEach(([ref, desc, note]) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lf-row';
    b.setAttribute('aria-label', desc + ' — pick it up');
    b.innerHTML = '<span class="ref"></span><span class="desc"></span><span class="arrow">↗</span>';
    $('.ref', b).textContent = ref;
    $('.desc', b).textContent = desc;
    b.addEventListener('click', () => openQuiet({ ref, desc, note }));
    li.appendChild(b);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
  renderHeld();
}

function renderHeld() {
  const wrap = $('#lf-held-wrap');
  const ul = $('#lf-held');
  if (!wrap || !ul) return;
  const list = held();
  wrap.hidden = list.length === 0;
  $('#lf-held-n').textContent = list.length ? list.length + (list.length > 1 ? ' items' : ' item') : '';
  ul.textContent = '';
  list.slice().reverse().forEach((item) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lf-row';
    b.setAttribute('aria-label', item.text + ' — claim it back');
    b.innerHTML = '<span class="ref"></span><span class="desc"></span><span class="arrow">↺</span>';
    // textContent, never innerHTML: this is the visitor's own writing
    $('.ref', b).textContent = item.ref;
    const d = $('.desc', b);
    d.textContent = item.text;
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = heldSince(item.at) + ' · click to take it back';
    d.appendChild(when);
    b.addEventListener('click', () => claimBack(item.ref));
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function claimBack(ref) {
  saveHeld(held().filter((i) => i.ref !== ref));
  renderHeld();
  station.click(0.08);
  announce(ref + ' returned to you. It was here the whole time.');
}

/* ================================================================
   The quiet room

   Picking something up off the counter does not open a form. It
   plays back what the object has been looking at: one slow scene,
   full screen, with nothing to do and nothing that ends.

   The chrome removes itself after a few seconds of stillness, so
   what is left is the thing itself. Move anything and it comes back.
   ================================================================ */

const QUIET_STILL_AFTER = 5000;
let quietOpen = false;
let quietItem = null;
let quietStill = 0;

async function openQuiet(item) {
  if (quietOpen || inTransit) return;
  const scene = SCENE_OF[item.ref];
  if (!scene || !gl.ok) { openCounter(item); return; }   // no WebGL: fall back to the slip

  quietOpen = true;
  quietItem = item;
  inTransit = true;
  pushOverlayState();                            // Back closes it

  $('#q-ref').textContent = item.ref;
  $('#q-title').textContent = scene.title;
  $('#q-caption').textContent = scene.caption;

  station.chime();

  // a long fade rather than the departure warp: nothing here is sudden
  if (!REDUCED) {
    await tween({ from: 0, to: 1, dur: 1500, ease: easeInOut, onUpdate: (v) => { gl.fade = v; } });
  }
  gl.setWorld(scene.id);
  station.setWorld('spire');            // the calmest bed on the site
  document.body.classList.add('away');
  $('#concourse').inert = true;
  $('#topbar').inert = true;
  document.documentElement.style.overflow = 'hidden';

  const q = $('#quiet');
  q.classList.add('open');
  q.setAttribute('aria-hidden', 'false');
  q.inert = false;
  markQuietMoved();

  if (!REDUCED) {
    await tween({ from: 1, to: 0, dur: 2200, ease: easeOut, onUpdate: (v) => { gl.fade = v; } });
  }
  gl.fade = 0;
  inTransit = false;
}

async function closeQuiet() {
  if (!quietOpen || inTransit) return;
  inTransit = true;

  if (!REDUCED) {
    await tween({ from: 0, to: 1, dur: 1100, ease: easeIn, onUpdate: (v) => { gl.fade = v; } });
  }
  const q = $('#quiet');
  q.classList.remove('open');
  q.setAttribute('aria-hidden', 'true');
  q.inert = true;
  document.body.classList.remove('away', 'q-still');
  $('#concourse').inert = false;
  $('#topbar').inert = false;
  document.documentElement.style.overflow = '';
  gl.setWorld('concourse');
  station.setWorld('concourse');
  quietOpen = false;
  quietItem = null;

  if (!REDUCED) {
    await tween({ from: 1, to: 0, dur: 1400, ease: easeOut, onUpdate: (v) => { gl.fade = v; } });
  }
  gl.fade = 0;
  inTransit = false;
}

/** move to something else on the counter without going back for it */
function nextQuiet() {
  if (!quietItem) return;
  const refs = LOST_AND_FOUND.map((r) => r[0]);
  let i = refs.indexOf(quietItem.ref);
  i = (i + 1 + (Math.random() * (refs.length - 1) | 0)) % refs.length;
  const row = LOST_AND_FOUND[i];
  const scene = SCENE_OF[row[0]];
  if (!scene) return;
  quietItem = { ref: row[0], desc: row[1], note: row[2] };
  $('#q-ref').textContent = row[0];
  $('#q-title').textContent = scene.title;
  $('#q-caption').textContent = scene.caption;
  gl.setWorld(scene.id);
  station.click(0.05);
  markQuietMoved();
}

function markQuietMoved() {
  quietStill = performance.now();
  if (document.body.classList.contains('q-still')) {
    document.body.classList.remove('q-still');
  }
}

function quietWatch() {
  setInterval(() => {
    if (!quietOpen) return;
    if (performance.now() - quietStill > QUIET_STILL_AFTER) {
      document.body.classList.add('q-still');
    }
  }, 500);
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    addEventListener(ev, () => quietOpen && markQuietMoved(), { passive: true })
  );
}

function quietWiring() {
  $('#q-back').addEventListener('click', dismissOverlay);
  $('#q-next').addEventListener('click', nextQuiet);
  $('#q-leave').addEventListener('click', () => quietItem && openCounter(quietItem));
  quietWatch();
}

/* ---- the deposit slip ------------------------------------------- */

let counterOpen = false;

function openCounter(item) {
  const el = $('#counter');
  $('#ctr-ref').textContent = item.ref;
  $('#ctr-item').textContent = item.desc;
  $('#ctr-note').textContent = item.note || '';
  $('#ctr-prompt').textContent = COUNTER_PROMPTS[(Math.random() * COUNTER_PROMPTS.length) | 0];
  const ta = $('#ctr-text');
  ta.value = '';
  $('#ctr-n').textContent = '0';
  $('#ctr-hand').disabled = true;
  $('#ctr-receipt').hidden = true;

  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  el.inert = false;
  document.documentElement.style.overflow = 'hidden';
  counterOpen = true;
  pushOverlayState();                            // Back closes the counter
  station.chime();
  setTimeout(() => ta.focus(), 260);
}

function closeCounter() {
  const el = $('#counter');
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  if (!quietOpen) document.documentElement.style.overflow = '';
  counterOpen = false;
}

async function handItIn() {
  const ta = $('#ctr-text');
  const text = ta.value.trim();
  if (!text) return;

  const ref = makeRef(text);
  const list = held();
  list.push({ ref: ref, text: text, at: Date.now() });
  saveHeld(list.slice(-40));
  renderHeld();

  const receipt = $('#ctr-receipt');
  receipt.textContent =
    'Received. Reference ' + ref + '. Held until morning — you can come back for it ' +
    'any time, and you do not have to.';
  receipt.hidden = false;
  ta.value = '';
  $('#ctr-n').textContent = '0';
  $('#ctr-hand').disabled = true;

  station.chime();
  await announce(ref + ' — held until morning.');
  setTimeout(() => { if (counterOpen) closeCounter(); }, 1400);
}

function counterWiring() {
  const ta = $('#ctr-text');
  ta.addEventListener('input', () => {
    $('#ctr-n').textContent = String(ta.value.length);
    $('#ctr-hand').disabled = ta.value.trim().length === 0;
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handItIn();
  });
  $('#ctr-hand').addEventListener('click', handItIn);
  $('#ctr-close').addEventListener('click', dismissOverlay);
  $('#counter').addEventListener('click', (e) => {
    if (e.target === $('#counter')) closeCounter();
  });
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

/* Nothing tracks the pointer as shared state any more: the hero no
   longer tilts, uMouse stays at rest, and the cursor ring writes its
   own transform straight from the event. */

function cursor() {
  if (matchMedia('(hover: none)').matches || REDUCED) return;
  const c = $('#cursor');

  /* The ring sits exactly on the pointer. It used to ease toward it at
     0.22 per frame, which always left it trailing behind the real
     cursor — that lag is what read as weight.

     Writing the transform straight from the pointermove event also
     retires the rAF loop: there is nothing to animate between moves, so
     a still mouse now costs nothing per frame. */
  addEventListener('pointermove', (e) => {
    c.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
  }, { passive: true });

  /* A single pass across one board row fires ~134 pointerover events,
     because every flap cell is its own element. Resolving and writing
     the class on all of them is pointless work — only a change of the
     matched ancestor can change the ring, so remember the last one. */
  const hot = 'a, button, .board-row, .lf-row';
  let lastHot;
  addEventListener('pointerover', (e) => {
    const hit = e.target.closest ? e.target.closest(hot) : null;
    if (hit === lastHot) return;
    lastHot = hit;
    c.classList.toggle('hot', !!hit);
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
  reelAudio(station.enabled);            // a reel's bed follows the same switch
}

/* Rendering quality — the touch equivalent of the Q key. The boot page
   used to say "Press Q to step the renderer down" with no way to do it
   on a phone; this is that control. Both the key and the button call
   cycleQuality, and the label carries the current tier. */
function cycleQuality() {
  if (!gl.ok) return;
  const q = gl.setQuality(gl.quality + 1);
  reelRetier();                          // swap the footage tier too
  updateQualityBtn();
  announce(`Rendering quality — ${q}`);
}
function updateQualityBtn() {
  const btn = $('#quality-btn');
  if (!btn) return;
  const name = gl.ok ? gl.qualityName() : '—';
  $('#quality-label').textContent = `Quality · ${name}`;
  btn.setAttribute('aria-label', `Rendering quality — ${name}`);
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
    // hand the audio to a real media element so the browser stops
    // throttling us the moment the tab loses focus
    const bg = station.goBackground(true);
    announce(
      bg
        ? 'Night service. The station stays open — you can leave the tab.'
        : 'Night service. Keep this tab in front.'
    );
  } else {
    setDim(0);
    setTimer(0);
    night.ending = false;
    station.goBackground(false);
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
  const fill = $('#nr-fill');
  if (!el) return;

  if (!night.on || !night.minutes) {
    el.textContent = 'Open · no timer';
    if (fill) fill.style.height = '0%';
    return;
  }
  const total = night.minutes * 60000;
  const left = Math.max(0, night.endsAt - Date.now());
  if (fill) fill.style.height = `${(left / total) * 100}%`;

  if (night.ending) { el.textContent = 'Fading out'; return; }
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  el.textContent = `${m}:${String(s).padStart(2, '0')} left`;
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
   Something passes, a long way off

   The concourse shader sweeps a light across the floor every ~22
   seconds. Most of those pass in silence — whatever it is, it's too
   far to hear. Every few minutes one of them is close enough, and
   then the steam comes in with it: the sound is aimed at the exact
   sweep the light will make, so they arrive together.
   ================================================================ */
const SWEEP_PERIOD = 1 / 0.0455;
const QUIET_BETWEEN = [30000, 45000];    // silence between one pass and the next

let trainDue = Infinity;
/** The announcer sets the first one going once she has finished. */
function trainDueIn(ms) {
  trainDue = performance.now() + ms;
}

function trainWatch() {
  setInterval(() => {
    if (!entered || !gl.ok || !station.enabled) return;
    if (gl.current !== 'concourse' || document.hidden || inTransit) return;
    /* gl.current alone is not enough: an arrival leaves the concourse
       world loaded behind a screen, so the station would keep running
       trains past somebody who has already left the station. */
    if (currentDest || currentArrival || reelOpen()) return;
    if (announcer.speaking) return;        // never talk over her
    if (performance.now() < trainDue) return;

    /* A pass is 15–20 seconds now, so its midpoint can no longer be
       stretched to meet the light. Delay the *start* instead: work out
       when the shader will next sweep the floor and set off early
       enough that the engine arrives with it. */
    const dur = rnd(15, 20);
    const now = gl.time;
    const k = Math.ceil((now + dur * 0.5 - SWEEP_PERIOD * 0.5) / SWEEP_PERIOD);
    const sweepAt = k * SWEEP_PERIOD + SWEEP_PERIOD * 0.5;
    /* Only wait for the light if it is nearly here. The sweep comes
       round every 22 seconds, and holding the train for the back half
       of that would put a minute of silence between passes — a sync
       nobody can consciously perceive is not worth the wait. */
    const untilSweep = Math.max(0, sweepAt - dur * 0.5 - now);
    const startIn = untilSweep <= 6 ? untilSweep : 0;

    setTimeout(() => {
      if (currentDest || currentArrival || reelOpen()) return;   // boarded while it waited
      if (gl.current === 'concourse' && !inTransit && station.enabled) {
        station.steamTrain({ dur, far: 0.5 + Math.random() * 0.22 });
      }
    }, startIn * 1000);

    // next one starts a short quiet after this one has gone
    trainDue = performance.now() + (startIn + dur) * 1000 + rnd(...QUIET_BETWEEN);
  }, 500);
}

/* ================================================================
   Wiring
   ================================================================ */
/* ================================================================
   Back button

   Every overlay — a destination world, an arrival, the counter, the
   quiet room — is shown by script with no URL change, so the phone's
   Back button used to walk straight off the site. Opening one pushes a
   single history entry; Back (hardware, browser, or on-screen) pops it
   and popstate closes whatever is open. The app only ever has one
   overlay up at once, so one entry suffices and moving between services
   does not stack more.
   ================================================================ */
function overlayOpen() {
  return reelOpen() || !!currentDest || counterOpen || quietOpen;
}
function closeCurrentOverlay() {
  if (reelOpen()) return leaveArrival();
  if (currentDest) return returnHome();
  if (counterOpen) return closeCounter();
  if (quietOpen) return closeQuiet();
}
function pushOverlayState() {
  if (!(history.state && history.state.nc)) history.pushState({ nc: 1 }, '');
}
/* On-screen closes go through history too, so the stack stays balanced
   with the hardware button — one entry per open, one pop per close. */
function dismissOverlay() {
  if (history.state && history.state.nc) history.back();
  else closeCurrentOverlay();
}
addEventListener('popstate', () => { if (overlayOpen()) closeCurrentOverlay(); });

function keys() {
  addEventListener('keydown', (e) => {
    // letter shortcuts must not fire while she is writing on the slip
    const typing = /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape') { dismissOverlay(); return; }
    // Enter/Space only enters once the boot has finished — before that
    // the same press is what begins the boot, and must not skip it
    if (!entered && $('#boot-cta').classList.contains('in') && (e.key === 'Enter' || e.key === ' ')) {
      enterStation();
      return;
    }
    if (typing) return;
    if (e.key === 'm' || e.key === 'M') { station.toggle(); if (!station.enabled) announcer.cancel(); updateSoundBtn(); return; }
    if (e.key === 'q' || e.key === 'Q') { cycleQuality(); return; }
    if (e.key === 'n' || e.key === 'N') { toggleNight(); return; }
    if (e.key === 'b' || e.key === 'B') { showBoard(boardView === 'media' ? 'worlds' : 'media'); return; }
    const n = parseInt(e.key, 10);
    if (boardView === 'media') {
      if (n >= 1 && n <= ARRIVALS.length && entered && !currentArrival) {
        arrive_at(ARRIVALS[n - 1].id);
      }
      return;
    }
    if (n >= 1 && n <= DESTINATIONS.length && entered && !currentDest) {
      depart_to(DESTINATIONS[n - 1].id);
    }
  });
}

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  /* The terminal is a fixed veil, but a fixed veil does not stop the
     document behind it from scrolling — and on a phone that scroll
     collapses the address bar, grows the visual viewport, and slides
     the page up past the veil so the board shows underneath. Locking
     the document while the veil is up is the only thing that holds on
     every mobile browser; enterStation lifts it. */
  document.documentElement.classList.add('boot-lock');
  $('#arrival').inert = true;
  $('#counter').inert = true;
  $('#quiet').inert = true;
  $('#concourse').inert = true;   // until the gate opens
  $('#topbar').inert = true;

  /* Deferred work. The cells are built while the board is still a
     screen away; the flip itself waits until you are actually looking
     at it, because a departure board that has already finished
     flipping is just a table. */
  lazySection('#departures', buildBoard, '420px 0px');
  lazySection('#board-shell', () => entered && populateVisible(), '-60px 0px');
  lazySection('#lost', lostAndFound);

  clock();
  notices();
  cursor();
  reveals();
  scrollFx();
  keys();
  driftBoard();
  nightWiring();
  counterWiring();
  quietWiring();
  trainWatch();

  if (gl.ok) {
    gl.restoreQuality();
    gl.setWorld('concourse');
    addEventListener('resize', () => gl.resize(), { passive: true });
    // the boot veil is opaque — there is nothing to draw behind it
    gl.preload(['glass', 'noon', 'null', 'dunes', 'spire', 'inverted']);
    updateQualityBtn();
  } else {
    // no renderer, nothing to step down — the control has no meaning
    const qb = $('#quality-btn'); if (qb) qb.hidden = true;
  }

  $('#boot-cta').addEventListener('click', enterStation);
  $('#quality-btn').addEventListener('click', cycleQuality);
  $('#arr-back').addEventListener('click', dismissOverlay);
  $('#sound-btn').addEventListener('click', () => {
    station.toggle();
    if (!station.enabled) announcer.cancel();
    updateSoundBtn();
  });

  document.addEventListener('visibilitychange', () => {
    if (gl.ok) document.hidden ? gl.stop() : gl.start();
    /* Away means silent, on every device. The context carries the
       ambience, the cues and the night drone; reel.js pauses the music
       bed and any video on the same event. */
    if (document.hidden) { station.suspend(); announcer.cancel(); }
    else station.wake();
  });

  // signalbox: for anyone who opens the console
  window.NC = {
    gl, station, announcer, rows, night,
    go: depart_to,
    home: returnHome,
    sleep: toggleNight,
    watch: (ref) => openQuiet({ ref, desc: '', note: '' }),
    /** NC.train() — hear one now, without waiting. NC.train(0.2) = close. */
    train: (far = 0.6) => station.steamTrain({ dur: 18, far }),
    /**
     * NC.type(wght) — dial the display serif live on your own screen.
     * 400 is the elegant end, 600 the sturdy end. No arguments reads
     * the current value.
     */
    voices: () => announcer.list(),
    voice: (frag) => announcer.use(frag),
    say: (t) => speak(t),
    type: (wght) => {
      if (wght === undefined) {
        return +getComputedStyle(document.documentElement).getPropertyValue('--display-wght');
      }
      $$('[style*="--display-wght"]').forEach((el) => el.style.removeProperty('--display-wght'));
      document.documentElement.style.setProperty('--display-wght', String(wght));
      return `weight ${wght}`;
    },
  };

  boardWiring();
  initReel({
    list: ARRIVALS,
    onSelect: (id) => { leaveArrival().then(() => setTimeout(() => arrive_at(id), 160)); },
    onBack: () => dismissOverlay(),
    isSoundOn: () => station.enabled,
    onDuck: (v, t) => station.duck(v, t),
    /* Deliberately NOT speak(): that routes through the tannoy rig, and
       paOpen/paClose are the relay whoosh and carrier hiss. Over a music
       bed they read as a broken radio rather than a voice in the room. */
    /* No ducking here: reel.js owns it for both cue kinds, because only
       it knows whether a music bed is up and therefore what level the
       station should be handed back to. */
    onSay: (line) => announcer.say(line, { gap: 640 }),
    onCancelSpeech: () => announcer.cancel(),
    /* HD footage on HIGH only. AUTO is the default and adapts to the
       machine, so it stays on the light encode; a visitor who wants the
       full-resolution clip asks for it with Q. */
    isHd: () => gl.quality === 1,
    audioCtx: () => station.ctx,
    cueOpener: NIGHT_OPENER,
    cueLines: NIGHT_LINES,
  });

  if (REDUCED) {
    boot();                                  // dumps instantly, no sound to gate
  } else {
    // the first tap or key press anywhere begins the boot, with sound
    const begin = $('#boot-begin');
    if (begin) {
      begin.addEventListener('click', beginBoot);
      begin.focus({ preventScroll: true });
    }
    const onFirst = () => { beginBoot(); teardown(); };
    const teardown = () => {
      removeEventListener('pointerdown', onFirst, true);
      removeEventListener('keydown', onFirst, true);
      removeEventListener('touchstart', onFirst, true);
    };
    addEventListener('pointerdown', onFirst, true);
    addEventListener('keydown', onFirst, true);
    addEventListener('touchstart', onFirst, true);
  }
}

init();
