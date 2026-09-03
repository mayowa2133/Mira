# UX Flows

Canonical end-to-end flows. Each maps to a critical E2E journey in
`docs/08-engineering/testing-strategy.md`.

---

## Flow 1 — Onboarding

```text
Splash (MIRA wordmark)
   ↓
Welcome — full-bleed fashion imagery
"Your closet. Your stylist. Your mirror."
   ↓
Value proposition — 3 swipeable cards
Know what you own → Style what you own → See it on you
   ↓
Create account (Apple / Google / email)
   ↓
Build your closet
┌──────────────────────────────────────────────┐
│ Find Online Purchases                        │
│ Scan Receipts                                │
│ Scan Clothes                                 │
│ Scan Tags                                    │
│ I'll do this later                           │
└──────────────────────────────────────────────┘
   ↓                              ↓
[import path]              [skip → Home, empty state]
   ↓
Your closet is coming together (visual grid)
   ↓
Help Mira understand your style   ← skippable
   ↓
Home
```

**Rules**

- The choice screen must communicate that Mira handles closets that already
  exist. That is the differentiator.
- "I'll do this later" is always present and never styled as a failure.
- Style preferences are skippable and re-offered later, never blocking.

---

## Flow 2 — Photograph a garment

```text
+ Add  →  Scan an item
   ↓
Camera (full screen, silhouette guide)
   ↓  shutter
Local preview appears instantly; upload starts in background
   ↓
Analyzing (garment appears in closet as an "analyzing" tile)
   ↓
┌─ duplicate found ──────────────┐
│ Duplicate resolution sheet     │ → same / own two / different
└────────────────────────────────┘
   ↓
AI Item Review
   large cutout · brand · name · colour · size · editable chips
   "Mira found" list with ticks only where confident
   ↓  Add to my closet
Garment created → haptic → animates into the closet grid
```

**Failure branches**

- Segmentation fails → keep the original photo as canonical, continue.
- Classification fails → review screen asks for category only.
- Upload fails → queue locally, retry, show a retryable tile in the closet.

---

## Flow 3 — Scan a tag

```text
+ Add  →  Scan a tag
   ↓
Tag camera (close focus, barcode detector active)
   ↓
Parallel: barcode decode · OCR · visual recognition
   ↓
┌ confident match ────────────────────────────────┐
│ "We think this is: Zara Satin Effect Midi Dress │
│  Black · Small"     [Add to Mira] [Not this item]│
└──────────────────────────────────────────────────┘
   ↓ Add                     ↓ Not this item
Duplicate check          AI Item Review (prefilled, corrigible)
   ↓
AI Item Review → Add to my closet
```

Partial identification prefills what it knows and prompts only for the rest.
Unreadable tags fall back to Flow 2. **A tag scan never dead-ends.**

---

## Flow 4 — Scan a receipt

```text
+ Add  →  Scan a receipt
   ↓
Document capture (edge detection) or pick from library / PDF
   ↓
Extracting…
   ↓
We found 4 possible items
☑ Black Mini Dress — Zara      $49.99
☑ Straight Leg Jeans — Zara    $69.99
☑ Ribbed Top — Zara            $29.99
☑ Shoulder Bag — Zara          $59.99
   (non-clothing lines hidden under "Show all lines")
   ↓  Add 4 items
Duplicate check per line
   ↓
Garments created, each with its purchase record
   ↓
"4 pieces added" → closet
```

---

## Flow 5 — Find online purchases

```text
+ Add  →  Find purchases        (or onboarding "Find Online Purchases")
   ↓
Privacy explainer
   what Mira reads · what it stores · how to disconnect
   ↓  Connect
OAuth (system browser)
   ↓
Purchase discovery — animated processing, live count
   ↓
We found 126 possible pieces 👀
Fashion Nova 38 · Aritzia 21 · Amazon 19 · Nike 11 · Other 37
   ↓
Purchase review grid
   tap a candidate ↓
   ┌ Do you still own this? ─────────┐
   │ Yes — in my closet              │
   │ Returned it                     │
   │ Sold / donated                  │
   │ Not mine                        │
   │ Not sure                        │
   └─────────────────────────────────┘
   ↓  Add 97 items to my closet
Duplicate check → garments created from confirmed_owned only
   ↓
Your closet is coming together
```

**Rules**

- No candidate becomes a garment without explicit confirmation.
- "Not sure" keeps the candidate reviewable; it never creates a garment.
- Disconnect is always reachable from `You → Connected accounts`.

---

## Flow 6 — Ask Mira for an outfit

```text
Mira tab  (or Home "Ask Mira", or Garment detail → Style it)
   ↓
"What are we dressing for?"  +  Vibe chips  +  Priority chips
   ↓  Style me
Generating — outfit pieces assemble one by one
   Top ✓  Bottom ✓  Shoes ✓  Bag ✓
   ↓
Outfit results — full-screen swipeable looks (1/3, 2/3, 3/3)
   ├── Try it on   → Flow 8
   ├── ♡ Save      → Looks
   ├── Swap item   → Flow 7
   └── Wear this   → wear events recorded
```

If the closet cannot support the request, Mira says so plainly and offers the
closest thing it can build — it never invents garments.

---

## Flow 7 — Swap one item

```text
Outfit results → tap the shoes slot
   ↓
Swap shoes (sheet)
   Mira recommends   [heel] [heel]
   More from your closet  [boot] [sneaker] …
   ↓  select
Look updates in place — other slots unchanged
```

---

## Flow 8 — Virtual try-on

```text
Any outfit → Try it on
   ↓
┌ no body profile ────────────────────────┐
│ Meet your Mira — privacy explainer      │
│ Guided capture: front (required),       │
│ side (optional), extra reference        │
└─────────────────────────────────────────┘
   ↓
Generating (soft shimmer, honest progress)
   ↓
Try-on result — full-screen image, floating glass panel
   ├── ♡ Save
   ├── Change item → Flow 7 → regenerate
   ├── Compare  → swipe between looks / side-by-side
   └── ⋯ → delete this try-on
```

Cached generations for the same (body reference, outfit) are reused.

---

## Flow 9 — Duplicate resolution

```text
Any ingestion path → duplicate detected above threshold
   ↓
This may already be in your closet.
Existing: Aritzia Contour Bodysuit — Black
New:      Aritzia Contour Crew Bodysuit — Black
   ↓
[It's the same item]   → merge images + attributes + purchase record
[I own two]            → create second garment, link as duplicates
[They're different]    → create separately, record negative pair
```

---

## Flow 10 — Search the closet

```text
Closet → search field
   ↓
Type "heels I haven't worn recently"
   ↓
Query understanding → structured filters + semantic retrieval, merged
   ↓
Results grid, with the interpretation shown as removable chips
   [Shoes] [Heels] [Not worn in 90 days]     ← editable, so search is correctable
   ↓
Tap a garment → Garment detail
```

Showing the interpretation as chips is what makes semantic search trustworthy:
the user can see what Mira understood and fix it.
