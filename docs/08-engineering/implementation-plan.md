# Implementation Plan

The build order, with what "done" means at each step. Phases map to
`docs/01-product/roadmap.md`; tasks map to `tasks/`.

**Rule:** a phase is not complete until it satisfies
[definition-of-done.md](definition-of-done.md).

---

## Phase 0 — Foundation

**Goal:** a signed-in user sees an empty closet on a real device, and CI is green.

```text
0.1  Monorepo: apps/mobile, apps/api, apps/worker, packages/{types,taxonomy,ai,ui}
0.2  Expo app boots on the iOS Simulator; tab navigation shell
0.3  API skeleton: route → validation → authorization → service → repository
0.4  Postgres + migration runner + seed command
0.5  Managed auth: Apple, Google, email; token handling in the keychain
0.6  packages/taxonomy generated from docs/04-data/taxonomy.md
0.7  packages/ui: tokens from docs/02-design/design-system.md
0.8  Environments: local, dev, staging, production
0.9  CI: typecheck, lint, unit, integration, api, database, security, build
0.10 Analytics + error reporting, with redaction in place from day one
```

**Exit criteria**
- Sign in on a device, land on an empty Home with the correct empty state.
- A cross-user request returns 404 in a test.
- The log redactor passes its fixture suite.
- CI green end to end.

---

## Phase 1 — Closet core

**Goal:** a garment can be created manually and browsed beautifully.

```text
1.1  garments, garment_images, garment_sources, brands, categories + RLS
1.2  Private object storage + signed URL issuance + derivative pipeline
1.3  GET/POST/PATCH/DELETE /garments with filters and cursor pagination
1.4  Closet grid: two columns, FlashList, skeletons, empty state
1.5  Garment detail (SSENSE reference)
1.6  Manual add + edit
1.7  Favourite, status change, archive — optimistic with undo
1.8  Category chips + filter sheet with live count
```

**Exit criteria**
- 220-garment seed closet scrolls at 60 fps.
- Every state from `states-and-errors.md` implemented on Closet and Detail.
- VoiceOver pass on both screens.

---

## Phase 2 — Photo capture

**Goal:** photograph a dress → it appears in the closet as a clean cutout.

```text
2.1  Camera screen (garment mode), full-screen, minimal chrome
2.2  Local-first capture + upload queue surviving app kill
2.3  Direct-to-storage upload with scoped keys
2.4  image.process worker: derivatives, blurhash, perceptual hash
2.5  Segmentation + quality gate + canonical image selection
2.6  Optimistic "analyzing" tile in the closet
2.7  Photo library import, incl. iOS limited selection
```

**Exit criteria**
- Capture → visible in closet < 1 s (PERF-3).
- Segmentation failure keeps the original and still creates the garment.
- Airplane-mode capture uploads on reconnect.

---

## Phase 3 — Garment intelligence

**Goal:** photographing a garment fills in category, colour and often brand, with
confidence surfaced honestly.

```text
3.1  packages/ai capability interfaces + provider config (ADR 0002)
3.2  Validation → taxonomy clamp → confidence normalization pipeline
3.3  garment.analyze worker
3.4  garment_attributes with per-field provenance and confidence
3.5  AI Item Review screen (ticks, questions, empty tappable rows)
3.6  Correction flow; user values win permanently
3.7  Product matching (barcode, SKU, URL) + cache
3.8  Evaluation harness + the 200-garment dataset baseline
```

**Exit criteria**
- Category accuracy ≥ 0.95, brand precision without a tag ≥ 0.95.
- Calibration error ≤ 0.10.
- A malformed provider response degrades to category-only, with no data loss.
- No form of empty fields is ever shown (CAP-2).

---

## Phase 4 — Bulk existing-closet import

**Goal:** a user with 200 garments makes real progress in one sitting.

```text
4.1  Tag camera mode + barcode detection
4.2  OCR + tag reading + merge precedence
4.3  Receipt capture (edge detection) + PDF/screenshot input
4.4  receipt.parse worker + totals reconciliation
4.5  Multi-item confirmation list
4.6  Duplicate detection: signals, scoring, thresholds
4.7  Duplicate resolution sheet + merge semantics + garment_duplicates
4.8  Evaluation: tags, receipts, duplicate pairs
```

**Exit criteria**
- Receipt line-item recall ≥ 0.93.
- Duplicate precision ≥ 0.95 at the 0.90 threshold.
- Interruption rate ≤ 8 sheets per 100 additions.
- A tag scan never dead-ends.

---

## Phase 5 — Search

**Goal:** "black dresses" and "things that still have tags" both work.

```text
5.1  pgvector + garment_embeddings + HNSW indexes
5.2  embedding.generate worker (batched)
5.3  Query interpretation capability
5.4  Structured + semantic merge, with filters as hard constraints
5.5  Search screen with interpretation chips
5.6  Filter sheet completion (colour swatches, brand search, status)
5.7  Evaluation: 100 labelled searches
```

**Exit criteria**
- Recall@10 ≥ 0.90; false-inclusion ≤ 0.01.
- Semantic search p95 < 800 ms.
- Interpretation chips are removable and re-run the search.

---

## Phase 6 — Outfits

**Goal:** the user can compose and save a look.

```text
6.1  outfits, outfit_items + slot rules
6.2  Outfit builder with slot-filtered closet
6.3  Looks library (Pinterest masonry) with four tabs
6.4  Look detail with tappable constituent garments
6.5  wear_events + derived worn_count / last_worn_at
```

**Exit criteria**
- Dress/top+bottom exclusivity works and is overridable.
- Marking a look worn creates wear events for every garment.

---

## Phase 7 — Mira stylist

**Goal:** "dinner downtown tonight" returns three wearable looks from owned
clothes. **The first moment Mira is worth opening daily.**

```text
7.1  Eligibility filter + candidate set construction
7.2  Outfit generation with constrained ids + validation
7.3  Mira tab (prompt, vibe, priority) — not a chat UI
7.4  Generating state that assembles pieces
7.5  Swipeable outfit results
7.6  Swap-one-item sheet
7.7  Home "today's look"
7.8  recommendations persistence + evaluation on 100 requests
```

**Exit criteria**
- **Hallucinated garment rate = 0.00** and **ineligible garment rate = 0.00**.
- Occasion appropriateness ≥ 0.85.
- Closet-too-small case returns partial looks with `missing_slots`, honestly.

---

## Phase 8 — Purchase automation

**Goal:** the closet stays current with near-zero effort.

```text
8.1  Privacy explainer + OAuth + encrypted token storage
8.2  email.scan worker: metadata filter, classification, extraction
8.3  purchase_candidates + idempotent scan cursor
8.4  purchase.match worker
8.5  Purchase discovery + review screens
8.6  Status transitions; only confirmed_owned creates a garment
8.7  Notifications for new purchases
8.8  Opt-in auto-import behind its five conditions, with 30-day undo
8.9  Evaluation: 100 purchase emails incl. negatives
```

**Exit criteria**
- False purchase detection ≤ 0.01; auto-import precision ≥ 0.99.
- Disconnect is one action and offers deletion.
- Injection fixtures produce data, never a status change.

---

## Phase 9 — Wardrobe intelligence

```text
9.1  Insight computations: forgotten, never worn, tags attached, most loved
9.2  Similar-owned detection surfaced outside capture
9.3  Cost per wear + closet value
9.4  Wardrobe insights screen as fashion content
9.5  Wear history calendar
9.6  Home rediscovery cards
```

**Exit criteria**
- No screen in this phase reads as a dashboard.
- Insights degrade gracefully on a small or new closet.

---

## Phase 10 — Virtual try-on

```text
10.1  body_profiles + private bucket + biometric gate
10.2  Guided body capture with honest copy (TRY-2)
10.3  tryon capability + provider evaluation on garment fidelity
10.4  tryon.generate worker + fingerprint cache
10.5  Try-on result screen (full-bleed + glass panel)
10.6  Compare mode
10.7  Deletion paths: body image, generation, cache invalidation
10.8  Evaluation: 50 combinations, human-rated
```

**Exit criteria**
- **Garment fidelity ≥ 4.2**, identity consistency ≥ 4.0.
- Deleting a body image hard-deletes derivatives and invalidates the cache.
- Nothing about try-on implies guaranteed fit.

---

## Phase 11 — Personalization

```text
11.1  Style preference capture + editing
11.2  Feedback signals: saves, wears, swaps, regenerations
11.3  Preference learning influencing candidate construction and ranking
11.4  Outfit ranking improvements
11.5  Evaluation: acceptance rate over time
```

**Exit criteria**
- Stylist acceptance rate improves against the Phase 7 baseline.
- Personalization never overrides an explicit user constraint.

---

## Sequencing rules

1. **Inventory before try-on.** Phase 10 does not start early, however good the
   demo would be.
2. **Capture before intelligence.** Phases 2 and 4 remove more friction than any
   Phase 3 model improvement.
3. **Search before stylist.** Phase 5 is the stylist's retrieval foundation.
4. Security tests and redaction exist from Phase 0, not retrofitted.
5. Every phase updates `tasks/` and the specs it changes.
