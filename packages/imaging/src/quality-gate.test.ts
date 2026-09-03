import { describe, expect, it } from 'vitest';
import { assessCutout, GATE } from './quality-gate.js';
import type { PixelBuffer } from './pixels.js';

/** An RGBA canvas that is fully transparent until something is drawn on it. */
function canvas(width: number, height: number): PixelBuffer {
  return { data: Buffer.alloc(width * height * 4), width, height, channels: 4 };
}

function fillRect(
  image: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha = 255,
): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * image.width + x) * 4;
      image.data[at] = 120;
      image.data[at + 1] = 110;
      image.data[at + 2] = 100;
      image.data[at + 3] = alpha;
    }
  }
}

describe('assessCutout', () => {
  it('accepts a clean, solid, centred garment', () => {
    const image = canvas(100, 100);
    // 40% coverage, one component, straight edges.
    fillRect(image, 30, 20, 70, 80);

    const result = assessCutout(image);
    expect(result.accepted).toBe(true);
    expect(result.rejection).toBeNull();
    expect(result.metrics.coverage).toBeCloseTo(0.24, 2);
    expect(result.metrics.dominantComponent).toBe(1);
  });

  it('rejects a speck', () => {
    const image = canvas(100, 100);
    fillRect(image, 10, 10, 20, 20); // 1%

    expect(assessCutout(image).rejection).toBe('almost_transparent');
  });

  it('rejects a mask that covers essentially the whole frame', () => {
    const image = canvas(100, 100);
    fillRect(image, 0, 0, 100, 100);

    expect(assessCutout(image).rejection).toBe('coverage_too_high');
  });

  it('rejects a mask below the coverage floor but above transparency', () => {
    const image = canvas(100, 100);
    // 5%: past 'almost transparent' (2%), short of the 8% floor.
    fillRect(image, 0, 0, 50, 10);

    const result = assessCutout(image);
    expect(result.metrics.coverage).toBeCloseTo(0.05, 3);
    expect(result.rejection).toBe('coverage_too_low');
  });

  it('rejects confetti — many fragments rather than one garment', () => {
    const image = canvas(100, 100);
    // A grid of disconnected 2px blocks: plenty of coverage, no dominant part.
    for (let y = 0; y < 100; y += 4) {
      for (let x = 0; x < 100; x += 4) fillRect(image, x, y, x + 2, y + 2);
    }

    const result = assessCutout(image);
    expect(result.rejection).toBe('fragmented');
    expect(result.metrics.dominantComponent).toBeLessThan(GATE.minDominantComponent);
  });

  it('rejects a torn contour', () => {
    const image = canvas(100, 100);
    fillRect(image, 20, 20, 80, 80);
    // Comb the bottom edge into teeth: same area, far longer perimeter.
    for (let x = 20; x < 80; x += 2) {
      for (let y = 60; y < 80; y += 1) {
        const at = (y * image.width + x) * 4;
        image.data[at + 3] = 0;
      }
    }

    const result = assessCutout(image);
    expect(result.rejection).toBe('edges_torn');
    expect(result.metrics.edgeRoughness).toBeGreaterThan(GATE.maxEdgeRoughness);
  });

  it('rejects an image with no alpha channel at all', () => {
    const rgb: PixelBuffer = {
      data: Buffer.alloc(10 * 10 * 3, 200),
      width: 10,
      height: 10,
      channels: 3,
    };
    expect(assessCutout(rgb).rejection).toBe('not_transparent');
  });

  it('treats semi-transparent pixels below the threshold as background', () => {
    const image = canvas(100, 100);
    fillRect(image, 30, 20, 70, 80, GATE.opaqueThreshold - 1);

    // Every pixel is faint, so nothing counts as garment.
    expect(assessCutout(image).rejection).toBe('almost_transparent');
  });

  it('is not fooled by a garment that touches the frame edge', () => {
    const image = canvas(100, 100);
    // Runs off the bottom: edge pixels count toward the perimeter, but a
    // rectangle is still smooth enough to pass.
    fillRect(image, 25, 40, 75, 100);

    expect(assessCutout(image).accepted).toBe(true);
  });
});
