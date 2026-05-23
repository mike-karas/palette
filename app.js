/* ═══════════════════════════════════════════════════════════════════
   palette. — app.js
   Dependencies (loaded via CDN before this script):
     • Vibrant  — node-vibrant@3.1.6  (color extraction)
     • chroma   — chroma-js@2.4.2     (color math & transforms)
   ═══════════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────
const state = {
  dominants:     null,   // [hex, hex, hex]  — top 3 from Vibrant
  harmonies:     null,   // [hex, hex, hex]  — derived via color theory
  harmonyLabels: null,   // ['Complementary', …]
  locked:        new Set(), // swatch indices 0-5 that are locked
  busy:          false,
};

// ─── DOM references ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const uploadSection  = $('uploadSection');
const resultsSection = $('resultsSection');
const dropZone       = $('dropZone');
const fileInput      = $('fileInput');
const cameraInput    = $('cameraInput');
const swatchesGrid   = $('swatchesGrid');
const imagePreview   = $('imagePreview');
const paletteNameEl  = $('paletteName');

// ═══════════════════════════════════════════════════════════════════
// COLOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════

// Vibrant.js uses a modified Median-Cut Quantization algorithm to identify
// perceptually distinct color regions. It targets six named aesthetic slots:
// Vibrant, DarkVibrant, LightVibrant, Muted, DarkMuted, LightMuted.
// We walk this priority list and take the first three non-null swatches.
const SWATCH_PRIORITY = [
  'Vibrant', 'DarkVibrant', 'LightVibrant',
  'Muted',   'DarkMuted',   'LightMuted',
];

async function extractDominants(imgEl) {
  const palette = await Vibrant.from(imgEl, { colorCount: 64 }).getPalette();

  const swatches = SWATCH_PRIORITY
    .map(k => palette[k])
    .filter(Boolean)
    .slice(0, 3)
    .map(s => s.hex);

  // Guard: if the image is very monochromatic, Vibrant may return < 3 swatches.
  // Fill gaps by rotating hue 120° from the last found color.
  while (swatches.length < 3) {
    swatches.push(rotateHue(swatches[swatches.length - 1], 120));
  }

  return swatches;
}

// ═══════════════════════════════════════════════════════════════════
// COLOR THEORY TRANSFORMS
// All transforms work through HSL space via Chroma.js for perceptual
// accuracy — HSL hue rotation maps directly onto the color wheel.
// ═══════════════════════════════════════════════════════════════════

// Shift hue by `deg` degrees, leaving saturation and lightness intact
function rotateHue(hex, deg) {
  const h = chroma(hex).get('hsl.h') || 0;
  return chroma(hex).set('hsl.h', (h + deg + 360) % 360).hex();
}

// Complementary — opposite on the color wheel (180°)
function complementary(hex) {
  return rotateHue(hex, 180);
}

// Split-complementary — ±150° from the hue; picks whichever side
// produces the greatest minimum distance from colors already chosen.
function splitComplementary(hex, existing) {
  const a = rotateHue(hex,  150);
  const b = rotateHue(hex, -150);
  return minDistFrom(b, existing) > minDistFrom(a, existing) ? b : a;
}

// Triadic — 120° step; three equally-spaced hues form a triangle
function triadic(hex) {
  return rotateHue(hex, 120);
}

// Analogous — 30° step; adjacent hue for a cohesive, related feel
function analogous(hex) {
  return rotateHue(hex, 30);
}

// Tetradic / square — 90° step; four-color square harmony
function tetradic(hex) {
  return rotateHue(hex, 90);
}

// Shaded — same hue, darkened 1.5 stops; adds depth without new hue
function shaded(hex) {
  return chroma(hex).darken(1.5).hex();
}

// ── Distance helpers ───────────────────────────────────────────────

// Smallest CIELAB distance from `hex` to any color in `others`
function minDistFrom(hex, others) {
  return Math.min(...others.map(o => chroma.distance(hex, o, 'lab')));
}

// Smallest pairwise CIELAB distance across an array of hex colors.
// Used as the "score" for a palette — higher = more visually distinct.
function minPairwiseDist(hexes) {
  let min = Infinity;
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      min = Math.min(min, chroma.distance(hexes[i], hexes[j], 'lab'));
    }
  }
  return min;
}

// ═══════════════════════════════════════════════════════════════════
// INTELLIGENT HARMONY ASSIGNMENT
//
// Strategy: exhaustive search over all 6³ = 216 combinations of the
// six harmony types applied to the three dominant colors. Score each
// full 6-color palette by its minimum pairwise CIELAB distance — this
// is the "maximin" criterion, guaranteeing the palette we pick has
// the greatest separation between its most similar pair of colors.
// ═══════════════════════════════════════════════════════════════════
const HARMONIES = [
  { label: 'Complementary',       fn: (h, ex) => complementary(h)         },
  { label: 'Split-complementary', fn: (h, ex) => splitComplementary(h, ex) },
  { label: 'Triadic',             fn: (h, ex) => triadic(h)               },
  { label: 'Analogous',           fn: (h, ex) => analogous(h)             },
  { label: 'Tetradic',            fn: (h, ex) => tetradic(h)              },
  { label: 'Shaded',              fn: (h, ex) => shaded(h)                },
];

function assignHarmonies(dominants) {
  let best = { score: -Infinity, colors: [], labels: [] };

  for (let i = 0; i < HARMONIES.length; i++) {
    for (let j = 0; j < HARMONIES.length; j++) {
      for (let k = 0; k < HARMONIES.length; k++) {
        const pool = [...dominants];

        // Derive each harmony in sequence so later ones can see earlier picks
        const h0 = HARMONIES[i].fn(dominants[0], pool);
        pool.push(h0);
        const h1 = HARMONIES[j].fn(dominants[1], pool);
        pool.push(h1);
        const h2 = HARMONIES[k].fn(dominants[2], pool);

        const score = minPairwiseDist([...dominants, h0, h1, h2]);
        if (score > best.score) {
          best = {
            score,
            colors: [h0, h1, h2],
            labels: [HARMONIES[i].label, HARMONIES[j].label, HARMONIES[k].label],
          };
        }
      }
    }
  }

  return best;
}

// ═══════════════════════════════════════════════════════════════════
// PALETTE NAME GENERATION
// Maps the dominant hue and lightness to evocative word pairs.
// ═══════════════════════════════════════════════════════════════════
const HUE_BUCKETS = [
  { range: [0,   15],  words: ['Crimson', 'Scarlet', 'Rose']     },
  { range: [15,  45],  words: ['Amber',   'Ember',   'Terra']    },
  { range: [45,  75],  words: ['Gold',    'Honey',   'Wheat']    },
  { range: [75,  150], words: ['Sage',    'Forest',  'Fern']     },
  { range: [150, 195], words: ['Jade',    'Mint',    'Teal']     },
  { range: [195, 255], words: ['Ocean',   'Azure',   'Cobalt']   },
  { range: [255, 285], words: ['Indigo',  'Violet',  'Twilight'] },
  { range: [285, 330], words: ['Mauve',   'Plum',    'Lavender'] },
  { range: [330, 360], words: ['Rose',    'Blush',   'Magenta']  },
];
const DARK_WORDS  = ['Midnight', 'Shadow', 'Dusk'];
const LIGHT_WORDS = ['Frost',    'Pearl',  'Haze'];

function pickHueWord(hex) {
  const h     = chroma(hex).get('hsl.h') || 0;
  const entry = HUE_BUCKETS.find(e => h >= e.range[0] && h < e.range[1])
             ?? HUE_BUCKETS[0];
  return entry.words[Math.floor(Math.random() * entry.words.length)];
}

function generatePaletteName(dominants) {
  const l     = chroma(dominants[0]).get('hsl.l');
  const word1 = pickHueWord(dominants[0]);

  let word2;
  if (l < 0.2) {
    word2 = DARK_WORDS[Math.floor(Math.random() * DARK_WORDS.length)];
  } else if (l > 0.8) {
    word2 = LIGHT_WORDS[Math.floor(Math.random() * LIGHT_WORDS.length)];
  } else {
    word2 = pickHueWord(dominants[1]);
  }

  return word1 === word2 ? `${word1} Study` : `${word1} ${word2}`;
}

// ═══════════════════════════════════════════════════════════════════
// SWATCH RENDERING
// ═══════════════════════════════════════════════════════════════════

// SVG icons for the lock / unlock button
const ICON_LOCKED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>`;
const ICON_UNLOCKED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2"/>
  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
</svg>`;

function colorValues(hex) {
  const c       = chroma(hex);
  const [r,g,b] = c.rgb().map(Math.round);
  const [h,s,l] = c.hsl();
  return {
    hex: hex.toUpperCase(),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${Math.round(h || 0)}°, ${Math.round((s || 0) * 100)}%, ${Math.round((l || 0) * 100)}%)`,
  };
}

function renderSwatches() {
  const { dominants, harmonies, harmonyLabels, locked } = state;

  const palette = [
    { hex: dominants[0], type: 'Dominant 1', sub: null              },
    { hex: dominants[1], type: 'Dominant 2', sub: null              },
    { hex: dominants[2], type: 'Dominant 3', sub: null              },
    { hex: harmonies[0], type: 'Harmony 1',  sub: harmonyLabels[0]  },
    { hex: harmonies[1], type: 'Harmony 2',  sub: harmonyLabels[1]  },
    { hex: harmonies[2], type: 'Harmony 3',  sub: harmonyLabels[2]  },
  ];

  swatchesGrid.innerHTML = palette.map(({ hex, type, sub }, i) => {
    const vals      = colorValues(hex);
    const isLocked  = locked.has(i);
    // Choose a readable overlay color (lock icon) based on swatch brightness
    const swatchText = chroma(hex).luminance() > 0.35
      ? 'rgba(0,0,0,0.75)'
      : 'rgba(255,255,255,0.9)';

    return `
      <div class="swatch${isLocked ? ' is-locked' : ''}"
           style="--swatch-color:${hex};--swatch-text:${swatchText}"
           role="listitem">
        <div class="swatch__block">
          <button class="swatch__lock"
                  data-action="lock" data-index="${i}"
                  aria-label="${isLocked ? 'Unlock' : 'Lock'} color ${vals.hex}"
                  title="${isLocked ? 'Unlock' : 'Lock'}">
            ${isLocked ? ICON_LOCKED : ICON_UNLOCKED}
          </button>
        </div>
        <div class="swatch__info">
          <div>
            <div class="swatch__type">${type}</div>
            ${sub ? `<div class="swatch__sublabel">${sub}</div>` : ''}
          </div>
          <div class="swatch__hex">${vals.hex}</div>
          <div class="swatch__values">
            <div class="swatch__rgb">${vals.rgb}</div>
            <div class="swatch__hsl">${vals.hsl}</div>
          </div>
          <button class="swatch__copy"
                  data-action="copy" data-hex="${vals.hex}">
            Copy HEX
          </button>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// CORE PROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════════════
async function processImage(imgEl) {
  if (state.busy) return;
  state.busy = true;
  swatchesGrid.classList.add('is-loading');

  try {
    const rawDoms = await extractDominants(imgEl);

    // Respect locked dominant slots (indices 0–2)
    const dominants = rawDoms.map((c, i) =>
      state.locked.has(i) && state.dominants ? state.dominants[i] : c
    );

    const { colors: rawHarmonies, labels } = assignHarmonies(dominants);

    // Respect locked harmony slots (indices 3–5)
    const harmonies = rawHarmonies.map((c, i) =>
      state.locked.has(i + 3) && state.harmonies ? state.harmonies[i] : c
    );

    Object.assign(state, { dominants, harmonies, harmonyLabels: labels });

    paletteNameEl.textContent = generatePaletteName(dominants);
    renderSwatches();

    // Transition in results, hide upload zone
    uploadSection.hidden = true;
    resultsSection.hidden = false;
    // Double rAF ensures the initial opacity:0 is painted before the class adds the transition
    requestAnimationFrame(() =>
      requestAnimationFrame(() => resultsSection.classList.add('is-visible'))
    );
  } catch (err) {
    console.error('[palette.] extraction failed:', err);
    alert('Could not read colors from this image. Try a different one.');
  } finally {
    swatchesGrid.classList.remove('is-loading');
    state.busy = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// FILE HANDLING
// ═══════════════════════════════════════════════════════════════════
function handleFile(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    alert('Please upload a JPG, PNG, or WebP image.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ({ target: { result } }) => {
    // Use an off-DOM Image for Vibrant — avoids display:none causing
    // naturalWidth/naturalHeight to read as 0 inside the hidden results section.
    const img = new Image();
    img.onload = () => {
      imagePreview.src = result; // set the visible preview separately
      processImage(img);
    };
    img.onerror = () => alert('Could not load this image. Please try another.');
    img.src = result;
  };
  reader.onerror = () => alert('Could not read this file. Please try another.');
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════════════
// PNG EXPORT
// Draws all 6 swatches onto a Canvas and triggers a download.
// ═══════════════════════════════════════════════════════════════════
function exportPng() {
  const hexes      = [...state.dominants, ...state.harmonies];
  const paletteName = paletteNameEl.textContent;

  const SWATCH_W = 200, SWATCH_H = 380, LABEL_H = 76;
  const W = SWATCH_W * 6, H = SWATCH_H + LABEL_H;

  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0f11';
  ctx.fillRect(0, 0, W, H);

  hexes.forEach((hex, i) => {
    const x = i * SWATCH_W;

    // Color block
    ctx.fillStyle = hex;
    ctx.fillRect(x, 0, SWATCH_W, SWATCH_H);

    // Label bar
    ctx.fillStyle = '#17171a';
    ctx.fillRect(x, SWATCH_H, SWATCH_W, LABEL_H);

    // HEX value
    ctx.fillStyle = '#ebebeb';
    ctx.font      = '500 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hex.toUpperCase(), x + SWATCH_W / 2, SWATCH_H + 26);

    // Swatch type label
    ctx.fillStyle = '#6b6b72';
    ctx.font      = '400 11px sans-serif';
    ctx.fillText(
      i < 3 ? `Dominant ${i + 1}` : `Harmony ${i - 2}`,
      x + SWATCH_W / 2, SWATCH_H + 46
    );
  });

  // Palette name — bottom-left
  ctx.fillStyle = '#ebebeb';
  ctx.font      = 'italic 700 18px serif';
  ctx.textAlign = 'left';
  ctx.fillText(paletteName, 16, SWATCH_H + 68);

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `palette-${paletteName.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ═══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

// ── Upload zone ───────────────────────────────────────────────────
// Browse/camera are now <label for="..."> elements — no JS needed to open the picker.
fileInput.addEventListener('change',   () => { handleFile(fileInput.files[0]);   fileInput.value   = ''; });
cameraInput.addEventListener('change', () => { handleFile(cameraInput.files[0]); cameraInput.value = ''; });

// Clicking the drop zone background (anywhere that isn't the label) also opens the picker
dropZone.addEventListener('click', e => {
  if (!e.target.closest('label')) fileInput.click();
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('is-over');
});
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('is-over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('is-over');
  handleFile(e.dataTransfer.files[0]);
});

// ── Results header ────────────────────────────────────────────────
$('newImageBtn').addEventListener('click', () => {
  resultsSection.classList.remove('is-visible');
  resultsSection.addEventListener('transitionend', () => {
    resultsSection.hidden = true;
    uploadSection.hidden  = false;
  }, { once: true });
});

$('copyAllBtn').addEventListener('click', () => {
  const list = [...state.dominants, ...state.harmonies]
    .map(h => h.toUpperCase())
    .join('\n');
  navigator.clipboard.writeText(list).then(() => {
    const btn  = $('copyAllBtn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = orig), 1600);
  });
});

$('exportBtn').addEventListener('click', exportPng);

// ── Swatch grid (delegated) ───────────────────────────────────────
swatchesGrid.addEventListener('click', e => {
  // Copy HEX
  const copyBtn = e.target.closest('[data-action="copy"]');
  if (copyBtn) {
    navigator.clipboard.writeText(copyBtn.dataset.hex).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('is-copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy HEX';
        copyBtn.classList.remove('is-copied');
      }, 1600);
    });
    return;
  }

  // Lock / unlock
  const lockBtn = e.target.closest('[data-action="lock"]');
  if (lockBtn) {
    const idx = parseInt(lockBtn.dataset.index, 10);
    state.locked.has(idx) ? state.locked.delete(idx) : state.locked.add(idx);
    renderSwatches();
  }
});
