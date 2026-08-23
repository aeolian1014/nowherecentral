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

/* =================================================================
   THE WALK BACK  —  the wet shoes

   This one is a real 3D scene, not stacked layers. A camera at the
   origin, a road plane, six sodium lamps going away down it, and fog
   between you and all of them.

   The light in the air is the whole picture, and it is computed, not
   drawn: the in-scattering integral for a point light along a ray has
   a closed form, so each shaft is exact and perfectly smooth instead
   of marched and banded — one atan pair per lamp, no sample loop. The
   road is the same integral again, fired along the reflected ray, off
   a normal bent by rain. That is why the reflections streak vertically
   without anyone telling them to.
   ================================================================= */
const RAINWALK = `
/* In-scattering along a ray, in closed form.
   ∫₀ᵀ dt/(h² + (t−b)²) = (1/h)·[atan((T−b)/h) + atan(b/h)]
   Marching this costs N samples per lamp and still bands. This does
   not band, because it is not sampled. */
float shaft(vec3 ro, vec3 rd, vec3 L, float tMax){
  vec3  v  = L - ro;
  float b  = dot(v, rd);
  float h2 = max(dot(v, v) - b * b, 2e-3);
  float h  = sqrt(h2);
  return (atan((tMax - b) / h) + atan(b / h)) / h;
}

/* The lamps recede down the road. Nothing converges them by hand —
   perspective does that, because they are actually out there. */
vec3 lampAt(float i){ return vec3(0.62, 0.60, 4.0 + i * 5.4); }

/* Wet tarmac — fine ripples, not swell. The amplitude here is the
   difference between a road in the rain and an ocean at night. */
float wetH(vec2 p){
  float h = fbm(p * 5.5 + vec2(0.0, uTime * 0.5), 2) * 0.5
          + fbm(p * 13.0 - vec2(uTime * 0.35, 0.0), 2) * 0.22;
  for(int i = 0; i < 3; i++){
    float fi   = float(i);
    float seed = hash11(fi * 17.3);
    float per  = 2.6 + seed * 3.4;
    float ph   = uTime / per + seed * 23.0;
    float t    = fract(ph) * per;
    vec2  c    = (hash22(vec2(fi * 2.7, floor(ph))) - 0.5) * vec2(3.0, 16.0) + vec2(0.0, 9.0);
    float d    = length(p - c);
    h += sin(d * 30.0 - t * 34.0) * exp(-d * 5.5) * exp(-t * 1.4) * 0.10;
  }
  return h;
}

vec3 world(vec2 uv, vec2 st){
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = normalize(vec3(uv.x + uMouse.x * 0.020,
                           uv.y - 0.055 + uMouse.y * 0.014, 1.15));

  const float GY   = -0.55;
  const vec3  LAMP = vec3(0.38, 0.60, 1.00);

  float tG   = (rd.y < -1e-4) ? (GY - ro.y) / rd.y : 1e9;
  float tMax = min(tG, 95.0);

  /* ---- what the air gives back. this coefficient is the exposure of
     the whole picture; too much and the night turns to milk. ---- */
  vec3 air = vec3(0.0);
  for(int i = 0; i < 7; i++){
    float fi = float(i);
    vec3  L  = lampAt(fi);
    air += LAMP * shaft(ro, rd, L, tMax) * 0.0115;

    // the bulb, sized by angle, so distance shrinks it correctly
    vec3  v = L - ro;
    float b = dot(v, rd);
    if(b > 0.0){
      float ang = length(v - rd * b) / b;
      float att = 1.0 / (1.0 + b * b * 0.010);
      air += LAMP * smoothstep(0.020, 0.002, ang) * 1.20 * att;
      air += LAMP * smoothstep(0.130, 0.000, ang) * 0.085 * att;

      // the post, hanging under it
      vec3 P = vec3(L.x, GY, L.z);
      float pb = dot(P - ro, rd);
      if(pb > 0.0){
        vec3  pp   = ro + rd * pb;
        float sideD = abs(pp.x - L.x) / pb;
        float below = step(pp.y, L.y - 0.03) * step(GY - 0.02, pp.y);
        air += vec3(0.030, 0.042, 0.070) * smoothstep(0.006, 0.0, sideD) * below * att * 2.0;
      }
    }
  }

  /* ---- the road, handing all of it back ---- */
  vec3 surf = vec3(0.0);
  if(tG > 0.0 && tG < 95.0){
    vec3 pos = ro + rd * tG;
    vec2 gp  = pos.xz;

    /* Tarmac in the middle. A road does not have a ruled edge, so the
       kerb wanders with the same noise the verge is made of. */
    float edge = 1.22 + (vnoise(vec2(pos.z * 0.55, sign(pos.x) * 3.7)) - 0.5) * 0.34;
    float road = smoothstep(edge + 0.30, edge - 0.18, abs(pos.x));

    float e  = 0.05;
    float h0 = wetH(gp);
    vec3  n  = normalize(vec3((h0 - wetH(gp + vec2(e, 0.0))) * 0.016,
                              e,
                              (h0 - wetH(gp + vec2(0.0, e))) * 0.016));

    vec3 rr   = reflect(rd, n);
    vec3 refl = vec3(0.0);
    for(int i = 0; i < 7; i++){
      refl += LAMP * shaft(pos, rr, lampAt(float(i)), 95.0) * 0.030;
    }

    float fres = pow(1.0 - sat(dot(-rd, n)), 5.0);
    surf = vec3(0.0035, 0.0050, 0.0090) * (0.35 + road * 0.65)
         + refl * road * (0.22 + fres * 1.45);
  }

  vec3 col = surf * exp(-tG * 0.055) + air;

  /* ---- what grows along the verge.
     Two vertical planes at x = ±1.75. Where the ray crosses one below
     its ragged top, everything behind it is gone. This is what gives
     the road something to be a road between. ---- */
  float hedge = 0.0;
  for(int s = 0; s < 2; s++){
    float sx = mix(-1.75, 1.75, float(s));
    float th = (abs(rd.x) > 1e-4) ? sx / rd.x : -1.0;
    if(th > 0.6 && th < 55.0){
      vec3  hp  = ro + rd * th;
      float top = GY + 0.62 + (fbm(vec2(hp.z * 0.7, float(s) * 9.0), 3) - 0.5) * 0.62;
      if(hp.y < top) hedge = max(hedge, exp(-th * 0.055));
    }
  }
  col = mix(col, vec3(0.0035, 0.0050, 0.0085), hedge * 0.93);

  /* ---- rain, brightened by whatever it is falling through ---- */
  vec2 sp = uv;
  sp.x += sp.y * 0.15;
  float rn = 0.0;
  for(int k = 0; k < 3; k++){
    float fk = float(k);
    float sc = 24.0 + fk * 19.0;
    float id = floor(sp.x * sc);
    float hh = hash11(id * 1.37 + fk * 51.0);
    float y  = fract(sp.y * sc * 0.30 - uTime * (0.55 + fk * 0.33) * (0.6 + hh * 0.7) + hh * 9.1);
    float x  = fract(sp.x * sc) - 0.5;
    float s  = smoothstep(0.5, 0.0, abs(x) * (30.0 + fk * 16.0));
    s *= smoothstep(0.0, 0.09, y) * smoothstep(0.38, 0.10, y);
    rn += s * step(0.44, hh) * (0.16 - fk * 0.04);
  }
  col += LAMP * rn * (0.25 + sat(length(air)) * 2.2);

  return col;
}
`;

/* =================================================================
   SOMEBODY ELSE'S CITY  —  the borrowed view
   Three ranks of towers at three depths, lit at random and never
   changing their minds about it. Droplets on the glass in front,
   holding still, because the window is shut and you are inside.
   ================================================================= */
const CITYGLOW = `
/* one rank of towers. returns the silhouette; writes the lit windows. */
float towers(vec2 p, float scale, float baseH, float amp, float seed, out float lit){
  float tx  = p.x * scale + seed;
  float id  = floor(tx);
  float h   = baseH + hash11(id * 3.71 + seed) * amp;
  float m   = step(p.y, h);
  vec2  w   = vec2(fract(tx) * 4.0, (h - p.y) * 26.0);
  vec2  wid = floor(w);
  float on  = step(0.70, hash21(wid + vec2(id * 13.0, seed)));
  vec2  wf  = fract(w) - 0.5;
  float box = smoothstep(0.30, 0.16, max(abs(wf.x) * 1.6, abs(wf.y) * 1.1));
  lit = box * on * m * step(0.0, w.y);
  return m;
}

vec3 world(vec2 uv, vec2 st){
  vec2 p = uv + uMouse * 0.018;

  vec3 col = mix(vec3(0.075, 0.038, 0.135), vec3(0.010, 0.008, 0.028), sat(p.y * 1.5 + 0.42));
  col += vec3(0.26, 0.09, 0.34) * exp(-sat(p.y + 0.46) * 3.6) * 0.42;

  float lit;
  float m;
  m = towers(p, 3.4, -0.06, 0.30, 11.0, lit);            // far
  col = mix(col, vec3(0.028, 0.020, 0.055), m);
  col += vec3(1.00, 0.74, 0.42) * lit * 0.30;

  m = towers(p, 2.2, -0.14, 0.34, 3.0, lit);             // middle
  col = mix(col, vec3(0.016, 0.012, 0.034), m);
  col += vec3(1.00, 0.80, 0.50) * lit * 0.42;

  m = towers(p, 1.4, -0.24, 0.28, 27.0, lit);            // near
  col = mix(col, vec3(0.008, 0.006, 0.020), m);
  col += vec3(1.00, 0.86, 0.58) * lit * 0.50;

  // things out of focus, drifting on cycles that never line up
  for(int i = 0; i < 6; i++){
    float fi = float(i);
    vec2 c = (hash22(vec2(fi * 5.3, 1.0)) - 0.5) * vec2(2.0, 1.0);
    c.y += sin(uTime / (19.0 + fi * 4.3) + fi) * 0.02;
    float rr = 0.045 + hash11(fi * 7.1) * 0.05;
    col += vec3(0.42, 0.30, 0.62) * smoothstep(rr, rr * 0.55, length(p - c)) * 0.10;
  }

  // the glass itself. these do not move; the window is shut.
  vec2 dp  = p * 9.0;
  vec2 did = floor(dp);
  vec2 dc  = hash22(did) - 0.5;
  float dd = length(fract(dp) - 0.5 - dc * 0.6);
  col += vec3(0.30, 0.24, 0.46)
       * smoothstep(0.22, 0.10, dd) * step(0.80, hash21(did * 1.7)) * 0.28;

  return col;
}
`;

/* =================================================================
   THE NIGHT PROGRAMME  —  the unlabelled tape
   Whatever was recorded first is gone. What is left is the machine's
   own handwriting: chroma that lands beside the picture instead of on
   it, a tracking band climbing the frame once every thirty-seven
   seconds, and head-switching noise along the bottom edge where the
   drum leaves the tape. Nothing here cuts, because nothing here is
   edited. It is a tape.
   ================================================================= */
const TAPE = `
vec3 tapePic(vec2 p){
  float t = uTime * 0.016;
  float n = fbm(p * 1.45 + vec2(t, t * 0.55), 4);
  float m = fbm(p * 0.70 - vec2(t * 0.7, t * 0.3) + n * 0.5, 3);
  vec3 c = mix(vec3(0.022, 0.016, 0.048), vec3(0.110, 0.055, 0.150), sat(n * 0.8 + m * 0.35));
  c += vec3(0.10, 0.14, 0.22) * pow(sat(1.0 - abs(p.y + 0.06) * 2.2), 4.0) * 0.55;
  c += vec3(0.16, 0.06, 0.12) * pow(sat(m), 3.0) * 0.40;
  return c;
}

vec3 world(vec2 uv, vec2 st){
  vec2 p = uv;

  // one pass up the frame every 37s. slow enough you never catch it start.
  float band = fract(st.y - uTime / 37.0);
  float inB  = smoothstep(0.0, 0.015, band) * smoothstep(0.055, 0.038, band);

  // 240 lines, not device pixels — the ladder can drop uRes and this must not alias
  float line   = floor(st.y * 240.0);
  float jitter = hash21(vec2(line, floor(uTime * 6.0))) - 0.5;
  p.x += jitter * (0.0009 + inB * 0.055);

  // the colour carrier never lands where the luma does
  float ab = 0.0022 + inB * 0.012;
  vec3 col;
  col.r = tapePic(p + vec2(ab, 0.0)).r;
  col.g = tapePic(p).g;
  col.b = tapePic(p - vec2(ab * 0.8, 0.0)).b;

  col *= 0.88 + 0.12 * sin(st.y * 240.0 * PI);              // scanlines
  col += vec3(0.10, 0.09, 0.13) * inB * 0.50;               // the band lifts the level
  col += vec3(0.5) * hash21(gl_FragCoord.xy + uTime * 31.0) * inB * 0.06;

  // where the drum leaves the tape
  float hs = smoothstep(0.045, 0.0, st.y);
  col = mix(col, vec3(hash21(gl_FragCoord.xy * 0.7 + uTime * 57.0)) * 0.22, hs * 0.55);

  col *= 0.93 + 0.07 * sin(uTime / 11.3);                   // the whole thing breathes
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
  rainwalk: PRE + RAINWALK + TAIL,
  cityglow: PRE + CITYGLOW + TAIL,
  tape: PRE + TAPE + TAIL,
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
  'SHO-2244': { id: 'rainwalk', title: 'The walk back', caption: 'The lamps go on ahead of you. You do not have to follow them tonight.' },
  'CTY-0700': { id: 'cityglow', title: 'Somebody else’s city', caption: 'Every lit window is a person not asleep either. You are not the only one.' },
  'TPE-1988': { id: 'tape', title: 'The night programme', caption: 'Whatever was on it first is gone. It plays anyway, and that is enough.' },
};
