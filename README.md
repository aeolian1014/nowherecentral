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
as it nears and closes as it goes; the level follows a
swell rather than a fade; and most of it is sent to the hall, because at
that range you hear the valley more than the engine.

- **Exhaust** — four beats to a wheel revolution, at offsets
  `[0, 0.238, 0.5, 0.762]` with uneven strengths. The two cylinders of a
  steam engine are never quite matched, and that limp in the rhythm is
  the whole reason it sounds like a steam engine rather than a machine.
- **Horn** — five pipes with shallow vibrato, a slow attack because
  steam takes a moment to find the pipes, and a slight pitch rise on
  the attack and sag on the release as pressure builds and falls.
  Two things decide whether it lands as *big* or as *eerie*, and
  neither is volume: the chord must be a major stack (a minor one is
  beautiful but reads as dread), and there must be a band of breath
  noise around the tone, or it is a church organ.

  It sounds the real grade-crossing signal — long, long, short, LONG —
  worked backwards from the closest approach so the sustained one
  lands as the engine goes past.

There is deliberately **no bell**. A bell is a hard thing to make
sound casual: get the partials even slightly clangorous and it tolls,
and a tolling bell under reverb is the sound of an empty church at
midnight. The horn carries the whole announcement instead.

The first train comes **15 seconds after the announcer finishes**, and
after that there is roughly **half a minute of quiet** between one pass and the
next. The concourse shader sweeps light across the floor every 22
seconds, and each pass is aimed at one of those sweeps, so the light
crossing the floor and the engine going through are the same event.

Distance is a gentle falloff rather than a literal inverse square. True
1/r² spends most of a pass inaudible, which reads as a short event
surrounded by silence instead of a train crossing a valley. The ambience
bus ducks about 40% underneath it too — a real distant train doesn't get
louder than the wind so much as take the wind's place for a minute.

Measured at the output: ambience sits at 0.059 RMS, the pass peaks at
0.252 — a little over four times the room, at its closest.

Voices are scheduled about two and a half seconds ahead on a rolling
timer rather than all at once, so a forty-second pass never holds more
than a handful of live nodes, and it survives a throttled tab.

Off until you ask for it — press **M** or use the toggle.

### The announcer — `js/voice.js`

The one woman who works here is the browser's own speech synthesiser.
She costs nothing to download, and she reads the board as it actually
stands — including departure times that did not exist when this was
written.

Enter the concourse and you get the two-tone chime, then her welcome
with the next service, its time and its platform. Fifteen seconds after
she finishes, the first train comes through. She also calls each
departure as you take it.

Voice selection walks a preference list (Aria, Jenny, Sonia, Samantha,
Zira, Hazel…) and falls back to any English voice that isn't obviously
male. Names come off the board in caps, because that is how a split-flap
works, so she gets them back in title case — speech engines read caps as
initialisms. Times are spelt out too: "one thirty-nine", not "01:39".

#### Making her sound like a tannoy

Her voice **cannot be filtered**. Web Speech writes to the output device,
past the AudioContext entirely — there is no node to hang a bandpass on,
and no honest way around it short of a server-side TTS.

So the equipment gets built around her instead, and the ear does the
rest. Three things carry it:

- **Phrasing.** She speaks in separate utterances with real pauses
  between them, not one sentence with commas. This does more for
  "professional announcer" than any amount of processing.
- **The rig.** A relay closes with a thump of cone movement, then a
  carrier hiss band-limited the way a horn speaker is (420 Hz – 3.4 kHz)
  runs underneath her with 100 Hz mains hum from an amplifier that has
  been warm since 1974. At the end: key down, and the hall rings on for
  a third of a second.
- **Fusion.** Every word boundary pulses the carrier. The ear fuses a
  voice with a noise bed that shares its band *and its timing* and hears
  one source — so the hiss reads as carrying her rather than sitting
  beside her. Without the pulsing it stays two separate sounds.

Voice choice is scored, not first-match: a "Natural"/"Neural"/"Online"
voice outranks the right name on an old SAPI one, since Edge ships
several that are far better than anything local. `NC.voices()` lists
what your machine has; `NC.voice('aria')` forces one.

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
