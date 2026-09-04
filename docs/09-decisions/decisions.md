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
