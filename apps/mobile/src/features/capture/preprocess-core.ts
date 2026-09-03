/**
 * Preprocessing rules (`docs/06-ai/image-processing.md` §6), free of any
 * platform import so they can be tested without a simulator.
 *
 * `preprocess.ts` holds the parts that need expo-image-manipulator and the
 * filesystem; the arithmetic that decides what a photo becomes lives here.
 */

/** §6: "downscales to a 2048 px longest edge". */
export const MAX_EDGE = 2048;
export const JPEG_QUALITY = 0.82;

/** Captures live here until they are safely uploaded. */
export const CAPTURE_DIR = 'captures';

/**
 * Which edge to pin, or `null` when the photo is already small enough.
 *
 * Pinning WIDTH alone — the obvious first thing to write — leaves a portrait
 * photo far over budget on its long side, and portrait is most garment photos.
 * Pinning both would distort it.
 *
 * Never upscales: a 900px photo blown up to 2048 is a bigger file carrying no
 * more detail, and every later step then pays for the extra pixels.
 */
export function constrain(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (width <= MAX_EDGE && height <= MAX_EDGE) return null;
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}
