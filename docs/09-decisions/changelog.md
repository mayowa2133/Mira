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
