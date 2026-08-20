/* ------------------------------------------------------------------
   NOWHERE CENTRAL — the quiet room

   Eight things to watch at two in the morning. These are not the
   destination worlds: nothing here has a horizon, a sun, or an event.
   Everything moves at somewhere between a tenth and a fiftieth of the
   speed the rest of the site does, because the point is a screen you
   can stop looking at without anything happening.

   Rules they all follow:
     · nothing sudden, ever — no cuts, no flashes, no strobing
     · low contrast and low luminance; a bright screen at 2am is a lie
     · long, irrational cycle lengths, so nothing lands on a beat you
       can start anticipating
     · cheap enough to leave running all night
------------------------------------------------------------------ */

import { PRE, TAIL } from './shaders.js';

/* =================================================================
   RAIN ON STILL WATER  —  the umbrella
   Twelve drops on their own long cycles. The surface normal comes
   from the analytic derivative of the same wave, so the light on it
   is real rather than painted.
   ================================================================= */
const RIPPLES = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv + uMouse * 0.03;

  /* The screen is about one unit tall, so ring spacing is the whole
     game: k = 95 puts roughly fifteen rings across it, and a crest
     speed of k/13 means one takes about seven seconds to cross. Any
     coarser and it stops being water and becomes lava lamp. */
  const float K = 95.0;

  float h = 0.0;
  vec2 grad = vec2(0.0);

  for(int i = 0; i < 14; i++){
    float fi = float(i);
    float seed = hash11(fi * 13.77);
    float period = 6.0 + seed * 11.0;              // no two drops share a beat
    float phase = uTime / period + seed * 31.0;
    float t = fract(phase) * period;
    vec2 c = (hash22(vec2(fi * 3.1, floor(phase))) - 0.5) * vec2(1.9, 1.15);

    float d = length(p - c) + 1e-4;
    float ring = d * K - t * 13.0;
    float env = exp(-d * 2.4) * exp(-t * 0.32) * smoothstep(0.0, 0.5, t);
    h += sin(ring) * env;
    grad += ((p - c) / d) * (K * cos(ring)) * env;   // analytic, not sampled
  }

  float slope = sat(length(grad) / K);

  // black water with one cold light on it, and nothing else
  vec3 col = vec3(0.009, 0.020, 0.030);
  col += vec3(0.07, 0.15, 0.21) * sat(h * 0.5 + 0.5) * 0.30;
  col += vec3(0.50, 0.74, 0.94) * pow(sat(h), 5.0) * 0.34;
  col += vec3(0.16, 0.30, 0.42) * slope * 0.22;
  col += vec3(0.05, 0.09, 0.13) * exp(-length(p - vec2(-0.4, 0.34)) * 1.6);
  return col;
}
`;

/* =================================================================
   FIRELIGHT THROUGH CLOSED EYES  —  the glove
   No shapes at all. Warm blooms drifting under the lids, the way
   they do when you have shut your eyes near a lamp.
   ================================================================= */
const EMBER = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv * 0.85;
  float t = uTime * 0.035;

  float a = fbm(p * 1.3 + vec2(t, t * 0.7), 4);
  float b = fbm(p * 2.1 - vec2(t * 0.8, t * 1.3) + a, 3);
  float f = sat(a * 0.75 + b * 0.45);

  vec3 deep = vec3(0.075, 0.024, 0.010);
  vec3 warm = vec3(0.80, 0.31, 0.080);
  vec3 hot  = vec3(1.00, 0.62, 0.26);

  vec3 col = mix(deep, warm, smoothstep(0.30, 0.72, f));
  col = mix(col, hot, smoothstep(0.66, 0.95, f) * 0.55);

  // the slow bloom of a lamp you are not quite facing
  float breath = 0.5 + 0.5 * sin(uTime * 0.085);
  col += vec3(1.0, 0.5, 0.2) * exp(-length(p - vec2(0.25, 0.1)) * 1.6) * (0.10 + breath * 0.075);

  col *= 0.86 + 0.10 * sin(uTime * 0.047);
  return col;
}
`;

/* =================================================================
   DUST IN A SUNBEAM  —  four point two hours of somebody's Tuesday
   An afternoon that will not end. The motes take a full minute to
   cross the beam.
   ================================================================= */
const MOTES = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv + uMouse * 0.03;
  vec2 r = rot(-0.5) * (p - vec2(-0.7, 1.0));

  float beam = pow(smoothstep(0.95, 0.15, abs(r.x - 0.55)), 2.0) * exp(-max(r.y, 0.0) * 0.42);
  beam *= 0.75 + 0.25 * fbm(vec2(r.x * 1.4, r.y * 0.4 - uTime * 0.012), 3) * 1.6;

  vec3 warm = vec3(1.0, 0.86, 0.62);
  vec3 col = vec3(0.020, 0.022, 0.028);
  col += warm * sat(beam) * 0.20;

  float dust = 0.0;
  for(int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 gp = p * (9.0 + fi * 7.0) + vec2(uTime * (0.010 + fi * 0.006), -uTime * (0.007 + fi * 0.004));
    vec2 id = floor(gp);
    vec2 f = fract(gp) - 0.5;
    vec2 o = hash22(id + fi * 21.3) - 0.5;
    float m = smoothstep(0.045, 0.002, length(f - o * 0.85));
    dust += m * step(0.62, hash21(id + fi * 7.7)) * (0.4 + 0.6 * hash21(id + fi));
  }
  col += warm * dust * 0.85 * sat(beam * 2.2 + 0.08);

  return col;
}
`;

/* =================================================================
   A DOOR LEFT OPEN  —  the key
   Rectangles of light receding on a log scale. It never arrives and
   it never stops, which between them is the restful part.
   ================================================================= */
const DOORWAY = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv * 1.1 + uMouse * 0.03;
  vec3 col = vec3(0.016, 0.018, 0.026);
  vec3 warm = vec3(1.0, 0.80, 0.50);

  for(int i = 0; i < 9; i++){
    float fi = float(i);
    // each frame is the one before, smaller, drifting inward forever
    float z = fract((uTime * 0.018) + fi / 9.0);
    float s = pow(z, 1.6) * 2.4 + 0.05;
    vec2 q = abs(p / s) - vec2(0.42, 0.72);
    float d = max(q.x, q.y);
    float edge = smoothstep(0.030, 0.0, abs(d)) ;
    float fade = smoothstep(0.0, 0.18, z) * smoothstep(1.0, 0.62, z);
    col += warm * edge * fade * 0.26;
    col += warm * smoothstep(0.0, -0.5, d) * fade * 0.022;
  }

  col += warm * pow(sat(1.0 - length(p) * 1.9), 7.0) * 0.32;
  return col;
}
`;

/* =================================================================
   A SONG YOU ALMOST REMEMBER  —  the last verse
   Chladni figures: the nodal lines of a plate being driven at a
   frequency that keeps changing its mind.
   ================================================================= */
const CHLADNI = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv * 2.4;
  // the two mode numbers wander independently and very slowly
  float m = 3.0 + 6.2 * (0.5 + 0.5 * sin(uTime * 0.021));
  float n = 3.0 + 7.1 * (0.5 + 0.5 * sin(uTime * 0.0133 + 2.1));

  float v = sin(m * p.x) * sin(n * p.y) + sin(n * p.x) * sin(m * p.y);
  float line = 1.0 - smoothstep(0.0, 0.10, abs(v));

  vec3 col = vec3(0.014, 0.018, 0.028);
  col += vec3(0.42, 0.62, 0.80) * pow(line, 1.5) * 0.42;
  col += vec3(0.85, 0.92, 1.0) * pow(line, 7.0) * 0.30;

  // the plate itself, barely lit
  col += vec3(0.05, 0.075, 0.11) * (0.5 + 0.5 * sat(v * 0.5 + 0.5)) * 0.9;

  return col;
}
`;

/* =================================================================
   BREATHING  —  one name, no longer attached to anyone
   The only scene here with a job. Four in, seven held, eight out —
   the cadence that drops a heart rate — drawn as one slow bloom and
   a ring that shows you where you are in it.
   ================================================================= */
const BREATH = `
vec3 world(vec2 uv, vec2 st){
  const float IN = 4.0, HOLD = 7.0, OUT = 8.0;
  float cycle = IN + HOLD + OUT;
  float t = mod(uTime, cycle);

  float e;                                   // 0 empty, 1 full
  if(t < IN)              e = smoothstep(0.0, 1.0, t / IN);
  else if(t < IN + HOLD)  e = 1.0;
  else                    e = 1.0 - smoothstep(0.0, 1.0, (t - IN - HOLD) / OUT);

  float d = length(uv);
  float rad = mix(0.12, 0.31, e);

  vec3 warm = vec3(1.0, 0.78, 0.48);
  vec3 col = vec3(0.016, 0.019, 0.026);

  // the bloom you follow
  col += warm * exp(-pow(d / rad, 2.2) * 2.6) * (0.20 + e * 0.26);
  // its edge, so the turn is legible without being sharp
  col += warm * smoothstep(0.045, 0.0, abs(d - rad)) * 0.34;

  // the progress ring: one full turn per cycle
  float a = atan(uv.y, uv.x) / TAU + 0.5;
  float head = fract(t / cycle);
  float arc = smoothstep(0.05, 0.0, abs(fract(a - head + 0.5) - 0.5));
  col += warm * arc * smoothstep(0.020, 0.0, abs(d - 0.44)) * 0.85;
  col += vec3(0.16, 0.20, 0.27) * smoothstep(0.006, 0.0, abs(d - 0.44));

  return col;
}
`;

/* =================================================================
   GRAIN SETTLING  —  the photograph
   A particle field under a curl-noise flow. It keeps very nearly
   arranging itself into something and then thinking better of it.
   ================================================================= */
const GRAIN = `
vec2 flow(vec2 p, float t){
  float e = 0.35;
  float n1 = fbm(p + vec2(0.0, t * 0.05), 3);
  float n2 = fbm(p + vec2(e, t * 0.05), 3);
  float n3 = fbm(p + vec2(0.0, e + t * 0.05), 3);
  return vec2(n3 - n1, -(n2 - n1)) / e;       // curl of the noise field
}

vec3 world(vec2 uv, vec2 st){
  vec2 p = uv * 1.35;
  vec3 col = vec3(0.018, 0.020, 0.026);
  vec3 tint = vec3(0.80, 0.83, 0.90);

  for(int i = 0; i < 3; i++){
    float fi = float(i);
    float sc = 7.0 + fi * 6.0;
    // drift the sampling grid along the flow instead of moving points
    vec2 off = flow(p * 0.55 + fi * 4.1, uTime) * (0.22 + fi * 0.06);
    vec2 gp = (p + off) * sc + fi * 13.0;
    vec2 id = floor(gp);
    vec2 f = fract(gp) - 0.5;
    vec2 o = hash22(id + fi * 17.0) - 0.5;
    float m = smoothstep(0.058, 0.004, length(f - o * 0.9));
    col += tint * m * step(0.45, hash21(id + fi * 5.5)) * (0.11 + 0.15 * hash21(id));
  }

  col += tint * 0.030 * fbm(p * 2.0 + uTime * 0.01, 3);
  return col;
}
`;

/* =================================================================
   A NIGHT TRAIN WINDOW  —  the return ticket
   Four ridgelines at four speeds, and lights out there belonging to
   people who are also still awake.
   ================================================================= */
const WINDOW = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv;
  vec3 col = vec3(0.022, 0.026, 0.042);

  // a sky that never quite gets light
  col += vec3(0.055, 0.066, 0.105) * smoothstep(-0.4, 0.9, p.y);
  col += vec3(0.10, 0.085, 0.15) * pow(sat(1.0 - abs(p.x + 0.3)), 3.0) * smoothstep(-0.1, 0.7, p.y) * 0.7;

  for(int i = 0; i < 4; i++){
    float fi = float(i);
    float speed = 0.020 + fi * 0.030;
    float scale = 0.7 + fi * 0.85;
    // uv.y only reaches ±0.5, so the far ridges have to sit high
    float base = 0.02 - fi * 0.115;
    float amp = 0.13 - fi * 0.018;

    float h = base + (fbm(vec2(p.x * scale + uTime * speed, fi * 7.3), 4) - 0.5) * amp * 2.0;
    float mask = smoothstep(0.004, -0.004, p.y - h);

    vec3 hill = mix(vec3(0.042, 0.050, 0.078), vec3(0.006, 0.007, 0.014), fi / 3.0);
    col = mix(col, hill, mask);

    // somebody else is awake out there
    if(i >= 2){
      vec2 lp = vec2(p.x * scale * 9.0 + uTime * speed * 9.0, 0.0);
      float id = floor(lp.x);
      float lit = step(0.86, hash11(id + fi * 31.0));
      float dot_ = smoothstep(0.055, 0.0, length(vec2(fract(lp.x) - 0.5, (p.y - h + 0.02) * 6.0)));
      col += vec3(1.0, 0.72, 0.38) * dot_ * lit * mask * 1.6;
    }
  }

  // the reflection of the carriage in the glass, very faint
  col += vec3(0.07, 0.063, 0.05) * smoothstep(0.35, 0.0, abs(p.y - 0.42)) * 0.16;
  return col;
}
`;

export const SCENES = {
  ripples: PRE + RIPPLES + TAIL,
  ember: PRE + EMBER + TAIL,
  motes: PRE + MOTES + TAIL,
  doorway: PRE + DOORWAY + TAIL,
  chladni: PRE + CHLADNI + TAIL,
  breath: PRE + BREATH + TAIL,
  grain: PRE + GRAIN + TAIL,
  window: PRE + WINDOW + TAIL,
};

/** What each thing on the counter turns out to be, when you pick it up. */
export const SCENE_OF = {
  'UMB-0041': { id: 'ripples', title: 'Rain, arriving late', caption: 'It is falling now. You do not have to be out in it.' },
  'GLV-0118': { id: 'ember', title: 'Warmth, second-hand', caption: 'Firelight through a closed eye. Nothing is required of you here.' },
  'TUE-4207': { id: 'motes', title: 'A held afternoon', caption: 'Four point two hours, spending themselves very slowly.' },
  'KEY-0003': { id: 'doorway', title: 'A door left open', caption: 'It goes on. You are not expected to reach the end of it.' },
  'SNG-0862': { id: 'chladni', title: 'The shape of the verse', caption: 'This is what it looks like. It will come back to you on its own.' },
  'NAM-0001': { id: 'breath', title: 'Four in, seven held, eight out', caption: 'Follow the ring if you like. Or do not, and just watch it.' },
  'PHT-5510': { id: 'grain', title: 'Everyone, looking left', caption: 'It almost settles into a picture. Let it not.' },
  'TKT-∞':    { id: 'window', title: 'The window seat', caption: 'Somebody out there is also still awake. The journey has no stops.' },
};
