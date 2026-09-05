/**
 * Client-side preprocessing (`docs/06-ai/image-processing.md` §6).
 *
 * Before a photograph leaves the device it is downscaled, stripped of EXIF and
 * compressed — and written to local storage first, so it is never lost to a
 * failed upload (REL-2).
 *
 * The EXIF part is not an optimization. A garment photo carries GPS by default,
 * which is the user's home address attached to a picture of their wardrobe:
 * "a privacy leak with no product value". `expo-image-manipulator` re-encodes
 * the pixels and writes no EXIF, so the metadata is gone by construction rather
 * than by a field-by-field scrub that a future format could quietly defeat.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { CAPTURE_DIR, JPEG_QUALITY, constrain } from './preprocess-core';

function captureDirectory(): Directory {
  const directory = new Directory(Paths.document, CAPTURE_DIR);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export type PreparedCapture = {
  /**
   * File name only. Resolve it with `captureFileUri` when you need a URI.
   *
   * Absolute paths are deliberately not returned: iOS changes the app's data
   * container id on reinstall, so an absolute path that outlives an update
   * points at nothing and the photograph looks lost (REL-2).
   */
  fileName: string;
  width: number;
  height: number;
};

/** The current absolute URI for a stored capture. */
export function captureFileUri(fileName: string): string {
  return new File(captureDirectory(), fileName).uri;
}

/**
 * Downscale, strip metadata, compress, and persist under our control.
 *
 * The source may be a camera temp file or a photo-library asset, and neither is
 * ours to rely on: the OS can reclaim a temp file, and a library asset may not
 * be readable later (or at all, under iOS limited selection). Copying into the
 * document directory is what makes "the photo is never lost" true.
 */
export async function prepareCapture(sourceUri: string, id: string): Promise<PreparedCapture> {
  // Read the real dimensions before deciding how to resize. Constraining WIDTH
  // alone would leave a portrait photo — which is most garment photos — far
  // over the budget on its long side, and constraining both would distort it.
  const measured = await ImageManipulator.manipulate(sourceUri).renderAsync();
  const constraint = constrain(measured.width, measured.height);

  const context = ImageManipulator.manipulate(sourceUri);
  if (constraint) context.resize(constraint);

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });

  const destination = new File(captureDirectory(), `${id}.jpg`);
  if (destination.exists) destination.delete();
  // Awaited: the queue may read this file immediately, and a move still in
  // flight would look exactly like a capture that vanished.
  await new File(saved.uri).move(destination);

  return { fileName: `${id}.jpg`, width: saved.width, height: saved.height };
}

/** Remove a capture's local copy once it is safely in the closet. */
export function discardCapture(fileName: string): void {
  try {
    const file = new File(captureDirectory(), fileName);
    if (file.exists) file.delete();
  } catch {
    // A capture we cannot delete is a small amount of wasted disk, not a
    // failure worth surfacing — and never a reason to keep the entry queued.
  }
}
