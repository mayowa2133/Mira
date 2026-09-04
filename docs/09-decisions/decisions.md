# Decisions

Product and process decisions, newest last. Architecture decisions live in
`docs/03-architecture/adr/`; an entry here links to its ADR when both apply.

**When you make a decision the specifications did not cover, add it here in the
same change.**

Format:

```md
## D-NNN — Title
- **Date:** YYYY-MM-DD · **Status:** Accepted | Superseded by D-XXX
- **Decision:** what we decided
- **Why:** the reasoning
- **Consequences:** what this makes easy, and what it makes hard
```

---

## D-001 — Product name

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** The product is **Mira**. Tagline: *Your closet. Your stylist. Your
  mirror.*
- **Why:** Short, pronounceable, evokes "mirror" without being literal, and reads
  as a fashion brand rather than a utility.
- **Consequences:** The wordmark is typographic, not illustrative. No AI imagery,
  no sparkles. See `docs/02-design/design-system.md` §1.

## D-002 — Existing closets are first-class

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Mira must support importing clothing owned before installation.
  Bulk import is a core feature, not an onboarding nicety.
- **Why:** The primary persona already owns 150–500 pieces. A product that only
  tracks future purchases is useless to her for a year.
- **Consequences:** Phase 4 (bulk import) and Phase 8 (email) carry more weight
  than they would in a typical closet app. Onboarding's central screen is "Let's
  find what you already own."

## D-003 — Purchase does not imply ownership

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Detected purchases require confirmation unless the user explicitly
  enables automatic importing. Candidates are a separate entity from garments.
- **Why:** Purchases get returned, sold, gifted, and are sometimes not clothing.
  A wrong garment in the closet breaks the one thing Mira must get right, and the
  stylist will then recommend clothes she does not have.
- **Consequences:** Two review surfaces instead of one. Structurally enforced by
  ADR 0003 rather than by remembering a rule.

## D-004 — Multiple ingestion methods

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Mira supports photos, tags, receipts, email detection and future
  retailer integrations. Manual entry always exists and is always last.
- **Why:** No single method covers a real wardrobe. Email covers online history;
  photos cover everything bought in a store years ago.
- **Consequences:** Duplicate detection must run on every path (CAP-5), and every
  path must degrade rather than dead-end (CAP-4).

## D-005 — Inventory before virtual try-on

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** The closet experience must be excellent before try-on becomes a
  primary engineering focus. Try-on is Phase 10.
- **Why:** Try-on is dramatically more useful with a real closet, clean garment
  images, metadata, saved outfits and preferences behind it. Mira must not become
  a try-on demo with a bad closet product attached.
- **Consequences:** The most demo-able feature is built last. Accepted
  deliberately.

## D-006 — Private by default

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Closets, body profiles and try-on images are private by default.
  There is no public closet in V1.
- **Why:** Mira holds photographs of a person's body and the contents of their
  home. A sharing surface would invert the product's default at exactly the point
  where the data is most sensitive.
- **Consequences:** No social features (`docs/01-product/non-goals.md`). No public
  buckets anywhere in the system.

## D-007 — AI metadata is editable

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Users can correct every AI-generated garment attribute.
  Corrections become evaluation and feedback signals where privacy policy permits.
- **Why:** The model will be wrong. A closet the user cannot fix is a closet she
  stops trusting. Corrections are also the highest-value quality signal Mira has.
- **Consequences:** `garment_attributes` keeps AI and user values separately, so a
  correction never erases what the model said.

## D-008 — Clothing may have multiple images

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** A garment supports many images: canonical, original, cleaned,
  front, back, side, detail, retailer.
- **Why:** Required for better identification, product matching, duplicate
  detection and try-on fidelity.
- **Consequences:** Canonical image selection needs explicit rules
  (`docs/06-ai/image-processing.md` §4), and storage costs more.

## D-009 — Two-column closet grid

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** The closet is two columns, never three. At most three text lines
  per tile.
- **Why:** Clothing is visual. Image size beats density. Three columns turns a
  wardrobe into a spreadsheet with pictures.
- **Consequences:** More scrolling, which is the correct trade. Metadata moves to
  the detail screen.

## D-010 — The Mira tab is not a chat interface

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** The stylist is a prompt field plus vibe and priority chips, with
  full-screen visual results. No message bubbles, no transcript, no avatar.
- **Why:** A chat UI signals "AI tool" and invites conversation where the user
  wants an answer. Mira should feel like a stylist, not a chatbot.
- **Consequences:** Clarifying questions are chips, and are limited to one or two.

## D-011 — Confidence is shown as treatment, never as a number

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Confidence reaches the UI as bands — a tick, no tick, a question,
  or an empty tappable row. Users never see "0.72".
- **Why:** Numbers invite the user to do statistics about her dress. The band
  communicates the only thing that matters: does Mira know this, or is it asking?
- **Consequences:** Calibration becomes a product requirement, not just a model
  metric (`docs/06-ai/evaluation.md` §3).

## D-012 — Only `active` garments participate in generated outfits

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Garments in `laundry`, `lent_out`, `unavailable`, `lost`,
  `returned`, `sold`, `donated` or `archived` never appear in a generated look.
- **Why:** "What should I wear tonight?" is a question about tonight. A dress in
  the wash is a wrong answer, however good the styling.
- **Consequences:** Status hygiene matters, so marking laundry must be one tap
  from the garment tile and the look.

## D-013 — Search always returns its interpretation

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Search responses include what Mira understood, rendered as
  removable chips above the results.
- **Why:** Semantic search is otherwise unfalsifiable from the user's side. She
  cannot tell a bad query from a bad closet. Chips make the interpretation visible
  and fixable in one tap.
- **Consequences:** `interpretation` is a required field in the API contract, not
  an optional debug affordance.

## D-014 — Never guess a brand

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Brand is populated only from a visible logo, a legible label, or a
  matched product. Otherwise it is left empty and tappable.
- **Why:** A wrong brand is worse than no brand, because the user believes it and
  it propagates into search, insights and duplicate detection.
- **Consequences:** Brand precision is weighted far above brand recall in
  evaluation. Many garments will have no brand, which is correct.

## D-015 — Moderate transitive advisories under expo-router are accepted

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** CI gates `npm audit` at `--audit-level=high`. The 20 moderate
  advisories in `expo-router`'s dependency tree (`@react-navigation/*` →
  `query-string` → `decode-uri-component`, and `uuid`) are accepted for now.
- **Why:** `npm audit fix --force` resolves them by **downgrading expo-router
  from v6 to v5**, a breaking downgrade of the navigation layer. Trading a
  current, supported router for a moderate denial-of-service advisory in a URL
  parser — reached only through deep links we do not yet accept — is the worse
  risk.
- **Consequences:** the gate is `high`, not `moderate`, so a genuinely serious
  advisory still fails the build. Revisit when expo-router ships updated
  navigation dependencies; if Mira starts accepting untrusted deep links before
  then, re-evaluate immediately.

## D-016 — A secondary control inside a tile is an accessibility custom action

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Where a tile is a single accessibility element, a secondary
  control inside it (today: favourite on the closet tile) is exposed as an
  `accessibilityAction` on the tile, not as a nested accessible element. The
  inner `Pressable` is explicitly `accessible={false}`. State stays in the tile
  label ("… , Favourited").
- **Why:** `docs/02-design/accessibility.md` §4 requires a tile to read as one
  garment rather than four fragments, so the tile sets its own label and role.
  iOS then folds every descendant into that element — which silently made the
  favourite button unreachable with VoiceOver while remaining tappable by touch.
  A custom action is how iOS resolves exactly this tension (the mechanism behind
  Mail's per-row archive/delete). Making the heart separately accessible would
  fix reachability by breaking §4.
- **Consequences:** XCUITest cannot enumerate custom actions, so the automated
  check asserts the observable half — that no orphaned favourite toggle exists
  on the grid and that favourite state reaches the tile label. That the action
  is wired is a unit-test concern, and the rotor gesture itself stays on the
  manual VoiceOver pass (`accessibility.md` §10). Any future in-tile control
  follows this pattern.

## D-017 — `POST /imports/photo` takes an upload key, not multipart bytes

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** The photo import endpoint accepts `{ upload_key }` referring to
  an object the client has already PUT to private storage, as
  `docs/05-api/api-contract.md` specifies. `docs/03-architecture/data-flow.md`
  §1 sketches it as `multipart`; that sketch is superseded.
- **Why:** CLAUDE.md names api-contract.md as the authority on endpoint shapes,
  and the two documents disagree. Beyond precedence, `POST /media/upload-url`
  and the scoped PUT target exist precisely so image bytes never proxy through
  the API: multipart would put every photograph through the request path,
  double the bytes on the wire, and couple upload progress to an API timeout.
- **Consequences:** the client uploads first and imports second, which is also
  what makes the offline queue workable — a queued capture holds a storage key,
  not a megabyte of body. `data-flow.md` §1 should be corrected when that
  document is next revised.

## D-018 — Deterministic image operations live in `@mira/imaging`

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Blurhash, perceptual hashing and the cutout quality gate live in
  a shared package that works on decoded pixel buffers. Decoding and resizing —
  the parts that need `sharp` — stay in the worker.
- **Why:** the seed invents images and the worker processes real ones, and both
  must produce identical hashes or seeded data behaves differently from captured
  data in duplicate detection. Keeping the algorithms free of a native decoder
  also keeps them testable without one.
- **Consequences:** `garment_images.image_hash` changed meaning. It was a
  sha256 prefix explicitly marked "standing in for the real one until Phase 2";
  it is now a 64-bit DCT hash, 16 hex characters. Existing seeded rows carry the
  old 32-character value and must be reseeded, not migrated — the old value
  cannot be converted, only recomputed from pixels.

## D-019 — An unanalyzed photo is category `other`, not a new sentinel

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** A garment created by photo import is stored with
  `category = 'other'` and `analysis_state = 'analyzing'` until analysis
  replaces both.
- **Why:** `garments.category` is `not null references categories(id)`, but a
  photograph has no category until it has been analyzed — and the whole point
  of `data-flow.md` §1 is that the garment exists first. `other` is already a
  member of the canonical taxonomy (`taxonomy.md` §1), so this places the
  garment honestly without introducing an `unknown` value, which would be
  widening the taxonomy from application code (INV-1).
- **Consequences:** a filter for `other` will briefly surface garments that are
  merely unanalyzed. `analysis_state` distinguishes them, and the closet already
  renders an analyzing tile differently. If that proves confusing in use, the
  answer is a taxonomy change with a migration — not a sentinel invented in the
  service layer.

## D-020 — `ingestion_jobs` is the queue, not a mirror of one

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** Background work is claimed directly from `ingestion_jobs` using
  `for update skip locked`. There is no separate broker.
- **Why:** the table exists regardless — `database-schema.md` specifies it as
  the user-visible mirror of the queue so failures are retryable in the UI
  (REL-3) — and it is written in the same transaction as the garment it belongs
  to. A broker alongside it would be a second source of truth that can disagree
  with the job list the user is shown, and reconciling those is a class of bug
  worth not having. Postgres claims safely under concurrency, which was verified
  with four workers racing over the same six jobs.
- **Consequences:** throughput is bounded by polling rather than push, and the
  idle loop costs one query per second per worker. Both are far inside what Mira
  needs. Revisit when a job class arrives that needs sub-second dispatch or
  fan-out to many workers; the `JobEnqueuer` port in the API is the seam where a
  broker would attach.

## D-021 — AI responses are clamped per field, never rejected wholesale

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** `clampUnderstanding` reduces a model response to taxonomy-valid
  values field by field. An invalid value is dropped and recorded; the rest of
  the response survives. `GarmentUnderstandingSchema`'s strict enums remain, but
  they describe the shape a *validated* understanding has — they are not the
  gate the raw response passes through.
- **Why:** `garment-understanding.md` §1 requires that a non-taxonomy value be
  dropped and logged as `ai_taxonomy_clamped`, and §7 requires the pipeline to
  continue. Validating the whole object against strict enums does the opposite:
  one unknown occasion would reject the response and cost the user a correct
  category, colour and pattern. That is the data loss REL-4 forbids.
- **Consequences:** every ingestion path clamps before persisting, and drops are
  a quality signal worth alarming on — a rise means a prompt or model
  regression, not a user problem. `category` is the one field that cannot be
  dropped (it is `not null`); an unknown category becomes `other` and the drop
  is still recorded, so a model failing at categories cannot hide behind a
  plausible default.

## D-022 — Only stateable values are flattened onto `garments`

- **Date:** 2026-09-03 · **Status:** Accepted
- **Decision:** `garment.analyze` writes every field it produced to
  `garment_attributes` with its own confidence, but copies onto the `garments`
  row only those at or above the medium band (≥ 0.60). Lower-confidence values
  live in `garment_attributes` and reach the user only through the review
  screen.
- **Why:** the flattened columns are what the closet grid and detail screen
  render, and they carry no confidence band — a value there is an assertion.
  `ai-product-spec.md` §3 says medium and high are *stated* while low is *asked
  as a question* and very low is not shown at all. Flattening a 0.41 material
  would turn a question into a claim, and §6 is explicit that the user must
  never see a confidently wrong value.
- **Consequences:** a freshly analyzed garment can have fields that are known
  but blank in the closet, which is correct — the review screen offers them as
  questions and an answer promotes them. `ai_confidence` is the MINIMUM of the
  stated fields rather than a mean, so one confident category cannot disguise a
  weak brand. Nothing is lost either way: every value the model produced is in
  `garment_attributes` for evaluation and for comparison against a later model.

## D-023 — Duplicate signal weights are derived from the thresholds

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** each non-decisive signal in `duplicate-detection.md` §2 is
  weighted at exactly the score it should reach **on its own**, and the weights
  are combined with noisy-OR (`1 − Π(1 − wᵢ)`): strong 0.72, moderate 0.55, weak
  0.15. A decisive signal short-circuits to 0.99.
- **Why:** §2 says "a weighted combination" and §3 gives the thresholds, but
  neither gives numbers, and numbers invented to feel right are numbers nobody
  can argue with later. Reading them off the thresholds makes each one a
  statement about behaviour instead: a strong signal alone must show the sheet
  softly, so it is 0.72, above 0.70 and below 0.90. A moderate signal alone must
  **not** interrupt — §7 names "same brand, same colour, different cut" as the
  case where a false merge does the most damage — so it is 0.55, inside the
  quiet band. A weak signal is "supporting only", so at 0.15 it can never
  surface anything by itself.
- **Consequences:** the thresholds are the specification and the weights follow
  from them, so moving a threshold moves the weights rather than contradicting
  them. Noisy-OR keeps every signal monotonic — evidence can only ever raise a
  score — and saturating, so two strong signals compound into `ask` (0.922)
  without any weight needing to be clamped. Visual embedding similarity is
  moderate when Phase 5 supplies it, which is what "never sufficient alone"
  means as behaviour rather than as prose: alone it reaches `note` and asks
  nothing.

## D-024 — `duplicate_unresolved` carries ids, not the sheet

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** `POST /garments` refuses with 409 `duplicate_unresolved` when an
  interrupting candidate exists and no `duplicate_resolution` was supplied, and
  the response lists candidate ids and summaries in `details` — not hydrated
  garments.
- **Why:** the error body in `error-contract.md` is one shape for every non-2xx
  response, and widening it so one code can carry garments would make the
  contract answer "it depends". The client that shows the sheet has already
  called `check-duplicate`, which returns hydrated garments with imagery,
  because §4 shows both pieces as pictures. The 409 exists for the client that
  did not — a safety net, not the path.
- **Consequences:** a client that ignores `check-duplicate` needs a second call
  to render the sheet. That is the right cost to put on the wrong order.

## D-025 — A create-time merge fills gaps and never overwrites

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** answering the duplicate sheet with "It's the same item" copies
  onto the surviving garment only the fields it has **no value for**, records a
  `garment_sources` row describing the merge, and creates nothing.
- **Why:** §5's headline is "merging never destroys information". The full
  precedence rule in `garment-understanding.md` §3 resolves per field by source,
  which needs each field's source from `garment_attributes` — and today the only
  sources that can meet at a create-time merge are the user and vision
  inference, where that rule already says the existing value stands. Filling
  gaps is a strict subset of the rule, conservative in the direction that
  matters.
- **Consequences:** merging a receipt into a garment that already has a wrong
  price keeps the wrong price. Tag OCR (Phase 4) and product matching (3.7) are
  the sources that will make precedence genuinely matter; the full per-field
  merge lands with them. No `garment_duplicates` row is written for this merge,
  because there is only ever one garment — the pair table records pairs that
  still exist.

## D-026 — The photo path meets CAP-5 after analysis, not at capture

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** `POST /imports/photo` does not run weighted duplicate detection.
  It keeps its exact perceptual-hash guard against the same bytes arriving
  twice, and the weighted check runs later — once analysis has given the garment
  something to compare — surfacing as "You might already own this" (§26) rather
  than as a sheet.
- **Why:** at capture a photo import has a category of `other` and no brand, no
  name, no colour and no hash, because the hash is computed by the worker. There
  is nothing to weigh. Blocking the capture on a check that cannot see anything
  would cost the sub-second tile in PERF-3 and find nothing.
- **Consequences:** CAP-5 is met on this path by a different surface from the
  manual and receipt paths, and this should be read as a documented difference
  rather than as coverage. A near-identical — not byte-identical — re-photograph
  of an owned garment becomes a second garment until the user is shown the pair
  while browsing.

## D-027 — `openapi.yaml` is reconciled to `duplicate-detection.md`, not the reverse

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** three duplicate-related shapes in `openapi.yaml` predated the
  detail in `duplicate-detection.md` and could not express it. They are changed
  to match it: `DuplicateCheckRequest` becomes the create payload (it had no
  size, no retailer to make a SKU decisive, and no source reference to recognize
  a re-imported order line); `duplicate_resolution` becomes
  `{ garment_id, relation }` (it was a bare enum with no way to name *which*
  garment, and no `same_item`, so the merge §5 defines could not be requested);
  and `DuplicateCandidate.signals` takes one name per row of §2, plus `band` and
  `summary`.
- **Why:** `api-contract.md` already said the check "accepts the same payload a
  create would", so the two API documents disagreed with each other before any
  code existed. Where they disagree, the document that describes the *behaviour*
  wins over the one that describes a shape — a shape that cannot carry the
  signals is not a smaller version of the contract, it is a different one.
- **Consequences:** `existing_garment` is kept as the response field name
  because `openapi.yaml` named it first and nothing about it was wrong.
  `packages/types` regenerates from the spec, so the mobile client sees the
  corrected shapes without hand-editing — which is what caught the last
  contract drift, where a mobile type had been written to match a bug.

## D-028 — A conflicting attribute counts against a pair

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** duplicate scoring now weighs evidence **against** a pair as well
  as for it. A `primary_color` or `size` recorded on both garments that
  *disagrees* multiplies the combined score by 0.75 per conflict. Decisive
  signals are unaffected, because `combine` short-circuits before the penalty
  applies.
- **Why:** D-023 established that every signal can only raise a score — "absent
  evidence is not evidence of difference." That was right about absence and
  wrong about contradiction. A colour present on both records and differing is
  not missing information; it is information. The evaluation set made the cost
  measurable: the false-duplicate rate was **48%**, and every "same style,
  different colour" and "same style, different size" pair was being interrupted.
  Owning a staple in three colours is ordinary, and being asked about it three
  times is §1's interruption budget spent on nothing.
- **Consequences:** the penalty is read off the bands, like the weights: one
  conflict moves a single strong signal from 0.72 to 0.54, out of "ask" and into
  "note" — mentioned while browsing, never interrupting a save, which is exactly
  right for a staple owned twice. Two conflicts compound to 0.405 and say
  nothing. The false-duplicate rate fell to **4%** against a ≤5% target.
  Category is deliberately NOT a conflict: the same jumpsuit is legitimately
  filed as `tops` on one path and `sets` on another. Size normalization had to
  learn alpha sizes first, or "S" against "Small" would have registered as a
  conflict on a garment that is one garment.

## D-029 — `Recall @0.70 ≥ 0.90` is not reachable on metadata alone

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** duplicate detection ships with recall at **0.88** against §7's
  0.90 target, and the gap is recorded rather than closed by tuning.
- **Why:** the evaluation set contains pairs whose evidence is *identical* to
  pairs in the negative set. `dup-attributes-only` and
  `neg-attributes-only-different-items` — same brand, colour, size and category,
  nothing else known — both score 0.550, one labelled a duplicate and one not.
  No threshold separates them, and both shapes occur in real closets. Lowering
  the name-similarity bar to catch "Dress" against "Midi Dress" would fire on
  "Kourtney Midi Dress" against "Kourtney Mini Dress", which is two dresses.
- **Consequences:** the residual is not silence. **96%** of true duplicates
  still score at or above 0.50, so they reach the user through "You might
  already own this" (§26) rather than through a sheet — which is what §3 asks
  for that band anyway. Closing the last 2% needs a signal the metadata does not
  contain, and §2 names it: visual embedding similarity, which arrives with
  Phase 5. The exit criterion should be read as **blocked on Phase 5**, not as
  an open bug in the scorer.

## D-030 — The provider owns tokens; Mira owns the user

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** `POST /auth/session` verifies a provider identity and returns
  the Mira user and closet — no access token, no refresh token. `/auth/refresh`
  and `DELETE /auth/session` delegate to the managed provider behind an
  `IdentityProvider` seam. Mira never issues or rotates a session token.
- **Why:** `auth-contract.md` reads two ways. "Mira issues its own session on
  top of the provider's identity" suggests minting; "signature and expiry
  validated against **the provider's** JWKS" on every request describes the
  opposite, and is what the code has always done. Task 0.5 settles it by naming
  the goal: *managed* auth. A rotating refresh-token family with single-use
  detection and family invalidation is precisely the machinery a managed
  provider exists to supply, and precisely where a hand-rolled version goes
  wrong. Building a second copy of state the provider already keeps could only
  ever end with the two disagreeing.
- **Consequences:** the endpoints exist and are tested, but the two that need a
  live provider return **503** locally rather than succeeding, because
  `SUPABASE_URL` is unset. That is deliberate: a stub returning success for
  `revokeSessions` would make sign-out look tested while revoking nothing, and
  a user who signed out on a shared device would still be signed in. Wiring
  Supabase is a configuration change plus one implementation of the seam, with
  no caller affected.

## D-031 — Account deletion is recorded outside the queue

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** a deletion request is written to its own `account_deletions`
  table with no foreign key to `users`, rather than to `ingestion_jobs`.
- **Why:** `ingestion_jobs.user_id` is `on delete cascade`, so the job that
  deletes a user would delete itself partway through its own teardown. And
  `data-retention.md` requires that a deletion reaching its final attempt
  **alerts**, and that failures are "tracked until resolved" — tracking cannot
  live in a row that vanishes with the thing it tracks.
- **Consequences:** the table is deliberately not row-level-secured and not
  scoped at the repository layer, because it must stay readable after its user
  is gone, which is exactly when SEC-5 has nothing left to scope to. Safety
  comes from the endpoint instead: the subject is taken from the verified actor
  and never from the request, and a mutation test holds that. The retained
  email is constrained to be cleared on completion, so "hard delete" stays true.

## D-032 — Postgres stays; Clerk is a reasonable auth swap

- **Date:** 2026-09-04 · **Status:** Accepted
- **Decision:** Mira keeps PostgreSQL. Convex is **not** adopted as the
  database. Clerk may replace Supabase Auth when task 0.5's client half is
  built, adopted for developer experience rather than for cost.
- **Why:** the question was raised as a cost decision — "Supabase gets
  expensive, Convex is cheaper" — and cost is the one thing neither choice
  moves. Mira's spend is images (an original plus two derivatives per garment,
  plus egress) and, later, AI inference per analysis and try-on. Postgres is not
  the bill.

  Three things verified against Convex's own documentation make it the wrong
  fit here, independent of price:

  1. **Vector search cannot express Mira's filters.** Convex filters on
     pre-declared `filterFields` with "exact equality on a single field, or an
     `OR` of expressions", and returns at most 256 results. Six of the closet's
     twenty filters are ranges — `priceMin`, `priceMax`, `notWornSinceDays`,
     `addedWithinDays`, `purchasedAfter`, `purchasedBefore` — and four more are
     array-contains (`season`, `occasion`, `material`, `styleTag`). Task 5.4
     requires filters as **hard constraints** (INV-3). Post-filtering 256
     results in application code cannot guarantee that: it can return nothing
     while matches exist past the cut, which is exactly the "false inclusion
     ≤ 0.01, recall@10 ≥ 0.90" pair 5.7 measures.
  2. **No database-enforced cascade.** Convex offers cascading deletes through
     triggers or the Ents library — in application code — and its own
     documentation notes they "will fail if there are too many links" because a
     long-lived transaction is not allowed. A user with 240 garments is
     thousands of documents. D-031's whole argument was that deleting one row
     and letting the database cascade means you **cannot forget a table**; the
     guard test that caught `style_preferences` today has no equivalent.
  3. **No row-level security.** SEC-5 requires repository scoping **and** RLS,
     and says "neither mechanism may be the only one." Convex authorizes in
     application code. That is a stated security requirement being dropped.

  Scale, for completeness: this is not a database swap. Convex replaces the
  backend — 129 raw SQL call sites, 7 repositories, 829 lines of migrations, 31
  check constraints, 8 triggers, 5 `skip locked` claims, 8 integration test
  files, Fastify and the worker process.
- **Consequences:** Clerk is cheap to adopt because `IdentityProvider`
  (D-030) already isolates the provider and verification is already JWKS-based
  — roughly two days, and nothing else notices. Note that Clerk is *not* cheaper
  than Supabase Auth at Mira's likely scale; it is chosen, if it is, for its
  flows and DX.

  If cost is the real concern, the lever is object storage: originals plus
  derivatives with egress. Cloudflare R2's zero egress is the change that shows
  on a bill, and `StorageDriver` already isolates it.

  **What would change this answer:** wanting Convex for *reactivity* rather than
  cost is a different and more honest argument — live queries would replace the
  polling behind the analyzing→complete tile, and its scheduler could replace
  the worker. That conversation has to happen before Phase 7, which adds
  substantially more query surface. It should be reopened as its own decision,
  not folded into a cost question.
