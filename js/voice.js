/* ------------------------------------------------------------------
   NOWHERE CENTRAL — the announcer

   The one woman who works here. She is the browser's own speech
   synthesiser, which means she costs nothing to download and speaks
   whatever the board currently says — including times that did not
   exist when this was written.

   Web Speech output cannot be routed into an AudioContext, so she
   can't be given the station's reverb. Instead the room ducks under
   her while she speaks, which is what a real PA does anyway.
------------------------------------------------------------------ */

/* Ordered by preference. Windows ships Zira and Hazel; Edge adds the
   far better Aria and Sonia; macOS has Samantha; Android has its own. */
const PREFERRED = [
  /aria/i, /jenny/i, /michelle/i, /sonia/i, /libby/i, /emma/i, /ava/i,
  /samantha/i, /zira/i, /hazel/i, /susan/i, /karen/i, /moira/i, /tessa/i,
  /google uk english female/i, /google us english/i,
  /female/i,
];
const MALE = /david|mark|george|james|daniel|alex|fred|guy|eric|christopher|roger|ryan|brian|thomas/i;

export class Announcer {
  constructor() {
    this.ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
    this.enabled = true;
    this.voice = null;
    this.speaking = false;
    if (!this.ok) return;
    this._choose();
    // Chrome populates the voice list asynchronously, and sometimes twice
    speechSynthesis.addEventListener('voiceschanged', () => this._choose());
  }

  /* Scored rather than first-match: a "Natural"/"Online" neural voice
     is worth far more than the right name on an old SAPI one, and Edge
     ships several. */
  _score(v) {
    const name = v.name || '';
    let n = 0;
    if (/natural|neural|online/i.test(name)) n += 100;
    if (v.localService === false) n += 8;
    const i = PREFERRED.findIndex((rx) => rx.test(name));
    if (i >= 0) n += 60 - i;
    if (/^en-GB/i.test(v.lang)) n += 6;        // a British station voice
    else if (/^en/i.test(v.lang)) n += 4;
    if (MALE.test(name)) n -= 500;
    return n;
  }

  _choose() {
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { return; }
    if (!voices.length) return;
    const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang || ''));
    const pool = (en.length ? en : voices).slice();
    pool.sort((a, b) => this._score(b) - this._score(a));
    this.voice = pool[0] || null;
  }

  /** every voice the machine has, best first — for NC.voices() */
  list() {
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { return []; }
    return voices
      .slice()
      .sort((a, b) => this._score(b) - this._score(a))
      .map((v) => `${v.name} [${v.lang}]${v === this.voice ? '  ← in use' : ''}`);
  }

  /** force one by name fragment */
  use(fragment) {
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { return null; }
    const hit = voices.find((v) => new RegExp(fragment, 'i').test(v.name));
    if (hit) this.voice = hit;
    return this.voiceName;
  }

  get voiceName() {
    return this.voice ? this.voice.name : null;
  }

  cancel() {
    if (!this.ok) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    this.speaking = false;
  }

  /**
   * @param {string|string[]} text one line, or several delivered with
   *   a pause between them — which is most of what makes an announcer
   *   sound like an announcer rather than a satnav.
   * @param {{rate?:number, pitch?:number, volume?:number, gap?:number,
   *          onStart?:Function, onWord?:Function, onEnd?:Function}} opts
   * @returns {Promise<boolean>} false if she could not speak
   */
  async say(text, opts = {}) {
    if (!this.ok || !this.enabled) return false;
    const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
    if (!parts.length) return false;

    try { speechSynthesis.cancel(); } catch (e) {}
    this.speaking = true;
    opts.onStart && opts.onStart();

    let spoke = false;
    for (let i = 0; i < parts.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      spoke = (await this._one(parts[i], opts)) || spoke;
      if (!this.speaking) break;                  // cancelled mid-way
      if (i < parts.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, opts.gap ?? 620));
      }
    }

    this.speaking = false;
    opts.onEnd && opts.onEnd();
    return spoke;
  }

  _one(part, opts) {
    return new Promise((resolve) => {
      let u;
      try {
        u = new SpeechSynthesisUtterance(part);
      } catch (e) {
        resolve(false);
        return;
      }
      if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
      // unhurried and level: a station announcer, not a satnav
      u.rate = opts.rate ?? 0.84;
      u.pitch = opts.pitch ?? 1.0;
      u.volume = opts.volume ?? 1;

      let settled = false;
      let guard;
      const done = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(v);
      };

      // every word keys the amplifier a little harder
      u.onboundary = (e) => {
        if (e.name === 'word' || e.charLength) opts.onWord && opts.onWord();
      };
      u.onend = () => done(true);
      u.onerror = () => done(false);

      // some engines never fire onend; do not leave the caller hanging
      guard = setTimeout(() => done(true), 2200 + part.length * 105);

      try { speechSynthesis.speak(u); } catch (e) { done(false); }
    });
  }
}

/* ------------------------------------------------------------------
   What she actually says
------------------------------------------------------------------ */

/* The board stores names in caps because that is how a split-flap
   works. Speech engines read caps as initialisms, so she gets them
   back in title case. */
const SMALL = new Set(['the', 'of', 'a', 'an', 'and']);
export function titleCase(s) {
  return String(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** "twenty forty-seven" reads better than "20:47" on most engines */
export function spokenTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hh = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'a.m.' : 'p.m.';
  if (m === 0) return `${hh} o'clock ${suffix}`;
  if (m < 10) return `${hh} oh ${m} ${suffix}`;
  return `${hh} ${m} ${suffix}`;
}

export function welcomeLine(dest, depart) {
  const plat = dest.platform === '—' ? 'a platform yet to be confirmed' : `platform ${dest.platform}`;
  // separate utterances, so the pauses are real pauses and not commas
  return [
    'Welcome to Nowhere Central.',
    `The next departure is the ${spokenTime(depart)} service to ${titleCase(dest.name)}.`,
    `Now boarding at ${plat}.`,
  ];
}

export function departureLine(dest) {
  const plat = dest.platform === '—' ? 'an unlisted platform' : `platform ${dest.platform}`;
  return [
    `The service to ${titleCase(dest.name)} is ready to depart.`,
    `${plat.charAt(0).toUpperCase()}${plat.slice(1)}. Please stand clear of the doors.`,
  ];
}

export function arrivalLine(dest) {
  return `This is ${titleCase(dest.name)}. Please mind the gap.`;
}
