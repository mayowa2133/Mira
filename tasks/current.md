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

## Phase 3 status

| # | Task | Status |
| - | ---- | ------ |
| 3.1 | packages/ai capability interfaces + provider config | **Done** — interfaces and stub; no real provider configured |
| 3.2 | Validation → taxonomy clamp → confidence normalization | **Done** (D-021) |
| 3.3 | garment.analyze worker | **Done** — verified on real captures |
| 3.4 | garment_attributes with per-field provenance and confidence | **Done** (D-022) |
| 3.5 | AI Item Review screen | **Done** — not yet seen on a simulator |
| 3.6 | Correction flow; user values win permanently | **Done** |
| 3.7 | Product matching (barcode, SKU, URL) + cache | **Not started** |
| 3.8 | Evaluation harness + 200-garment dataset baseline | **Harness done; dataset absent** |

### Exit criteria — none can be claimed yet

- [ ] **Category accuracy ≥ 0.95, brand precision without a tag ≥ 0.95**
- [ ] **Calibration error ≤ 0.10**

  Both need a real vision provider AND the 200-photograph dataset. Neither
  exists: the pipeline runs against a stub that returns a fixed answer, so any
  number it produced would describe the stub. `npm run evaluate` deliberately
  exits non-zero with "NOT RUN — this is not a pass" rather than reporting a
  metric it could not measure.

- [x] **A malformed provider response degrades to category-only, with no data
      loss** — a response that cannot be parsed is retried once and then falls
      back to category-only; one out-of-taxonomy value is dropped and the rest
      of the response survives (D-021).
- [x] **No form of empty fields is ever shown (CAP-2)** — the review screen
      renders a tick, a statement, a question or an empty row per field
      according to its band, and the rules are unit-tested.

### What is blocking the rest

**No vision provider.** 3.1's interfaces and config are in place and the stub
exercises the whole path, but nothing is wired to a real model. That needs a
provider choice, a key, and a cost decision — and until it exists the accuracy
bars cannot be approached, let alone claimed.

**No evaluation dataset.** 200 garment photographs, consented. Q-14 in
`open-questions.md` — how consent for evaluation use is captured — is still
open and should be settled before images are collected, not after.

**3.7 product matching** needs a real catalogue or retailer integration to
match against. The routing seam (barcode, SKU, product URL) is where it
attaches; nothing about it is built.

**No segmentation provider**, so cutouts never happen and every garment keeps
its original as canonical. The quality gate and the fallback are implemented
and tested; only the provider is missing.

## Phase 6 status

| # | Task | Status |
| - | ---- | ------ |
| 6.1 | outfits, outfit_items + slot rules | **Done** |
| 6.2 | Outfit builder with slot-filtered closet | **Done** — not yet exercised on device |
| 6.3 | Looks library (masonry) with four tabs | **Done** — verified on simulator |
| 6.4 | Look detail with tappable garments | **Done** — not yet exercised on device |
| 6.5 | wear_events + derived worn_count / last_worn_at | **Done** — verified end to end |

### Exit criteria

- [x] **Dress/top+bottom exclusivity works and is overridable** — the builder
      warns; the database does not refuse. A test saves a dress-over-top look
      and expects 201, because taxonomy §14 says that is a real outfit.
- [x] **Marking a look worn creates wear events for every garment** — verified
      on real data: one look event plus one per piece, with the look counted
      once and each garment counted once.

Only the Looks library has been seen on a simulator. The builder and look detail
typecheck and their API is tested, which this session has repeatedly shown is
weak evidence.

## Phase 9 status

| # | Task | Status |
| - | ---- | ------ |
| 9.1 | Insight computations | **Done** — verified on the real closet |
| 9.2 | Similar-owned detection | **Done** — `GET /wardrobe/similar-owned` and a section on the insights screen |
| 9.3 | Cost per wear + closet value | **Done** |
| 9.4 | Wardrobe insights screen | **Done** — verified on simulator |
| 9.5 | Wear history calendar | **API done**; the calendar screen is not built |
| 9.6 | Home rediscovery cards | **Done** — verified on simulator |

### Exit criteria

- [x] **Insights degrade gracefully on a small or new closet** — every rule can
      decline, and a closet under 12 pieces is told nothing at all. Home shows
      "Keep building your closet" under 10 (§13).
- [~] **No screen in this phase reads as a dashboard** — a judgement no test can
      settle. What is held structurally: the numbers are collapsed until asked
      for, rails lead with a sentence, and Home has no counts-first block.

## Phase 4 status (partial — duplicate detection only)

| # | Task | Status |
| - | ---- | ------ |
| 4.1 | Tag camera + barcode detection | **Not started** |
| 4.2 | OCR + tag reading | **Not started** — needs a vision provider |
| 4.3 | Receipt capture | **Not started** |
| 4.4 | receipt.parse worker | **Not started** — needs a vision provider |
| 4.5 | Multi-item confirmation list | **Not started** |
| 4.6 | Duplicate detection: signals, scoring, thresholds | **Done** — eight of nine signals; the ninth needs Phase 5 embeddings |
| 4.7 | Duplicate resolution sheet + merge + garment_duplicates | **Done** — API and sheet |
| 4.8 | Evaluation: tags, receipts, duplicate pairs | **Duplicates done**; tags and receipts need a vision provider |

### What duplicate detection does NOT yet cover

**The photo path.** `POST /imports/photo` keeps its exact-hash guard and nothing
more, because at capture a photo import has category `other`, no brand, no name
and no hash — the hash is computed by the worker. The weighted check happens
later and surfaces as "You might already own this" (D-026). Read that as a
documented difference from the manual path, not as coverage.

**Visual embedding similarity**, which is the one signal in §2 that needs a
model. The combination is additive, so it drops in when Phase 5 produces
embeddings without moving a threshold.

**Measured, on a synthetic set.** `npm run evaluate:duplicates` runs 50
duplicate pairs and 50 similar-but-different pairs (§7):

| Metric | Target | Result |
| ------ | ------ | ------ |
| Precision @0.90 | ≥ 0.95 | **1.00** |
| Recall @0.70 | ≥ 0.90 | **0.88** — see D-029 |
| False-duplicate rate | ≤ 0.05 | **0.04** |
| Noticed at all (≥0.50) | — | 0.96 |

The dataset is synthetic and was authored alongside the scorer, so it measures
internal consistency and guards regressions — it is NOT evidence of accuracy on
real wardrobes. It earned its place immediately: the false-duplicate rate was
**48%** on the first run, which is what produced D-028.

Recall is short of target and is recorded rather than tuned away: the set
contains pairs whose evidence is identical to pairs in the negative set, so no
threshold separates them (D-029). Closing it needs visual embedding similarity,
which arrives with Phase 5.

## Phase 9.2 — done

`GET /wardrobe/similar-owned` and a section on the insights screen. No
closet-size gate, unlike the other insights: those are statistical claims about
a wardrobe, this is a fact about two specific garments.

## Gotchas worth keeping

**Editing an XCUITest used to test the previous version.** `e2e/MiraUITests/`
was COPIED into the generated `ios/` at prebuild time, so a test edited and run
without re-running prebuild compiled the old file — passing, or failing for a
reason already fixed, with nothing saying the source under test was not the
source on disk. They are symlinks now (`plugins/withUITestTarget.js`).

**A running API can be several commits behind.** `npm run api` serves `dist/`;
without a rebuild and restart, an endpoint added minutes ago returns 404 and
the obvious conclusion is that the routing is wrong. This has now cost time
twice.

## Task 0.5 — auth and onboarding (partial)

| Piece | Status |
| ----- | ------ |
| `POST /auth/session` | **Done** — idempotent bootstrap, returns the user and closet, never a token |
| `PATCH /auth/me` | **Done** — `onboarding_state` only |
| `POST /auth/refresh` | **Done**, delegated — 503 until a provider is configured |
| `DELETE /auth/session` | **Done**, delegated — 503 until a provider is configured |
| `DELETE /auth/account` | **Done** — 202, recorded in `account_deletions` |
| Onboarding §1–5 | **Screens done** — welcome, value, account, build-your-closet |
| Launch routing | **Done** — verified both ways on the simulator |
| The deletion worker | **Not built** — the request is recorded, nothing acts on it |
| Apple / Google / email sign-in | **Not built** — needs a configured provider |

### What is NOT done, plainly

**Nobody can actually sign in.** The three options on §4 fail with an inline
message, because the provider SDKs and a configured Supabase project are the
other half of 0.5. The screen offers "Look around first" so onboarding is not a
wall, and the app still runs on the dev token in `apps/mobile/.env`.

**A deletion request is recorded and then nothing happens.** `DELETE
/auth/account` writes to `account_deletions` and revokes sessions; the ordered
teardown in `data-retention.md` needs a worker that does not exist. Until it
does, an account can ask to be deleted and will not be.

**§1's splash is not a screen.** The launch decision happens in the root layout
rather than behind a wordmark with a 900 ms budget. The routing is right and
verified; the presentation is not built.

0.5's exit criterion — "sign in on a device, land on an empty Home" — cannot be
claimed while the first half of that sentence is impossible.

## Where the AI-free work stands

**57 of 59 AI-free tasks (97%).** 58.5 of the whole 89-task plan (66%).

Everything buildable without a provider is built. What remains needs you:

| Task | What it needs |
| ---- | ------------- |
| 0.5 | A Supabase project. Endpoints, screens and routing are done; **nobody can sign in** until one exists (D-032) |
| 0.8 | Somewhere to deploy. The env config supports four environments; none are hosted |
| 8.1 | Google OAuth credentials for email scanning |

### What "done" means for the last twelve

They were built knowing they are **inert** — the concern is recorded above and
was overruled deliberately. Each one ends by saying what it cannot do yet rather
than looking finished:

- **Tag scan** reads barcodes for real; reading the label's words is 4.2 and
  needs a vision provider. A found barcode is carried into the form as an
  identifier, not as an understanding.
- **Receipt capture** saves the image and says outright that Mira cannot read it
  yet. The confirmation list and totals reconciliation are built and tested
  against fixtures; nothing produces real lines until 4.4.
- **Purchase review** is complete and works on real candidates — but nothing
  creates candidates until `email.scan` (8.2) exists. Its empty state says so
  rather than implying the account is empty.
- **Body profile** stores height, sizes and preferences, and deletes hard. The
  photo slots say "Phase 10" rather than opening a camera that leads nowhere.
- **Feedback signals** read saves and wears from where they already live; swaps
  and regenerations have a schema and a writer but no emitter until Phase 7,
  and the API says which is which (D-034).

### Exit criteria still open on work marked done

- **1.x** — the 60 fps claim rests on a duration metric, not a frame rate.
- **4.8** — duplicate recall is 0.88 against a 0.90 target (D-029).
- **0.5** — "sign in on a device" is impossible today.
- **10.2** — partly closed 2026-09-05. `expo-local-authentication` is linked and
  the app launches; the Face ID gate itself has still not been exercised on a
  device, because nothing can navigate to the body profile without a session.

## The design pass — 2026-09-05

Not a numbered task. It came out of the question "is it too plain?", and the
honest answer was that the app was not plain, it was **unfinished in specific
places** — so those were finished. See D-035, D-036.

What was found by looking rather than by reading:

- **The app did not launch at all.** `expo-local-authentication` was in
  `package.json` but never linked, and expo-router eagerly loads every route
  file at startup, so one screen's module-scope import took down the whole app.
  Structural lesson worth keeping: a missing native module in ANY route is a
  total failure, not a broken screen.
- **Five placeholder tab icons**, documented as "replaced in Phase 1", still
  there on every screen in the app.
- **Emoji standing in for icons** on onboarding and the Add sheet — the first
  screens a new user sees.
- **"Phase 8" and "Q-08"** rendered in the You screen.
- **No typeface at all.** No `assets/fonts`, no `fontFamily` anywhere.

Two of the six items on my own list were WRONG, checked against the specs, and
corrected rather than built: "237 pieces" is `screen-specs.md` §14 verbatim, and
a count inside a sentence is explicitly permitted by §13. The garment tile was
already full-bleed; the grey read as card chrome was the seed artwork's own
ground.

Two changes would have failed **silently** and are the ones worth remembering:

- `fontWeight` selects nothing on iOS once `fontFamily` names a custom face, so
  every heading would have rendered as body copy with no error and no failing
  test. Resolved centrally in `src/ui/Text.tsx`, enforced by
  `no-restricted-imports`.
- `colorDark` spreads `...color`, so an ink accent would have painted a
  near-black selected chip onto a near-black ground.

Seed imagery was rebuilt in the same pass — shaded rather than flat-filled, with
a contact shadow and per-garment variation, still drawn and still deterministic
(`seed-data.md`). Stock photography was considered and declined: it would cost
the determinism `seed-data.md` buys deliberately, and both sources need an API
key. Two seed NAME bugs surfaced once the images stopped being the worst thing
on the tile — `other` used as a product noun, and near-duplicates named by
appending a word.

## Known flakes

### ~~Worker suite — one unexplained failure in ~10 runs~~ — EXPLAINED 2026-09-04

The self-explaining logger paid for itself: on the next occurrence the failure
named its cause, `unsupported_image_undecodable` on a photograph that was
definitely decodable.

Job claiming is global by design, and the tests shared a database with
development. A test seeds a capture and a locally running worker claims it
first, reads the key against the API's storage root instead of the test's temp
directory, finds nothing, and fails the job permanently. The test then sees one
image row where it expected two.

Rare because the window is one poll interval, which is why it survived ten
runs. Fixed by giving integration tests their own database
(`npm run db:test:setup`, `mira_test`) rather than by making the race less
likely. Verified: the full suite passes three times with a worker live on the
development database, and no test user is created there any more.

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
