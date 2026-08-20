# NOWHERE CENTRAL

**The terminus for services that do not arrive.**

A live split-flap departure board for six places that don't exist. Pick a
service, the board flips, the frame tears itself apart, and you arrive
somewhere impossible — with local conditions, an advisory, and weather
measured in regret.

```bash
node server.js
```

Then open <http://localhost:4173>. That's the whole build step.

---

## What's actually going on

**Zero dependencies.** No React, no Three.js, no GSAP, no bundler, no
`node_modules`. Every pixel and every sound is generated at runtime from
maths. Nothing is fetched except the three Google fonts, and the page
degrades cleanly without them.

### The board — `js/board.js`

A real split-flap mechanism, not a CSS animation. Each character is four
layers: two static halves and two hinged leaves. A single `requestAnimationFrame`
ticker drives all 192 cells, writing nothing but `transform` and
`textContent`, so a full board reset stays on the compositor.

Cells cycle *forward* through the drum like the real hardware. If the
shortest path is longer than 18 flaps the drum is silently jumped so no
single character holds the board up. Each cell gets a small random start
delay, which is where the cascade comes from.

### The worlds — `js/shaders.js`

Seven GLSL fragment shaders, one per destination plus the station itself.
There is no geometry anywhere — every scene is raymarched or layered from
noise inside a single fullscreen triangle:

| | |
|---|---|
| **Concourse** | Sheared light shafts, suspended dust, a floor that mirrors them, and something that passes the platform every twenty seconds. Drifts downward as you scroll. |
| **The Glass Sea** | Analytic ocean with wave-gradient normals and Fresnel sky reflection, seen through rain that **refracts** the scene by re-sampling it. |
| **Vantablack Dunes** | Raymarched heightfield with an albedo of ~0.007. All you ever see is the crest where the ember light skims off it. |
| **Hollow Spire** | A polar Droste fold — each storey is the one before, smaller and rotated an eighth of a turn, forever. Treads carved by seam masks. |
| **The Long Noon** | Permanent mid-afternoon. Heat shimmer, blown-out sun, lens-flare ghosts on the sun axis, perspective-projected grass, bokeh pollen. |
| **Nullpoint** | Carrier signal only. Tape tears, a rolling sync bar, dropouts — and a silhouette that resolves for a few seconds every minute or so. |
| **The Inverted Sea** | The ocean is the ceiling. Ray direction decides whether you hit hanging water with caustics or a dry cracked bed. Rain goes up. |

### The renderer — `js/gl.js`

Raw WebGL2. World shader → framebuffer → post pass → screen. The post pass
is what makes seven different shaders feel like one film: radial smear on
departure, chromatic split scaled by radius, speed lines, luminance-aware
grain, vignette, fade and flash.

The post chain only exists for departures. While nothing is warping,
fading or flashing, the world draws **straight to the screen** — one pass,
no render target, no texture reads. Grain and vignette live in the world
shaders so the idle frame never needs a second pass at all.

Resolution follows the frame budget: it drops on the first missed window
and climbs back when the machine proves it can keep up. The cost is capped
in **absolute pixels**, not as a ratio, so a 4K panel doesn't quietly ask
for eight million pixels a frame. Integrated and software renderers are
detected up front and start lower. Vantablack Dunes — the only true
raymarcher here — renders at 70% of the others, which nobody notices on a
scene made of haze and rim light.

All seven programs are compiled during idle time so a departure never
stutters.

### Things deliberately *not* used

Each of these is a per-frame cost on a page with a live canvas, and none
of them earn it:

- **`backdrop-filter`** — blurring a moving canvas every frame is one of
  the most expensive things a page can ask a browser to do. The topbar,
  the board and the conditions panel use plain gradients instead.
- **`backface-visibility: hidden`** on flap halves — it promotes each one
  to its own compositor layer, and 192 cells × 4 halves is 768 layers.
  `display: none` on the idle leaves does the same job for free.
- **`mix-blend-mode`** on the cursor — forces a full re-composite of the
  frame behind it.
- **A composited scrim** over the canvas — the reading gradient is part of
  the concourse shader now.
- **Per-frame DOM writes** — the clock ticks twice a second into a text
  node instead of re-parsing `innerHTML` sixty times a second, and a flap
  toggles its class twice per flip rather than once per frame.

### The sound — `js/audio.js`

No audio files, and that is a feature rather than a saving. A sample
pack — even a hundred of them — eventually loops, and a brain trying to
fall asleep is very good at noticing periodicity. Noise driven by slow
LFOs at unrelated rates never repeats, and the whole engine is about
eight kilobytes.

Three layers per world:

- **Beds** — pink noise through a modulated biquad. The bed *drifts*:
  every 20–45 seconds its filter and gain retarget to a new random point
  over a ten-second glide, so hour two does not sound like hour one.
- **Drones** — detuned oscillator stacks with slow breathing LFOs.
- **Events** — the things that happen occasionally. Drawn from a
  weighted pool at a random interval, so nothing falls into a rhythm.

Plus named cues: the platform chime, the departure sweep, one filtered
click per flap (throttled, or 2,400 would arrive at once), and
`steamTrain()`.

#### The steam train

Everything about it is a distance problem. Air absorbs high frequencies
over a kilometre, so the whole train runs through one lowpass that opens
as it nears and closes as it goes; the level follows an inverse-square
swell rather than a fade; and most of it is sent to the hall, because at
that range you hear the valley more than the engine.

- **Exhaust** — four beats to a wheel revolution, at offsets
  `[0, 0.238, 0.5, 0.762]` with uneven strengths. The two cylinders of a
  steam engine are never quite matched, and that limp in the rhythm is
  the whole reason it sounds like a steam engine rather than a machine.
- **Whistle** — five pipes on a minor stack with shallow vibrato, a
  slow attack because steam takes a moment to find the pipes, and a
  band of breath noise around the tone. Without the breath it is an
  organ.
- **Bell** — brass, so inharmonic partials at 1, 2.01, 3.04, 4.19, 5.51
  with the upper ones dying first. It swings, so alternate strikes fall
  0.60s and 0.70s apart at slightly different strengths.

The whole pass runs about three quarters of a minute, and it happens
**every two and a half to five minutes**, not continuously. The concourse
shader sweeps light across the floor every 22 seconds; most of those pass
in silence — whatever it is, it's too far to hear. Occasionally one is
close enough, and the sound is aimed at that exact sweep so the light and
the steam arrive together.

Voices are scheduled about two and a half seconds ahead on a rolling
timer rather than all at once, so a forty-second pass never holds more
than a handful of live nodes, and it survives a throttled tab.

Off until you ask for it — press **M** or use the toggle.

#### Writing a pack

Each world's recipe is one object in `PRESETS`. To describe a new pack,
these are the knobs that exist — say it in these terms and it maps
straight across:

```js
glass: {
  beds: [
    // filter type, centre frequency, resonance, level,
    // and [lfo rate in Hz, sweep depth in Hz]
    { type: 'highpass', freq: 1500, q: 0.6, gain: 0.085, lfo: [0.09, 400] },
  ],
  drones: [
    { f: 48, type: 'sine', gain: 0.05 },   // f in Hz, any oscillator type
  ],
  events: { every: [26, 70], pool: ['thunder', 'swell', 'thunder', 'groan'] },
  //         ^ seconds between       ^ repeats = higher odds
}
```

Generators currently available to a pool: `thunder`, `gust`, `swell`,
`rumble`, `groan`, `drip`, `chime`, `bird`, `cicada`, `clatter`,
`dropout`, `carrier`, `doorFar`, `tannoy`. Each takes its own randomised
ranges, so two `gust` events are never the same gust.

**The current pools are structural placeholders.** They prove the
machinery, not the mood. Describe what each place should *sound* like —
"the Glass Sea should be rain on a window from inside a warm room, with
thunder so distant it is only felt" — and the recipe gets rewritten to
match.

---

## Controls

| | |
|---|---|
| `1` – `6` | Depart for that service |
| `Esc` | Return to Nowhere Central |
| `M` | Sound on / off |
| `Q` | Rendering quality — Auto → High → Medium → Low. Low halves the frame rate and quarters the pixels. Remembered between visits. |
| `N` | Night service |
| `NC` | A handle on the console: `NC.go('spire')`, `NC.home()`, `NC.gl`, `NC.station` |

---

## Night service

Press **N**. The station stays open: volume, a sleep timer (15/30/60/90),
and a screen that puts itself out.

After 55 seconds without input the page steps back; after 105 seconds it
goes dark but for a clock, where you are, and how long is left. The
renderer follows it down to **6 frames a second at a third of the
pixels** — about a fortieth of the work — so a laptop left on the
nightstand stays cold. Move anything and it all comes back over two and a
half seconds. When the timer runs out the audio tapers to silence over 90
seconds rather than stopping.

**An honest limit:** this is a page, not an app. Browsers throttle
background tabs and suspend audio on locked phones, and there is no
lock-screen control. Keep the tab in front and it works well. For a phone
under a pillow, a native app wins, and no amount of code here changes
that.

## Loading

FCP around **110ms**; **46KB on the wire** for 149KB of source, gzipped
by the little server. There are no images anywhere, so there is nothing
to lazy-load in the usual sense — but there is still work worth deferring:

- The renderer does not start until you enter. The boot veil is opaque,
  so every frame drawn behind it was thrown away.
- The board's 192 cells are built from an IntersectionObserver after
  first paint rather than during parse, and Lost & Found is built when
  its section approaches.
- The **flip** waits until the board is actually on screen. A departure
  board that has already finished flipping is just a table.
- All seven shader programs compile during idle time.

## Notes

- Respects `prefers-reduced-motion`: the boot log prints at once, the warp
  is skipped, and the worlds hold still.
- Falls back to a static gradient if WebGL2 is unavailable.
- Fully keyboard reachable; hidden layers are `inert`, not just invisible.
- The departure times are generated from the moment you load the page, so
  the board is always plausibly live. The clock is the real one.

## Layout

```
index.html          the whole document
css/tokens.css      design DNA — colour, type, space, shape, motion
css/main.css        surface
js/main.js          conductor: boot, board, departures, chrome
js/data.js          the destination register (all of the fiction)
js/board.js         split-flap mechanism
js/shaders.js       seven worlds + the post chain
js/gl.js            WebGL2 renderer
js/audio.js         synthesised station
server.js           30-line static server
```
