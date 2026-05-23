# palette.

A color palette generator that analyzes any image and returns a 6-color palette grounded in color theory.

Upload a photo, and palette. extracts the 3 most visually dominant colors using Vibrant.js, then derives 3 harmony colors by intelligently selecting from complementary, split-complementary, triadic, analogous, tetradic, and shaded transforms — picking the combination that maximizes perceptual distance across all 6 colors.

**[Try it → mike-karas.github.io/palette](https://mike-karas.github.io/palette/)**

---

## Features

- **Image input** — drag & drop, file picker, or camera capture on mobile (JPG, PNG, WebP)
- **Dominant color extraction** — Vibrant.js identifies the 3 most perceptually meaningful colors in the image
- **Intelligent harmony assignment** — exhaustively scores all combinations of 6 color theory transforms and picks the palette with the greatest minimum pairwise CIELAB distance
- **Full color values** — HEX, RGB, and HSL shown for every swatch
- **Copy HEX** — per swatch, or copy all 6 at once
- **Swatch locking** — lock individual colors so they survive re-uploads
- **PNG export** — download the palette as a labeled image
- **Auto palette name** — generated from the detected hues (e.g. "Ocean Dusk", "Forest Ember")
- **No build step** — open `index.html` directly in any modern browser

---

## Color theory

For each of the 3 dominant colors, palette. tries every combination of these transforms:

| Transform | Description |
|---|---|
| Complementary | Hue + 180° — maximum contrast |
| Split-complementary | Hue ± 150° — softer contrast, more interesting than pure complementary |
| Triadic | Hue + 120° — three equally-spaced hues |
| Analogous | Hue + 30° — adjacent, cohesive feel |
| Tetradic | Hue + 90° — square harmony |
| Shaded | Same hue, darkened 1.5 stops — adds depth |

All transforms run through HSL space via Chroma.js. The winning combination is whichever 6-color palette has the largest minimum pairwise distance in CIELAB — ensuring every color is visually distinct.

---

## Stack

- Vanilla HTML, CSS, and JavaScript — no framework, no build step
- [Vibrant.js](https://github.com/Vibrant-Colors/node-vibrant) — color extraction
- [Chroma.js](https://gka.github.io/chroma.js/) — color math and transforms

---

## Running locally

```
git clone https://github.com/mike-karas/palette.git
cd palette
open index.html
```

No install, no server required.
