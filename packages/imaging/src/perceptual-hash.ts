/**
 * Perceptual hashing (`docs/06-ai/image-processing.md` §5).
 *
 * Used for three things: detecting that the same photo was uploaded twice, as a
 * strong signal in duplicate detection ("often literally the same photo",
 * `duplicate-detection.md`), and for try-on cache fingerprinting.
 *
 * This is a DCT hash (pHash), not a difference hash. Both survive rescaling and
 * re-compression, but a garment photographed twice on the same hanger differs
 * by small shifts in framing and exposure — and pHash, which keeps only the
 * lowest-frequency structure, is markedly more tolerant of exactly that than a
 * gradient hash is.
 *
 * The result is 64 bits, hex-encoded, so it fits `garment_images.image_hash`
 * and can be compared with a Hamming distance rather than an equality test.
 */
import { downsample, toGrayscale, type PixelBuffer } from './pixels.js';

/** Working size before the DCT. 32 → the top-left 8×8 keeps low frequencies. */
const DCT_SIZE = 32;
const HASH_SIZE = 8;

/** Separable DCT-II. */
function dct2d(input: Float64Array, size: number): Float64Array {
  // Precompute the cosine basis: the naive form recomputes size^4 cosines.
  const basis = new Float64Array(size * size);
  for (let u = 0; u < size; u += 1) {
    for (let x = 0; x < size; x += 1) {
      basis[u * size + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
    }
  }

  const rows = new Float64Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let u = 0; u < size; u += 1) {
      let sum = 0;
      for (let x = 0; x < size; x += 1) {
        sum += (input[y * size + x] ?? 0) * (basis[u * size + x] ?? 0);
      }
      rows[y * size + u] = sum;
    }
  }

  const out = new Float64Array(size * size);
  for (let u = 0; u < size; u += 1) {
    for (let v = 0; v < size; v += 1) {
      let sum = 0;
      for (let y = 0; y < size; y += 1) {
        sum += (rows[y * size + u] ?? 0) * (basis[v * size + y] ?? 0);
      }
      out[v * size + u] = sum;
    }
  }

  return out;
}

/** Force a square working image, so aspect ratio cannot shift the hash. */
function toSquare(image: PixelBuffer, size: number): Float64Array {
  const small = downsample(image, size);
  const gray = toGrayscale(small);
  const out = new Float64Array(size * size);

  for (let y = 0; y < size; y += 1) {
    const sy = Math.min(gray.height - 1, Math.floor((y * gray.height) / size));
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(gray.width - 1, Math.floor((x * gray.width) / size));
      out[y * size + x] = gray.data[sy * gray.width + sx] ?? 0;
    }
  }

  return out;
}

/** A 64-bit perceptual hash, hex-encoded (16 characters). */
export function perceptualHash(image: PixelBuffer): string {
  const square = toSquare(image, DCT_SIZE);
  const frequencies = dct2d(square, DCT_SIZE);

  // The top-left 8×8 block, minus the DC term: DC carries overall brightness,
  // so keeping it would make the same garment under two lights hash apart.
  const low: number[] = [];
  for (let v = 0; v < HASH_SIZE; v += 1) {
    for (let u = 0; u < HASH_SIZE; u += 1) {
      if (u === 0 && v === 0) continue;
      low.push(frequencies[v * DCT_SIZE + u] ?? 0);
    }
  }

  // Median, not mean: one extreme coefficient would drag a mean across the
  // whole set and flip bits that describe nothing.
  const sorted = [...low].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);

  // 63 coefficients + a leading 0 for the dropped DC term = 64 bits.
  const bits = [0, ...low.map((value) => (value > median ? 1 : 0))];

  let hex = '';
  for (let byte = 0; byte < 8; byte += 1) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | (bits[byte * 8 + bit] ?? 0);
    }
    hex += value.toString(16).padStart(2, '0');
  }

  return hex;
}

/**
 * Differing bits between two hashes.
 *
 * Returns `null` for hashes of different lengths rather than a number, because
 * a silently wrong distance would read as "these are similar".
 */
export function hammingDistance(a: string, b: string): number | null {
  if (a.length !== b.length) return null;

  let distance = 0;
  for (let i = 0; i < a.length; i += 2) {
    const left = Number.parseInt(a.slice(i, i + 2), 16);
    const right = Number.parseInt(b.slice(i, i + 2), 16);
    if (Number.isNaN(left) || Number.isNaN(right)) return null;

    let diff = left ^ right;
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }

  return distance;
}

/**
 * The same photograph, uploaded twice.
 *
 * Chosen from measured separation rather than convention. Over the synthetic
 * garment scenes in the tests: rescaling to half size moves the hash by 2 bits,
 * compression-scale noise by up to 6, while a different garment — a different
 * shape in a different position, same colour — sits 38 bits away. Ten leaves
 * real headroom above the noise without approaching genuine difference.
 *
 * It stays well clear of 32 (the distance between unrelated images) on purpose.
 * A loose threshold would silently merge two similar garments, which is a real
 * risk in a wardrobe where someone owns the same t-shirt in three colours, and
 * `duplicate-detection.md` treats a near-match as a strong SIGNAL to be weighed
 * — not a decision to be made here.
 */
export const SAME_IMAGE_MAX_DISTANCE = 10;

export function isSameImage(a: string, b: string): boolean {
  const distance = hammingDistance(a, b);
  return distance !== null && distance <= SAME_IMAGE_MAX_DISTANCE;
}
