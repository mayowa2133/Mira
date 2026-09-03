/**
 * `image.process` (`docs/06-ai/image-processing.md` §1).
 *
 *   validate → orientation → derivatives → blurhash → perceptual hash
 *     → segmentation → cutout → quality gate → canonical selection
 *
 * The governing rule from §8 is that **in no case does the garment fail to be
 * created**. Validation can reject an upload, but once bytes are accepted every
 * later step is allowed to fail and leave a usable garment behind. That is why
 * this returns a report of what succeeded rather than throwing on the first
 * disappointment.
 */
import { assessCutout, encodeBlurhash, perceptualHash, type PixelBuffer } from '@mira/imaging';
import type { SegmentationCapability } from '@mira/ai';
import {
  UnsupportedImage,
  inspect,
  makeDerivatives,
  toPixels,
  toRgba,
  type Derivative,
} from './decode.js';

/** What the pipeline needs from the outside world. */
export type ImageProcessPorts = {
  read(storageKey: string): Promise<Buffer | null>;
  write(storageKey: string, bytes: Buffer): Promise<void>;
  /** Derive a sibling key, e.g. `…/original.jpg` → `…/thumb.webp`. */
  derivedKey(originalKey: string, variant: string, extension: string): string;
  segmentation: SegmentationCapability;
};

export type ImageProcessInput = {
  garmentImageId: string;
  uploadKey: string;
  userId: string;
};

export type CutoutOutcome =
  | { status: 'accepted'; storageKey: string; coverage: number }
  | { status: 'rejected'; reason: string }
  | { status: 'unavailable'; reason: string };

export type ImageProcessReport = {
  width: number;
  height: number;
  blurhash: string;
  imageHash: string;
  derivatives: { name: string; storageKey: string; width: number; height: number }[];
  cutout: CutoutOutcome;
  /** The key that should become `is_canonical`. */
  canonicalKey: string;
};

const EXTENSION_FOR_VARIANT: Record<string, string> = {
  thumb: 'webp',
  medium: 'webp',
  cutout: 'png',
};

export async function processImage(
  ports: ImageProcessPorts,
  input: ImageProcessInput,
): Promise<ImageProcessReport> {
  const original = await ports.read(input.uploadKey);
  if (!original) throw new UnsupportedImage('undecodable');

  // Validation is the ONE step allowed to reject the whole upload.
  const facts = await inspect(original);

  const pixels = await toPixels(original);
  const blurhash = encodeBlurhash(pixels);
  const imageHash = perceptualHash(pixels);

  const derivatives = await writeDerivatives(ports, input.uploadKey, original);
  const cutout = await tryCutout(ports, input, imageHash);

  return {
    width: facts.width,
    height: facts.height,
    blurhash,
    imageHash,
    derivatives,
    cutout,
    // §4: accepted cutout, else the original. A retailer image can outrank the
    // original, but only product matching can offer one, and that is Phase 3.
    canonicalKey: cutout.status === 'accepted' ? cutout.storageKey : input.uploadKey,
  };
}

async function writeDerivatives(
  ports: ImageProcessPorts,
  uploadKey: string,
  original: Buffer,
): Promise<ImageProcessReport['derivatives']> {
  // §8: "Derivative generation fails → retry; serve the original meanwhile."
  // A missing thumbnail must not cost the user their garment, so a failure here
  // is reported as an empty set and the original still serves the grid.
  let built: Derivative[];
  try {
    built = await makeDerivatives(original);
  } catch {
    return [];
  }

  const written: ImageProcessReport['derivatives'] = [];
  for (const derivative of built) {
    const key = ports.derivedKey(uploadKey, derivative.name, 'webp');
    try {
      await ports.write(key, derivative.bytes);
      written.push({
        name: derivative.name,
        storageKey: key,
        width: derivative.width,
        height: derivative.height,
      });
    } catch {
      // Same reasoning: one unwritten derivative is not a lost garment.
    }
  }

  return written;
}

async function tryCutout(
  ports: ImageProcessPorts,
  input: ImageProcessInput,
  imageHash: string,
): Promise<CutoutOutcome> {
  let result: { storageKey: string; maskCoverage: number } | null;
  try {
    result = await ports.segmentation.cutout({
      storageKey: input.uploadKey,
      imageHash,
    });
  } catch (error) {
    // §8: "Segmentation provider down → skip cutout, original is canonical,
    // retry later." A provider outage is not a broken garment.
    return { status: 'unavailable', reason: reasonOf(error) };
  }

  if (!result) return { status: 'unavailable', reason: 'no_cutout_returned' };

  const bytes = await ports.read(result.storageKey);
  if (!bytes) return { status: 'unavailable', reason: 'cutout_missing' };

  let rgba: PixelBuffer;
  try {
    rgba = await toRgba(bytes);
  } catch {
    return { status: 'rejected', reason: 'cutout_undecodable' };
  }

  // The gate reads the returned alpha channel rather than trusting the
  // provider's own `maskCoverage`: a torn mask is exactly the failure a
  // provider is least likely to report about itself.
  const verdict = assessCutout(rgba);
  if (!verdict.accepted) {
    return { status: 'rejected', reason: verdict.rejection ?? 'unknown' };
  }

  return {
    status: 'accepted',
    storageKey: result.storageKey,
    coverage: verdict.metrics.coverage,
  };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 120) : 'unknown';
}

export { EXTENSION_FOR_VARIANT };
