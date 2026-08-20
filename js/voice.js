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
  /aria/i, /jenny/i, /michelle/i, /sonia/i, /libby/i,
  /samantha/i, /zira/i, /hazel/i, /susan/i, /karen/i, /moira/i, /tessa/i,
  /google uk english female/i, /google us english/i,
  /\bfemale\b/i,
];

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

  _choose() {
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { return; }
    if (!voices.length) return;

    const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang || ''));
    const pool = en.length ? en : voices;

    for (const rx of PREFERRED) {
      const hit = pool.find((v) => rx.test(v.name));
      if (hit) { this.voice = hit; return; }
    }
    // no named match: anything English and not obviously male
    this.voice = pool.find((v) => !/david|mark|george|james|daniel|alex|fred/i.test(v.name)) || pool[0];
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
   * @param {string} text
   * @param {{rate?:number, pitch?:number, volume?:number,
   *          onStart?:Function, onEnd?:Function}} opts
   * @returns {Promise<boolean>} resolves false if she could not speak
   */
  say(text, opts = {}) {
    return new Promise((resolve) => {
      if (!this.ok || !this.enabled) { resolve(false); return; }
      if (!this.voice) this._choose();

      let u;
      try {
        u = new SpeechSynthesisUtterance(text);
      } catch (e) {
        resolve(false);
        return;
      }
      if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
      // unhurried, and a touch low: a station PA, not a satnav
      u.rate = opts.rate ?? 0.86;
      u.pitch = opts.pitch ?? 0.94;
      u.volume = opts.volume ?? 1;

      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        this.speaking = false;
        opts.onEnd && opts.onEnd();
        resolve(v);
      };

      u.onstart = () => { this.speaking = true; opts.onStart && opts.onStart(); };
      u.onend = () => done(true);
      u.onerror = () => done(false);

      // some engines never fire onend; don't leave the caller hanging
      const guard = setTimeout(() => done(true), 2500 + text.length * 95);
      const clear = () => clearTimeout(guard);
      const wrapped = opts.onEnd;
      opts.onEnd = () => { clear(); wrapped && wrapped(); };

      try {
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) {
        done(false);
      }
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
  return (
    `Welcome to Nowhere Central. ` +
    `The next departure is the ${spokenTime(depart)} service to ${titleCase(dest.name)}, ` +
    `now boarding at ${plat}.`
  );
}

export function departureLine(dest) {
  const plat = dest.platform === '—' ? 'an unlisted platform' : `platform ${dest.platform}`;
  return `The service to ${titleCase(dest.name)} is ready to depart from ${plat}. Please stand clear.`;
}

export function arrivalLine(dest) {
  return `This is ${titleCase(dest.name)}. Please mind the gap.`;
}
