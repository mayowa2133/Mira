# Seed Data

Seeds exist so that every environment can demonstrate a *believable* closet.
An empty Mira demonstrates nothing, and a Mira with 12 garments demonstrates the
wrong product.

**Production data is never copied into a lower environment.** Seeds are
synthetic.

---

## Seed sets

| Set | Contents | Used for |
| --- | -------- | -------- |
| `minimal` | 1 user, 12 garments, 2 outfits | Unit and integration tests |
| `realistic` | 1 user, **220 garments**, 30 outfits, 180 wear events, 40 purchase candidates | Local development, design review, demos |
| `large` | 1 user, 1,200 garments | Performance testing (PERF-1, PERF-2, INV-5) |
| `edge` | Deliberately awkward data | State and error testing |
| `eval` | Fixed, versioned | AI evaluation — see `docs/06-ai/evaluation.md` |

`realistic` is the default for local development. 220 garments is the size at
which the product's actual problem becomes visible.

## Composition of `realistic`

Proportions matched to the primary persona, not to an even spread:

```text
Tops         62    Shoes        28
Bottoms      38    Bags         14
Dresses      31    Accessories  18
Outerwear    16    Activewear   9
Sets          4    Swimwear     0
```

With:

- 34 garments never worn (`worn_count = 0`)
- 11 garments with `tags_attached = true`
- 19 garments not worn in more than 8 months
- 6 garments in `laundry`, 3 `archived`, 2 `lent_out`, 1 `returned`
- 4 deliberate near-duplicate pairs (for the duplicate sheet)
- 3 legitimate exact duplicates (the user genuinely owns two)
- Garments across 24 brands, with 8 brands unmatched (`brand_raw` only)
- A spread of `source_type` covering every value in taxonomy §11
- Mixed confidence: ~20% of garments have at least one medium-confidence field,
  ~8% have a low-confidence field — so the review UI is exercised

## Images

Seeds use **synthetic or properly licensed placeholder imagery only**.

- Never use screenshots from `docs/02-design/reference-images/` as seed content.
- Never use scraped retailer photography.
- Placeholder garments are generated flat-lay renders on a neutral ground, which
  also exercise the cutout path.

### How they are generated

`apps/api/src/db/seed-images.ts` DRAWS them: a category silhouette in the
garment's own taxonomy colour, on the `surfaceSunken` ground, at 640x800 (the
4:5 tile ratio). Nothing is downloaded, so the seed stays legally clean and
deterministic — the same seed produces the same closet, which is what makes
screenshots and performance numbers comparable between runs.

They are shaded rather than flat-filled, because a flat fill reads as a
placeholder no matter how good the outline is. Three layers, plus a shadow:

- **Form.** Darker toward the silhouette edge, driven by a distance transform
  of the shape. This is the one that makes cloth look like cloth.
- **Key light.** One soft source from the top left, so the garment has a
  direction.
- **Folds.** Low-frequency variation across the surface, 3% — the difference
  between fabric and vinyl.
- **Contact shadow** on the ground beneath, offset downward, so a flat lay sits
  on a surface instead of floating over one.

Each garment is also rendered with a small rotation and scale, derived from a
caller-supplied integer rather than from a random source. Two hundred identical
renders read as a print pattern: the eye finds the repeat immediately and the
grid stops looking like a wardrobe. The variation is deliberately small —
±3° and ±4.5% — because a clipped sleeve is a worse placeholder than an
unvaried one, and a test renders forty variants to assert none of them touch
the frame edge.

There is no image dependency. PNG is written directly (zlib ships with Node) and
blurhash is a small, well-defined transform. A raster library to draw a dozen
rectangles would not have earned its place.

Each seeded garment gets one `canonical` image with real `width`, `height`,
`blurhash` and `image_hash`, written through the same storage driver the API
reads from — so the seeded closet exercises the real signed-URL path rather than
a shortcut.

Colours near the ground are darkened slightly before drawing. Without that, an
ivory garment on an ivory ground is invisible, and roughly a fifth of the
taxonomy palette is light.

**These are placeholders, not photographs.** They verify layout, hierarchy and
colour handling. They do not tell you how the grid behaves with the varied
crops, backgrounds and contrast of real garment photos.

## `edge` set

Deliberately awkward, because these are the cases that break screens:

- A garment with no images (upload failed)
- A garment stuck in `analyzing` for hours
- A garment with a 90-character product name
- A garment with 6 secondary colours and 5 materials
- A brand name with an emoji and RTL characters
- A price of 0, and a price of 4,200
- A purchase candidate with no image and no product name
- A receipt import that failed to parse
- An outfit whose garment was later archived
- A try-on whose body profile was deleted
- A user with 0 garments (empty states)
- A user with 1 garment (near-empty states)

## Running seeds

```bash
npm run db:seed -- --set=realistic
npm run db:seed -- --set=large --user=perf@mira.local
npm run db:seed -- --reset --set=edge
```

Seeds are idempotent: running twice produces the same database, not double the
garments.

## Rules

1. Seed users use `@mira.local` addresses and can never receive real email.
2. Seeds never write to production.
3. Seed data never contains real people's photographs.
4. The `eval` set is versioned and immutable — changing it invalidates every
   historical metric (`docs/06-ai/evaluation.md`).
