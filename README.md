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

No audio files. Pink noise beds through modulated biquads, detuned drone
stacks with slow breathing LFOs, a two-tone platform chime, a feedback
delay standing in for the hall, and one short filtered click per flap
(throttled, or 2,400 clicks would arrive at once).

Off until you ask for it — press **M** or use the toggle.

---

## Controls

| | |
|---|---|
| `1` – `6` | Depart for that service |
| `Esc` | Return to Nowhere Central |
| `M` | Sound on / off |
| `Q` | Rendering quality — Auto → High → Medium → Low. Low halves the frame rate and quarters the pixels. Remembered between visits. |
| `NC` | A handle on the console: `NC.go('spire')`, `NC.home()`, `NC.gl`, `NC.station` |

---

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
