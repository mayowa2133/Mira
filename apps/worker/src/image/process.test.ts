import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processImage, type ImageProcessPorts } from './process.js';
import { UnsupportedImage } from './decode.js';

/** A JPEG of a dark garment shape on a light ground. */
async function photo(width = 900, height = 1200): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3, 235);
  for (let y = Math.floor(height * 0.15); y < height * 0.85; y += 1) {
    for (let x = Math.floor(width * 0.3); x < width * 0.7; x += 1) {
      const at = (y * width + x) * 3;
      raw[at] = 40;
      raw[at + 1] = 38;
      raw[at + 2] = 52;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
}

/** A PNG cutout: the garment opaque, everything else transparent. */
async function cutoutPng(options: { coverage: 'good' | 'speck' | 'confetti' }): Promise<Buffer> {
  const width = 400;
  const height = 500;
  const raw = Buffer.alloc(width * height * 4, 0);

  const paint = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const at = (y * width + x) * 4;
        raw[at] = 40;
        raw[at + 1] = 38;
        raw[at + 2] = 52;
        raw[at + 3] = 255;
      }
    }
  };

  if (options.coverage === 'good') paint(120, 75, 280, 425);
  if (options.coverage === 'speck') paint(0, 0, 20, 20);
  if (options.coverage === 'confetti') {
    for (let y = 0; y < height; y += 8)
      for (let x = 0; x < width; x += 8) paint(x, y, x + 3, y + 3);
  }

  return sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

function ports(overrides: Partial<ImageProcessPorts> & { store?: Map<string, Buffer> } = {}) {
  const store = overrides.store ?? new Map<string, Buffer>();

  const base: ImageProcessPorts = {
    read: async (key) => store.get(key) ?? null,
    write: async (key, bytes) => {
      store.set(key, bytes);
    },
    derivedKey: (originalKey, variant, extension) =>
      `${originalKey.replace(/\/[^/]+$/, '')}/${variant}.${extension}`,
    segmentation: {
      cutout: async () => null,
    },
    ...overrides,
  };

  return { ports: base, store };
}

const input = {
  garmentImageId: 'gi-1',
  uploadKey: 'garments/user-1/g-1/original.jpg',
  userId: 'user-1',
};

describe('processImage', () => {
  it('produces derivatives, a blurhash and a perceptual hash', async () => {
    const { ports: p, store } = ports();
    store.set(input.uploadKey, await photo());

    const report = await processImage(p, input);

    expect(report.width).toBe(900);
    expect(report.height).toBe(1200);
    expect(report.blurhash.length).toBeGreaterThan(6);
    expect(report.imageHash).toMatch(/^[0-9a-f]{16}$/);

    expect(report.derivatives.map((d) => d.name).sort()).toEqual(['medium', 'thumb']);
    // 400px and 1080px longest edge, aspect preserved.
    expect(report.derivatives.find((d) => d.name === 'thumb')?.height).toBe(400);
    expect(report.derivatives.find((d) => d.name === 'medium')?.height).toBe(1080);
    for (const derivative of report.derivatives) {
      expect(store.has(derivative.storageKey)).toBe(true);
    }
  });

  it('never upscales a small photo', async () => {
    const { ports: p, store } = ports();
    store.set(input.uploadKey, await photo(300, 400));

    const report = await processImage(p, input);
    for (const derivative of report.derivatives) {
      expect(derivative.height).toBeLessThanOrEqual(400);
    }
  });

  describe('the garment survives every failure after validation', () => {
    it('keeps the original canonical when segmentation returns nothing', async () => {
      const { ports: p, store } = ports();
      store.set(input.uploadKey, await photo());

      const report = await processImage(p, input);

      expect(report.cutout.status).toBe('unavailable');
      expect(report.canonicalKey).toBe(input.uploadKey);
    });

    it('keeps the original canonical when the segmentation provider throws', async () => {
      const { ports: p, store } = ports({
        segmentation: {
          cutout: async () => {
            throw new Error('provider 503');
          },
        },
      });
      store.set(input.uploadKey, await photo());

      const report = await processImage(p, input);

      expect(report.cutout).toMatchObject({ status: 'unavailable' });
      expect(report.canonicalKey).toBe(input.uploadKey);
      // Derivatives were still produced: an outage in one step does not
      // cascade into the others.
      expect(report.derivatives).toHaveLength(2);
    });

    it('keeps the original canonical when the cutout fails the quality gate', async () => {
      const store = new Map<string, Buffer>();
      store.set(input.uploadKey, await photo());
      store.set('cut/speck.png', await cutoutPng({ coverage: 'speck' }));

      const { ports: p } = ports({
        store,
        segmentation: {
          cutout: async () => ({ storageKey: 'cut/speck.png', maskCoverage: 0.4 }),
        },
      });

      const report = await processImage(p, input);

      expect(report.cutout.status).toBe('rejected');
      expect(report.canonicalKey).toBe(input.uploadKey);
    });

    it('rejects a fragmented cutout even when the provider claims good coverage', async () => {
      const store = new Map<string, Buffer>();
      store.set(input.uploadKey, await photo());
      store.set('cut/confetti.png', await cutoutPng({ coverage: 'confetti' }));

      const { ports: p } = ports({
        store,
        segmentation: {
          // The provider reports a healthy mask. The gate reads the alpha
          // channel itself and disagrees.
          cutout: async () => ({ storageKey: 'cut/confetti.png', maskCoverage: 0.45 }),
        },
      });

      const report = await processImage(p, input);

      expect(report.cutout).toMatchObject({ status: 'rejected', reason: 'fragmented' });
      expect(report.canonicalKey).toBe(input.uploadKey);
    });

    it('still returns hashes when every derivative write fails', async () => {
      const store = new Map<string, Buffer>();
      store.set(input.uploadKey, await photo());

      const { ports: p } = ports({
        store,
        write: async () => {
          throw new Error('disk full');
        },
      });

      const report = await processImage(p, input);

      expect(report.derivatives).toEqual([]);
      expect(report.blurhash).toBeTruthy();
      expect(report.canonicalKey).toBe(input.uploadKey);
    });
  });

  it('promotes an accepted cutout to canonical', async () => {
    const store = new Map<string, Buffer>();
    store.set(input.uploadKey, await photo());
    store.set('cut/good.png', await cutoutPng({ coverage: 'good' }));

    const { ports: p } = ports({
      store,
      segmentation: {
        cutout: async () => ({ storageKey: 'cut/good.png', maskCoverage: 0.28 }),
      },
    });

    const report = await processImage(p, input);

    expect(report.cutout).toMatchObject({ status: 'accepted' });
    expect(report.canonicalKey).toBe('cut/good.png');
  });

  describe('validation', () => {
    it('rejects a file that is not an image', async () => {
      const { ports: p, store } = ports();
      store.set(input.uploadKey, Buffer.from('this is not an image'));

      await expect(processImage(p, input)).rejects.toBeInstanceOf(UnsupportedImage);
    });

    it('rejects a missing upload rather than creating an empty garment image', async () => {
      const { ports: p } = ports();
      await expect(processImage(p, input)).rejects.toBeInstanceOf(UnsupportedImage);
    });
  });
});
