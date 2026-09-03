# Mira Visual References

## Purpose

This document defines the visual direction for Mira.

References are inspirational rather than templates to copy.
Never reproduce another application's UI pixel-for-pixel, brand assets,
logos, proprietary artwork, or exact visual identity.

Instead, identify the useful interaction/design principle and implement
that principle using Mira's own design system.

Mira should feel like:

Fashion Nova's visual merchandising
+
SSENSE's minimalism
+
Aritzia's premium fashion identity
+
Pinterest/LTK outfit discovery
+
Apple-level mobile polish

Mira should NOT feel like an inventory-management application.

Screenshots collected for study live in `reference-images/<app>/`. They are
reference material only and must never be shipped, redistributed, or used as
placeholder content in the app.

---

# Reference 01 — Fashion Nova Product Grid

## Use For

- Closet
- Search results
- Category views
- Purchase-import review

## Visual Characteristics

- Two-column product grid
- Large product photography
- Very little metadata underneath
- White/light neutral background
- Garment dominates the card
- Brand/product information secondary
- Category/filter controls above grid
- Favourites available directly from cards

## Mira Adaptation

Fashion Nova presents products the user may buy.
Mira should present clothing the user already owns using the same
fashion-first visual hierarchy.

The user's closet should therefore resemble a personalized fashion store
where every item is already theirs.

Bad:

    [small picture]
    Black Dress
    Zara
    Size Small
    Purchased 2024
    Worn 3 times
    SKU 4938348

Good:

    [LARGE GARMENT IMAGE]

    Zara
    Satin Midi Dress
    Black · S                          ♡

Metadata such as purchase date, SKU, wear count and source should be
available on the detail screen rather than overwhelming the grid.

---

# Reference 02 — SSENSE Product Detail

## Use For

- Garment Detail
- Try-On garment selection
- Product identification confirmation

## Visual Characteristics

- Extremely large hero image
- Significant whitespace
- Minimal visible chrome
- Fashion image is the main content
- Typography is restrained
- Secondary information appears below
- Premium/editorial feel

## Mira Adaptation

The Garment Detail screen should make an item the user owns feel as
important as a product on a luxury-fashion store.

The interface should communicate:

"This is one of your pieces."

rather than:

"This is row #482 in your inventory."

---

# Reference 03 — SSENSE Search / Filters

## Use For

- Closet filtering
- Search
- Brand selection
- Category filtering

## Characteristics

- Minimal controls
- Strong typography
- Easy-to-understand selected filters
- Product imagery remains visible
- Avoid complicated enterprise filtering interfaces

## Mira Adaptation

Recommended filters:

Category
Colour
Brand
Occasion
Season
Size
Status
  Worn / Unworn
  Still has tags
  Favourite
  Laundry

Use chips and bottom sheets rather than dense forms.

---

# Reference 04 — Pinterest

## Use For

- Looks
- Outfit inspiration
- Saved outfits
- Mira recommendations
- Virtual try-on history

## Characteristics

- Image-first discovery
- Scrollable visual collections
- Strong emphasis on saving
- Different content can coexist without looking like a database
- Exploration feels effortless

## Mira Adaptation

The Looks section should feel like the user's private Pinterest board,
except every outfit can connect directly to garments from her real closet.

---

# Reference 05 — LTK

## Use For

- Outfit Detail
- "What's in this look?"
- Outfit-to-garment breakdown

## Characteristics

Large lifestyle/outfit image first.
Individual products underneath.

The relationship between:

COMPLETE LOOK

and

INDIVIDUAL ITEMS

is visually obvious.

## Mira Adaptation

When Mira recommends an outfit:

[COMPLETE OUTFIT]

should be followed by:

Your Aritzia top
Your Zara trousers
Your Steve Madden heels
Your Coach bag

Every constituent item should be tappable.

---

# Reference 06 — Whering

## Use For

- Digital wardrobe mechanics
- Outfit builder
- Clothing cutouts
- Category browsing
- Wardrobe statistics

## What Mira Should Learn

- Clothing looks better when isolated from its original photographed
  background.
- Outfit creation benefits from garment cutouts rather than rectangular
  product cards.
- Categories should be visually understandable.
- Wardrobe tools can still feel consumer-friendly.

## What Mira Should Improve

Mira should feel:

more premium
more editorial
less playful
less cluttered
more AI-native
more fashion-brand-like

Mira should use Whering primarily as PRODUCT inspiration rather than
Mira's final visual identity.

---

# Screen → Reference Assignment

Before implementing a screen, look it up here, then read the wireframe below.

| Screen                     | Primary reference          | Secondary          |
| -------------------------- | -------------------------- | ------------------ |
| Home                       | Fashion Nova merchandising | Pinterest, Apple   |
| Closet grid                | Reference 01 (Fashion Nova)| Reference 03       |
| Search                     | Reference 03 (SSENSE)      | —                  |
| Filters                    | Reference 03 (SSENSE)      | Airbnb sheets      |
| Garment detail             | Reference 02 (SSENSE)      | Reference 05       |
| Add item sheet             | Apple                      | —                  |
| Scan garment / tag         | Apple camera               | —                  |
| AI item review             | Reference 02 (SSENSE)      | Reference 01       |
| Purchase review            | Reference 01 (Fashion Nova)| —                  |
| Mira stylist               | Aritzia editorial          | Apple              |
| Outfit results             | Reference 05 (LTK)         | Pinterest, SSENSE  |
| Swap item                  | Reference 01               | —                  |
| Looks library              | Reference 04 (Pinterest)   | —                  |
| Try-on setup               | Apple                      | —                  |
| Try-on result              | SSENSE full-bleed          | Apple              |
| Wardrobe insights          | Pinterest editorial cards  | —                  |

---

# What Mira must NOT copy from Fashion Nova

Fashion Nova is designed to make you **buy more**. It therefore uses sales
banners, discounts, urgency, thousands of products, new-arrival labels and
checkout/cart emphasis.

Mira has almost the opposite mission:

> **Make the clothes you already own feel exciting again.**

Borrow Fashion Nova's *visual presentation*. Replace its ecommerce pressure with
rediscovery, personalization, outfit inspiration, styling, try-on and closet
intelligence.

---

# Mira Wireframes

These show how the references combine into Mira. They are layout intent, not
pixel specifications — the design system supplies the actual values.

## HOME

```text
┌───────────────────────────────────┐
│                                   │
│  MIRA                       ◯     │
│                                   │
│  Good evening, Maya               │
│                                   │
│  What are we wearing tonight?     │
│                                   │
│ ┌───────────────────────────────┐ │
│ │                               │ │
│ │                               │ │
│ │         OUTFIT IMAGE          │ │
│ │                               │ │
│ │                               │ │
│ └───────────────────────────────┘ │
│                                   │
│  Dinner downtown                  │
│  Your black top + wide-leg jeans  │
│                                   │
│  [ Try it on ]     ♡ Save         │
│                                   │
│ ────────────────────────────────  │
│                                   │
│  Ask Mira                         │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ What are you dressing for?  → │ │
│ └───────────────────────────────┘ │
│                                   │
│  Dinner   Going Out   Casual      │
│                                   │
│  Rediscover your closet           │
│                                   │
│  ┌──────────┐ ┌──────────┐       │
│  │ garment  │ │ garment  │  →    │
│  │          │ │          │       │
│  └──────────┘ └──────────┘       │
│                                   │
│  Home Closet  MIRA  Looks   You   │
└───────────────────────────────────┘
```

**Visual rule.** The first screen must immediately communicate **Mira styles me**,
not **Mira inventories things**.

## CLOSET

```text
┌───────────────────────────────────┐
│                                   │
│  Closet                    + Add  │
│  327 pieces                       │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ 🔍 Search your closet         │ │
│ └───────────────────────────────┘ │
│                                   │
│ All  Tops  Bottoms Dresses Shoes →│
│                                   │
│ Filter                      Sort  │
│                                   │
│ ┌──────────────┐ ┌──────────────┐│
│ │              │ │              ││
│ │              │ │              ││
│ │    DRESS     │ │     TOP      ││
│ │              │ │              ││
│ │              │ │              ││
│ └──────────────┘ └──────────────┘│
│ Zara               Fashion Nova   │
│ Satin Midi Dress   Corset Top     │
│ Black · S      ♡   Cream · S   ♥ │
│                                   │
│ ┌──────────────┐ ┌──────────────┐│
│ │              │ │              ││
│ │    JEANS     │ │     BAG      ││
│ │              │ │              ││
│ └──────────────┘ └──────────────┘│
│                                   │
│  Home Closet  MIRA  Looks   You   │
└───────────────────────────────────┘
```

**Inspiration.** Fashion Nova grid + SSENSE restraint.

## ADD CLOTHING

```text
                ┌───────────────────────┐
                │                       │
                │ Add to your closet    │
                │                       │
                │ ┌───────────────────┐ │
                │ │      📸           │ │
                │ │ Scan an item      │ │
                │ │                   │ │
                │ │ Photograph clothes│ │
                │ │ you already own   │ │
                │ └───────────────────┘ │
                │                       │
                │ 🏷  Scan a tag        │
                │                       │
                │ 🧾  Scan a receipt    │
                │                       │
                │ ✉️  Find purchases    │
                │                       │
                │ 🖼  Choose photo      │
                │                       │
                │ 🔗  Product link      │
                │                       │
                │ ✎   Add manually      │
                │                       │
                └───────────────────────┘
```

The camera method gets the strongest hierarchy. Manual entry is always last.

## SCAN GARMENT

```text
┌───────────────────────────────────┐
│ ×                                 │
│                                   │
│                                   │
│                                   │
│       ╭───────────────────╮       │
│       │                   │       │
│       │                   │       │
│       │  PLACE GARMENT    │       │
│       │     IN FRAME      │       │
│       │                   │       │
│       ╰───────────────────╯       │
│                                   │
│                                   │
│       Place one item in frame     │
│                                   │
│                ◉                  │
│                                   │
│          Upload instead           │
└───────────────────────────────────┘
```

Extremely clean. No navigation bar. No unnecessary controls.

## AI DETECTION RESULT

```text
┌───────────────────────────────────┐
│ ←                                 │
│                                   │
│ ┌───────────────────────────────┐ │
│ │                               │ │
│ │                               │ │
│ │     CLEAN GARMENT IMAGE       │ │
│ │                               │ │
│ │                               │ │
│ └───────────────────────────────┘ │
│                                   │
│ Aritzia                           │
│                                   │
│ Contour Squareneck Bodysuit       │
│                                   │
│ Black · Small                     │
│                                   │
│ [Bodysuit] [Black] [Dinner]       │
│ [Going Out] [Summer]              │
│                                   │
│ Mira found                        │
│                                   │
│ Brand      Aritzia             ✓  │
│ Size       Small               ✓  │
│ Material   Nylon blend            │
│                                   │
│ ┌───────────────────────────────┐ │
│ │      Add to my closet         │ │
│ └───────────────────────────────┘ │
└───────────────────────────────────┘
```

This must feel like a **fashion product page**, not an AI output screen.

## PURCHASE IMPORT

```text
┌───────────────────────────────────┐
│                                   │
│ We found 126 pieces 👀            │
│                                   │
│ Fashion Nova 38                   │
│ Aritzia      21                   │
│ Amazon       19                   │
│ Nike         11                   │
│                                   │
│ Review what you still own         │
│                                   │
│ ┌──────────────┐ ┌──────────────┐│
│ │      ✓       │ │      ✓       ││
│ │    DRESS     │ │     TOP      ││
│ │              │ │              ││
│ └──────────────┘ └──────────────┘│
│                                   │
│ ┌──────────────┐ ┌──────────────┐│
│ │              │ │      ✓       ││
│ │    JEANS     │ │     BAG      ││
│ │              │ │              ││
│ └──────────────┘ └──────────────┘│
│                                   │
│ ┌───────────────────────────────┐ │
│ │  Add 97 items to my closet    │ │
│ └───────────────────────────────┘ │
└───────────────────────────────────┘
```

This interaction must make importing 100 garments feel closer to **swiping
through clothes** than filling out a database.

## GARMENT DETAIL

```text
┌───────────────────────────────────┐
│ ←                           ⋯     │
│                                   │
│ ┌───────────────────────────────┐ │
│ │                               │ │
│ │                               │ │
│ │                               │ │
│ │        GARMENT IMAGE          │ │
│ │                               │ │
│ │                               │ │
│ │                               │ │
│ └───────────────────────────────┘ │
│                                   │
│ Aritzia                       ♡   │
│                                   │
│ Contour Squareneck Bodysuit       │
│ Black · S                         │
│                                   │
│ [ Style it ]      [ Try it on ]   │
│                                   │
│ ────────────────────────────────  │
│                                   │
│ Goes well with                    │
│                                   │
│ ┌───────┐ ┌───────┐ ┌───────┐    │
│ │ jeans │ │ skirt │ │ heels │ →  │
│ └───────┘ └───────┘ └───────┘    │
│                                   │
│ Details                           │
│ Purchase history                  │
│ Wear history                      │
└───────────────────────────────────┘
```

SSENSE is the strongest reference here.

## MIRA AI STYLIST

**Do not make this look like ChatGPT.**

```text
┌───────────────────────────────────┐
│                                   │
│               MIRA                │
│                                   │
│       What are we dressing for?   │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ Dinner with my boyfriend      │ │
│ │ tonight                       │ │
│ │                               │ │
│ │                            →  │ │
│ └───────────────────────────────┘ │
│                                   │
│ Vibe                              │
│                                   │
│ [Cute] [Sexy] [Classy] [Casual]   │
│                                   │
│ I want                            │
│                                   │
│ [Something new]                   │
│ [Haven't worn lately]             │
│ [Favourite pieces]                │
│ [Surprise me]                     │
│                                   │
│ ┌───────────────────────────────┐ │
│ │           Style me            │ │
│ └───────────────────────────────┘ │
│                                   │
│  Home Closet  MIRA  Looks   You   │
└───────────────────────────────────┘
```

## OUTFIT RESULT

```text
┌───────────────────────────────────┐
│ ×                        LOOK 1/3 │
│                                   │
│                                   │
│ ┌───────────────────────────────┐ │
│ │                               │ │
│ │                               │ │
│ │                               │ │
│ │        COMPLETE LOOK          │ │
│ │                               │ │
│ │                               │ │
│ │                               │ │
│ └───────────────────────────────┘ │
│                                   │
│ Dinner Downtown                   │
│                                   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │ top │ │jeans│ │heels│ │ bag │  │
│ └─────┘ └─────┘ └─────┘ └─────┘  │
│                                   │
│ [ Try it on ]                     │
│                                   │
│ ♡ Save         Swap item          │
│                                   │
│          swipe for next →         │
└───────────────────────────────────┘
```

Pinterest + LTK + SSENSE. This should feel like a fashion editorial, and it
should feel addictive to swipe.

## SWAP ITEM

```text
┌───────────────────────────────────┐
│ ←                                 │
│                                   │
│ Swap shoes                        │
│                                   │
│ Mira recommends                   │
│                                   │
│ ┌──────────┐ ┌──────────┐         │
│ │          │ │          │         │
│ │  HEELS   │ │  HEELS   │         │
│ │          │ │          │         │
│ └──────────┘ └──────────┘         │
│                                   │
│ More from your closet             │
│                                   │
│ ┌──────────┐ ┌──────────┐         │
│ │  BOOTS   │ │ SNEAKERS │         │
│ └──────────┘ └──────────┘         │
│                                   │
└───────────────────────────────────┘
```

This is what makes AI styling feel **interactive rather than generative**.

## LOOKS

```text
┌───────────────────────────────────┐
│                                   │
│ Looks                             │
│                                   │
│ Saved   Worn   Mira   Mine        │
│ ─────                             │
│                                   │
│ ┌────────────┐ ┌───────────────┐ │
│ │            │ │               │ │
│ │   LOOK     │ │               │ │
│ │            │ │     LOOK      │ │
│ └────────────┘ │               │ │
│                │               │ │
│ ┌────────────┐ └───────────────┘ │
│ │            │                   │
│ │            │ ┌───────────────┐ │
│ │    LOOK    │ │     LOOK      │ │
│ │            │ │               │ │
│ └────────────┘ └───────────────┘ │
│                                   │
│  Home Closet  MIRA  Looks   You   │
└───────────────────────────────────┘
```

Pinterest-style masonry works here because these are looks rather than
standardized products.

## VIRTUAL TRY-ON RESULT

```text
┌───────────────────────────────────┐
│ ×                            ⋯    │
│                                   │
│                                   │
│                                   │
│                                   │
│        FULL-SCREEN USER           │
│           TRY-ON IMAGE            │
│                                   │
│                                   │
│                                   │
│                                   │
│                                   │
│      ╭─────────────────────╮      │
│      │ Look 02             │      │
│      │                     │      │
│      │ Aritzia + Zara      │      │
│      │                     │      │
│      │ ♡ Save              │      │
│      │ Change item Compare │      │
│      ╰─────────────────────╯      │
│                                   │
└───────────────────────────────────┘
```

Almost nothing should compete with the generated image.

## WARDROBE INSIGHTS

```text
┌───────────────────────────────────┐
│                                   │
│ Your closet lately                │
│                                   │
│ 17 pieces deserve another chance  │
│                                   │
│ ┌────────┐ ┌────────┐ ┌────────┐ │
│ │ dress  │ │  top   │ │ jacket │→│
│ └────────┘ └────────┘ └────────┘ │
│                                   │
│ You've never worn these 👀        │
│                                   │
│ ┌────────────┐ ┌────────────┐     │
│ │            │ │            │     │
│ │ garment    │ │ garment    │     │
│ │            │ │            │     │
│ └────────────┘ └────────────┘     │
│                                   │
│ Your most-loved piece             │
│                                   │
│ ┌───────────────────────────────┐ │
│ │          BLACK TOP            │ │
│ └───────────────────────────────┘ │
│ Worn 11 times                     │
│                                   │
└───────────────────────────────────┘
```

The rule: **turn data into fashion content.** Do not turn fashion into analytics
software.

---

# Evidence behind this direction

- Apparel shoppers rely heavily on product imagery; mobile-commerce usability
  research devotes significant attention to thumbnails, image galleries,
  filtering and list presentation (Baymard Institute, mobile e-commerce
  usability).
- Mobile filtering research supports a dedicated filtering interface with applied
  filters kept visible in the main view, and visual filters for visually distinct
  attributes such as colour (Baymard, ecommerce filter UI).
- Research on female consumers found clothing shown in richer usage context can
  increase perceived emotional value versus plain product presentation — which is
  why Mira shows both the isolated garment *and* the styled outfit.
- Personalization and AI-assisted discovery are increasingly central in fashion
  retail (McKinsey, fashion industry outlook).
- Whering validates demand for wardrobe organization, outfit planning, retailer
  image import, background removal and wardrobe insights. Mira differentiates
  through automatic historical purchase ingestion, much stronger AI styling,
  virtual try-on, and a more premium visual identity.

Star ratings and download counts for the referenced apps do not prove any single
visual style is universally preferred. They are evidence that these interaction
patterns are *familiar* to a large fashion-oriented audience.

---

# Reference image library

```text
reference-images/
├── fashion-nova/   product grid, category nav, filters, favourites
├── ssense/         product detail, search, filters, minimal chrome
├── aritzia/        editorial typography, premium fashion identity
├── whering/        wardrobe mechanics, cutouts, outfit builder
├── ltk/            outfit → constituent products breakdown
└── pinterest/      masonry discovery, saving, boards
```

Each folder should contain a `NOTES.md` recording, per screenshot, **exactly what
Mira should learn from it**. Screenshots are study material: never ship them,
never redistribute them, never use them as placeholder content.
