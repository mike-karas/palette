# palette.

A color palette generator that analyzes any image and returns a 6-color palette grounded in color theory.

Upload a photo, and palette. extracts the 3 most visually dominant colors using Vibrant.js, then derives 3 harmony colors by applying classic color-theory transforms — a random mix by default, or a single harmony of your choosing.

**[Try it → mike-karas.github.io/palette](https://mike-karas.github.io/palette/)**

---

## Features

- **Image input** — drag & drop, file picker, or camera capture on mobile (JPG, PNG, WebP)
- **Example photos** — six random landscape images from Unsplash to try without uploading anything
- **Dominant color extraction** — Vibrant.js identifies the 3 most perceptually meaningful colors in the image
- **Harmony modes** — Random (the default, re-click to re-roll) or one of six named harmonies applied to all three dominants
- **Swatch reasons** — every swatch explains where it came from: which Vibrant region it was extracted from, or which transform of which dominant produced it
- **Full color values** — HEX, RGB, and HSL shown for every swatch
- **Copy HEX** — per swatch, or copy all 6 at once
- **Swatch locking** — lock harmony colors so they are kept when switching harmony modes (locks reset when you load a new image)
- **PNG export** — download the palette as a labeled image
- **Auto palette name** — generated from the detected hues (e.g. "Ocean Dusk", "Forest Ember")
- **No build step** — open `index.html` directly in any modern browser

---

## Color theory

Each of the 3 dominant colors gets one harmony color, derived with one of these transforms:

| Transform | Description |
|---|---|
| Complementary | Hue + 180° — maximum contrast |
| Split-complementary | Hue ± 150° — softer contrast, more interesting than pure complementary |
| Triadic | Hue + 120° — three equally-spaced hues |
| Analogous | Hue + 30° — adjacent, cohesive feel |
| Tetradic | Hue + 90° — square harmony |
| Shaded | Same hue, darkened 1.5 stops — adds depth |

In **Random** mode, each dominant is paired with a randomly chosen transform, so one palette might mix a complement, a triad, and a shade. Re-clicking Random rolls again. Selecting a named mode applies that one transform to all three dominants.

All transforms run through HSL space via Chroma.js. Split-complementary is the only transform that looks at the rest of the palette: of its two candidates (+150° and −150°), it keeps whichever is farther in CIELAB from the colors already chosen.

Near-neutral colors — whites, grays, and blacks — are usually absent from the result. Vibrant.js favors saturated regions, so low-saturation tones are deprioritized in favor of hues that define the image's character.

---

## Stack

- Vanilla HTML, CSS, and JavaScript — no framework, no build step
- [Vibrant.js](https://github.com/Vibrant-Colors/node-vibrant) — color extraction
- [Chroma.js](https://gka.github.io/chroma.js/) — color math and transforms
- [Unsplash API](https://unsplash.com/developers) — example photos

---

## Running locally

```
git clone https://github.com/mike-karas/palette.git
cd palette
open index.html
```

No install, no server required.
