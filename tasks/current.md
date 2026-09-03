# Current

**Phase:** 1 — Closet core (in progress)
**Updated:** 2026-09-03

`npm run verify` is green: typecheck, format, lint and **335 tests**, including
33 integration tests against a real Postgres 16 + pgvector and 41 covering the
React-free form and filter logic.

---

## Phase 1 status

| # | Task | Status |
| - | ---- | ------ |
| 1.1 | garments, garment_images, garment_sources, brands, categories + RLS | **Done** |
| 1.2 | Private object storage + signed URL issuance | **Done** (local driver; S3 driver when infra exists) |
| 1.3 | GET/POST/PATCH/DELETE /garments with filters and cursor pagination | **Done** |
| 1.4 | Closet grid: two columns, FlashList, skeletons, empty state | **Written, not visually verified** (B-2) |
| 1.5 | Garment detail (SSENSE reference) | **Written, not visually verified** (B-2) |
| 1.6 | Manual add + edit | **Done** (code); not visually verified (B-2) |
| 1.7 | Favourite, status change, archive — optimistic with undo | **Partial** — favourite and status are optimistic; the undo snackbar is still to build |
| 1.8 | Category chips + filter sheet with live count | **Done** (code); not visually verified (B-2) |

### Exit criteria

- [ ] **220-garment seed closet scrolls at 60 fps** — cannot be measured without
      a simulator (B-2). The API side is fast: every list, filter and sort query
      is p95 < 6 ms against the 227-garment seed.
- [x] Every state from `states-and-errors.md` implemented on Closet and Detail —
      loading, empty, filtered-empty, error, offline and not-found are all
      implemented, on the grid, detail, add and edit screens. Not yet *seen*.
- [ ] **VoiceOver pass on both screens** — blocked on B-2.

## Blocked

### B-2 — No iOS Simulator on this machine

`xcode-select -p` points at `/Library/Developer/CommandLineTools`; full Xcode is
not installed, so `simctl` does not exist.

`AGENTS.md` requires visual verification in the iOS Simulator before a screen is
considered complete, so **1.4, 1.5 and 1.7 are not done by Mira own standard**,
however well they typecheck.

**To unblock:** install Xcode, then

```bash
sudo xcode-select -s /Applications/Xcode.app
npm run mobile   # then press i
```

## Next

1. Clear B-2 and verify Closet, Garment detail, the add/edit form and the filter
   sheet visually and with VoiceOver.
2. 1.7 — the undo snackbar for archive and status changes. This is the only
   remaining code gap in Phase 1.

Everything in 1.6 and 1.8 was verified against the running API: creating a
garment from the exact payload the form emits, editing it, the server rejecting
`source_type` with `immutable_field`, rejecting `dresses/heels` with
`subcategory_mismatch`, and every filter combination's live count matching its
actual result set (including multi-value OR and explicit laundry).

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
