import { describe, expect, it } from 'vitest';
import {
  SAME_IMAGE_MAX_DISTANCE,
  hammingDistance,
  isSameImage,
  perceptualHash,
} from './perceptual-hash.js';
import { downsample, type PixelBuffer } from './pixels.js';

/** A deterministic "photograph": a soft blob on a ground, with fine texture. */
function scene(options: {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  tint: [number, number, number];
  noise?: number;
}): PixelBuffer {
  const { width, height, cx, cy, radius, tint, noise = 0 } = options;
  const data = Buffer.alloc(width * height * 3);

  // A fixed LCG, so "noise" is reproducible across runs.
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - cx * width) / (radius * width);
      const dy = (y - cy * height) / (radius * height);
      const inside = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));

      const at = (y * width + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const base = 235 - inside * (235 - (tint[c] ?? 0));
        const jitter = noise ? (rand() - 0.5) * noise : 0;
        data[at + c] = Math.max(0, Math.min(255, Math.round(base + jitter)));
      }
    }
  }

  return { data, width, height, channels: 3 };
}

const dress = scene({ width: 200, height: 260, cx: 0.5, cy: 0.5, radius: 0.35, tint: [30, 30, 40] });

describe('perceptualHash', () => {
  it('is 64 bits of hex', () => {
    const hash = perceptualHash(dress);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for the same pixels', () => {
    expect(perceptualHash(dress)).toBe(perceptualHash(dress));
  });

  it('survives rescaling — the same photo at half size is the same image', () => {
    const half = downsample(dress, 100);
    const distance = hammingDistance(perceptualHash(dress), perceptualHash(half));

    expect(distance).not.toBeNull();
    expect(distance as number).toBeLessThanOrEqual(SAME_IMAGE_MAX_DISTANCE);
    expect(isSameImage(perceptualHash(dress), perceptualHash(half))).toBe(true);
  });

  it('survives light compression noise', () => {
    const noisy = scene({
      width: 200,
      height: 260,
      cx: 0.5,
      cy: 0.5,
      radius: 0.35,
      tint: [30, 30, 40],
      noise: 12,
    });

    expect(isSameImage(perceptualHash(dress), perceptualHash(noisy))).toBe(true);
  });

  it('ignores a uniform brightness shift, because the DC term is dropped', () => {
    const brighter: PixelBuffer = {
      ...dress,
      data: Buffer.from(dress.data.map((v) => Math.min(255, v + 20))),
    };

    expect(isSameImage(perceptualHash(dress), perceptualHash(brighter))).toBe(true);
  });

  it('separates two genuinely different garments', () => {
    // A different shape in a different place — a coat on the left, not a dress
    // centred. Colour alone is deliberately NOT the difference.
    const coat = scene({
      width: 200,
      height: 260,
      cx: 0.25,
      cy: 0.35,
      radius: 0.18,
      tint: [30, 30, 40],
    });

    const distance = hammingDistance(perceptualHash(dress), perceptualHash(coat));
    // Measured at 38 — far outside the same-image band, which is the property
    // that makes the threshold safe.
    expect(distance as number).toBeGreaterThan(20);
    expect(isSameImage(perceptualHash(dress), perceptualHash(coat))).toBe(false);
  });
});

describe('hammingDistance', () => {
  it('counts differing bits', () => {
    expect(hammingDistance('00', '00')).toBe(0);
    expect(hammingDistance('00', '01')).toBe(1);
    expect(hammingDistance('00', 'ff')).toBe(8);
    expect(hammingDistance('0f0f', 'f0f0')).toBe(16);
  });

  it('refuses to compare hashes of different lengths rather than guessing', () => {
    expect(hammingDistance('00', '0000')).toBeNull();
    expect(isSameImage('00', '0000')).toBe(false);
  });

  it('refuses non-hex input rather than reading it as zero', () => {
    expect(hammingDistance('zz', '00')).toBeNull();
  });
});
