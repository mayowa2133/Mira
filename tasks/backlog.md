# Backlog

Work that is specified but not yet ready to start, grouped by phase. Detail lives
in `docs/08-engineering/implementation-plan.md`.

Pull from here into `current.md` only when the previous phase's exit criteria are
met.

---

## Phase 1 — Closet core
Garment schema and storage · private buckets and signed URLs · garments CRUD with
filters · two-column closet grid · garment detail · manual add and edit ·
favourite, status, archive · category chips and the filter sheet.

## Phase 2 — Photo capture
Garment camera · local-first capture queue · direct-to-storage upload ·
derivatives and hashes · segmentation with a quality gate · "analyzing" tiles ·
photo library import with iOS limited selection.

## Phase 3 — Garment intelligence
AI capability interfaces · validation, clamping and confidence normalization ·
`garment.analyze` worker · per-field provenance · AI Item Review · correction
flow · product matching and cache · evaluation harness and the 200-image baseline.

## Phase 4 — Bulk existing-closet import
Tag camera and barcode detection · OCR and tag reading · receipt capture and
parsing · totals reconciliation · multi-item confirmation · duplicate detection
signals and thresholds · duplicate resolution sheet and merge semantics.

## Phase 5 — Search
pgvector and embeddings · batched embedding generation · query interpretation ·
structured + semantic merge · search screen with interpretation chips · full
filter sheet · relevance evaluation.

## Phase 6 — Outfits
Outfit data model and slot rules · outfit builder · Looks masonry with four tabs ·
look detail · wear events and derived wear values.

## Phase 7 — Mira stylist
Eligibility filtering · candidate set construction · constrained generation and
validation · Mira tab · assembling generation state · swipeable results ·
swap-one-item · Home "today's look" · stylist evaluation.

## Phase 8 — Purchase automation
Privacy explainer and OAuth · encrypted token storage · `email.scan` worker ·
purchase candidates with an idempotent cursor · `purchase.match` · discovery and
review screens · status transitions · notifications · opt-in auto-import with
30-day undo.

## Phase 9 — Wardrobe intelligence
Insight computations · similar-owned surfacing · cost per wear and closet value ·
insights screen as fashion content · wear history calendar · Home rediscovery.

## Phase 10 — Virtual try-on
Body profiles and the private bucket · biometric gate · guided body capture ·
try-on capability and provider evaluation · generation worker and fingerprint
cache · result screen · compare mode · deletion paths.

## Phase 11 — Personalization
Style preference capture · feedback signals · preference learning in candidate
construction and ranking · outfit ranking · acceptance-rate evaluation.

---

## Unscheduled

Specified or discussed, not yet placed in a phase:

- Android support (`apps/mobile` is cross-platform; verification is iOS-first)
- Dark mode design pass (tokens exist — see Q-08)
- Outfit planning for a future date (Q-04)
- Retailer integrations (A-16 — email covers V1)
- Product URL import polish (the endpoint exists from Phase 3)
- Data export UI (`You → Privacy & data`)
- Bulk actions on purchase candidates ("everything from this retailer" — A-03)
- Re-analysis policy when models improve (Q-11)

## Explicitly not planned

See `docs/01-product/non-goals.md`. Do not add social features, a marketplace, a
public closet, or a shopping-first recommendation engine to this backlog.
