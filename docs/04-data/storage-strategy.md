# Storage Strategy

Every user image in Mira is private. There is no public bucket.

---

## 1. Buckets

| Bucket | Contents | Signed URL TTL | Notes |
| ------ | -------- | -------------- | ----- |
| `mira-garments` | Originals, derivatives, cutouts, retailer images | 5 min | The bulk of storage |
| `mira-body` | Body reference photos | 2 min | Strictest. Extra ownership assertion at issue time |
| `mira-tryon` | Generated try-on images | 2 min | Deletable by the user at any time |
| `mira-imports` | Receipt scans and PDFs | 5 min | Deleted per retention policy |

All buckets: no public read, no public list, server-side encryption at rest,
versioning off (a deleted object must actually be gone).

## 2. Key layout

```text
garments/{user_id}/{garment_id}/{image_id}/{variant}.{ext}
body/{user_id}/{body_profile_id}/{image_id}.{ext}
tryon/{user_id}/{generation_id}.{ext}
imports/{user_id}/{receipt_import_id}/{filename}
```

The `user_id` prefix makes bulk deletion for a privacy request a prefix
operation, and makes a misdirected write obvious.

## 3. Variants

| Variant | Longest edge | Format | Used by |
| ------- | ------------ | ------ | ------- |
| `thumb` | 400 px | WebP | Closet grid, carousels, swap sheet |
| `medium` | 1080 px | WebP | Garment detail, look detail |
| `original` | unchanged | as uploaded | Re-analysis, try-on input, export |
| `cutout` | 1080 px | PNG (alpha) | Canonical image, outfit collages |

Grids request `thumb`. Detail requests `medium`. `original` is fetched only for
re-analysis and try-on (INV-6, PERF-1).

**Originals are never discarded.** They are needed for re-analysis when models
improve and for try-on garment fidelity.

## 4. Upload path

```text
client → POST /media/upload-url  (authorized, returns a scoped, short-lived PUT URL)
client → PUT direct to storage
client → POST /imports/photo { upload_key, idempotency_key }
api    → verifies the key belongs to this user, creates the garment, enqueues work
```

Direct-to-storage upload keeps large images off the API. The API still validates
that the key matches the authenticated user's prefix before accepting it.

Client-side: downscale to a 2048 px longest edge and strip EXIF **before** upload
— location metadata in a garment photo is a privacy leak with no product value.

## 5. Read path

1. Client requests a resource (garment, look, try-on).
2. API authorizes ownership.
3. API issues signed URLs with the bucket's TTL and returns `urlExpiresAt`.
4. Client caches the bytes, not the URL, and refetches the URL when it expires.

No CDN in front of user content in V1: signed short-lived URLs and a device-side
cache are simpler and leak less.

## 6. Deletion

| Action | Effect |
| ------ | ------ |
| Garment removed by user | Soft delete; objects retained for the undo window, then purged |
| Body image deleted | **Immediate hard delete** of object + derivatives; try-on cache invalidated |
| Try-on deleted | **Immediate hard delete** of object + row |
| Email disconnected | Offer to delete derived candidates and any cached retailer images |
| Account deleted | Prefix delete of all four buckets for that `user_id` |

Deletion jobs are idempotent and retried; a failure leaves a dead-lettered job
that alerts, because "we failed to delete your photo" is not an acceptable silent
outcome.

Details and windows: `docs/07-security/data-retention.md`.

## 7. Cost control

- Store one `original`, not every intermediate.
- Generate `cutout` once; regenerate only if segmentation is re-run.
- Deduplicate by `image_hash` within a user's account — the same photo uploaded
  twice stores once.
- Try-on results are cached by `input_fingerprint`, so re-viewing a look costs
  nothing.
- Lifecycle rule: purge soft-deleted garment objects after the retention window.

## 8. Rules

1. No public bucket, ever (SEC-4).
2. No storage credential in the client (SEC-3).
3. No user image URL in logs, analytics or error reports (SEC-9).
4. Body and try-on objects are never used as inputs to anything except try-on
   generation for that same user.
5. EXIF is stripped before upload; location is never persisted with an image.
