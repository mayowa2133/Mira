# Mira — Product Requirements Document

**Status:** canonical
**Owner:** product
**Supersedes:** individual task prompts (see the decision hierarchy in `AGENTS.md`)

---

## 1. What we are proving

> Can we create an extremely useful digital representation of someone's wardrobe
> **without making wardrobe setup miserable?**

Every scope decision in this document resolves against that question.

## 2. Critical product principle — existing closets matter

Mira is **not** a product that only starts tracking clothing after installation.
A new user may already own 50, 200, or 500+ items.

The initial experience must therefore solve:

> "How do we reconstruct your closet without making you manually enter every
> single item?"

This is a first-class feature, not an onboarding nicety.

## 3. Scope

### 3.1 MVP

**Account**
- authentication (Apple, Google, email)
- profile

**Closet**
- garment inventory
- categories
- garment detail
- editing
- favourite
- archive

**Existing wardrobe import**
- photo import (camera)
- photo library import
- AI garment recognition
- tag scan
- basic receipt scan

**Search**
- text search
- filters
- semantic query support

**Outfit system**
- manual outfit builder
- save outfits

**Basic Mira stylist**
- generate outfits from owned garments

### 3.2 MVP+ / Next

**Purchase ingestion**
- Gmail / supported email connection
- purchase detection
- candidate review
- duplicate prevention
- notifications

**Wardrobe intelligence**
- never worn
- rarely worn
- forgotten clothing
- tags attached
- similar owned items

### 3.3 Later

**Virtual try-on.** Begin serious try-on work only after Mira has a strong garment
representation, because try-on is far more useful once users already have a real
closet, clean garment images, item metadata, saved outfits and style preferences.

> Mira must not become a virtual-try-on demo with a bad closet product attached.

### 3.4 Out of scope

See [non-goals.md](non-goals.md).

---

## 4. Pillar 1 — Capture

### 4.1 Supported ingestion methods

1. clothing photograph
2. multiple clothing photographs
3. tag photograph
4. barcode / QR scan
5. paper receipt photograph
6. receipt screenshot
7. order screenshot
8. email purchase detection
9. product URL
10. online retailer integration
11. manual entry

Manual entry always exists as a fallback and is always the **last** option in the
hierarchy. See `docs/02-design/screen-specs.md` — Add Item Menu.

### 4.2 Photograph an item

The user may photograph clothing on a hanger, lying flat, being worn, or
photograph shoes, bags and accessories.

Mira must:

1. identify the garment
2. segment it from the background
3. create a clean garment image
4. classify it
5. extract attributes
6. attempt brand / product matching
7. show a confirmation screen

Example result:

```text
Detected
Zara
Black Ribbed Midi Dress
Size: Small
Black
Midi Dress
```

The user can correct anything before saving.

> **Requirement:** adding an item must not require manually entering every field.
> AI-generated fields are the default.

### 4.3 Scan a tag

Supported tag types: brand label, care label, SKU label, barcode, QR code,
product number, size tag.

Mira combines OCR, barcode decoding, visible brand information, SKU/product ID,
web/product matching where available, and visual garment recognition.

The user chooses **Add to Mira** or **Not this item**. If exact identification
fails, Mira must still use whatever the tag yielded to reduce manual entry.

### 4.4 Scan a receipt

Input may be a physical receipt, screenshot, PDF or digital receipt.

Mira extracts retailer, purchase date, line items, prices, product identifiers and
sizes where available, then attempts to match line items to actual products.

```text
We found 4 possible items
☑ Black Mini Dress — Zara
☑ Straight Leg Jeans — Zara
☑ Ribbed Top — Zara
☑ Shoulder Bag — Zara
Add 4 items
```

The user can exclude individual items.

### 4.5 Email purchase detection

One of Mira's highest-value features. The user may connect an email account;
Mira searches for likely order confirmations, shipping confirmations, electronic
receipts and purchase receipts from fashion retailers.

```text
We found 87 possible wardrobe items
Fashion Nova — 31
Aritzia — 18
Amazon — 13
Nike — 9
Zara — 8
Other — 8
```

Each candidate can be marked: **I own this** · **Returned** · **Sold / donated** ·
**Bought for someone else** · **Not clothing** · **Not sure**.

> **Critical rule:** purchase detected ≠ garment owned. Mira must distinguish
> between purchase history and current closet inventory.

### 4.6 Purchase candidate lifecycle

```text
PURCHASE DETECTED
        ↓
CANDIDATE CREATED
        ↓
PRODUCT MATCHING
        ↓
USER REVIEW
        ↓
┌─────────────┬──────────┬───────────┬────────────┐
│             │          │           │            │
OWNED      RETURNED    REMOVED     NOT MINE    UNSURE
│
▼
CLOSET
```

A purchase must not silently become confirmed inventory unless the user has
explicitly enabled automatic importing. Even then, imports must be undoable.

### 4.7 Retailer integrations

Long-term targets where technically available: Amazon, Fashion Nova, Zara,
Aritzia, H&M, Nike, SSENSE, ASOS, Shein, Shopify-based retailers.

Retailer integration is **not** required for MVP. Email receipt ingestion is the
more universal initial strategy.

### 4.8 Future purchase automation

Once Mira understands the existing closet, keeping it updated should require
almost no work.

```text
New purchase detected
Fashion Nova
Rosette Mini Dress
Black · Small
$59.99
Add to Mira?     [Add] [Returned] [Not mine]
```

Users may eventually enable *"Automatically add high-confidence purchases."*
Undo must always be available.

### 4.9 Duplicate detection

**Every** ingestion method runs duplicate detection before adding an item.

Signals: same retailer · same SKU · same product URL · same order · same barcode ·
visual similarity · same product name · similar purchase date · identical images.

```text
This may already be in your closet.
Existing: Aritzia Contour Bodysuit — Black
New:      Aritzia Contour Crew Bodysuit — Black

[It's the same item]  [I own two]  [They're different]
```

Mira must support legitimate duplicate ownership. See
`docs/06-ai/duplicate-detection.md`.

---

## 5. Pillar 2 — Understand

Mira extracts or infers: category, subcategory, brand, product name, colour,
secondary colours, pattern, material, size, fit, sleeve type, sleeve length,
neckline, length, style descriptors, season, occasions, purchase source, purchase
price, purchase date, product identifier, SKU, barcode, source URL.

Every machine-generated field carries a confidence score. Low-confidence values are
presented for confirmation rather than silently treated as fact. Never fabricate
high certainty. The contract lives in `docs/06-ai/garment-understanding.md`.

---

## 6. Pillar 3 — Inventory

### 6.1 Categories

```text
All · Tops · Bottoms · Dresses · Sets · Outerwear · Shoes · Bags ·
Accessories · Activewear · Swimwear · Other
```

Subcategories are defined by the canonical taxonomy in
`docs/04-data/taxonomy.md`. The taxonomy is centralized; AI systems cannot invent
incompatible categories.

### 6.2 Garment status

```text
active · laundry · unavailable · lent_out · returned · sold · donated · lost · archived
```

Only appropriate statuses participate in outfit generation. A dress marked
`laundry` is not normally recommended for tonight.

### 6.3 Garment images

A garment may have multiple images: canonical, original upload, AI-cleaned, front,
back, side, detail, retailer. Multiple images improve recognition, product
matching, duplicate detection and try-on.

### 6.4 Search

Traditional filters **and** natural-language search:

```text
black dresses
white going-out tops
heels I haven't worn recently
clothes from Zara
outfits I bought this summer
bags that work with a red dress
things that still have tags
show me everything I've never worn
```

Search must understand semantic meaning rather than matching exact text.

### 6.5 Filters

Category · subcategory · brand · colour · size · season · occasion · material ·
style · retailer · purchase date · purchase price · worn/unworn · favourite ·
tags attached · laundry status · availability. Filters must be combinable.

### 6.6 Garment detail

Displays garment images, product name, brand, category, colour, size, material,
season, occasion, purchase information, source, worn history, favourite state and
current status.

Actions: edit · favourite · add to outfit · try on · find matching items · find
similar owned items · mark worn · mark laundry · archive · remove.

---

## 7. Pillar 4 — Style

### 7.1 Outfit builder

Slots: Top · Bottom · Dress · Layer · Shoes · Bag · Accessories.

Users may select items, save outfits, favourite them, name them, assign
occasions, mark an outfit worn, and send an outfit to try-on.

### 7.2 Mira stylist

Core prompt: **"What are you dressing for?"** answered naturally —
*"Dinner downtown tonight." · "Club tonight." · "Casual date." · "Wedding." ·
"Give me something around this skirt."*

Mira considers: wardrobe inventory · occasion · dress code · weather (when
authorized) · location (when relevant and authorized) · style preferences ·
favourites · recently worn pieces · underused pieces · unavailable clothing ·
colours · garment compatibility · season · temperature · footwear · bags ·
accessories.

Output is usually **multiple complete outfits**, not a text list.

```text
Look 1
Black Corset Top
Blue Wide-Leg Jeans
Black Heels
Silver Shoulder Bag
```

> Mira's first question is always: **what can we create from what you already own?**

### 7.3 Swap one item

From any generated look the user can tap a slot and swap that single garment,
with Mira-recommended alternatives first and the rest of the relevant closet
below. The outfit updates in place. This is what makes AI styling feel
*interactive* rather than *generative*.

---

## 8. Pillar 5 — Mirror

### 8.1 Body profile

Optional and private by default. Inputs: full-body image, additional body images,
height, optional sizing information, optional fit preferences.

Mira must clearly distinguish **visualization** from **guaranteed physical sizing
accuracy**, and must never imply that a generated try-on guarantees actual fit.

### 8.2 Virtual try-on definition

> Preserve the user's recognizable appearance and body while faithfully
> reproducing the **actual selected garment or outfit** as closely as technically
> possible.

It does **not** mean: generate a random fashionable outfit inspired by the
garment.

Evaluation priorities, in order: garment fidelity · user identity consistency ·
body consistency · believable garment placement · colour fidelity · pattern
fidelity · accessory fidelity · visual quality.

### 8.3 Try-on UX

From any outfit: **Try It On** → gather required body reference → processing →
result. The user can compare outfits, regenerate, save, favourite, return to the
outfit, switch an individual garment, or try another outfit. Cache previous
generations where appropriate to reduce cost.

---

## 9. Wardrobe intelligence

After enough usage Mira surfaces insights — presented as fashion content, not
analytics:

- **Forgotten pieces** — "You haven't worn this jacket in 11 months."
- **Never worn** — "14 pieces in your closet haven't been worn yet."
- **Tags still attached** — "You have 8 items that may still have their tags."
- **Similar purchases** — "You already own three black cropped tops similar to this."
- **Cost per wear** — "$180 jacket · 9 wears · $20 / wear."
- **Underused value** — "You have ~$1,240 worth of clothing you've never logged as worn."

These come **after** reliable inventory.

---

## 10. Onboarding

| Screen | Content |
| ------ | ------- |
| 1 | Meet Mira — *Your closet. Your stylist. Your mirror.* |
| 2 | Let's find what you already own — Find Online Purchases · Scan Receipts · Scan Clothes · Scan Tags · I'll Do This Later |
| 3 | If purchase detection used: "We found 126 possible items 👀", grouped by retailer, user reviews candidates |
| 4 | Your closet is coming together — visual grid of imported garments |
| 5 | Optional, skippable: Help Mira understand your style |

Onboarding must immediately communicate Mira's differentiated value.

---

## 11. Navigation

```text
Home · Closet · Mira · Looks · You
```

The centre **Mira** destination is the AI stylist. Adding garments is a
persistent `+ Add` action from Home and Closet rather than consuming a tab.

---

## 12. Non-functional requirements

See [requirements.md](requirements.md) for the numbered, testable list.

---

## 13. North star metrics

| Metric | Definition |
| ------ | ---------- |
| **Closet activation** | % of users reaching 20+ confirmed owned items during initial setup |
| **Import efficiency** | Average user actions per successfully imported garment (lower is better) |
| **Closet coverage** | Estimated proportion of the actual wardrobe represented in Mira |
| **Search success** | % of searches resulting in a garment interaction |
| **Stylist usefulness** | % of generated outfit sessions resulting in outfit saved, worn, or try-on started |
| **Maintenance burden** | Manual work performed after initial setup — should trend toward passive |

---

## 14. Definition of done

A Mira feature is **not** complete because the happy path renders. See
`docs/08-engineering/definition-of-done.md`.
