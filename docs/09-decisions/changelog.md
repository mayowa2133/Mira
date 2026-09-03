# Changelog

Notable changes to Mira's **specifications and product behaviour**. Not a git log.

Add an entry when: a specification changes meaning, the taxonomy changes, an AI
model or prompt changes, an evaluation metric moves materially, or a decision is
recorded.

Format: `## YYYY-MM-DD` then bullets grouped by area.

---

## 2026-09-03

### Repository

- Initialized the Mira repository brain: the full `docs/` specification set,
  `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, `package.json` and
  `tasks/`.

### Product

- Recorded decisions D-001 through D-014 in
  [decisions.md](decisions.md), including: Mira as the product name; existing
  closets as first-class; purchase ≠ ownership; inventory before try-on; private
  by default; AI metadata editable; two-column grid; the Mira tab is not a chat
  interface; confidence shown as treatment rather than numbers; only `active`
  garments in generated outfits; search always returns its interpretation; and
  never guess a brand.
- Defined MVP, MVP+ and Later scope in `docs/01-product/prd.md`.
- Recorded 17 assumptions and 16 open questions.

### Design

- Established the design system: warm ivory ground `#FAF9F7`, near-black text
  `#171717`, dusty rose accent `#C98F8A` used as punctuation only, and the
  40/25/20/15 reference formula (Fashion Nova / SSENSE-Aritzia / Pinterest-LTK /
  Apple).
- Specified all 28 screens, with a per-screen visual reference assignment.
- Added the Visual Implementation Rule to `AGENTS.md`.

### Data

- Published the canonical taxonomy: 11 categories, 75 subcategories, 32 colours
  with swatches, and closed sets for patterns, materials, fit, sleeves,
  necklines, lengths, seasons, occasions, style tags, statuses, sources,
  candidate statuses, image kinds, outfit slots and size systems.
- Published the database schema, including `purchase_candidates` as an entity
  distinct from `garments` (ADR 0003).

### API

- Published `openapi.yaml` (34 paths, 31 schemas) and the API, error and auth
  contracts.
- Established the 404-not-403 rule for cross-user access.

### AI

- Set initial model defaults: `claude-opus-5` for garment and tag understanding;
  `claude-sonnet-5` for receipt structuring, purchase extraction, query
  interpretation and outfit generation.
- Established the five binding AI rules, constrained generation for closet
  references, and the confidence band scheme.
- Defined evaluation datasets and metrics, with hard gates on hallucinated
  garments (0.00), ineligible garments (0.00) and try-on garment fidelity (≥ 4.2).

### Architecture

- ADR 0001 — record architecture decisions.
- ADR 0002 — provider-independent AI layer.
- ADR 0003 — purchase candidates separate from garments.

## 2026-09-03 (later) — Phase 0 scaffolding

### Design

- **Corrected a WCAG AA failure.** `color.textSecondary` was `#77736F`, which is
  4.47:1 on the ivory ground — below the 4.5 required for body text, on the
  token that carries garment metadata across the whole closet. Now `#76726E`
  (4.53:1). The contrast table in `accessibility.md` held estimated ratios that
  were several points off; it now holds computed values, asserted in CI by
  `packages/ui/src/tokens.contrast.test.ts`.
- Clarified that `success` and `warning`, like `accent`, are fills and icons
  only — never text on a light ground. `danger` is the one status colour that
  passes AA as text.

### Engineering

- Phase 0 scaffold landed: npm workspaces monorepo, four packages, three apps,
  CI, and 204 tests. See `tasks/completed.md`.
- `docs/` and `tasks/` are excluded from Prettier. They are hand-authored prose
  containing deliberate ASCII wireframes and fenced value lists that the
  taxonomy generator parses; reflowing them is both diff churn and a
  correctness hazard.
- The taxonomy generator now tolerates a blank line between a label and its
  fenced block, so hand-editing the source cannot silently break generation.

### Decisions

- D-015 — moderate transitive advisories under `expo-router` are accepted; the
  CI audit gate is `high`.

### Engineering (Phase 0, continued)

- Local Postgres and Redis moved to host ports **5433** and **6380**. A
  developer machine frequently already runs these on 5432/6379, and binding the
  defaults either fails or silently shadows theirs. Mira never competes with a
  developer's own services.
- `db:migrate`, `db:seed` and `dev` build before running. Node's
  `--experimental-strip-types` strips types but does not rewrite the `.js`
  import specifiers NodeNext requires, so running the `.ts` entrypoints
  directly cannot resolve their imports.
- SQL migrations are resolved from the package root, not from the calling
  module: they are source, not build output, and `tsc` does not copy them.
- The `scopedQuery` guard now distinguishes reads from writes.
  SELECT/UPDATE/DELETE must filter on `user_id`; an INSERT must name `user_id`
  among its columns, because it has no WHERE clause to filter on. It still
  rejects an ownerless INSERT and still requires a predicate on the SELECT side
  of an `INSERT ... SELECT`.

## 2026-09-03 (Phase 1) — Closet core

### Data

- Migration `0002_closet_core` — garments, garment_images, garment_attributes,
  garment_sources, garment_embeddings, garment_duplicates, brands, categories,
  with indexes, check constraints and RLS on every user-owned table.
- Migration `0003_provenance_append_only` — corrected the `garment_sources`
  trigger. 0002 blocked UPDATE *and* DELETE, which also blocked the cascade from
  `garments` and made deleting a garment impossible. The rule in
  `database-schema.md` is "never updated, never deleted **while the garment
  lives**", so UPDATE is blocked and deletion is governed by the foreign key.
- `categories` is synced from the canonical taxonomy on every `db:migrate`.
  It is reference data, not sample data: `garments.category` has a foreign key
  to it, so a migrated-but-unseeded database could otherwise hold no garments.
- `realistic` seed set: 227 garments (220 + 3 genuine duplicates + 4
  near-duplicates), 24 resolved brands, 33 brand_raw-only pieces, 53 never worn,
  11 with tags attached, 19 forgotten, and every source type represented.

### API

- `GET /closet`, `GET/POST/PATCH/DELETE /garments`, `/garments/count`,
  `/garments/:id/favorite`, `/garments/:id/status`, `/garments/:id/restore`,
  `POST /media/upload-url`, and signed private media reads.
- Keyset pagination throughout. Measured p95 under 6 ms for every list, filter
  and sort against the 227-garment closet.

### Fixes

- **Actor resolution.** `actor.userId` held the identity provider's *subject*,
  not the Mira `users.id`, so every scoped query received a non-uuid. The
  subject is now resolved to a Mira user in the auth layer, exactly as
  `auth-contract.md` specifies, and `providerSubject` is a separate field so the
  two can never be confused again.
- **Cursor precision.** Pagination round-tripped a `timestamptz` through a JS
  `Date`, truncating Postgres microseconds to milliseconds. Rows inside the lost
  window were silently skipped — 2 of 223 on the seeded closet. Cursor keys are
  now taken as text straight from Postgres.
- **Count/list divergence.** `GET /garments/count` did not apply the same
  default visibility as `GET /garments`, so the filter sheet's "Show N items"
  CTA would have promised more than the grid delivered. Both now share one
  `applyDefaults`.
- **Storage filename sanitizer** produced keys its own validator rejected
  (`.._.._evil.jpg`), making those upload targets unusable.
- **Seed arguments** were swallowed twice: npm cannot forward `-- args` through
  a `&&`-chained script, nor through a nested `npm run` without a trailing `--`.

### Engineering

- `FlashList` v2 measures items itself; `estimatedItemSize` no longer exists.
  `coding-standards.md` updated — it described the v1 API.

## 2026-09-03 (Phase 1, continued) — Manual entry and filtering

### Product

- **1.6 Manual add and edit.** Only a category is required; everything else is
  optional, because manual entry is the fallback path and Mira exists to remove
  data entry rather than demand it (CAP-2). Choosing a category clears a
  subcategory that no longer belongs to it, so the user can never construct
  `dresses/heels` and meet a server error for something the UI allowed.
  The edit form sends only changed fields and never `source_type` — provenance
  is immutable (CAP-3).
- **1.8 Filter sheet.** Category, colour, occasion, season and status, applying
  on the CTA rather than on every tap, with a live "Show N pieces" count from
  `/garments/count`. Applied filters remain visible above the grid as
  dismissible chips, each removable in one tap. Colour swatches always carry
  their name, so colour is never the only carrier of meaning (A11Y-4).

### Engineering

- Form state, serialization and filter state live in React-free modules
  (`garment-form.ts`, `filter-state.ts`), so the rules that matter are testable
  without a simulator. 41 tests cover them.
- `apps/mobile` joined the vitest projects.
- Two small correctness details worth naming: an un-ticked filter box omits its
  parameter entirely rather than sending `false` (which would filter to the
  *inverse* set), and `tags_attached` is sent as `null` rather than `false` when
  unticked, because null means "unknown" while false asserts the tags are gone.

## 2026-09-03 (Phase 1, continued) — Undo

### Product

- **1.7 Optimistic changes with undo.** Status changes are now optimistic and
  capture the previous status before writing, because "undo, not confirm" needs
  something to undo *to*. A snackbar offers `Undo` for six seconds; a failure
  rolls back visibly rather than leaving the UI asserting a status the server
  never accepted.
- Archive and status changes get **undo**. Removal gets a **confirmation** that
  names the piece and states it can be restored for 30 days — because
  "deletion confirmations state exactly what is removed and whether it can be
  recovered", and removal is a soft delete.
- Archiving from the detail screen steps back to the closet: the piece is no
  longer in the grid, so staying on a detail view the grid does not list would
  be disorienting.

### Engineering

- `SnackbarProvider` sits above the navigator, so an undo survives the
  navigation that accompanies the action it is undoing.
- The snackbar respects `prefers-reduced-motion`: it keeps the duration and the
  completion feedback, dropping only the movement (A11Y §6). It announces
  politely rather than stealing focus.
- Errors persist until dismissed; there is nothing to "wait out".
- Undo copy and reversal rules live in a React-free `undo.ts`, tested without a
  simulator — a snackbar that says the wrong thing is worse than none, because
  the user acts on it.

## 2026-09-03 (Phase 1) — First run on a simulator

Xcode arrived, so the closet screens were seen for the first time rather than
only typechecked. Screenshots and notes: `docs/02-design/verification/`.

### Verified on device

Home, Closet and Garment detail render against the real stack — Postgres with
the 227-garment seed, the API, and a debug build on an iPhone 17 Pro (iOS 26.5).
Two columns, ivory ground, blush selected chip, three text lines per tile, and a
header count matching the API exactly.

### Fixed

- **Metro could not resolve nested packages.** `metro.config.js` set
  `disableHierarchicalLookup: true`, which stops Metro walking into nested
  `node_modules`. `expo-router` ships its own `expo-glass-effect`, so the app
  failed at runtime with "could not be found within the project". That flag
  suits pnpm layouts, not npm workspaces.
- **Expo Router typed routes disabled** (Q-17): `@expo/cli` hoists its own
  `expo-router@6.0.24` while the app resolves `57.0.18`, and the type generator
  loads the hoisted copy, which lacks `internal/routing`.

### Known-unresolved

`/add/manual` did not navigate under the dev-route harness while other routes
did. It is recorded in `tasks/current.md` as **B-3** and deliberately NOT
written up as a product bug: a harness limitation fits the evidence just as
well, and settling it needs one manual tap. Automated tapping is unavailable
here — `simctl` has none, System Events needs Accessibility permission, and
`idb` taps did not register.

### Also noted

Seed garments have no images, so every tile shows its placeholder. The layout is
verified; "imagery dominates" is not, and cannot be until the seed generates
placeholder imagery as `seed-data.md` already calls for.

## 2026-09-03 (Phase 1) — Seed imagery

### Data

- Seeded garments now carry generated placeholder imagery. Each gets one
  `canonical` image with real dimensions, blurhash and image hash, written
  through the same storage driver the API reads from — so the seeded closet
  exercises the real signed-URL and progressive-load paths rather than a
  shortcut.
- Images are **drawn, not downloaded**: a category silhouette in the garment's
  own taxonomy colour on the `surfaceSunken` ground. `seed-data.md` forbids
  scraped retailer photography and reference screenshots, so generating them is
  the only clean option — and it makes the seed deterministic, which is what
  lets screenshots and performance numbers be compared between runs.
- No image dependency: PNG is written directly and blurhash is a small
  transform. A raster library to draw a dozen rectangles would not have earned
  its place.

### Fixed

- **`STORAGE_LOCAL_ROOT` was resolved against the working directory.** The API
  runs from `apps/api` and the seed from the repository root, so a relative
  default silently gave them two different directories — the seed would write
  images the server could never find. Relative roots now resolve against the API
  package root.
- **Blurhash ran on the full-size image**, which is O(width x height x
  components) — about 6M iterations per garment, minutes across a 227-garment
  seed, for a hash that only describes a blur. It now runs on a 32px
  downsample: 7ms instead of seconds, with a visually identical result.

### Design note

The closet grid could not be judged against Reference 01 until it had imagery.
With placeholders in place it reads as intended: the image dominates each tile
and the metadata supports it. What is still unverified is how the grid handles
REAL photography — varied crops, backgrounds and contrast — which arrives with
photo capture in Phase 2.

## 2026-09-03 (Phase 1) — Add form verified; B-3 was the harness, not the app

`/add/manual` failing to navigate was **not** a routing defect. Tapping
`+ Add → Add manually` by hand opens the form. The fault was
`useDevInitialRoute`, which fired `router.replace` on a 400ms timer — that
happened to work for routes declared as `<Stack.Screen>` and silently did
nothing for nested ones.

It now waits on `useRootNavigationState()`, which is the condition actually
being waited on rather than a guess at how long mounting takes. The add form
renders immediately afterwards.

The lesson worth keeping: a verification tool that fails quietly gets mistaken
for the thing it is verifying. The suspicion was recorded as unresolved rather
than written up as a product bug, which is the only reason no one went looking
for a defect that was never there.

### Verified

The manual add form (task 1.6): a category and nothing else required, and
colour swatches carrying their names, so colour is never the only carrier of
meaning (A11Y-4). The same controls back the filter sheet, so that sheet's
contents are verified even though the sheet itself has not been opened.
