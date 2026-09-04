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
| 1.6 | Manual add + edit | **Done** — add form verified on device; edit shares the same component |
| 1.7 | Favourite, status change, archive — optimistic with undo | **Done** — favourite verified under XCUITest |
| 1.8 | Category chips + filter sheet with live count | **Done** — sheet, live count and applied chips verified under XCUITest |

### Exit criteria

- [ ] **220-garment seed closet scrolls at 60 fps** — partially verified.
      `ClosetScrollTests` now flicks the real grid and harvests the
      `Scroll_Deceleration` signpost: 2.430 s, relative standard deviation
      0.284% over five passes. That is a **duration**, not a frame rate — it
      is a regression baseline (a stall lengthens it), not proof of 60 fps.
      A true frame-rate check needs an animation hitch metric; until then
      this criterion stays open.
- [x] Every state from `states-and-errors.md` implemented on Closet and Detail —
      loading, empty, filtered-empty, error, offline and not-found are all
      implemented. The empty and populated states have now been seen; the
      error, offline and filtered-empty states have not.
- [x] **VoiceOver pass on both screens** — `performAccessibilityAudit` runs on
      the closet, garment detail, the add menu and the filter sheet, covering
      contrast, element detection, hit regions, element descriptions, clipped
      text and traits. All pass. It found a real defect (see D-016). The
      human rotor pass in `accessibility.md` §10 still stands as a release
      ritual — an audit cannot hear whether a screen makes sense.

## Phase 2 — verified on device 2026-09-03

Capture works end to end on an iPhone 17 Pro simulator against the real stack.
Evidence, rather than "it builds":

- `POST /media/upload-url` 200 → `PUT /media/upload/*` 204 → `POST /imports/photo`
  202 in the API log, and `photo_library` garments in `analyzing` state in the
  database.
- The closet shows 228 pieces, up from the 227-garment seed, with the imported
  photograph rendering from real uploaded imagery.
- 17 XCUITests pass, including two new capture tests.

**Not covered:** the shutter itself. The simulator has no camera, so
`takePictureAsync` is unexercised — the capture tests reach the same code path
through the photo library. Real-device capture remains a manual check.

## Phase 2 status

| # | Task | Status |
| - | ---- | ------ |
| 2.1 | Camera screen, full-screen, minimal chrome | **Done** — verified under XCUITest |
| 2.2 | Local-first capture + upload queue surviving app kill | **Done** — offline→reconnect verified end to end |
| 2.3 | Direct-to-storage upload with scoped keys | **Done** (Phase 1 shipped it; the PUT was broken until Phase 2) |
| 2.4 | image.process: derivatives, blurhash, perceptual hash | **Done** — served to the client |
| 2.5 | Segmentation + quality gate + canonical selection | **Code done**; no segmentation provider yet, so the stub returns null and the original stays canonical |
| 2.6 | Optimistic "analyzing" tile | **Done** — verified offline, where it matters most |
| 2.7 | Photo library import, incl. iOS limited selection | **Done** — limited selection is a supported mode, not an error |

### Exit criteria

- [x] **Capture → visible in closet < 1 s (PERF-3)** — the tile renders from the
      local file, so it does not wait on the network at all. Verified with the
      API stopped.
- [x] **Segmentation failure keeps the original and still creates the garment** —
      every failure path is tested independently (provider down, provider
      returns nothing, cutout fails the gate, all derivative writes fail).
- [x] **Airplane-mode capture uploads on reconnect** — verified on device:
      API stopped, photo captured, API restored, app relaunched, closet went
      234 → 235 with no user action
      (`apps/mobile/scripts/verify-offline-capture.sh`).

**Not covered:** the shutter. The simulator has no camera, so
`takePictureAsync` is unexercised; the tests reach the same code path through
the photo library. Real-device capture remains a manual check.

## Known flakes

### Worker suite — one unexplained failure in ~10 runs

`promotes an accepted cutout to canonical` failed once during a full `verify`
with "1 row, expected 2", and has passed 10 consecutive runs since, including
six back to back. The symptom means `recordResult` threw and rolled back, but
the runner's error was discarded by a silent test logger.

Not claimed as fixed. The logger now records what the runner reported and
assertions include it, so a recurrence will explain itself instead of costing
another investigation.

## Blocked

### ~~B-5 — No queue transport between API and worker~~ — CLEARED 2026-09-03

The worker claims from `ingestion_jobs` with `for update skip locked`, rather
than a separate broker. That table already exists as the user-visible mirror of
the queue (REL-3), it is written in the same transaction as the garment, and a
broker that can disagree with the job list the user is shown is a bug waiting to
happen. Revisit if throughput ever needs more than Postgres can claim.

Verified against real captures: 6 queued jobs → 6 complete, 0 failures, 12
derivative files, width/height/blurhash and a 16-character perceptual hash
recorded on every image. Segmentation has no provider yet, so the stub returns
null and the original stays canonical — a specified path, not a failure.

Derivatives are now served: migration 0005 adds `thumb_key`/`medium_key`, the
worker records them, and the API returns `thumb_url`/`medium_url` — each signed
for the requesting user, because a derivative is exactly as private as the
photograph it came from. The grid uses the 400px thumb and detail the 1080px
medium; the original is kept for re-analysis and try-on, not for display.

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

### ~~B-3 — /add/manual navigation~~ — RESOLVED 2026-09-03

Not a product bug. Tapping `+ Add → Add manually` by hand opens the form, so
routing is fine. The fault was the verification harness: `useDevInitialRoute`
fired `router.replace` on a 400ms timer, which worked for routes declared as
`<Stack.Screen>` and silently did nothing for nested ones. It now waits on
`useRootNavigationState()`, which is the actual condition — and the add form
then renders (`docs/02-design/verification/04-add-manual.png`).

Worth remembering: a verification tool that fails quietly will be mistaken for
the thing it is verifying.

### ~~B-4 — Gestures cannot be automated here~~ — CLEARED 2026-09-03

An XCUITest target (`apps/mobile/e2e/`) now drives real taps, swipes and flicks
against the running app. It is injected by a config plugin
(`plugins/withUITestTarget.js`) so it survives `expo prebuild` regenerating
`ios/`.

13 tests: accessibility audits on four screens, filter-sheet behaviour, scroll
paging, grid columns, and a hierarchy dump for diagnosis.

It earned its place immediately by finding a defect nothing else could:
**the favourite control on a closet tile was unreachable with VoiceOver.**
Because the tile is one accessibility element (as `accessibility.md` §4
requires), iOS folded the nested favourite `Pressable` into it. Touch worked, so
the bug was invisible without a screen reader. Fixed as a custom action (D-016).

Two lessons worth keeping:

- The first version of the suite was **vacuous**. `garmentTiles` matched "any
  button whose label contains a comma", and React Navigation labels its tab
  buttons "Closet, tab, 2 of 5" — so the query returned five tabs on every
  screen and the tile assertions passed with no garments rendered. `closetGrid`
  was `scrollViews.firstMatch`, which is the horizontal category chip row, so
  the scroll test was flicking the wrong view.
- A metric can fail loudly for the wrong reason. `scrollDecelerationMetric`
  threw `Invalid parameter not satisfying: _data` because `stopMeasuring()` was
  called the moment the flick gesture returned — deceleration happens after
  that, so no signpost ever landed in the window.

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
