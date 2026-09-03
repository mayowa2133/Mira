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
| `04-add-manual.png` | Manual add form (1.6) | `feature-specs.md` F-01, `screen-specs.md` §18 |

Garments carry generated placeholder imagery (see
`docs/04-data/seed-data.md` — Images), so the grid can be judged on the thing it
exists to show.

## What these confirm

- Warm ivory ground, near-black text, blush selected-chip fill — the tokens
  render as specified.
- **Two columns, never three** (D-009).
- Garment tiles carry exactly three text lines: uppercase brand, name,
  colour · size — with the favourite heart on the image, and no SKU, wear count
  or source anywhere in the grid.
- The header count matches the API (`224` visible = 227 seeded − 3 archived).
- Garment detail reads as an editorial product page, not an inventory row.

- **Imagery dominates the tile**, with metadata supporting it rather than
  competing — the point of Reference 01, and not judgeable until there were
  images.
- Each silhouette matches its own metadata: the ivory dress reads ivory, the
  light-blue leggings read light blue.
- The add form asks for a category and nothing else, and its **colour swatches
  carry their names** — colour is never the only carrier of meaning (A11Y-4).
  The same `ColorSelect` and `ChipMultiSelect` controls back the filter sheet,
  so that sheet's contents are verified even though the sheet itself has not
  been opened.

## What they do NOT yet show

Real photography. These are drawn silhouettes, not photographs, so they verify
layout, hierarchy and colour handling — not how the grid behaves with the
varied crops, backgrounds and contrast of real garment photos. That arrives with
photo capture in Phase 2.

## Reaching a specific screen

`EXPO_PUBLIC_DEV_INITIAL_ROUTE` navigates once on launch, because iOS confirms
custom-scheme deep links with a dialog `simctl` cannot dismiss:

```bash
EXPO_PUBLIC_DEV_INITIAL_ROUTE=/add/manual npx expo start
```

It waits on `useRootNavigationState()`, not a timer. An earlier timer-based
version worked for top-level routes and silently did nothing for nested ones,
which looked like a routing defect in the app for a while. It was not.

## How to reproduce

```bash
npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
npm run api

cd apps/mobile
npx expo run:ios --device "<simulator UDID>"
```

See `docs/08-engineering/environments.md` for the setup traps (UTF-8 locale for
CocoaPods, UDID rather than name, and the dev auth token).
