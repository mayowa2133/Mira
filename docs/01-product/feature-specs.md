# Feature Specifications

Each feature below is specified to the level an implementer needs. Where a
feature has its own AI contract, the AI document is authoritative for model
behaviour and this document is authoritative for product behaviour.

---

## F-01 · Add garment from photograph

**Entry points:** Home `+ Add` → Scan an item · Closet `+ Add` → Scan an item ·
Onboarding "Scan Clothes"

**Flow**

1. Full-screen camera with a garment silhouette guide and the hint
   *"Place one item in frame."*
2. Shutter → immediate local preview, upload begins in the background.
3. Mira runs: segmentation → background removal → classification → attribute
   extraction → brand/product matching → duplicate check.
4. **AI Item Review** screen shows the cleaned garment large, with detected brand,
   product name, colour, size and editable attribute chips.
5. `Add to my closet` → garment created, haptic, garment animates into the closet.

**Rules**

- The user must never be shown an empty form. If the model returns nothing usable,
  show category-only with a clear prompt, not 14 blank fields.
- Every AI field is editable. Corrections are recorded as feedback signals where
  privacy policy permits (`docs/06-ai/evaluation.md`).
- Duplicate check runs before creation. If a likely duplicate exists, present the
  duplicate resolution sheet (F-08) *before* the item is saved.
- Analysis is asynchronous. The user may leave the screen; the garment appears in
  the closet when processing completes, with an "analyzing" placeholder state.

**States:** capturing · uploading · analyzing · review · duplicate-detected ·
save-failed · offline (queue locally, upload when connected).

**Related:** `docs/06-ai/image-processing.md`, `docs/06-ai/garment-understanding.md`

---

## F-02 · Add garment from tag scan

**Flow**

1. Camera tuned for labels: closer focus, brighter, barcode detector running.
2. On capture: barcode decode + OCR + visual garment recognition, in parallel.
3. Identification attempt produces one of three outcomes:
   - **Confident match** — "We think this is: Zara Satin Effect Midi Dress, Black,
     Small." → `Add to Mira` / `Not this item`
   - **Partial** — brand and size known, product unknown → prefill and continue to
     review, prompting only for what is missing.
   - **Unidentified** — fall back to F-01 using whatever the tag yielded.
4. Duplicate check, then review, then save.

**Rules**

- A failed identification must never dead-end. Always degrade to partial prefill.
- Barcode/SKU values are stored verbatim on the garment even when matching fails —
  they make later matching and duplicate detection possible.

---

## F-03 · Add garments from a receipt

**Input:** camera capture, photo library image, screenshot, or PDF.

**Flow**

1. Document-style capture with edge detection.
2. Extraction: retailer, purchase date, currency, line items, per-line price,
   product identifiers, sizes.
3. Line items are classified as clothing / not-clothing. Non-clothing lines are
   hidden by default but visible under "Show all lines".
4. Multi-item confirmation list, all clothing lines pre-checked.
5. `Add N items` → creates garments; each carries `source_type = receipt` and a
   shared `source_reference` (the receipt import id).

**Rules**

- A receipt creates **garments** (the user is holding the receipt for things they
  bought and kept) but each garment records its purchase record.
- Items with no confident category must still be addable with a user-chosen
  category rather than being silently dropped.
- Duplicate detection runs per line item.

**Related:** `docs/06-ai/receipt-understanding.md`

---

## F-04 · Find online purchases (email)

**Precondition:** explicit user consent with a plain-language explanation of what
Mira reads and why. See `docs/07-security/permissions.md`.

**Flow**

1. Privacy explainer → OAuth → connection stored encrypted.
2. Background scan for order/shipping confirmations and receipts from fashion
   retailers.
3. Progress screen: *"Looking through your purchases…"* with a live count.
4. **Purchase Review**: retailer strip with counts, then a visual grid of
   candidates.
5. Per candidate: `Yes — in my closet` · `Returned it` · `Sold / donated` ·
   `Not mine` · `Not sure`.
6. `Add N items to my closet` creates garments only from `confirmed_owned`
   candidates.

**Rules**

- **Purchase detected ≠ garment owned.** Candidates live in
  `purchase_candidates` and never appear in the closet until confirmed.
- Mira requests the narrowest email scope technically available and never stores
  raw message bodies beyond what extraction requires. See
  `docs/07-security/data-retention.md`.
- Disconnecting email must be one tap in `You → Connected accounts` and must
  offer to delete derived candidates.
- Email content must never be sent to analytics.

**Related:** `docs/06-ai/purchase-detection.md`

---

## F-05 · Future purchase automation

After the initial import, newly detected purchases arrive as notifications:
`Add` · `Returned` · `Not mine`.

Users may opt in to *"Automatically add high-confidence purchases."* When enabled:

- only candidates above the confidence threshold auto-create garments
- the user is still notified
- every auto-import is undoable for at least 30 days
- auto-imported garments are visually flagged in the closet until acknowledged

---

## F-06 · Closet browse and filter

Two-column grid, large imagery, minimal metadata (brand, name, colour · size, and
a favourite control). Horizontally scrollable category chips. Filter and Sort
open a full-screen sheet; applied filters appear as dismissible chips above the
grid and remain visible while browsing.

Sticky CTA in the filter sheet shows the live result count: `Show 38 items`.

**Rules**

- Two columns, not three. Image size beats density.
- Filters do not re-run the whole page on every tap; they apply on `Show N items`.
- Colour filtering uses actual colour swatches, not text labels.

---

## F-07 · Closet search

One field accepts both keyword and natural language. Query understanding routes to
structured filters where possible and to semantic retrieval otherwise, then merges.

Examples that must work: `black dresses` · `heels I haven't worn recently` ·
`things that still have tags` · `something cute for dinner`.

**Related:** `docs/06-ai/closet-search.md`

---

## F-08 · Duplicate resolution

Triggered before any garment creation when the duplicate detector returns a
candidate above threshold.

```text
This may already be in your closet.
Existing: Aritzia Contour Bodysuit — Black
New:      Aritzia Contour Crew Bodysuit — Black
[It's the same item]  [I own two]  [They're different]
```

- **Same item** — merge: keep the existing garment, attach the new images and any
  newly learned attributes and purchase record.
- **I own two** — create a second garment, link the two as known duplicates.
- **They're different** — create separately and record a negative pair for
  evaluation.

**Related:** `docs/06-ai/duplicate-detection.md`

---

## F-09 · Garment detail

Editorial product-page treatment. Large hero image, swipeable through front →
back → original photo → retailer image. Brand, name, colour · size. Primary
actions `Style it` and `Try it on`. Then **Goes well with** — a carousel of
things *she owns*. Then collapsible Details, Purchase history, Wear history.

---

## F-10 · Outfit builder

Slot-based composition (top, bottom, dress, layer, shoes, bag, accessories).
Selecting a slot opens the closet filtered to that slot's categories. Outfits can
be named, favourited, assigned occasions, marked worn, and sent to try-on.

Dress and top+bottom are mutually exclusive by default; the user can override.

---

## F-11 · Mira stylist

Prompt field (*"What are we dressing for?"*), optional Vibe chips
(Cute · Sexy · Classy · Casual · Comfy · Minimal) and Priority chips
(Something new · Haven't worn lately · Favourite pieces · Surprise me), then
`Style me`.

Output: full-screen swipeable looks, each a complete outfit built from available
owned garments, with constituent garment thumbnails, `Try it on`, `Save`,
`Swap item`.

**Rules**

- Only garments with an outfit-eligible status participate. See
  `docs/04-data/taxonomy.md`.
- Every recommended garment must actually exist in the user's closet. A
  hallucinated garment is a hard failure, not a quality issue.
- Mira may ask at most one or two clarifying questions, and only when genuinely
  necessary.

**Related:** `docs/06-ai/outfit-recommendation.md`

---

## F-12 · Swap an item in a look

Tapping a slot opens `Swap shoes` (etc.) showing **Mira recommends** first and
**More from your closet** below. Selecting updates the look in place without
regenerating the rest.

---

## F-13 · Wear tracking

`Wear this` on a look, or `Mark worn` on a garment, creates wear events for the
garment(s) with a date. Wear history feeds forgotten-pieces, cost-per-wear and the
stylist's recency logic.

---

## F-14 · Body profile

Optional, private, deletable. Guided capture: front (required), side (optional),
additional reference (optional). Height and sizing optional. Copy must state
plainly that try-on is a visualization and not a guarantee of fit.

---

## F-15 · Virtual try-on

Outfit + body reference → generation → full-screen result with a floating glass
panel naming the look and its garments, plus `Save`, `Change item`, `Compare`.
Compare mode swipes between looks or shows side-by-side thumbnails.

**Rules**

- Generations are private, deletable, and cached by (body reference, outfit)
  where possible.
- Provider access is server-side only. See `docs/07-security/security-rules.md`.

**Related:** `docs/06-ai/virtual-try-on.md`

---

## F-16 · Wardrobe insights

Fashion content, not a dashboard: *"17 pieces deserve another chance"*,
*"You've never worn these 👀"*, *"Your most-loved piece"*, similar-item detection,
optional closet value and cost-per-wear. Numbers stay secondary to imagery.
