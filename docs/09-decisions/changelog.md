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
