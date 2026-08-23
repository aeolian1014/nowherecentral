# Nowhere Central — house rules

Three rules for this project. They are not preferences; do not trade them
away for convenience, and do not ask to skip one because a task is small.

---

## 1. Nothing the site needs may live outside the project folder

Whatever the site loads must resolve inside this repo. If something is
pointed at from outside — a Downloads folder, a CDN, a font host, an
absolute path on one machine — it gets brought in: copied into the asset
tree and re-encoded if that is what it takes, or inlined into the source.
Which of those is a judgement call. Leaving it external is not an option.

**Why:** an external reference is a broken build on every other machine,
and a silent breakage on this one the moment the user tidies their
Downloads. It also means the project cannot be cloned, zipped or deployed
as a unit.

**Verify:** load the page and check that

```js
performance.getEntriesByType('resource')
  .map(e => e.name)
  .filter(n => !n.startsWith(location.origin) && !n.startsWith('data:'))
```

returns an empty array. That is the whole test. Google Fonts was the last
thing to fail it; the faces now live in `assets/fonts/` with a local
`css/fonts.css`.

---

## 2. Unused assets do not stay in the folder

If nothing in the code references a file, delete it. Superseded encodes,
old formats replaced by newer ones, leftovers from an approach that was
abandoned — none of them stay. A file kept "in case" is a file that will
be shipped to every visitor's browser by mistake later, or that will make
the next person wonder which of two similar names is the live one.

The user's own source material is safe in their own folders. The project
holds only what the project uses.

**Verify:** compare what the code references against what is on disk:

```bash
grep -ohE "assets/[A-Za-z0-9._/-]+" js/*.js css/*.css index.html | sort -u
find assets -type f | sort
```

Anything in the second list and not the first goes — remembering that
`-hd` variants are derived at runtime by `hdSrc()` and so never appear
literally in the source.

---

## 3. Every video the admin chooses must boomerang

Videos play forward, then reversed, then forward again, forever. A
straight loop cuts when the last frame jumps back to the first, and that
cut is exactly the kind of sudden event this site exists to avoid.

Baked at encode time, never at runtime — negative `playbackRate` is not
usable in any browser. For an N-frame source: play frames `0..N-1`, then
`N-2..1`. Dropping the first and last frame of the reversed half is what
stops a frame repeating at the join and at the wrap.

```
[0:v]split[a][b];
[b]reverse,select='between(n,1,N-2)',setpts=N/FRAME_RATE/TB[r];
[a][r]concat=n=2:v=1[v]
```

Scale **before** reversing — `reverse` buffers every frame, and 1080p
footage of any length will exhaust memory otherwise. For long clips,
reverse in halves and concatenate.

**Both quality tiers must be the same duration.** The tier swap preserves
`currentTime`, so a 58s LOW against a 117s HIGH would seek out of range
mid-clip. Same boomerang, same speed changes, same length — only
resolution and bitrate differ.

**Verify:** a boomerang's last frame is its first frame. Compare them:

```bash
ffmpeg -i clip.mp4 -vf "select=eq(n\,0)"     -vframes 1 a.png
ffmpeg -i clip.mp4 -vf "select=eq(n\,N-1)"   -vframes 1 b.png
ffmpeg -i a.png -i b.png -lavfi ssim -f null -
```

SSIM ≈ 0.99 means it boomerangs. Anything near 0.6 is a straight loop
wearing the name.

---

## 4. Every video is stripped of audio before it enters the project

Encode with `-an`. Not muted at runtime with the `muted` attribute —
stripped at encode time, so the track does not exist in the file at all.

**Why:** the sections play their own bed and voice cues through the audio
graph, where they are levelled, filtered and ducked against each other. A
video's own soundtrack bypasses all of that and simply mixes on top. Both
Gradient Girl sources arrived carrying a 128 kbps AAC track that would
have played straight over the music.

Runtime muting is not the same thing. `muted` can be undone by a stray
property write, it still costs a decode, and it leaves the file wrong for
anyone who opens it outside the site.

**Verify:** the count must be zero.

```bash
ffprobe -v error -select_streams a -show_entries stream=index \
  -of csv=p=0 clip.mp4 | wc -l
```

---

## Encoding note, learned the hard way

Do not downscale dark, smooth, slow footage to save bytes. Gradients cost
almost nothing to encode at any resolution, so halving the pixels buys
very little while the softness is immediately visible. Hold the native
resolution and lower the bitrate instead — 1080p at 116 kbps beat 720p at
180 kbps on this project's own footage, on both size and appearance.
