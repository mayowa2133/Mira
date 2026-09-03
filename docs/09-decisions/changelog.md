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
