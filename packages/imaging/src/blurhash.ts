/**
 * Blurhash encoding (`docs/02-design/design-system.md` — imagery).
 *
 * A blurhash is stored on every image so the grid can paint the shape and
 * colour of a garment before its bytes arrive. A spinner over an empty box says
 * "wait"; a blurred silhouette says "your dress is coming", which is the same
 * delay experienced as progress.
 *
 * Kept dependency-free and shared, because both the seed (which invents images)
 * and the worker (which processes real ones) must produce identical hashes.
 */
import { downsample, type PixelBuffer } from './pixels.js';

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
export function encodeBlurhash(image: PixelBuffer, componentX = 4, componentY = 3): string {
  const small = downsample(image, 32);
  const { width, height, channels } = small;
  const pixels = small.data;
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
          const k = (y * width + x) * channels;
          // Composite over white: a cutout's transparent surround would
          // otherwise encode as black and every cutout would share a dark
          // blurhash that looks nothing like the garment.
          const alpha = channels === 4 ? (pixels[k + 3] ?? 255) / 255 : 1;
          const over = (value: number) => sRgbToLinear(value * alpha + 255 * (1 - alpha));
          r += basis * over(pixels[k] as number);
          g += basis * over(pixels[k + 1] as number);
          b += basis * over(pixels[k + 2] as number);
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
