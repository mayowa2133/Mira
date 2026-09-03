# Image Processing

Turning a phone photograph into the clean garment imagery the whole product is
built on.

**Capabilities:** `segmentation`, plus deterministic image operations
**Consumers:** every ingestion path

---

## 1. Pipeline

```text
upload (original, EXIF already stripped client-side)
  → validate (format, dimensions, size)
  → orientation normalization
  → derivatives: thumb 400px, medium 1080px
  → blurhash
  → perceptual hash (duplicate detection)
  → segmentation → mask → cutout (PNG with alpha)
  → quality gate
  → canonical image selection
```

Everything after `derivatives` may fail without losing the garment.

## 2. Derivatives

| Variant | Longest edge | Format | Used by |
| ------- | ------------ | ------ | ------- |
| `thumb` | 400 px | WebP | Grid, carousels, swap sheet |
| `medium` | 1080 px | WebP | Detail, look detail |
| `cutout` | 1080 px | PNG + alpha | Canonical image, outfit collages |
| `original` | unchanged | as uploaded | Re-analysis, try-on, export |

The original is never discarded — model quality improves, and try-on fidelity
depends on it.

## 3. Segmentation

Goal: isolate one garment from its background, whether it is on a hanger, laid
flat, or being worn.

**Quality gate.** A cutout is accepted only if:

- the mask covers 8%–92% of the frame (not a speck, not the whole image),
- the mask is a single dominant connected component (> 80% of masked pixels),
- edges are not obviously torn (contour smoothness above threshold),
- the result is not almost entirely transparent.

A cutout that fails the gate is discarded and the **original becomes canonical**.
A bad cutout is worse than no cutout: it makes the closet look broken.

### Worn garments

When the photo is of a person wearing the item, segmentation targets the garment,
not the person. If the garment cannot be separated cleanly, the original is kept.
Faces are never separately detected, stored, or analyzed in the garment pipeline.

## 4. Canonical image selection

```text
1. accepted cutout
2. retailer image, if product matching succeeded
3. original photo
```

`garment_images.is_canonical` is unique per garment. The user can override by
reordering images.

## 5. Perceptual hashing

Every image gets a perceptual hash, used for:

- exact-duplicate upload detection (the same photo twice stores once),
- a signal in [duplicate-detection.md](duplicate-detection.md),
- try-on cache fingerprinting.

Hashes are stored on `garment_images.image_hash`.

## 6. Client-side preprocessing

Before upload the client:

- downscales to a 2048 px longest edge,
- **strips EXIF**, including GPS — location in a garment photo is a privacy leak
  with no product value,
- compresses to a target size,
- writes the file locally first, so the photo is never lost to a failed upload
  (REL-2).

## 7. Performance

| Step | Budget |
| ---- | ------ |
| Client preprocess | < 300 ms |
| Upload (typical photo, good network) | < 1.5 s |
| Derivatives + hashes | < 800 ms |
| Segmentation | < 2 s |
| Capture → visible in closet as "analyzing" | < 1 s (PERF-3) |

The user sees their photo immediately; everything else happens behind that.

## 8. Failure handling

| Failure | Handling |
| ------- | -------- |
| Unsupported format | Reject at upload with `unsupported_image_format` |
| Too large | Client downscales; server rejects above the hard cap |
| Segmentation provider down | Skip cutout, original is canonical, retry later |
| Segmentation low quality | Discard cutout, original is canonical |
| Derivative generation fails | Retry; serve the original meanwhile |

**In no case does the garment fail to be created.**

## 9. Evaluation

Sampled from the 200-image garment set.

| Metric | Target |
| ------ | ------ |
| Cutout acceptance rate | ≥ 0.90 |
| Human-rated cutout quality (1–5) | ≥ 4.2 mean |
| False-accept rate (bad cutout accepted) | ≤ 0.02 |
| Perceptual-hash collision rate across distinct garments | ≤ 0.001 |

False-accepts are weighted heavily: the quality gate exists to protect the closet
from looking broken.
