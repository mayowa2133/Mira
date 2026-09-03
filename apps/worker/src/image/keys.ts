/**
 * Storage key derivation.
 *
 * Its own module so the worker and its tests use the SAME function. The
 * integration test previously mirrored this logic with a slightly different
 * key shape, which is precisely why it did not catch the collision below.
 */
/**
 * A derivative sits beside its original, named after it.
 *
 * Deriving from the DIRECTORY was wrong and silently destructive: upload keys
 * are `garments/<user>/<timestamp>-capture.jpg`, so every image for a user
 * shares one prefix and every capture overwrote the previous one's `thumb.webp`.
 * Six processed images left two files on disk.
 *
 * Keying off the original's full name instead makes the derivative as unique as
 * the original is, and keeps everything for a user under one prefix so deleting
 * their data stays a prefix operation (`storage-strategy.md` §2).
 */
export function derivedKey(originalKey: string, variant: string, extension: string): string {
  const lastDot = originalKey.lastIndexOf('.');
  const lastSlash = originalKey.lastIndexOf('/');
  // Only strip an extension, never a dot that belongs to a directory name.
  const stem = lastDot > lastSlash ? originalKey.slice(0, lastDot) : originalKey;
  return `${stem}-${variant}.${extension}`;
}
