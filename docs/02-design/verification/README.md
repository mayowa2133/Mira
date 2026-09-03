# Visual verification

Screenshots captured from the iOS Simulator against the **real** stack: Postgres
with the 227-garment `realistic` seed, the API on :4000, and a debug build on an
iPhone 17 Pro (iOS 26.5).

These are evidence for `AGENTS.md`'s Visual Implementation Rule item 10 — a
screen is not complete until it has been seen. Re-capture them whenever a screen
changes materially.

| File | Screen | Spec |
| ---- | ------ | ---- |
| `01-home.png` | Home, empty closet state | `screen-specs.md` §13 |
| `02-closet.png` | Closet grid, 224 visible pieces | `screen-specs.md` §14, Reference 01 |
| `03-detail.png` | Garment detail | `screen-specs.md` §17, Reference 02 |

## What these confirm

- Warm ivory ground, near-black text, blush selected-chip fill — the tokens
  render as specified.
- **Two columns, never three** (D-009).
- Garment tiles carry exactly three text lines: uppercase brand, name,
  colour · size — with the favourite heart on the image, and no SKU, wear count
  or source anywhere in the grid.
- The header count matches the API (`224` visible = 227 seeded − 3 archived).
- Garment detail reads as an editorial product page, not an inventory row.

## What they do NOT yet show

Garment imagery. The seed creates garments without images, because photo
capture is Phase 2, so every tile renders its `surfaceSunken` placeholder. The
layout is verified; the claim that "imagery dominates" cannot be until there are
images. `docs/04-data/seed-data.md` calls for generated placeholder imagery —
worth doing before the next visual pass.

## How to reproduce

```bash
npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
npm run api

cd apps/mobile
npx expo run:ios --device "<simulator UDID>"
```

See `docs/08-engineering/environments.md` for the setup traps (UTF-8 locale for
CocoaPods, UDID rather than name, and the dev auth token).
