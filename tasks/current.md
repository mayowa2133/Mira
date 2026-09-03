# Current

**Phase:** 1 — Closet core (in progress)
**Updated:** 2026-09-03

`npm run verify` is green: typecheck, format, lint and **351 tests**, including
33 integration tests against a real Postgres 16 + pgvector and 57 covering the
React-free form, filter and undo logic.

**Every Phase 1 task is code-complete.** What remains is visual verification,
which is blocked on B-2.

---

## Phase 1 status

| # | Task | Status |
| - | ---- | ------ |
| 1.1 | garments, garment_images, garment_sources, brands, categories + RLS | **Done** |
| 1.2 | Private object storage + signed URL issuance | **Done** (local driver; S3 driver when infra exists) |
| 1.3 | GET/POST/PATCH/DELETE /garments with filters and cursor pagination | **Done** |
| 1.4 | Closet grid: two columns, FlashList, skeletons, empty state | **Done** — verified on device |
| 1.5 | Garment detail (SSENSE reference) | **Done** — verified on device |
| 1.6 | Manual add + edit | **Done** (code); not visually verified (B-3) |
| 1.7 | Favourite, status change, archive — optimistic with undo | **Done** (code); not visually verified (B-3) |
| 1.8 | Category chips + filter sheet with live count | **Chips verified on device**; the sheet needs a tap (B-3) |

### Exit criteria

- [ ] **220-garment seed closet scrolls at 60 fps** — the closet renders with
      227 seeded garments, but measuring scroll needs a gesture (B-3).
- [x] Every state from `states-and-errors.md` implemented on Closet and Detail —
      loading, empty, filtered-empty, error, offline and not-found are all
      implemented. The empty and populated states have now been seen; the
      error, offline and filtered-empty states have not.
- [ ] **VoiceOver pass on both screens** — blocked on B-3.

## Blocked

### ~~B-2 — No iOS Simulator~~ — CLEARED 2026-09-03

Xcode 26.6 is installed and the iOS 26.5 platform downloaded. The app builds,
installs and runs on an iPhone 17 Pro simulator against the real stack.

**Verified visually** (screenshots in `docs/02-design/verification/`):

- **Home** — ivory ground, warm empty-closet copy, five tabs.
- **Closet** — two columns, blush selected chip, `224 pieces` matching the API,
  tiles carrying exactly brand / name / colour · size with the favourite heart
  on the image.
- **Garment detail** — editorial treatment, glass back and overflow controls,
  Details rows with hairline separators.

**Not yet seen:** the add form, the edit form and the filter sheet. See B-3.

### B-3 — Three screens still unverified, and one unexplained navigation result

`/add/manual` did not navigate under the dev-route harness across several
attempts, while `/closet` and `/garment/[id]` did. Two explanations fit equally
well and I could not separate them without a real tap:

1. a genuine routing defect, which would also break the "Add manually" row; or
2. a limitation of the harness itself — `router.replace` fired from the root
   layout before the navigator has registered nested routes.

Removing the explicit `<Stack.Screen>` declarations did not change the result,
so the simple explanation is ruled out. **Do not treat this as a confirmed
product bug until it has been tapped through by hand.**

Automated tapping is also unavailable: `simctl` has no tap command, System
Events needs Accessibility permission that cannot be granted from here, and
`idb`'s taps did not register against this simulator.

**To resolve:** open the app by hand, tap `+ Add → Add manually`, and see
whether the form appears. That single tap settles it.

### Also unverified

- **60 fps on the 227-garment closet** — needs a scroll gesture, so it is
  blocked on the same tapping problem. The API side is fast: every list, filter
  and sort query is p95 < 6 ms.
- **VoiceOver pass.** Labels, roles and states are written throughout and the
  contrast is asserted in CI, but no screen has been navigated with the screen
  reader. This needs either a person or an XCUITest target.

## Next

**Clear B-2**, then verify all five closet screens visually and with VoiceOver.
That is the only thing standing between Phase 1 and done.

After that, Phase 2 — photo capture.

Everything behavioural has been verified against the running API rather than
only typechecked:

- **1.6** — creating a garment from the exact payload the form emits, editing
  it, `source_type` rejected with `immutable_field`, `dresses/heels` rejected
  with `subcategory_mismatch`.
- **1.8** — every filter combination's live count matching its actual result
  set, including multi-value OR and explicit laundry.
- **1.7** — the full undo round-trips: archive removes a piece from the closet
  and undo returns it; laundry keeps it visible but out of outfits; remove
  makes it 404 and restore brings it back with its status intact.

## Local setup

```bash
npm install
npm run db:up                       # Postgres on 5433, Redis on 6380
npm run db:migrate
npm run db:seed -- --set=realistic  # 227 garments
npm run api                         # http://localhost:4000
npm run mobile
npm run verify
```

Ports are 5433 and 6380, not the defaults: this machine already runs a native
Postgres and Redis on 5432/6379, and Mira must never compete with a developer
own services.

## Notes

- Read `AGENTS.md` before starting anything.
- `npm run generate:taxonomy` and `npm run generate:api-types` regenerate the
  two generated files. CI fails if they are stale.
- Seed sets: `minimal`, `realistic` (227 garments), `large` (~1,360), `edge`.
