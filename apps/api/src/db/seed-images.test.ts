import { encodeBlurhash } from '@mira/imaging';
import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { CATEGORIES, COLOR_SWATCHES, type Color } from '@mira/taxonomy';
import {
  encodePng,
  hexToRgb,
  imageHash,
  renderGarmentImage,
} from './seed-images.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GROUND = { r: 0xf5, g: 0xf3, b: 0xf0 };

describe('PNG encoding', () => {
  it('writes a valid signature and IHDR', () => {
    const png = encodePng(4, 3, Buffer.alloc(4 * 3 * 3, 0x80));
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(png.readUInt32BE(16)).toBe(4);
    expect(png.readUInt32BE(20)).toBe(3);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(2); // truecolour RGB
  });

  it('round-trips pixel data through the IDAT chunk', () => {
    const width = 3;
    const height = 2;
    const rgb = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const png = encodePng(width, height, rgb);

    // Walk the chunks to find IDAT rather than assuming an offset.
    let pos = 8;
    let idat = Buffer.alloc(0);
    while (pos < png.length) {
      const length = png.readUInt32BE(pos);
      const type = png.subarray(pos + 4, pos + 8).toString('ascii');
      if (type === 'IDAT') idat = Buffer.concat([idat, png.subarray(pos + 8, pos + 8 + length)]);
      pos += 12 + length;
    }

    const raw = inflateSync(idat);
    const stride = width * 3;
    for (let y = 0; y < height; y += 1) {
      expect(raw[y * (stride + 1)], 'filter byte').toBe(0);
      expect(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))).toEqual(
        rgb.subarray(y * stride, (y + 1) * stride),
      );
    }
  });

  it('ends with IEND', () => {
    const png = encodePng(2, 2, Buffer.alloc(12));
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND');
  });
});

describe('colour parsing', () => {
  it('parses hex with and without a leading hash', () => {
    expect(hexToRgb('#C0392B')).toEqual({ r: 0xc0, g: 0x39, b: 0x2b });
    expect(hexToRgb('C0392B')).toEqual({ r: 0xc0, g: 0x39, b: 0x2b });
  });

  it('falls back to a neutral grey rather than throwing', () => {
    expect(hexToRgb('not-a-colour')).toEqual({ r: 140, g: 140, b: 140 });
  });
});

describe('garment rendering', () => {
  it.each([...CATEGORIES])('draws a %s that is neither blank nor solid', (category) => {
    const { pixels, width, height } = renderGarmentImage({
      category,
      colorHex: '#C0392B',
      width: 160,
      height: 200,
    });

    let covered = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      const isGround =
        Math.abs((pixels[i] as number) - GROUND.r) < 8 &&
        Math.abs((pixels[i + 1] as number) - GROUND.g) < 8 &&
        Math.abs((pixels[i + 2] as number) - GROUND.b) < 8;
      if (!isGround) covered += 1;
    }
    const coverage = covered / (width * height);

    // A silhouette that fills nothing is invisible; one that fills everything is
    // a colour swatch, not a garment.
    expect(coverage, `${category} coverage`).toBeGreaterThan(0.03);
    expect(coverage, `${category} coverage`).toBeLessThan(0.7);
  });

  it('renders on the neutral ground from the design system', () => {
    const { pixels } = renderGarmentImage({
      category: 'tops',
      colorHex: '#000000',
      width: 64,
      height: 80,
    });
    // The top-left corner is always ground — no silhouette reaches it.
    expect([pixels[0], pixels[1], pixels[2]]).toEqual([GROUND.r, GROUND.g, GROUND.b]);
  });

  it('uses the garment colour, not a fixed one', () => {
    const red = renderGarmentImage({
      category: 'dresses',
      colorHex: '#C0392B',
      width: 64,
      height: 80,
    });
    const blue = renderGarmentImage({
      category: 'dresses',
      colorHex: '#1E2A45',
      width: 64,
      height: 80,
    });
    expect(red.pixels.equals(blue.pixels)).toBe(false);
  });

  it('is deterministic, so seeded closets are comparable between runs', () => {
    const a = renderGarmentImage({ category: 'tops', colorHex: '#000000', width: 64, height: 80 });
    const b = renderGarmentImage({ category: 'tops', colorHex: '#000000', width: 64, height: 80 });
    expect(imageHash(a.pixels, a.width, a.height)).toBe(imageHash(b.pixels, b.width, b.height));
  });

  it('keeps a near-white garment visible against the ground', () => {
    const { pixels, width, height } = renderGarmentImage({
      category: 'tops',
      colorHex: '#FFFFFF',
      width: 160,
      height: 200,
    });
    let covered = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      const isGround =
        Math.abs((pixels[i] as number) - GROUND.r) < 8 &&
        Math.abs((pixels[i + 1] as number) - GROUND.g) < 8 &&
        Math.abs((pixels[i + 2] as number) - GROUND.b) < 8;
      if (!isGround) covered += 1;
    }
    // Without the darkening applied to very light colours, an ivory garment on
    // an ivory ground would be invisible.
    expect(covered / (width * height)).toBeGreaterThan(0.03);
  });

  it('renders every taxonomy colour without throwing', () => {
    for (const color of Object.keys(COLOR_SWATCHES) as Color[]) {
      const swatch = COLOR_SWATCHES[color] ?? '#9A9691';
      expect(() =>
        renderGarmentImage({ category: 'tops', colorHex: swatch, width: 32, height: 40 }),
      ).not.toThrow();
    }
  });
});

describe('blurhash', () => {
  const { pixels, width, height } = renderGarmentImage({
    category: 'dresses',
    colorHex: '#C0392B',
    width: 160,
    height: 200,
  });

  it('produces the documented length for 4x3 components', () => {
    // 1 (components) + 1 (max AC) + 4 (DC) + 2 per AC component; 4x3 has 11 AC.
    expect(encodeBlurhash({ data: pixels, width, height, channels: 3 })).toHaveLength(1 + 1 + 4 + 11 * 2);
  });

  it('uses only base83 characters', () => {
    expect(encodeBlurhash({ data: pixels, width, height, channels: 3 })).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]+$/);
  });

  it('encodes the component count in its first character', () => {
    const hash = encodeBlurhash({ data: pixels, width, height, channels: 3 }, 4, 3);
    const BASE83 =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
    const sizeFlag = BASE83.indexOf(hash[0] as string);
    expect((sizeFlag % 9) + 1).toBe(4); // componentX
    expect(Math.floor(sizeFlag / 9) + 1).toBe(3); // componentY
  });

  it('differs between differently coloured garments', () => {
    const other = renderGarmentImage({
      category: 'dresses',
      colorHex: '#1E2A45',
      width: 160,
      height: 200,
    });
    expect(encodeBlurhash({ data: pixels, width, height, channels: 3 })).not.toBe(
      encodeBlurhash({ data: other.pixels, width: other.width, height: other.height, channels: 3 }),
    );
  });

  it('is deterministic', () => {
    const image = { data: pixels, width, height, channels: 3 } as const;
    expect(encodeBlurhash(image)).toBe(encodeBlurhash(image));
  });

  // Blurhash describes a blur, so downsampling first must not change what it
  // conveys — only how long it takes.
  it('stays fast on a full-size image', () => {
    const big = renderGarmentImage({ category: 'tops', colorHex: '#000000' });
    const started = Date.now();
    encodeBlurhash({ data: big.pixels, width: big.width, height: big.height, channels: 3 });
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe('image hash', () => {
  it('is stable and differs between images', () => {
    const a = renderGarmentImage({ category: 'tops', colorHex: '#000000', width: 32, height: 40 });
    const b = renderGarmentImage({ category: 'shoes', colorHex: '#000000', width: 32, height: 40 });
    // 64 bits of hex, and two different garments do not collide.
    expect(imageHash(a.pixels, a.width, a.height)).toHaveLength(16);
    expect(imageHash(a.pixels, a.width, a.height)).not.toBe(
      imageHash(b.pixels, b.width, b.height),
    );
  });
});
