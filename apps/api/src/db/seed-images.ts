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
import { createHash } from 'node:crypto';

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

const top: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  if (between(y, 0.3, 0.42) && cx <= 0.38) return true; // shoulders and sleeves
  if (between(y, 0.3, 0.78) && cx <= 0.22) {
    // Neckline notch.
    if (y < 0.35 && cx < 0.09) return false;
    return true;
  }
  return false;
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
  if (!between(y, 0.28, 0.88)) return false;
  const cx = Math.abs(x - 0.5);
  if (y < 0.34 && cx < 0.08) return false; // neckline
  return cx <= taper(y, 0.28, 0.88, 0.17, 0.3);
};

const outerwear: Silhouette = (x, y) => {
  const cx = Math.abs(x - 0.5);
  // Sleeves, wide and short.
  if (between(y, 0.26, 0.46) && cx <= 0.42) return true;
  if (!between(y, 0.26, 0.86)) return false;
  // A wide body — narrower than this and the centre opening reads as trouser
  // legs rather than a coat.
  if (cx > 0.3) return false;
  if (y < 0.32 && cx < 0.1) return false; // collar
  // No centre opening: at thumbnail size a vertical gap reads as trouser legs,
  // which is the one thing this silhouette must not look like.
  return true;
};

const shoe: Silhouette = (x, y) => {
  // Side profile: a sole, a heel counter that curves forward, and a low vamp
  // tapering to the toe.
  if (between(y, 0.6, 0.655) && between(x, 0.2, 0.8)) return true; // sole
  if (!between(y, 0.44, 0.6)) return false;

  // Heel counter, rounded at the back.
  if (between(x, 0.2, 0.38)) {
    const dx = (x - 0.38) / 0.18;
    const dy = (y - 0.6) / 0.16;
    return x >= 0.28 || dx * dx + dy * dy <= 1;
  }
  // Vamp: height falls away toward the toe.
  if (between(x, 0.38, 0.78)) {
    const topEdge = taper(x, 0.38, 0.78, 0.47, 0.565);
    return y >= topEdge;
  }
  return false;
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

/**
 * Render a flat-lay placeholder.
 *
 * Supersampled 2x so silhouette edges are smooth rather than jagged, with a
 * soft vertical shade across the garment so tiles read as objects rather than
 * flat blocks.
 */
export function renderGarmentImage(options: {
  category: string;
  colorHex: string;
  width?: number;
  height?: number;
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

  const pixels = Buffer.alloc(width * height * 3);
  const SS = 2; // supersample factor

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const nx = (x + (sx + 0.5) / SS) / width;
          const ny = (y + (sy + 0.5) / SS) / height;
          if (shape(nx, ny)) covered += 1;
        }
      }
      const coverage = covered / (SS * SS);

      // Soft top-to-bottom shading, so the garment has a little depth.
      const shade = 1 - 0.14 * (y / height);
      const gr = clamp255(edge.r * shade);
      const gg = clamp255(edge.g * shade);
      const gb = clamp255(edge.b * shade);

      const i = (y * width + x) * 3;
      pixels[i] = clamp255(mix(GROUND.r, gr, coverage));
      pixels[i + 1] = clamp255(mix(GROUND.g, gg, coverage));
      pixels[i + 2] = clamp255(mix(GROUND.b, gb, coverage));
    }
  }

  return { png: encodePng(width, height, pixels), width, height, pixels };
}

// ---------------------------------------------------------------------------
// Blurhash
// ---------------------------------------------------------------------------

const BASE83 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function encodeBase83(value: number, length: number): string {
  let out = '';
  for (let i = 1; i <= length; i += 1) {
    const digit = Math.floor(value / 83 ** (length - i)) % 83;
    out += BASE83[digit];
  }
  return out;
}

const sRgbToLinear = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const linearToSRgb = (value: number): number => {
  const v = Math.max(0, Math.min(1, value));
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
};

const signPow = (value: number, exp: number) => Math.sign(value) * Math.abs(value) ** exp;

/**
 * Downsample an RGB buffer with nearest-neighbour sampling.
 *
 * Blurhash is O(width x height x components). At full size that is ~6M
 * iterations per image, which across a 227-garment seed is minutes of pure
 * arithmetic for a hash that only ever describes a blur. A small thumbnail
 * gives a visually identical result for a fraction of the work.
 */
function downsample(
  pixels: Buffer,
  width: number,
  height: number,
  targetWidth: number,
): { pixels: Buffer; width: number; height: number } {
  if (width <= targetWidth) return { pixels, width, height };

  const scale = targetWidth / width;
  const outWidth = targetWidth;
  const outHeight = Math.max(1, Math.round(height * scale));
  const out = Buffer.alloc(outWidth * outHeight * 3);

  for (let y = 0; y < outHeight; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y / outHeight) * height));
    for (let x = 0; x < outWidth; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x / outWidth) * width));
      const si = (sy * width + sx) * 3;
      const di = (y * outWidth + x) * 3;
      out[di] = pixels[si] as number;
      out[di + 1] = pixels[si + 1] as number;
      out[di + 2] = pixels[si + 2] as number;
    }
  }
  return { pixels: out, width: outWidth, height: outHeight };
}

/**
 * Encode a blurhash.
 *
 * The grid shows this while the real image loads, so a seeded garment exercises
 * the same progressive-load path a captured one will
 * (`docs/03-architecture/frontend-architecture.md` §5).
 *
 * Computed on a downsampled copy: blurhash describes a blur, so the extra
 * resolution changes nothing except the running time.
 */
export function encodeBlurhash(
  fullPixels: Buffer,
  fullWidth: number,
  fullHeight: number,
  componentX = 4,
  componentY = 3,
): string {
  const { pixels, width, height } = downsample(fullPixels, fullWidth, fullHeight, 32);
  const factors: [number, number, number][] = [];

  for (let j = 0; j < componentY; j += 1) {
    for (let i = 0; i < componentX; i += 1) {
      const normalisation = i === 0 && j === 0 ? 1 : 2;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const basis =
            normalisation *
            Math.cos((Math.PI * i * x) / width) *
            Math.cos((Math.PI * j * y) / height);
          const k = (y * width + x) * 3;
          r += basis * sRgbToLinear(pixels[k] as number);
          g += basis * sRgbToLinear(pixels[k + 1] as number);
          b += basis * sRgbToLinear(pixels[k + 2] as number);
        }
      }
      const scale = 1 / (width * height);
      factors.push([r * scale, g * scale, b * scale]);
    }
  }

  const dc = factors[0];
  if (!dc) throw new Error('blurhash: no DC component');
  const ac = factors.slice(1);

  let hash = encodeBase83(componentX - 1 + (componentY - 1) * 9, 1);

  const actualMax = ac.length
    ? Math.max(...ac.flatMap(([r, g, b]) => [Math.abs(r), Math.abs(g), Math.abs(b)]))
    : 0;
  const quantisedMax = ac.length ? Math.max(0, Math.min(82, Math.floor(actualMax * 166 - 0.5))) : 0;
  const maximum = ac.length ? (quantisedMax + 1) / 166 : 1;
  hash += encodeBase83(quantisedMax, 1);

  const dcValue = (linearToSRgb(dc[0]) << 16) + (linearToSRgb(dc[1]) << 8) + linearToSRgb(dc[2]);
  hash += encodeBase83(dcValue, 4);

  for (const [r, g, b] of ac) {
    const quant = (v: number) =>
      Math.max(0, Math.min(18, Math.floor(signPow(v / maximum, 0.5) * 9 + 9.5)));
    hash += encodeBase83(quant(r) * 19 * 19 + quant(g) * 19 + quant(b), 2);
  }

  return hash;
}

/** Perceptual-ish hash, standing in for the real one until Phase 2. */
export function imageHash(png: Buffer): string {
  return createHash('sha256').update(png).digest('hex').slice(0, 32);
}
