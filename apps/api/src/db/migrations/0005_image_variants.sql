-- 0005 — Image variants
--
-- `image.process` produces a 400px thumb and a 1080px medium
-- (docs/06-ai/image-processing.md §2), writes them to private storage, and
-- until now had nowhere to record them. The derivatives existed and were
-- unreachable: every closet tile loaded the full-size original, which is the
-- opposite of what the derivatives are for.
--
-- Columns rather than a `garment_image_variants` table: a variant is a property
-- of one image, always exactly these two, always produced together. A child
-- table would add a join to the hottest query in the product (the closet grid)
-- to model a one-to-one relationship.
--
-- Nullable because they are genuinely optional. §8 requires that a derivative
-- failure never costs the user their garment, so an image whose derivatives
-- failed must still be a valid row — the original serves in the meantime.

alter table garment_images
  add column if not exists thumb_key  text,
  add column if not exists medium_key text;

comment on column garment_images.thumb_key is
  '400px WebP derivative; null until image.process runs, or if it failed.';
comment on column garment_images.medium_key is
  '1080px WebP derivative; null until image.process runs, or if it failed.';
