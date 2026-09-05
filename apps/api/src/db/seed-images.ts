/**
 * Synthetic garment imagery for seeds.
 *
 * `docs/04-data/seed-data.md` — Images:
 *
 *   Seeds use synthetic or properly licensed placeholder imagery only.
 *   Never use screenshots from docs/02-design/reference-images/.
 *   Never use scraped retailer photography.
 *   Placeholder garments are generated flat-lay renders on a neutral ground.
 *
 * So these are DRAWN, not downloaded: a category silhouette in the garment's own
 * colour on a warm neutral ground. That keeps the seed legally clean, makes it
 * deterministic, and means the closet grid can finally be judged on the thing it
 * is meant to show — clothing.
 *
 * No image dependency: PNG is written directly (zlib is in Node), and blurhash
 * is a small well-defined transform. Pulling in a raster library to draw a few
 * rectangles would be a poor trade.
 */
import { deflateSync } from 'node:zlib';
import { perceptualHash } from '@mira/imaging';

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode an RGB buffer (width * height * 3) as a PNG. */
export function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  // Each scanline is prefixed with its filter type; 0 means "none".
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Silhouettes
// ---------------------------------------------------------------------------

/** A shape test in normalized coordinates, both in [0,1]. */
type Silhouette = (x: number, y: number) => boolean;

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

/** Taper helper: half-width at a given y, interpolating between two widths. */
const taper = (y: number, y0: number, y1: number, w0: number, w1: number) => {
  const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  return w0 + (w1 - w0) * t;
};

/**
 * A scooped neckline, carved out of whatever body shape asks for it.
 *
 * An elliptical dip below the shoulder line rather than the square notch these
 * shapes used to cut. At tile size a square notch is the single detail that
 * says "drawn": real necklines are the one part of a flat-laid garment with no
 * straight lines in it at all.
 */
const necklineCutsAway = (cx: number, y: number, shoulder: number, rx: number, ry: number) => {
  if (cx >= rx) return false;
  return y < shoulder + ry * Math.sqrt(1 - (cx / rx) * (cx / rx));
};

const top: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  const SHOULDER = 0.3;
  const HEM = 0.74;
  if (!between(y, SHOULDER, HEM)) return false;

  // The body widens very slightly toward the hem. A perfectly parallel body
  // reads as a box; a strong taper reads as a dress.
  const bodyHalf = taper(y, SHOULDER, HEM, 0.215, 0.245);
  if (cx <= bodyHalf) return !necklineCutsAway(cx, y, SHOULDER, 0.1, 0.05);

  // Sleeves: set in at the armhole, tapering and angled slightly downward, so
  // the outline is four converging lines rather than a rectangle stuck on.
  const sleeveTop = taper(cx, 0.215, 0.4, SHOULDER + 0.005, SHOULDER + 0.055);
  const sleeveBottom = taper(cx, 0.215, 0.4, 0.475, 0.415);
  return cx <= 0.4 && between(y, sleeveTop, sleeveBottom);
};

const bottom: Silhouette = (x, y) => {
  if (!between(y, 0.26, 0.9)) return false;
  const cx = Math.abs(x - 0.5);
  if (y < 0.42) return cx <= 0.2; // waist and hip
  const half = taper(y, 0.42, 0.9, 0.2, 0.15);
  const gap = taper(y, 0.42, 0.9, 0.0, 0.045); // legs separate
  return cx <= half && cx >= gap;
};

const dress: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  const TOP = 0.28;
  const WAIST = 0.46;
  const HEM = 0.9;
  if (!between(y, TOP, HEM)) return false;

  // A waist. Without it this is a trapezoid, which is what it was — and a
  // trapezoid is the shape of a lampshade, not of a dress.
  const half =
    y < WAIST ? taper(y, TOP, WAIST, 0.175, 0.145) : taper(y, WAIST, HEM, 0.145, 0.305);
  if (cx > half) return false;
  return !necklineCutsAway(cx, y, TOP, 0.105, 0.055);
};

const outerwear: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  const SHOULDER = 0.27;
  const HEM = 0.86;
  if (!between(y, SHOULDER, HEM)) return false;

  const bodyHalf = taper(y, SHOULDER, HEM, 0.245, 0.275);
  if (cx <= bodyHalf) {
    // A wider, shallower opening than a tee's — a collar rather than a crew
    // neck. No centre opening: at thumbnail size a vertical gap reads as
    // trouser legs, which is the one thing this silhouette must not look like.
    return !necklineCutsAway(cx, y, SHOULDER, 0.12, 0.05);
  }

  // Longer, heavier sleeves than a tee's, and set lower.
  const sleeveTop = taper(cx, 0.245, 0.425, SHOULDER + 0.005, SHOULDER + 0.07);
  const sleeveBottom = taper(cx, 0.245, 0.425, 0.6, 0.5);
  return cx <= 0.425 && between(y, sleeveTop, sleeveBottom);
};

const shoe: Silhouette = (x, y) => {
  // Side profile. The shape that makes a shoe readable is the TOP line, and it
  // is not a ramp: it is high at the heel, dips at the instep, runs flat across
  // the toe box and rounds down at the toe. Drawn as a ramp — which is what
  // this was — it reads as a doorstop at every size.
  const BACK = 0.18;
  const TOE = 0.86;
  const SOLE_BOTTOM = 0.658;
  if (!between(x, BACK, TOE) || y > SOLE_BOTTOM) return false;

  const t = (x - BACK) / (TOE - BACK);
  const topEdge =
    t < 0.28
      ? taper(t, 0, 0.28, 0.445, 0.468) // heel counter
      : t < 0.52
        ? taper(t, 0.28, 0.52, 0.468, 0.537) // instep
        : t < 0.8
          ? taper(t, 0.52, 0.8, 0.537, 0.549) // toe box
          : taper(t, 0.8, 1, 0.549, 0.632); // toe, rounding into the sole
  if (y < topEdge) return false;

  // Round the top-back corner, so the heel is a counter rather than a cut edge.
  if (t < 0.12) {
    const dx = (0.12 - t) / 0.12;
    const dy = (topEdge + 0.06 - y) / 0.06;
    if (dy > 0 && dx * dx + dy * dy > 1) return false;
  }
  return true;
};

const bag: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  if (between(y, 0.44, 0.72) && cx <= 0.24) return true; // body
  // Handle: an arc above the body.
  const r = Math.sqrt(cx * cx + (y - 0.44) * (y - 0.44));
  return y < 0.44 && between(r, 0.14, 0.175);
};

const accessory: Silhouette = (x, y) => {
  const cx = x - 0.5;
  const cy = y - 0.5;
  const r = Math.sqrt(cx * cx + cy * cy);
  return between(r, 0.13, 0.185);
};

const activewear: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  if (between(y, 0.34, 0.4) && cx <= 0.28) return true; // straps/band
  return between(y, 0.34, 0.6) && cx <= 0.2;
};

const set: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  if (between(y, 0.26, 0.5) && cx <= 0.22) return true; // top half
  if (between(y, 0.54, 0.84) && cx <= 0.24) return true; // bottom half
  return false;
};

const swimwear: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  if (between(y, 0.38, 0.46) && cx <= 0.22) return true;
  return between(y, 0.56, 0.68) && cx <= 0.18;
};

const SILHOUETTES: Record<string, Silhouette> = {
  tops: top,
  bottoms: bottom,
  dresses: dress,
  outerwear,
  shoes: shoe,
  bags: bag,
  accessories: accessory,
  activewear,
  sets: set,
  swimwear,
  other: top,
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return { r: 140, g: 140, b: 140 };
  const int = Number.parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** Warm neutral ground, matching `color.surfaceSunken` in the design system. */
const GROUND: Rgb = { r: 0xf5, g: 0xf3, b: 0xf0 };

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Hermite ease, so shading bands have no visible seam. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Where the silhouettes actually sit in their own coordinate space.
 *
 * Every shape above is authored between these bounds, which leaves a quarter of
 * the frame empty above the garment and none below it. Rendered straight, a
 * closet of them reads as a grid of small objects floating high in grey boxes —
 * the opposite of the fashion-first hierarchy the tiles are built for.
 */
const GARMENT_TOP = 0.26;
const GARMENT_BOTTOM = 0.9;
const GARMENT_CENTRE = (GARMENT_TOP + GARMENT_BOTTOM) / 2;

/**
 * Recentre the garment in the frame, and zoom slightly.
 *
 * The zoom is deliberately small. The widest silhouette (a jacket's shoulders)
 * already spans 84% of the frame, so anything past about 1.1 crops sleeves —
 * and a cropped garment is a worse placeholder than a small one.
 */
const FRAME_ZOOM = 1.09;

/**
 * Per-garment variation.
 *
 * Two hundred identical renders read as a print pattern rather than as a
 * wardrobe: the eye picks up the repeat instantly, and the grid stops looking
 * like a closet. A small rotation and scale per garment breaks the repeat
 * without making any single tile look wrong.
 *
 * Derived from a caller-supplied integer rather than from `Math.random`,
 * because `seed-data.md` buys determinism deliberately — the same seed must
 * produce the same closet, or screenshots and performance numbers stop being
 * comparable between runs.
 */
type Variation = { angle: number; scale: number; phase: number };

function variationFor(variant: number): Variation {
  if (variant === 0) return { angle: 0, scale: 1, phase: 0 };
  // Three different irrationals, so the three properties do not move together
  // and produce a visible pattern of their own.
  const a = (variant * 0.6180339887) % 1;
  const b = (variant * 0.7548776662) % 1;
  const c = (variant * 0.3247179572) % 1;
  return {
    angle: (a - 0.5) * 0.10, // ±2.9°
    scale: 1 + (b - 0.5) * 0.09, // ±4.5%
    phase: c * Math.PI * 2,
  };
}

/**
 * Distance, in pixels, from every set pixel to the nearest unset one.
 *
 * A two-pass chamfer transform: exact enough for shading and O(width × height),
 * where sampling the silhouette in a ring around every pixel would be an order
 * of magnitude slower for a result no eye could tell apart.
 */
function distanceToEdge(mask: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i += 1) d[i] = mask[i] ? INF : 0;

  const D1 = 1;
  const D2 = Math.SQRT2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let best = d[i] as number;
      if (x > 0) best = Math.min(best, (d[i - 1] as number) + D1);
      if (y > 0) best = Math.min(best, (d[i - width] as number) + D1);
      if (x > 0 && y > 0) best = Math.min(best, (d[i - width - 1] as number) + D2);
      if (x < width - 1 && y > 0) best = Math.min(best, (d[i - width + 1] as number) + D2);
      d[i] = best;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let best = d[i] as number;
      if (x < width - 1) best = Math.min(best, (d[i + 1] as number) + D1);
      if (y < height - 1) best = Math.min(best, (d[i + width] as number) + D1);
      if (x < width - 1 && y < height - 1) best = Math.min(best, (d[i + width + 1] as number) + D2);
      if (x > 0 && y < height - 1) best = Math.min(best, (d[i + width - 1] as number) + D2);
      d[i] = best;
    }
  }
  return d;
}

/**
 * Render a flat-lay placeholder.
 *
 * The shading is what separates this from a coloured cut-out, and it is three
 * things layered:
 *
 *   - **Form.** Cloth over a body is darker where it turns away at the edge.
 *     Driven by distance from the silhouette edge, which is why the distance
 *     field above exists.
 *   - **Key light.** One soft source from the top left, so the whole garment
 *     has a direction.
 *   - **Folds.** Low-frequency variation across the surface. Small — 3% — but
 *     it is the difference between fabric and vinyl.
 *
 * Plus a contact shadow on the ground beneath the garment, which is what makes
 * a flat lay sit on a surface instead of floating over one.
 *
 * These are still placeholders and still not photographs. They exercise layout,
 * hierarchy and colour handling; they cannot tell you how the grid behaves with
 * the crops, backgrounds and contrast of real garment photos.
 */
export function renderGarmentImage(options: {
  category: string;
  colorHex: string;
  width?: number;
  height?: number;
  /** Stable per-garment integer. 0 renders the canonical, unvaried garment. */
  variant?: number;
}): { png: Buffer; width: number; height: number; pixels: Buffer } {
  const width = options.width ?? 640;
  const height = options.height ?? 800;
  const shape = SILHOUETTES[options.category] ?? SILHOUETTES['other'];
  if (!shape) throw new Error(`no silhouette for category ${options.category}`);

  const base = hexToRgb(options.colorHex);
  // Very light garments need a visible edge against the ground.
  const luminance = (base.r * 299 + base.g * 587 + base.b * 114) / 1000;
  const edge: Rgb =
    luminance > 225
      ? { r: clamp255(base.r - 26), g: clamp255(base.g - 26), b: clamp255(base.b - 26) }
      : base;

  const { angle, scale, phase } = variationFor(options.variant ?? 0);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const zoom = FRAME_ZOOM * scale;

  const framed = (nx: number, ny: number): { x: number; y: number } => {
    // Rotate about the frame centre first, then recentre and zoom. Rotating
    // after the recentre would swing the garment out of frame at the bottom,
    // where it already sits closest to the edge.
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return { x: 0.5 + rx / zoom, y: GARMENT_CENTRE + ry / zoom };
  };

  // 3x, not 2x: the edge is now the most-looked-at part of the image, because
  // the form shading draws the eye straight to it.
  const SS = 3;
  const coverage = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const nx = (x + (sx + 0.5) / SS) / width;
          const ny = (y + (sy + 0.5) / SS) / height;
          const p = framed(nx, ny);
          if (shape(p.x, p.y)) covered += 1;
        }
      }
      const i = y * width + x;
      const c = covered / (SS * SS);
      coverage[i] = c;
      mask[i] = c > 0.5 ? 1 : 0;
    }
  }

  const inside = distanceToEdge(mask, width, height);
  const outsideMask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) outsideMask[i] = mask[i] ? 0 : 1;
  const outside = distanceToEdge(outsideMask, width, height);

  const shortest = Math.min(width, height);
  /** How far in from the edge the garment reaches full brightness. */
  const formBand = 0.075 * shortest;
  /** How far the contact shadow reaches onto the ground. */
  const shadowBand = 0.055 * shortest;
  /** The shadow sits below the garment, as a single overhead-ish light gives. */
  const shadowDrop = Math.round(0.018 * height);

  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;

      // --- the garment ---------------------------------------------------
      const form = 0.78 + 0.22 * smoothstep(clamp01((inside[i] as number) / formBand));
      const key = 1.07 - 0.15 * ((nx + ny) / 2);
      const folds =
        1 +
        0.03 *
          (Math.sin(nx * 13 + phase) * 0.5 +
            Math.sin(ny * 8.5 - phase * 1.7) * 0.3 +
            Math.sin((nx + ny) * 21 + phase * 0.6) * 0.2);
      const shade = form * key * folds;

      // --- the ground ------------------------------------------------------
      // Sampled from above the pixel, which drops the shadow below the garment.
      const sy = y - shadowDrop < 0 ? 0 : y - shadowDrop;
      const shadowDistance = outside[sy * width + x] as number;
      const shadow = (1 - smoothstep(clamp01(shadowDistance / shadowBand))) ** 2 * 0.11;
      const ground = 1 - shadow;

      const c = coverage[i] as number;
      pixels[i * 3] = clamp255(mix(GROUND.r * ground, edge.r * shade, c));
      pixels[i * 3 + 1] = clamp255(mix(GROUND.g * ground, edge.g * shade, c));
      pixels[i * 3 + 2] = clamp255(mix(GROUND.b * ground, edge.b * shade, c));
    }
  }

  return { png: encodePng(width, height, pixels), width, height, pixels };
}

// ---------------------------------------------------------------------------
// Blurhash
// ---------------------------------------------------------------------------

/**
 * Perceptual hash of a seeded image.
 *
 * Phase 2 replaced the sha256 placeholder that stood here with the real DCT
 * hash, so seeded imagery now participates in duplicate detection exactly as
 * uploaded photographs do — which is the only way the seed can exercise it.
 */
export function imageHash(rgb: Buffer, width: number, height: number): string {
  return perceptualHash({ data: rgb, width, height, channels: 3 });
}
