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
