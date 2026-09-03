/**
 * Raw pixel buffers.
 *
 * Everything in this package works on decoded pixels rather than encoded files,
 * so the algorithms stay independent of whichever decoder the caller uses
 * (`sharp` in the worker, a hand-rolled PNG encoder in the seed).
 */

/** Tightly packed 8-bit channels, row-major, no padding. */
export type PixelBuffer = {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
  /** 3 for RGB, 4 for RGBA. */
  channels: 3 | 4;
};

export function assertPixelBuffer(image: PixelBuffer): void {
  const expected = image.width * image.height * image.channels;
  if (image.data.length !== expected) {
    throw new Error(
      `pixel buffer is ${image.data.length} bytes, expected ${expected} ` +
        `(${image.width}×${image.height}×${image.channels})`,
    );
  }
}

/**
 * Box-downsample to a bounding box, preserving aspect ratio.
 *
 * Averaging rather than nearest-neighbour: both the blurhash and the perceptual
 * hash are meant to describe the image as a whole, and dropping pixels lets a
 * single bright speck survive into a thumbnail that should have averaged it
 * away.
 */
export function downsample(image: PixelBuffer, maxEdge: number): PixelBuffer {
  assertPixelBuffer(image);
  const { width, height, channels } = image;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  if (outWidth === width && outHeight === height) return image;

  const out = Buffer.alloc(outWidth * outHeight * channels);

  for (let y = 0; y < outHeight; y += 1) {
    const y0 = Math.floor((y * height) / outHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outHeight));

    for (let x = 0; x < outWidth; x += 1) {
      const x0 = Math.floor((x * width) / outWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outWidth));

      const totals = [0, 0, 0, 0];
      let samples = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const at = (sy * width + sx) * channels;
          for (let c = 0; c < channels; c += 1) {
            totals[c] = (totals[c] ?? 0) + (image.data[at + c] ?? 0);
          }
          samples += 1;
        }
      }

      const at = (y * outWidth + x) * channels;
      for (let c = 0; c < channels; c += 1) {
        out[at + c] = Math.round((totals[c] ?? 0) / samples);
      }
    }
  }

  return { data: out, width: outWidth, height: outHeight, channels };
}

/**
 * Rec. 601 luma.
 *
 * Alpha is composited onto white first: a cutout's transparent surround must
 * not read as black, which would put a hard edge into every hash of every
 * cutout and make two unrelated cutouts look similar.
 */
export function toGrayscale(image: PixelBuffer): { data: Float64Array; width: number; height: number } {
  assertPixelBuffer(image);
  const { width, height, channels } = image;
  const out = new Float64Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const at = i * channels;
    const r = image.data[at] ?? 0;
    const g = image.data[at + 1] ?? 0;
    const b = image.data[at + 2] ?? 0;
    const a = channels === 4 ? (image.data[at + 3] ?? 255) / 255 : 1;

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    out[i] = luma * a + 255 * (1 - a);
  }

  return { data: out, width, height };
}
