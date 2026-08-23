/* ------------------------------------------------------------------
   NOWHERE CENTRAL — split-flap mechanism
   Four layers per character: two static halves and two hinged leaves.
   One shared rAF ticker drives every cell on the board; nothing here
   touches layout, only transforms.
------------------------------------------------------------------ */

export const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-—/∞°';

/* A real board does not carry one drum. The clock columns are digits
   and a colon; the destination columns are letters. Giving every cell
   the full 44-glyph set meant a time cell span the alphabet on its way
   to a number — wrong to look at, and up to 18 flaps of work per cell
   where six would do. Each role now gets only the glyphs it can
   actually display, which shortens every spin and drops the number of
   cells the shared ticker has to keep live.

   Any character outside a role's own drum is dropped by _fit, so these
   sets have to cover every value the column is ever given. */
const ALPHABETS = {
  time:   ' 0123456789:-',
  dest:   ' ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  plat:   ' 0123456789—',
  status: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  full:   CHARSET,
};

const DRUMS = Object.fromEntries(
  Object.entries(ALPHABETS).map(([k, chars]) => [
    k,
    { chars, idx: new Map([...chars].map((c, i) => [c, i])) },
  ])
);

const STEP_MS = 52;      // one flap
const MAX_STEPS = 18;    // never spin further than this to reach a target

/* --- shared ticker ------------------------------------------------ */
const live = new Set();
let raf = 0;
let last = 0;

function tick(now) {
  const dt = Math.min(64, now - last);
  last = now;
  for (const cell of live) {
    cell.p += dt / STEP_MS;
    if (cell.delay > 0) {
      cell.delay -= dt;
      cell.p = 0;
      continue;
    }
    if (cell.p >= 1) {
      cell.finishStep();
      if (!cell.queue.length) {
        cell.settle();
        live.delete(cell);
        continue;
      }
      cell.beginStep();
      cell.p = 0;
    }
    cell.draw();
  }
  raf = live.size ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

/* --- one character ------------------------------------------------ */
class Cell {
  constructor(host, onFlip, drum = DRUMS.full) {
    this.onFlip = onFlip;
    this.chars = drum.chars;
    this.idx = drum.idx;
    const el = document.createElement('div');
    el.className = 'cell';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="half t"><span> </span></div>' +
      '<div class="half b"><span> </span></div>' +
      '<div class="half t leaf leaf-f"><span> </span></div>' +
      '<div class="half b leaf leaf-b"><span> </span></div>';
    const halves = el.children;
    this.el = el;
    this.topS = halves[0].firstChild;
    this.botS = halves[1].firstChild;
    this.leafF = halves[2];
    this.leafFS = halves[2].firstChild;
    this.leafB = halves[3];
    this.leafBS = halves[3].firstChild;

    this.cur = ' ';
    this.queue = [];
    this.p = 0;
    this.delay = 0;
    host.appendChild(el);
  }

  to(ch, delay = 0) {
    const chars = this.chars, idx = this.idx, N = chars.length;
    const target = idx.has(ch) ? ch : ' ';
    if (target === this.cur && !this.queue.length) return;

    let from = idx.get(this.cur);
    const to = idx.get(target);
    let dist = (to - from + N) % N;
    if (dist === 0) dist = N;
    if (dist > MAX_STEPS) {
      // jump the drum forward so the flip stays a believable length
      from = (to - MAX_STEPS + N * 2) % N;
      this.cur = chars[from];
      this.topS.textContent = this.cur;
      this.botS.textContent = this.cur;
      dist = MAX_STEPS;
    }

    this.queue = [];
    for (let i = 1; i <= dist; i++) this.queue.push(chars[(from + i) % N]);
    this.delay = delay;
    this.p = 0;
    this.beginStep();
    live.add(this);
    wake();
  }

  beginStep() {
    const next = this.queue.shift();
    this.next = next;
    this.topS.textContent = next;   // revealed as the front leaf falls
    this.botS.textContent = this.cur;
    this.leafFS.textContent = this.cur;
    this.leafBS.textContent = next;
    if (this.onFlip) this.onFlip();
  }

  finishStep() {
    this.cur = this.next;
    this.botS.textContent = this.cur;
  }

  /* Only the transform changes per frame. The class swap happens once,
     when the leaf handing over — toggling classes on 192 cells every
     frame is a style recalc the board cannot afford. */
  draw() {
    const p = this.p;
    const phase = p < 0.5 ? 1 : 2;
    if (phase !== this.phase) {
      this.phase = phase;
      this.leafF.classList.toggle('on', phase === 1);
      this.leafB.classList.toggle('on', phase === 2);
    }
    if (phase === 1) this.leafF.style.transform = `rotateX(${-180 * p}deg)`;
    else this.leafB.style.transform = `rotateX(${-180 + 180 * p}deg)`;
  }

  settle() {
    this.phase = 0;
    this.leafF.classList.remove('on');
    this.leafB.classList.remove('on');
    this.topS.textContent = this.cur;
    this.botS.textContent = this.cur;
  }
}

/* --- a run of characters ------------------------------------------ */
export class FlapLine {
  constructor(host, length, { role = '', align = 'left', onFlip = null } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'flapline';
    if (role) this.el.dataset.role = role;
    this.length = length;
    this.align = align;
    this.value = '';
    this.drum = DRUMS[role] || DRUMS.full;
    this.cells = Array.from({ length }, () => new Cell(this.el, onFlip, this.drum));
    host.appendChild(this.el);
  }

  _fit(text) {
    let s = String(text ?? '').toUpperCase();
    s = [...s].filter((c) => this.drum.idx.has(c) || c === ' ').join('');
    if (s.length > this.length) s = s.slice(0, this.length);
    const pad = this.length - s.length;
    if (this.align === 'right') return ' '.repeat(pad) + s;
    if (this.align === 'center') {
      const l = Math.floor(pad / 2);
      return ' '.repeat(l) + s + ' '.repeat(pad - l);
    }
    return s + ' '.repeat(pad);
  }

  /** @param {string} text @param {{stagger?:number, from?:number}} opts */
  set(text, { stagger = 7, from = 0 } = {}) {
    const s = this._fit(text);
    this.value = s.trim();
    for (let i = 0; i < this.length; i++) {
      this.cells[i].to(s[i], from + i * stagger + Math.random() * 24);
    }
    return this;
  }

  /** Screen readers get the text, not 200 empty divs. */
  label(el, text) {
    el.setAttribute('aria-label', text);
  }
}
