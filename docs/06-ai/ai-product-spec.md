# AI Product Specification

What AI is *for* in Mira, and the rules that govern all of it. Per-capability
contracts are in the sibling documents; the runtime architecture is in
`docs/03-architecture/ai-architecture.md`.

---

## 1. What AI is for

Mira uses AI to remove work from the user, not to add magic to the interface.
Every capability below exists because it deletes a step the user would otherwise
have to do by hand.

| Capability | Work it removes | Document |
| ---------- | --------------- | -------- |
| Segmentation, background removal | Cropping and staging photos | [image-processing.md](image-processing.md) |
| Classification, attributes, colour | Filling in 14 form fields | [garment-understanding.md](garment-understanding.md) |
| OCR, barcode, brand recognition | Typing a brand and size off a label | [garment-understanding.md](garment-understanding.md) |
| Product matching | Finding what the item actually is | [product-matching.md](product-matching.md) |
| Duplicate detection | Remembering what you already own | [duplicate-detection.md](duplicate-detection.md) |
| Receipt understanding | Entering four garments from one trip | [receipt-understanding.md](receipt-understanding.md) |
| Purchase extraction | Reconstructing a year of orders | [purchase-detection.md](purchase-detection.md) |
| Semantic search | Knowing Mira's category names | [closet-search.md](closet-search.md) |
| Outfit generation | Assembling a look from 300 pieces | [outfit-recommendation.md](outfit-recommendation.md) |
| Virtual try-on | Physically trying things on | [virtual-try-on.md](virtual-try-on.md) |

## 2. The five binding rules

### R1 — AI output is untrusted input

Every response is parsed strictly, schema-validated, taxonomy-clamped and
confidence-normalized before it can touch the database (AI-2, AI-7). Malformed
output is rejected, not coerced.

### R2 — Never fabricate certainty

Every machine-generated field carries confidence in `[0,1]` (AI-1). Absent
knowledge is `null`, not a plausible guess. A brand Mira is unsure of is left
empty and tappable — never filled with the most likely brand.

### R3 — The taxonomy is closed

Categories, subcategories, colours, patterns, materials, occasions, seasons and
style tags come from `docs/04-data/taxonomy.md` (AI-3). Model output outside the
taxonomy is dropped by the clamp step, never mapped to a neighbour and never
added as a new value.

### R4 — The model never acts

Model output is data. It never changes ownership state, never deletes, never
imports, never sends. Ownership transitions are user-initiated or explicitly
policy-gated (OWN-1). This is also the prompt-injection defence: content inside a
photo, receipt or email cannot cause an action because no model output causes an
action.

### R5 — Closet references are constrained, not requested

Anything that references the user's garments selects from a **server-built
candidate set** and is validated against it (AI-6). "Don't hallucinate garments"
is an enforced invariant, not a line in a prompt.

## 3. Confidence and the user

| Band | Range | What the user sees |
| ---- | ----- | ------------------ |
| High | ≥ 0.85 | Stated, with a tick |
| Medium | 0.60–0.849 | Stated without a tick, tappable |
| Low | 0.35–0.599 | Asked as a question |
| Very low | < 0.35 | Not shown; field empty and tappable |

Auto-accept (opt-in automatic purchase import only) requires ≥ 0.92 **and** a
matching SKU, barcode or product URL.

Bands, not raw numbers, reach the UI. A user should never see "0.72".

## 4. Corrections are the product's most valuable signal

Every AI field is editable (AI-5). Corrections are:

1. stored as user-sourced values that win over AI values,
2. retained alongside the AI value in `garment_attributes` so nothing is lost,
3. captured as evaluation feedback where privacy policy permits
   (`docs/07-security/privacy.md` rule 5).

A rising correction rate on a field is a model regression alarm.

## 5. Degradation

> An AI failure degrades a feature. It never blocks the user, and it never loses
> their work.

Full matrix: [ai-fallbacks.md](ai-fallbacks.md).

## 6. Cost

AI is the largest variable cost in Mira. The controls, in order of leverage:

1. **Cache** — embeddings by image hash, product matches by SKU/URL, try-on by
   input fingerprint.
2. **Right-size the model** per capability ([model-strategy.md](model-strategy.md)).
3. **Batch** — embeddings, receipt line items.
4. **Rate-limit and budget** — per user, enforced server-side.
5. **Don't re-run what hasn't changed** — re-analysis is explicit, never automatic.

## 7. Evaluation

Model behaviour requires evaluation as well as tests. Fixed, versioned datasets;
metrics per capability; a regression gate before any capability change ships.
See [evaluation.md](evaluation.md).

## 8. What Mira does not use AI for

- Deciding that a user owns something.
- Deleting anything.
- Choosing what to buy.
- Inferring body measurements from photographs.
- Judging the user's body, style or taste in generated copy.
