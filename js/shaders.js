/* ------------------------------------------------------------------
   NOWHERE CENTRAL — GLSL worlds
   Six procedural environments + one post chain. No textures, no meshes,
   no libraries: every pixel is computed from a noise field.
------------------------------------------------------------------ */

export const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/* Shared prelude injected into every world shader. */
export const PRE = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // eased pointer, roughly -1..1
uniform float uScroll;  // 0..1 page progress
uniform float uGrain;

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sat(float x){ return clamp(x, 0.0, 1.0); }
vec3  sat3(vec3 v){ return clamp(v, 0.0, 1.0); }

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 8; i++){
    if(i >= oct) break;
    s += a * vnoise(p);
    p = rot(0.63) * p * 2.03;
    a *= 0.5;
  }
  return s;
}

float ridge(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 8; i++){
    if(i >= oct) break;
    s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    p = rot(0.41) * p * 2.11;
    a *= 0.5;
  }
  return s;
}

vec3 aces(vec3 x){
  return sat3((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}
`;

/* Grain and vignette live here, not in a second pass. An idle frame is
   then a single draw with no render target and no texture reads — the
   post chain only wakes up for a departure. */
export const TAIL = `
void main(){
  vec2 st = gl_FragCoord.xy / uRes;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 col = aces(world(uv, st));

  float g = hash21(gl_FragCoord.xy + fract(uTime) * 941.0) - 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += g * uGrain * (0.010 + 0.055 * sqrt(luma));
  col *= 1.0 - smoothstep(0.42, 1.05, length(st - 0.5)) * 0.62;

  fragColor = vec4(col, 1.0);
}
`;

/* =================================================================
   CONCOURSE — the station itself. Sodium light through tall glass,
   dust suspended in the beams. Lives behind the whole document, so
   it stays dark enough to read type over.
   ================================================================= */
const CONCOURSE = `
vec3 world(vec2 uv, vec2 st){
  // scrolling the page walks you further into the hall: the light
  // rises out of frame and the floor takes over
  vec2 p = uv + vec2(0.0, uScroll * 0.42);
  vec3 sodium = vec3(1.0, 0.640, 0.265);
  vec3 col = vec3(0.0040, 0.0055, 0.0090);

  // far wall, barely lit
  float wall = smoothstep(-0.80, 0.55, p.y) * pow(1.0 - abs(p.x) * 0.50, 3.0);
  col += vec3(0.017, 0.024, 0.038) * wall;

  /* --- shafts of light through the clerestory glazing ---
     Built in a sheared frame so the beams rake down to the right,
     the way winter sun does through a high window.               */
  vec2 q = p;
  q.y += 0.10;
  vec2 r = rot(-0.62) * (q - vec2(-0.95, 1.10));   // r.x runs across the beams

  // one noise field, shared by all three beams — the break-up reads the
  // same and costs a third as much
  float breakup = 0.62 + 0.38 * fbm(vec2(r.x * 1.2, r.y * 0.45 - uTime * 0.018), 3) * 1.8;
  float fall = exp(-max(r.y, 0.0) * 0.55);

  float shaft = 0.0;
  for(int i = 0; i < 3; i++){
    float fi = float(i);
    float w = 0.62 + fi * 0.34;
    float s = sin(r.x * (2.35 + fi * 1.45) + fi * 2.1 + uTime * 0.011);
    s = pow(smoothstep(0.60, 0.995, s), 1.5);
    shaft += s * w * breakup * fall;
  }
  shaft *= smoothstep(-1.15, 0.55, p.y - p.x * 0.30);
  shaft = sat(shaft);

  col += sodium * shaft * 0.155;

  // the source, out of frame top-left
  float dl = length(p - vec2(-0.78 + uMouse.x * 0.02, 0.92 + uMouse.y * 0.015));
  col += sodium * exp(-dl * 2.6) * 0.085;

  // a colder lamp far right, for depth
  col += vec3(0.34, 0.52, 0.68) * exp(-length(p - vec2(1.02, 0.55)) * 5.2) * 0.075;

  // suspended dust — small, and only where a beam can catch it.
  // Skipped outright where no beam reaches; most of the frame is dark.
  float lit = sat(shaft * 2.2);
  if(lit > 0.01){
    float dust = 0.0;
    for(int i = 0; i < 2; i++){
      float fi = float(i);
      vec2 gp = p * (16.0 + fi * 15.0) + vec2(uTime * (0.016 + fi * 0.010), -uTime * 0.011 + fi * 7.3);
      vec2 id = floor(gp);
      vec2 f  = fract(gp) - 0.5;
      vec2 o  = hash22(id + fi * 19.3) - 0.5;
      float m = smoothstep(0.030, 0.002, length(f - o * 0.8));
      dust += m * step(0.55, hash21(id + fi * 3.7)) * (0.35 + 0.65 * hash21(id + fi * 11.0));
    }
    col += sodium * dust * 0.50 * lit;
  }

  // polished floor: a smeared mirror of the shafts
  float floorMask = smoothstep(-0.26, -0.60, p.y);
  if(floorMask > 0.005){
    vec2 rp = vec2(p.x + 0.06, -0.58 - p.y);
    vec2 r2 = rot(-0.62) * (vec2(rp.x, rp.y + 0.10) - vec2(-0.95, 1.10));
    float mirror = smoothstep(0.60, 1.0, sin(r2.x * 2.05 + uTime * 0.011)) * exp(-max(r2.y, 0.0) * 0.7);
    mirror *= 0.4 + 0.6 * fbm(vec2(p.x * 3.0, p.y * 9.0 + uTime * 0.05), 2);
    col += sodium * mirror * floorMask * 0.055;
  }
  col += vec3(0.020, 0.028, 0.042) * floorMask * 0.5;

  // seam where the floor meets the wall
  col += sodium * smoothstep(0.020, 0.0, abs(p.y + 0.26)) * 0.030;

  /* Every twenty-odd seconds something passes the platform. You never
     see the train, only its windows strobing across the floor.        */
  float cyc = fract(uTime * 0.0455);
  float sweepX = mix(-2.4, 2.4, cyc);
  float gate = smoothstep(0.0, 0.10, cyc) * smoothstep(1.0, 0.90, cyc);
  float strobe = 0.55 + 0.45 * sin((p.x - sweepX) * 46.0);
  float sw = exp(-abs(p.x - sweepX) * 1.9) * smoothstep(0.02, -0.62, p.y) * strobe;
  col += vec3(0.72, 0.84, 1.0) * sw * gate * 0.085;
  col += sodium * exp(-abs(p.x - sweepX) * 3.4) * gate * smoothstep(-0.40, -0.10, p.y) * 0.025;

  col *= 0.95 + 0.05 * sin(uTime * 0.29);

  // the reading scrim: this world sits behind a whole document, so it
  // carries its own contrast floor rather than a composited overlay
  vec2 d2 = (st - vec2(0.5, 0.55)) * vec2(1.05, 1.25);
  col *= 1.0 - smoothstep(0.22, 0.72, length(d2)) * 0.55;
  return col;
}
`;

/* =================================================================
   THE GLASS SEA — analytic ocean, and rain running down the window
   you are looking through. The droplets refract the scene by
   re-sampling it, which is why they read as glass and not decals.
   ================================================================= */
const GLASS = `
vec3 skyCol(vec3 rd){
  float h = sat(rd.y * 1.55 + 0.14);
  vec3 hor = vec3(0.415, 0.470, 0.470);
  vec3 mid = vec3(0.085, 0.135, 0.175);
  vec3 top = vec3(0.012, 0.028, 0.052);
  vec3 c = mix(hor, mid, sat(pow(h, 0.5)));
  c = mix(c, top, sat(pow(h, 1.7)));
  float cl = fbm(vec2(rd.x * 3.2 / max(rd.z, 0.25), rd.y * 7.0) + uTime * 0.008, 5);
  c += vec3(0.075, 0.082, 0.088) * smoothstep(0.42, 0.92, cl) * smoothstep(0.0, 0.30, rd.y);
  return c;
}

float waveField(vec2 p){
  float w = 0.0, a = 1.0, f = 1.0;
  for(int i = 0; i < 5; i++){
    p = rot(0.87) * p * 1.86;
    w += a * sin(p.x * 1.55 * f + uTime * (0.42 + float(i) * 0.11) + vnoise(p * 0.55) * 4.0);
    a *= 0.56;
  }
  return w * 0.055;
}

vec3 seaScene(vec2 uv){
  vec3 ro = vec3(0.0, 1.45, 0.0);
  vec3 rd = normalize(vec3(uv.x, uv.y + 0.055 + uMouse.y * 0.025, 1.0));
  rd.xz *= rot(uMouse.x * 0.11 + sin(uTime * 0.043) * 0.025);

  vec3 horizon = skyCol(vec3(0.0, 0.004, 1.0));
  if(rd.y > -0.0015) return skyCol(rd);

  float t = -ro.y / rd.y;
  if(t > 900.0) return horizon;
  vec3 pos = ro + rd * t;

  float e  = 0.05 + t * 0.006;
  float h0 = waveField(pos.xz * 0.52);
  float hx = waveField((pos.xz + vec2(e, 0.0)) * 0.52);
  float hz = waveField((pos.xz + vec2(0.0, e)) * 0.52);
  vec3 n = normalize(vec3(h0 - hx, e * 0.62, h0 - hz));

  vec3 refl = reflect(rd, n);
  refl.y = abs(refl.y);
  vec3 sky = skyCol(refl);

  float fres = pow(1.0 - sat(dot(-rd, n)), 4.2);
  vec3 deep = vec3(0.006, 0.017, 0.026);
  vec3 col = mix(deep, sky, sat(0.075 + fres * 0.94));

  vec3 ld = normalize(vec3(0.22, 0.13, 1.0));
  col += vec3(1.0, 0.94, 0.84) * pow(sat(dot(refl, ld)), 300.0) * 1.7;

  float fog = 1.0 - exp(-t * 0.0135);
  col = mix(col, horizon, fog);
  return col;
}

/* screen-space water on the glass — returns a refraction offset */
vec2 rainOnGlass(vec2 st, out float sheen){
  vec2 off = vec2(0.0);
  sheen = 0.0;
  float ar = uRes.x / uRes.y;

  for(int i = 0; i < 3; i++){
    float fi = float(i);
    float sc = 6.5 + fi * 6.0;
    vec2 gp = vec2(st.x * ar, st.y) * sc;
    gp.y += uTime * (0.16 + fi * 0.11);
    vec2 id = floor(gp);
    vec2 f  = fract(gp);
    vec2 rnd = hash22(id + fi * 41.7);
    if(rnd.x < 0.58) continue;
    vec2 c = vec2(0.5) + (rnd - 0.5) * 0.62;
    float r = 0.13 + rnd.y * 0.20;
    vec2 dd = f - c;
    dd.y *= 1.22;
    float dl = length(dd);
    float m = smoothstep(r, r * 0.30, dl);
    off += normalize(dd + vec2(1e-5)) * m * (0.020 + rnd.y * 0.028);
    sheen += pow(m, 3.0) * 0.55;
  }

  // long slow drips, stretched vertically
  for(int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 gp = vec2(st.x * ar * (10.0 + fi * 7.0), st.y * (2.4 + fi * 1.6));
    gp.y += uTime * (0.09 + fi * 0.06);
    vec2 id = floor(gp);
    vec2 f  = fract(gp);
    vec2 rnd = hash22(id + fi * 77.1 + 5.0);
    if(rnd.x < 0.72) continue;
    float x = abs(f.x - (0.3 + rnd.y * 0.4));
    float tail = smoothstep(0.10, 0.0, x) * smoothstep(1.0, 0.15, f.y);
    off.x += (f.x > 0.5 ? 1.0 : -1.0) * tail * 0.010;
    sheen += tail * 0.22;
  }

  // fine condensation
  off += (vec2(vnoise(st * 260.0), vnoise(st * 260.0 + 91.0)) - 0.5) * 0.0035;
  return off;
}

vec3 world(vec2 uv, vec2 st){
  float sheen;
  vec2 off = rainOnGlass(st, sheen);
  vec3 col = seaScene(uv + off);

  // the glass itself: cold cast, edge condensation, specular sheen
  col = mix(col, col * vec3(0.86, 0.94, 1.0), 0.35);
  col += vec3(0.65, 0.78, 0.88) * sheen * 0.10;
  float mist = fbm(st * 3.2 + uTime * 0.01, 4);
  col = mix(col, vec3(0.16, 0.20, 0.24), sat(mist * 0.32) * smoothstep(0.25, 1.0, length(uv)) * 0.55);

  // rain in the air, behind the glass — hairline streaks, not bars
  float streak = 0.0;
  for(int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 sp = vec2(st.x * uRes.x / uRes.y * (70.0 + fi * 38.0), st.y * 2.0 - uTime * (1.5 + fi * 0.9));
    float lane = hash11(floor(sp.x) + fi * 13.0);
    float w = smoothstep(0.16, 0.0, abs(fract(sp.x) - 0.5));
    float len = smoothstep(0.80, 1.0, fract(sp.y * 0.5 + lane * 9.0));
    streak += w * len * step(0.80, lane) * (0.55 - fi * 0.2);
  }
  col += vec3(0.58, 0.68, 0.75) * streak * 0.20;
  return col;
}
`;

/* =================================================================
   VANTABLACK DUNES — a raymarched heightfield with an albedo of
   almost nothing. The only thing you can see is the rim light on
   the crests, which is the whole point.
   ================================================================= */
const DUNES = `
/* The grain is only worth computing while it is bigger than a pixel.
   Its amplitude already falls off as exp(-t*0.16), so cutting it once
   that drops under 2% is free — there is no seam to see. */
float duneH(vec2 p, float t){
  float h = sin(p.x * 0.62 + fbm(p * 0.22, 2) * 2.6) * 0.34;
  h += fbm(p * 0.50, 4) * 0.60;
  float fade = exp(-t * 0.16);
  if(fade > 0.02) h += ridge(p * 1.9, 2) * 0.055 * fade;
  return h;
}

vec3 skyD(vec3 rd){
  float h = sat(rd.y * 1.9 + 0.05);
  vec3 ember = vec3(0.70, 0.235, 0.055);
  vec3 mid   = vec3(0.115, 0.048, 0.045);
  vec3 top   = vec3(0.010, 0.009, 0.014);
  vec3 c = mix(ember, mid, sat(pow(h, 0.42)));
  c = mix(c, top, sat(pow(h, 1.25)));
  vec3 sd = normalize(vec3(-0.30, 0.055, 1.0));
  float sun = pow(sat(dot(rd, sd)), 900.0);
  c += vec3(1.0, 0.44, 0.16) * sun * 3.2;
  c += vec3(1.0, 0.38, 0.12) * pow(sat(dot(rd, sd)), 14.0) * 0.30;
  float dustBand = fbm(vec2(rd.x * 4.0 / max(rd.z, 0.3), rd.y * 9.0) + uTime * 0.02, 3);
  c += vec3(0.22, 0.10, 0.05) * smoothstep(0.45, 0.95, dustBand) * smoothstep(0.30, 0.0, rd.y);
  return c;
}

vec3 world(vec2 uv, vec2 st){
  vec3 ro = vec3(0.0, 1.72, uTime * 0.52);
  vec3 rd = normalize(vec3(uv.x, uv.y + 0.035 + uMouse.y * 0.02, 1.0));
  rd.xz *= rot(uMouse.x * 0.13);

  /* March coarsely and let a secant step find the surface, rather than
     creeping up on it. Steps also lengthen with distance, where a metre
     of error is a fraction of a pixel anyway. */
  float t = 0.5, tPrev = t, dPrev = 1.0, d = 1.0;
  bool hit = false;
  for(int i = 0; i < 56; i++){
    vec3 q = ro + rd * t;
    d = q.y - duneH(q.xz * 0.55, t);
    if(d < 0.0025 * t){ hit = true; break; }
    tPrev = t;
    dPrev = d;
    t += max(0.055, d * 0.62) * (1.0 + t * 0.030);
    if(t > 46.0) break;
  }

  vec3 col;
  if(!hit){
    col = skyD(rd);
  } else {
    t = mix(tPrev, t, sat(dPrev / max(dPrev - d, 1e-4)));
    vec3 pos = ro + rd * t;
    float e = 0.014 + t * 0.004;
    float h0 = duneH(pos.xz * 0.55, t);
    float hx = duneH((pos.xz + vec2(e, 0.0)) * 0.55, t);
    float hz = duneH((pos.xz + vec2(0.0, e)) * 0.55, t);
    vec3 n = normalize(vec3(h0 - hx, e * 0.55, h0 - hz));

    vec3 ld = normalize(vec3(-0.30, 0.055, 1.0));
    float diff = sat(dot(n, ld));
    float rim  = pow(1.0 - sat(dot(n, -rd)), 4.0);

    /* Albedo is essentially zero — this sand returns nothing. All you
       ever see is the crest where the grazing light skims off it.     */
    vec3 albedo = vec3(0.0075, 0.0062, 0.0080);
    col  = albedo * (0.10 + diff * 0.35);
    col += vec3(1.0, 0.33, 0.11) * pow(diff, 22.0) * 0.14;   // only the sharpest crests
    col += vec3(1.0, 0.44, 0.18) * rim * 0.075;

    vec3 refl = reflect(rd, n);
    col += vec3(1.0, 0.52, 0.24) * pow(sat(dot(refl, ld)), 110.0) * 0.30;

    // mica: each grain catches the ember once, then swallows it
    float grain = hash21(floor(pos.xz * 460.0));
    col += vec3(1.0, 0.66, 0.38) * pow(grain, 64.0) * 9.0 * sat(diff) / (1.0 + t * 1.4);

    // haze creeps in, but the ground never brightens past the horizon
    float fog = 1.0 - exp(-t * 0.030);
    col = mix(col, skyD(vec3(rd.x, 0.004, rd.z)) * 0.42, fog * 0.85);
  }

  // sand carried across the lens
  float blow = 0.0;
  for(int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 sp = st * vec2(uRes.x / uRes.y, 1.0) * (5.0 + fi * 8.0);
    sp.x -= uTime * (0.65 + fi * 0.60);
    sp.y += sin(sp.x * 0.7 + fi) * 0.12;
    blow += smoothstep(0.60, 1.0, fbm(sp * vec2(0.35, 3.2), 2)) * (0.40 - fi * 0.11);
  }
  col += vec3(0.55, 0.25, 0.11) * blow * 0.15 * smoothstep(0.35, -0.35, uv.y);
  col *= 1.0 - smoothstep(0.45, 1.40, length(uv)) * 0.55;
  return col;
}
`;

/* =================================================================
   HOLLOW SPIRE — an infinite logarithmic stairwell. The geometry is
   a polar Droste fold: every storey is the previous one, smaller and
   rotated an eighth of a turn, forever.
   ================================================================= */
const SPIRE = `
vec3 world(vec2 uv, vec2 st){
  vec2 p = uv * 1.08 + uMouse * 0.055;
  p *= rot(sin(uTime * 0.062) * 0.055);

  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);

  // octagonal shaft rather than a round tube
  float k = 8.0;
  float poly = cos(mod(a + PI / k, TAU / k) - PI / k);
  float R = r / max(poly, 0.32);

  float z  = log(R) * 2.55 + uTime * 0.235;
  float fl = floor(z);
  float fz = fract(z);

  float spin  = a / TAU + fl * 0.125 + fz * 0.125;   // helical: storeys wind
  float steps = fract(spin * k * 2.0);

  float landing = smoothstep(0.055, 0.0, abs(fz - 0.5) - 0.370);
  float riser   = smoothstep(0.055, 0.0, abs(steps - 0.5) - 0.400);
  float rail    = smoothstep(0.022, 0.0, abs(fz - 0.16)) * smoothstep(0.45, 0.08, abs(steps - 0.5));

  // small R = far above. Falls off fast so only a few storeys are lit.
  float up   = sat(1.0 - R * 2.30);
  float near = sat(R * 0.55);                       // how far down the shaft we are
  vec3 warm = vec3(1.0, 0.735, 0.395);
  vec3 cool = vec3(0.16, 0.24, 0.34);

  vec3 col = vec3(0.0035, 0.0042, 0.0062);
  col += mix(cool, warm, sat(up * 1.4)) * landing * (0.020 + up * 0.42);
  col += warm * riser * (0.012 + up * 0.26);
  col += warm * rail * (0.045 + up * 0.62);

  // the light nobody reaches — kept small and hot
  col += warm * pow(up, 3.2) * 0.55;
  col += vec3(1.0, 0.90, 0.72) * pow(sat(1.0 - R * 5.5), 6.0) * 1.9;

  // storey lamps: one flickering bulb per landing
  float lampAng = fract(spin * k);
  float lamp = smoothstep(0.040, 0.0, abs(lampAng - 0.5)) * smoothstep(0.075, 0.0, abs(fz - 0.5));
  float flick = 0.72 + 0.28 * sin(uTime * 9.3 + fl * 7.1) * hash11(fl * 0.37);
  col += warm * lamp * flick * (0.10 + up * 0.85);

  // falling motes, caught in the light
  float motes = 0.0;
  for(int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 gp = p * (26.0 + fi * 17.0) + vec2(0.0, uTime * (0.20 + fi * 0.15));
    vec2 id = floor(gp);
    vec2 f  = fract(gp) - 0.5;
    vec2 o  = hash22(id + fi * 23.0) - 0.5;
    motes += smoothstep(0.032, 0.0, length(f - o * 0.8)) * step(0.6, hash21(id + fi));
  }
  col += warm * motes * 0.30 * sat(up * 1.6 + 0.05);

  /* Carve the treads. Without these seams the shaft reads as a shell;
     with them it reads as sixteen steps a storey, going up forever. */
  float treadSeam = smoothstep(0.0, 0.055, abs(steps - 0.5) - 0.435);
  col *= 1.0 - treadSeam * 0.62;
  float floorSeam = smoothstep(0.0, 0.045, abs(fz - 0.5) - 0.430);
  col *= 1.0 - floorSeam * 0.72;

  // the drop below: everything far from centre falls away to nothing
  col *= 1.0 - smoothstep(0.30, 1.20, r) * 0.88;
  col *= 1.0 - near * 0.35;
  col += vec3(0.006, 0.008, 0.013) * (1.0 - up);
  return col;
}
`;

/* =================================================================
   THE LONG NOON — permanent mid-afternoon. Overexposed on purpose:
   the sun clips, the haze eats the horizon, the pollen never lands.
   ================================================================= */
const NOON = `
vec3 world(vec2 uv, vec2 st){
  vec2 sun = vec2(0.42 + uMouse.x * 0.03, 0.40 + uMouse.y * 0.02);

  // heat shimmer warps everything below the horizon
  float horizonY = -0.045;
  float below = smoothstep(0.10, -0.25, uv.y - horizonY);
  vec2 p = uv;
  p.x += sin(uv.y * 42.0 + uTime * 1.6) * 0.0045 * below;
  p.x += fbm(uv * 6.0 + vec2(0.0, uTime * 0.35), 3) * 0.010 * below;

  // sky
  float h = sat((p.y - horizonY) * 1.5);
  vec3 skyTop = vec3(0.145, 0.375, 0.700);
  vec3 skyMid = vec3(0.470, 0.665, 0.870);
  vec3 skyLow = vec3(0.930, 0.860, 0.680);
  vec3 col = mix(skyLow, skyMid, sat(pow(h, 0.55)));
  col = mix(col, skyTop, sat(pow(h, 1.35)));

  // soft cumulus, barely moving
  float cl = fbm(vec2(p.x * 1.5 - uTime * 0.006, p.y * 3.0 + 4.0), 5);
  float cmask = smoothstep(0.50, 0.80, cl) * smoothstep(0.02, 0.40, p.y - horizonY);
  col = mix(col, vec3(1.06, 1.03, 0.98), cmask * 0.72);

  // the sun, blown out
  float sd = length((p - sun) * vec2(1.0, 1.0));
  col += vec3(1.0, 0.92, 0.70) * exp(-sd * 11.0) * 3.4;
  col += vec3(1.0, 0.86, 0.58) * exp(-sd * 2.3) * 0.55;
  col += vec3(1.0, 0.95, 0.80) * pow(sat(1.0 - sd * 9.0), 3.0) * 2.0;

  // anamorphic streak
  float streak = exp(-abs(p.y - sun.y) * 210.0) * exp(-abs(p.x - sun.x) * 2.1);
  col += vec3(1.0, 0.90, 0.72) * streak * 0.42;

  // lens flare ghosts along the sun axis
  vec2 axis = sun * -1.0;
  for(int i = 1; i < 6; i++){
    float fi = float(i);
    vec2 g = mix(sun, axis, fi * 0.31);
    float gd = length(p - g);
    float sz = 0.055 + fi * 0.020;
    float ring = smoothstep(sz, sz * 0.35, gd) * (1.0 - smoothstep(sz * 0.62, sz * 0.30, gd) * 0.55);
    vec3 tint = vec3(0.9 + 0.1 * sin(fi), 0.75 + 0.2 * cos(fi * 1.7), 0.55 + 0.35 * sin(fi * 2.3));
    col += tint * ring * 0.085;
  }

  // treeline
  float tree = fbm(vec2(p.x * 2.6 + 11.0, 0.0), 5) * 0.075 + ridge(vec2(p.x * 9.0, 3.0), 3) * 0.022;
  float treeMask = smoothstep(0.004, -0.004, (p.y - horizonY) - tree + 0.055);
  col = mix(col, vec3(0.145, 0.185, 0.130), treeMask * 0.80);

  // the field
  float fieldMask = smoothstep(0.006, -0.010, p.y - horizonY);
  if(fieldMask > 0.001){
    float dy = max(-(p.y - horizonY), 0.010);
    float depth = sat(dy * 4.2);
    vec2 gp = vec2(p.x / dy * 0.30, 1.0 / dy * 0.105 - uTime * 0.02);
    float blades = ridge(gp * vec2(11.0, 3.6), 4);
    float clumps = fbm(gp * 1.2, 4);
    vec3 grassLo = vec3(0.135, 0.185, 0.075);
    vec3 grassHi = vec3(0.720, 0.685, 0.245);
    vec3 g = mix(grassLo, grassHi, sat(blades * 0.95 + clumps * 0.45));
    g *= 0.62 + 0.62 * depth;
    // sun catching the tips of the near grass
    g += vec3(1.0, 0.88, 0.50) * pow(sat(blades), 9.0) * 0.55 * depth;
    col = mix(col, g, fieldMask);
    // haze eats the far grass, but the near field keeps its colour
    col = mix(col, skyLow, fieldMask * pow(1.0 - depth, 1.6) * 0.85);
  }

  // pollen, drifting upward, out of focus
  float pol = 0.0;
  for(int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 q = uv * (6.5 + fi * 5.5) + vec2(sin(uTime * 0.07 + fi) * 0.4, -uTime * (0.050 + fi * 0.040));
    vec2 id = floor(q);
    vec2 f  = fract(q) - 0.5;
    vec2 o  = hash22(id + fi * 29.0) - 0.5;
    float seed = hash21(id + fi * 3.0);
    if(seed < 0.55) continue;
    float rad = 0.045 + seed * 0.075;
    float m = smoothstep(rad, rad * 0.05, length(f - o * 0.75));
    pol += m * (0.35 + 0.65 * hash21(id + fi * 7.0)) * (0.9 - fi * 0.24);
  }
  col += vec3(1.0, 0.95, 0.76) * pol * 0.30;

  // bloom cast over the whole frame
  col += vec3(1.0, 0.90, 0.70) * exp(-length(p - sun) * 1.1) * 0.075;
  col *= 1.0 - smoothstep(0.45, 1.55, length(uv)) * 0.45;
  return col;
}
`;

/* =================================================================
   NULLPOINT — carrier signal only. The four seconds in the tunnel
   when the window becomes a mirror and the mirror lags behind you.
   ================================================================= */
const NULLW = `
float sdHead(vec2 p){
  float head = length((p - vec2(0.0, 0.155)) / vec2(0.085, 0.105)) - 1.0;
  vec2 q = p - vec2(0.0, -0.16);
  float shoulders = length(q / vec2(0.30, 0.20)) - 1.0;
  return min(head, shoulders);
}

vec3 world(vec2 uv, vec2 st){
  float tt = uTime;

  // tape damage: blocks of rows shifted sideways
  float band = floor(st.y * 46.0);
  float tear = step(0.955, hash21(vec2(band, floor(tt * 11.0))));
  float shift = (hash21(vec2(band, floor(tt * 11.0) + 3.0)) - 0.5) * 0.16 * tear;

  // vertical hold: the sync bar rolling up
  float roll = fract(st.y + tt * 0.09);
  float syncBar = smoothstep(0.055, 0.0, abs(roll - 0.5) - 0.020);
  shift += syncBar * 0.05 * sin(tt * 3.0);

  vec2 sp = vec2(st.x + shift, st.y);

  // the carrier
  float n = hash21(floor(sp * uRes * 0.55) + vec2(floor(tt * 34.0)));
  float n2 = hash21(floor(sp * uRes * 0.18) + vec2(floor(tt * 21.0) * 1.7));
  float sig = mix(n, n2, 0.35);

  // something almost there
  vec2 hp = (sp - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  hp.x += sin(tt * 0.23) * 0.04;
  float presence = smoothstep(0.30, 0.85, sin(tt * 0.117) * 0.5 + 0.5);
  float ghost = smoothstep(0.020, -0.075, sdHead(hp)) * presence;
  float ghostEdge = smoothstep(0.045, 0.0, abs(sdHead(hp))) * presence;
  sig = mix(sig, sig * 0.42 + 0.10, ghost * 0.85);
  sig += ghostEdge * 0.30 * (0.5 + 0.5 * sin(tt * 7.0));

  // interference fringes
  sig += sin(sp.y * 900.0 + tt * 4.0) * 0.035;
  sig += fbm(sp * vec2(2.0, 60.0) + vec2(0.0, tt * 2.0), 3) * 0.10;

  vec3 col = vec3(sig);
  col *= vec3(0.90, 0.955, 1.0);                       // cold CRT phosphor
  col += vec3(0.10, 0.13, 0.16) * syncBar;

  // scanlines
  col *= 0.80 + 0.20 * sin(st.y * uRes.y * 1.4);

  // dropouts
  float drop = step(0.9975, hash21(vec2(floor(st.y * 200.0), floor(tt * 26.0))));
  col = mix(col, vec3(0.0), drop * 0.9);

  // occasional lock: for a moment the signal almost resolves
  float lock = smoothstep(0.985, 1.0, sin(tt * 0.29) * 0.5 + 0.5);
  col = mix(col, col * vec3(0.6, 0.8, 1.15) + 0.06, lock);

  col *= 0.20 + 0.09 * sin(tt * 0.7);                  // keep it dim
  col *= 1.0 - smoothstep(0.15, 1.05, length(uv)) * 0.92;
  return col;
}
`;

/* =================================================================
   THE INVERTED SEA — the ocean is the ceiling. Rain rises. The
   seabed is dry and full of everything that has been dropped.
   ================================================================= */
const INVERTED = `
float ceilWave(vec2 p){
  float w = 0.0, a = 1.0;
  for(int i = 0; i < 4; i++){
    p = rot(0.72) * p * 1.92;
    w += a * sin(p.x * 1.35 + uTime * (0.28 + float(i) * 0.09) + vnoise(p * 0.5) * 3.4);
    a *= 0.58;
  }
  return w * 0.05;
}

vec3 world(vec2 uv, vec2 st){
  vec3 ro = vec3(0.0, 1.15, uTime * 0.16);
  vec3 rd = normalize(vec3(uv.x, uv.y + 0.045 + uMouse.y * 0.03, 1.0));
  rd.xz *= rot(uMouse.x * 0.10);

  const float CEIL = 3.9;
  vec3 col;
  vec3 hazeC = vec3(0.075, 0.130, 0.140);

  if(rd.y > 0.0015){
    /* ---- the hanging ocean ---- */
    float t = (CEIL - ro.y) / rd.y;
    vec3 pos = ro + rd * t;
    float e = 0.05 + t * 0.005;
    float h0 = ceilWave(pos.xz * 0.42);
    float hx = ceilWave((pos.xz + vec2(e, 0.0)) * 0.42);
    float hz = ceilWave((pos.xz + vec2(0.0, e)) * 0.42);
    vec3 n = normalize(vec3(h0 - hx, -e * 0.55, h0 - hz));

    float depth = fbm(pos.xz * 0.16 + uTime * 0.012, 5);
    vec3 water = mix(vec3(0.018, 0.070, 0.082), vec3(0.045, 0.175, 0.185), depth);

    // light filtering through from above the water
    float caust = ridge(pos.xz * 0.55 + vec2(uTime * 0.06, -uTime * 0.04), 4);
    caust = pow(sat(caust * 1.25), 4.0);
    water += vec3(0.55, 0.90, 0.95) * caust * 0.55;

    float fres = pow(1.0 - sat(dot(-rd, -n)), 3.0);
    water += vec3(0.30, 0.55, 0.60) * fres * 0.30;

    // drops preparing to fall
    vec2 gp = pos.xz * 1.4;
    vec2 id = floor(gp);
    vec2 f  = fract(gp) - 0.5;
    vec2 o  = hash22(id) - 0.5;
    float bulge = smoothstep(0.28, 0.02, length(f - o * 0.7));
    water += vec3(0.6, 0.95, 1.0) * bulge * 0.14 * (0.5 + 0.5 * sin(uTime * 2.0 + hash21(id) * 20.0));

    float fog = 1.0 - exp(-t * 0.048);
    col = mix(water, hazeC, fog);
  } else if(rd.y < -0.0015){
    /* ---- the dry bed ---- */
    float t = -(ro.y) / rd.y;
    vec3 pos = ro + rd * t;
    float crack = ridge(pos.xz * 1.05, 5);
    float seam = smoothstep(0.86, 1.0, crack);
    float silt = fbm(pos.xz * 0.55, 5);
    vec3 bed = mix(vec3(0.105, 0.098, 0.082), vec3(0.185, 0.170, 0.138), silt);
    bed *= 1.0 - seam * 0.78;
    bed += vec3(0.35, 0.52, 0.55) * pow(sat(crack), 8.0) * 0.10;

    // things dropped from above, catching the light
    float glint = hash21(floor(pos.xz * 26.0));
    bed += vec3(0.75, 0.92, 0.95) * pow(glint, 46.0) * 9.0 / (1.0 + t * 0.9);

    float fog = 1.0 - exp(-t * 0.075);
    col = mix(bed, hazeC, fog);
  } else {
    col = hazeC;
  }

  // horizon seam
  col += vec3(0.35, 0.62, 0.66) * smoothstep(0.010, 0.0, abs(uv.y + 0.045)) * 0.35;

  // rain going the wrong way — hairline streaks, not bars
  float rise = 0.0;
  for(int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 sp = vec2(st.x * uRes.x / uRes.y * (62.0 + fi * 34.0), st.y * 2.2 + uTime * (1.1 + fi * 0.7));
    float lane = hash11(floor(sp.x) + fi * 17.0);
    float w = smoothstep(0.15, 0.0, abs(fract(sp.x) - 0.5));
    float len = smoothstep(0.78, 1.0, fract(sp.y * 0.5 + lane * 11.0));
    rise += w * len * step(0.78, lane) * (0.6 - fi * 0.15);
  }
  col += vec3(0.52, 0.82, 0.88) * rise * 0.26;

  // droplets crawling up the lens
  for(int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 gp = vec2(st.x * uRes.x / uRes.y, st.y) * (11.0 + fi * 8.0);
    gp.y -= uTime * (0.18 + fi * 0.12);
    vec2 id = floor(gp);
    vec2 f  = fract(gp);
    vec2 rnd = hash22(id + fi * 53.0);
    if(rnd.x < 0.76) continue;
    float d = length((f - vec2(0.5) - (rnd - 0.5) * 0.5) * vec2(1.0, 1.25));
    float m = smoothstep(0.15 + rnd.y * 0.08, 0.01, d);
    col += vec3(0.40, 0.72, 0.78) * pow(m, 2.2) * 0.22;
  }

  col *= 1.0 - smoothstep(0.6, 1.5, length(uv)) * 0.42;
  return col;
}
`;

export const WORLDS = {
  concourse: PRE + CONCOURSE + TAIL,
  glass: PRE + GLASS + TAIL,
  dunes: PRE + DUNES + TAIL,
  spire: PRE + SPIRE + TAIL,
  noon: PRE + NOON + TAIL,
  null: PRE + NULLW + TAIL,
  inverted: PRE + INVERTED + TAIL,
};

/* =================================================================
   POST — the thing that makes six different shaders feel like one
   film. Radial smear on departure, chromatic split, grain, vignette.
   ================================================================= */
export const POST = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2  uRes;
uniform float uTime;
uniform float uWarp;    // 0..1 departure smear
uniform float uFade;    // 0..1 to black
uniform float uFlash;   // 0..1 to white

float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 st = gl_FragCoord.xy / uRes;
  vec2 c  = st - 0.5;
  float r = length(c);

  float ab = (0.0016 + uWarp * 0.011) * (0.25 + r);
  vec3 col;

  if(uWarp < 0.003){
    col.r = texture(uScene, st + c * ab).r;
    col.g = texture(uScene, st).g;
    col.b = texture(uScene, st - c * ab).b;
  } else {
    vec3 acc = vec3(0.0);
    float total = 0.0;
    float amt = uWarp * uWarp * 0.34;
    float jitter = hash21(gl_FragCoord.xy + uTime) * 0.06;
    for(int i = 0; i < 10; i++){
      float f = (float(i) + jitter) / 9.0;
      float w = 1.0 - f * 0.55;
      vec2 o = st - c * f * amt;
      vec3 s;
      s.r = texture(uScene, o + c * ab).r;
      s.g = texture(uScene, o).g;
      s.b = texture(uScene, o - c * ab).b;
      acc += s * w;
      total += w;
    }
    col = acc / total;

    // speed lines torn out of the frame
    float ang = atan(c.y, c.x);
    float streak = hash21(vec2(floor(ang * 90.0), floor(uTime * 24.0)));
    streak = pow(streak, 9.0) * smoothstep(0.10, 0.75, r);
    col += vec3(1.0, 0.86, 0.68) * streak * uWarp * 1.7;
  }

  // grain and vignette are already baked in by the world shader
  col = mix(col, vec3(0.0), uFade);
  col = mix(col, vec3(1.0, 0.96, 0.90), uFlash);

  fragColor = vec4(col, 1.0);
}
`;
