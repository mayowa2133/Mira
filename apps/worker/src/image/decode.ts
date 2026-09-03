/**
 * Decoding and derivative generation (`docs/06-ai/image-processing.md` §2).
 *
 * `sharp` is confined to this file. Everything downstream works on decoded
 * pixels through `@mira/imaging`, so the hashing and quality rules stay
 * testable without a native decoder and identical to the ones the seed uses.
 */
import sharp, { type Metadata } from 'sharp';
import type { PixelBuffer } from '@mira/imaging';

/** `docs/06-ai/image-processing.md` §2. */
export const DERIVATIVES = {
  thumb: { maxEdge: 400 },
  medium: { maxEdge: 1080 },
} as const;

export type DerivativeName = keyof typeof DERIVATIVES;

/** Hard caps. Above these the upload is rejected rather than processed. */
export const MAX_PIXELS = 50_000_000;
export const MAX_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'heif', 'heic', 'avif'] as const;

export type UnsupportedReason = 'format' | 'dimensions' | 'size' | 'undecodable';

export class UnsupportedImage extends Error {
  constructor(readonly reason: UnsupportedReason) {
    super(`unsupported image: ${reason}`);
    this.name = 'UnsupportedImage';
  }
}

export type ImageFacts = {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
};

/**
 * Validate before doing any real work.
 *
 * A 200-megapixel image is a memory bomb, and the cheapest place to refuse it
 * is before a single pixel is decoded.
 */
export async function inspect(bytes: Buffer): Promise<ImageFacts> {
  if (bytes.length > MAX_BYTES) throw new UnsupportedImage('size');

  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new UnsupportedImage('undecodable');
  }

  const { width, height, format } = meta;
  if (!width || !height) throw new UnsupportedImage('undecodable');
  if (!format || !SUPPORTED_FORMATS.includes(format as (typeof SUPPORTED_FORMATS)[number])) {
    throw new UnsupportedImage('format');
  }
  if (width * height > MAX_PIXELS) throw new UnsupportedImage('dimensions');

  return { width, height, format, hasAlpha: meta.hasAlpha ?? false };
}

/**
 * Normalized pixels for hashing.
 *
 * `rotate()` with no argument applies the EXIF orientation and drops the tag —
 * without it a portrait photo hashes differently depending on which way the
 * phone was held, and every derivative comes out sideways.
 */
export async function toPixels(bytes: Buffer, maxEdge = 512): Promise<PixelBuffer> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .toColorspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, channels: 3 };
}

export type Derivative = {
  name: DerivativeName;
  bytes: Buffer;
  width: number;
  height: number;
};

/** WebP derivatives at the sizes the grid and detail screens actually request. */
export async function makeDerivatives(bytes: Buffer): Promise<Derivative[]> {
  const out: Derivative[] = [];

  for (const name of Object.keys(DERIVATIVES) as DerivativeName[]) {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({
        width: DERIVATIVES[name].maxEdge,
        height: DERIVATIVES[name].maxEdge,
        fit: 'inside',
        // Never upscale: a 300px photo blown up to 1080 is bigger, blurrier and
        // no more useful.
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    out.push({ name, bytes: data, width: info.width, height: info.height });
  }

  return out;
}

/** Decode a cutout to RGBA so the quality gate can read its alpha channel. */
export async function toRgba(bytes: Buffer, maxEdge = 512): Promise<PixelBuffer> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, channels: 4 };
}
