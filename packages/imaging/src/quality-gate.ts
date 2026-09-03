/**
 * Cutout quality gate (`docs/06-ai/image-processing.md` §3).
 *
 * "A bad cutout is worse than no cutout: it makes the closet look broken."
 *
 * That sentence is the whole design. This gate is deliberately conservative and
 * every rejection is survivable — a rejected cutout falls back to the original
 * photo, and the garment is created either way. The expensive mistake is
 * ACCEPTING a torn mask, because it is then the canonical image the user sees
 * in the grid forever.
 */
import { assertPixelBuffer, type PixelBuffer } from './pixels.js';

export const GATE = {
  /** Not a speck, not the whole frame. */
  minCoverage: 0.08,
  maxCoverage: 0.92,
  /** The mask must be one garment, not confetti. */
  minDominantComponent: 0.8,
  /** Contour smoothness: perimeter against that of a disc of equal area. */
  maxEdgeRoughness: 3.5,
  /** Below this, "the result is almost entirely transparent". */
  minOpaqueRatio: 0.02,
  /** Alpha at or above this counts as garment. */
  opaqueThreshold: 128,
} as const;

export type QualityRejection =
  | 'coverage_too_low'
  | 'coverage_too_high'
  | 'fragmented'
  | 'edges_torn'
  | 'almost_transparent'
  | 'not_transparent';

export type QualityResult = {
  accepted: boolean;
  rejection: QualityRejection | null;
  metrics: {
    coverage: number;
    dominantComponent: number;
    edgeRoughness: number;
  };
};

/**
 * Largest connected component of the mask, as a fraction of all masked pixels.
 *
 * Iterative flood fill with an explicit stack: a recursive one blows the call
 * stack on a 1080px image long before it finishes a garment-sized region.
 */
function componentStats(
  mask: Uint8Array,
  width: number,
  height: number,
): { total: number; largest: number; largestPerimeter: number } {
  const labels = new Int32Array(width * height);
  let total = 0;
  let largest = 0;
  let largestPerimeter = 0;
  let current = 0;

  for (let i = 0; i < mask.length; i += 1) if (mask[i]) total += 1;

  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;

    current += 1;
    let size = 0;
    let perimeter = 0;
    stack.push(start);
    labels[start] = current;

    while (stack.length) {
      const at = stack.pop() as number;
      size += 1;

      const x = at % width;
      const y = (at - x) / width;

      // 4-connectivity. A pixel touching the frame edge or a non-mask
      // neighbour contributes to the perimeter.
      const neighbours = [
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
      ];

      for (const next of neighbours) {
        if (next < 0) {
          perimeter += 1;
          continue;
        }
        if (!mask[next]) {
          perimeter += 1;
          continue;
        }
        if (!labels[next]) {
          labels[next] = current;
          stack.push(next);
        }
      }
    }

    if (size > largest) {
      largest = size;
      largestPerimeter = perimeter;
    }
  }

  return { total, largest, largestPerimeter };
}

/**
 * Judge a cutout by its alpha channel.
 *
 * `maskCoverage` from the segmentation provider is not trusted as the only
 * input: it is the provider's own account of its work, and the failure this
 * gate exists to catch — a torn or fragmented mask — is precisely the one a
 * provider is least likely to report.
 */
export function assessCutout(cutout: PixelBuffer): QualityResult {
  assertPixelBuffer(cutout);

  if (cutout.channels !== 4) {
    return {
      accepted: false,
      rejection: 'not_transparent',
      metrics: { coverage: 0, dominantComponent: 0, edgeRoughness: 0 },
    };
  }

  const { width, height } = cutout;
  const pixels = width * height;
  const mask = new Uint8Array(pixels);

  let opaque = 0;
  for (let i = 0; i < pixels; i += 1) {
    const alpha = cutout.data[i * 4 + 3] ?? 0;
    if (alpha >= GATE.opaqueThreshold) {
      mask[i] = 1;
      opaque += 1;
    }
  }

  const coverage = opaque / pixels;
  const { total, largest, largestPerimeter } = componentStats(mask, width, height);
  const dominantComponent = total === 0 ? 0 : largest / total;

  // Perimeter of a disc with the same area is the smoothest a region of this
  // size could possibly be; the ratio says how much rougher this one is.
  const idealPerimeter = 2 * Math.sqrt(Math.PI * largest);
  const edgeRoughness = largest === 0 ? 0 : largestPerimeter / idealPerimeter;

  const metrics = { coverage, dominantComponent, edgeRoughness };
  const reject = (rejection: QualityRejection): QualityResult => ({
    accepted: false,
    rejection,
    metrics,
  });

  if (coverage < GATE.minOpaqueRatio) return reject('almost_transparent');
  if (coverage < GATE.minCoverage) return reject('coverage_too_low');
  if (coverage > GATE.maxCoverage) return reject('coverage_too_high');
  if (dominantComponent < GATE.minDominantComponent) return reject('fragmented');
  if (edgeRoughness > GATE.maxEdgeRoughness) return reject('edges_torn');

  return { accepted: true, rejection: null, metrics };
}
