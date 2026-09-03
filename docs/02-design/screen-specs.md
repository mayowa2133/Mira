# Screen Specifications

28 screens. Each entry gives purpose, layout, content, actions, states and the
assigned visual reference. Wireframes live in
[visual-references.md](visual-references.md); tokens live in
[design-system.md](design-system.md).

Before implementing any screen, follow the **Visual Implementation Rule** in
`AGENTS.md`.

---

## 1. Splash

Minimal **MIRA** wordmark, `type.wordmark`, `color.text`, centred on
`color.bg`. Short fade + 1.02 scale settle (`motion.hero`). No spinner, no
tagline. Maximum 900 ms before routing to Welcome, Onboarding or Home.

---

## 2. Welcome

Full-screen lifestyle/fashion photography with a bottom gradient scrim.
**MIRA** top-centre. Headline: *Your closet. Your stylist. Your mirror.*
Primary `Get started`, tertiary `I already have an account`.

Reference: Aritzia editorial.

---

## 3. Value proposition

Three swipeable full-bleed cards with page dots:

1. **Know what you own** — Mira finds the clothes you already have.
2. **Style what you own** — Outfits from your closet, for wherever you're going.
3. **See it on you** — Try a look on before you put it on.

`Continue` on the last card. Skippable via `Skip` top-right.

---

## 4. Create account

Ivory background, wordmark, three stacked options: `Continue with Apple`,
`Continue with Google`, `Continue with email`. Legal copy in `type.caption`,
`textTertiary`. No decoration.

Errors appear inline beneath the tapped option. Never a system alert.

---

## 5. Build your closet

The most important onboarding screen — it must communicate that Mira handles
closets that already exist.

```text
Let's find what you already own

┌─────────────────────────────────────────┐
│ ✉️  Find online purchases               │
│    Connect email and find clothes you   │
│    already bought                       │
└─────────────────────────────────────────┘
  🧾  Scan receipts
  📸  Scan clothes
  🏷   Scan tags

  I'll do this later
```

The email option gets visual priority (largest card) because it has the highest
item-per-action yield. `I'll do this later` is a tertiary action, never styled as
failure.

---

## 6. Email import — privacy explainer

Premium, plain-language, no legalese. Three short lines:

- **What Mira reads** — order and shipping confirmations from retailers.
- **What Mira keeps** — the item, price, retailer and date. Not your inbox.
- **You're in control** — disconnect any time, and delete what Mira found.

Primary `Connect email`. Tertiary `Not now`. A link to
`docs/07-security/privacy.md` content rendered in-app.

---

## 7. Purchase discovery

Animated processing state, not a progress bar. Live count that climbs:
*"Looking through your purchases… 38 found."* Retailer names fade in as they are
recognized. Backgroundable — the user may leave and be notified.

---

## 8. Purchase review

Reference 01 (Fashion Nova grid).

Header `We found 126 pieces 👀`, retailer strip with counts (tap to filter),
then a two-column grid of candidates with a selection tick on each tile.

Tapping a tile opens the ownership sheet:
`Yes — in my closet` · `Returned it` · `Sold / donated` · `Not mine` ·
`Not sure`.

Sticky footer: `Add 97 items to my closet` (live count).

**States:** loading · empty ("We couldn't find purchases in that account") ·
partial ("Still looking through older orders") · error · offline.

---

## 9. Scan closet (garment camera)

Full-screen camera. Only: `×` top-left, a rounded silhouette guide, the hint
*"Place one item in frame"*, a large circular shutter, and `Upload instead`.

No nav bar, no tab bar, no filters, no flash clutter (flash is a small icon
top-right only).

After capture: instant local preview, background upload, and a subtle
`Got it.` confirmation before routing to review.

---

## 10. Scan tag

Same shell as screen 9, tuned for labels: closer minimum focus, higher exposure,
live barcode detection with a subtle highlight when a code is found. Hint:
*"Point at the tag — brand, size or barcode."*

---

## 11. Scan receipt

Document capture with edge detection and auto-shutter, plus `Choose file` for
screenshots and PDFs. After extraction, the multi-item confirmation list:

```text
We found 4 possible items
☑ Black Mini Dress — Zara      $49.99
☑ Straight Leg Jeans — Zara    $69.99
☑ Ribbed Top — Zara            $29.99
☑ Shoulder Bag — Zara          $59.99

Show all lines (2 hidden)
[ Add 4 items ]
```

---

## 12. AI item review

Reference 02 (SSENSE product detail).

Large cleaned garment image, roughly half the screen. Then:

```text
ARITZIA                          ← type.brand, uppercase, textSecondary
Contour Squareneck Bodysuit      ← type.title2
Black · Small                    ← type.body, textSecondary

[Bodysuit] [Black] [Dinner] [Going Out] [Summer]   ← editable chips

Mira found
Brand      Aritzia            ✓
Size       Small              ✓
Material   Nylon blend            ← no tick: low confidence
Purchased  Unknown                ← tappable to add

[ Add to my closet ]
```

**Rules**

- A tick appears only above the display-confidence threshold.
- Low-confidence fields read as prompts, never as claims.
- Every row is tappable to correct.
- This must look like a fashion product page, not an AI output screen.

---

## 13. Home

Reference: Fashion Nova merchandising + Pinterest discovery.

```text
MIRA                                   ◯ avatar
Wednesday, September 3            ← type.caption, textSecondary
Good evening, Maya                ← type.display

What are we wearing tonight?      ← type.title2

[ ─────── full-width outfit image ─────── ]
Dinner downtown
Your black top + wide-leg jeans
[ Try it on ]        ♡ Save        Shuffle

──────────────────────────────────

Ask Mira
[ What are you dressing for?            → ]
Dinner   Going Out   Casual   Work   Vacation

Rediscover your closet
"You haven't worn this in 8 months"
[garment] [garment] [garment] →

Recently added
[garment] [garment] [garment] →

Still has tags 👀
[garment] [garment] →

Saved looks
[look] [look] →
```

**Forbidden:** any counts-first block ("You own 328 items · 52 Tops · 31
Dresses"). That is inventory-software thinking.

Time-aware greeting and prompt ("Going somewhere tonight?" after 5pm).

**States:** empty closet (a single warm invitation to add the first piece, with
the same four import options as onboarding) · few items (<10: hide rediscovery,
show "Keep building your closet") · loading (skeleton tiles) · offline (cached
closet, stylist disabled with an explanation).

---

## 14. Closet

Reference 01.

```text
Closet                                 + Add
327 pieces

[ 🔍 Search your closet                    ]

All  Tops  Bottoms  Dresses  Shoes  Bags →

Filter                                  Sort
[Black ✕] [Dresses ✕]        ← applied filter chips

┌──────────┐ ┌──────────┐
│  image   │ │  image   │
└──────────┘ └──────────┘
ZARA          FASHION NOVA
Satin Midi    Corset Top
Black · S ♡   Cream · S  ♥
```

Two columns. Infinite scroll with paged fetch. Sort options: recently added ·
recently worn · never worn · brand · colour · price.

**States:** loading skeletons · empty ("Your closet is empty" + import options) ·
filtered-empty ("No pieces match — clear filters") · error · offline (cached).

---

## 15. Search

Full-screen on focus. Recent searches, then suggested natural-language examples.
As results arrive, Mira's interpretation appears as removable chips above the
grid so the user can see and correct what was understood.

```text
[ 🔍 heels I haven't worn recently        ✕ ]

Mira understood
[Shoes ✕] [Heels ✕] [Not worn in 90 days ✕]

38 pieces
[grid]
```

**States:** idle (recents + suggestions) · searching · results · no results
("Nothing matched — try 'black dresses'") · error.

---

## 16. Filters

Full-height sheet, Reference 03.

```text
Filter                                 Reset

Category    visual tiles: Tops Dresses Bottoms Shoes Bags
Colour      true colour circles with names
Brand       searchable list
Occasion    Dinner · Going Out · Casual · Work · Wedding · Vacation · Gym · Beach
Status      Never Worn · Still Has Tags · Recently Added · Favourite · Laundry
Season      Spring · Summer · Fall · Winter
Size        chips
Price       range

[ Show 38 items ]     ← sticky, live count
```

Filters apply on the CTA, not on every tap. Applied filters remain visible as
chips in the Closet.

---

## 17. Garment detail

Reference 02 + Reference 05.

Full-bleed hero image, swipeable: cutout → back → original photo → retailer
image, with page dots. Overflow `⋯` top-right (edit, mark worn, mark laundry,
archive, remove).

```text
ARITZIA                                  ♡
Contour Squareneck Bodysuit
Black · S

[ Style it ]              [ Try it on ]

──────────────────────────────

Goes well with
[jeans] [skirt] [heels] [bag] →      ← things she OWNS

Details            (collapsible)
  Category · Material · Fit · Season · Occasion · Size
Purchase history   (collapsible)
  Retailer · Date · Price · Source
Wear history       (collapsible)
  Worn 11 times · Last worn 12 Aug · Cost per wear $16
```

"Goes well with" must contain only owned garments — never products for sale.
This is one of Mira's biggest differences.

---

## 18. Add item menu

Bottom sheet. The camera option is a large card; the rest are rows. Manual entry
is always last.

```text
Add to your closet

┌───────────────────────────────┐
│ 📸  Scan an item              │
│ Photograph something you own  │
└───────────────────────────────┘
🏷   Scan a tag
🧾   Scan a receipt
✉️   Find online purchases
🖼   Choose a photo
🔗   Paste product link
✎    Add manually
```

---

## 19. Mira stylist

**Must not look like ChatGPT.** No message bubbles, no transcript, no avatar.

```text
              MIRA

    What are we dressing for?

[ Dinner with my boyfriend tonight    → ]

Vibe
[Cute] [Sexy] [Classy] [Casual] [Comfy] [Minimal]

I want
[Something new] [Haven't worn lately]
[Favourite pieces] [Surprise me]

[ Style me ]
```

Generating state assembles the outfit rather than spinning:
`Top ✓ · Bottom ✓ · Shoes ✓ · Bag ✓`.

Mira may ask at most one or two clarifying questions, and only when necessary —
rendered as chips, not as a chat turn.

---

## 20. Outfit recommendations

Full-screen swipeable cards, Reference 05 + Pinterest.

```text
×                                LOOK 1/3

[ ────── complete look image ────── ]

Dinner Downtown

[top] [jeans] [heels] [bag]     ← tappable, tap = swap

[ Try it on ]
♡ Save              Swap item
        swipe for next →
```

Neighbouring cards scale slightly during the swipe.

**States:** generating · results · closet-too-small ("I couldn't build a full
look — here's the closest I can do, and what's missing") · error · offline.

---

## 21. Look detail

Large look image, occasion title, then every constituent garment as a tappable
row with thumbnail, brand and name. Actions: `Try it on`, `Wear this`, `♡`,
`Edit look`, `Duplicate`, `Delete`.

---

## 22. Looks library

Pinterest-style masonry, Reference 04. Tabs: `Saved` · `Worn` · `Mira` · `Mine`.
Cards are non-uniform because they are looks, not standardized products — outfit
collages, try-on results, and user photos coexist.

**Empty state per tab**, each with a route out: e.g. Saved → "Ask Mira for a look."

---

## 23. Virtual try-on setup

```text
Meet your Mira

Add a few photos so Mira can show your wardrobe on you.

Your photos are private. Only you can see them, and you can
delete them at any time. Try-on shows how a piece looks —
it can't promise how it fits.

Front photo        (required)  [ Take photo ]
Side photo         (optional)
Another reference  (optional)

Height (optional)  ▢
Usual size (optional) ▢

[ Save body profile ]
```

Guidance on capture: full body in frame, plain background, fitted clothing, good
light. Copy must never imply guaranteed fit (TRY-2).

---

## 24. Try-on generation

Outfit summary at top, body reference selector if more than one exists, then
`Generate try-on`. Progress is honest — an estimated time, a soft shimmer, and a
note that the user can leave and be notified.

---

## 25. Try-on result

Almost entirely full-screen image. `×` top-left, `⋯` top-right (save to photos,
delete, report a bad result). Floating glass panel at the bottom:

```text
Look 02
Aritzia top + Zara jeans + Steve Madden heels
♡ Save      Change item      Compare
```

**Compare mode:** swipe between generations for the same body reference, or show
side-by-side thumbnails beneath. This answers the real question — *"which one
actually looks better on me?"*

---

## 26. Wardrobe insights

Fashion content, not a dashboard.

```text
Your closet lately

17 pieces deserve another chance
[garment] [garment] [garment] →

You've never worn these 👀
[garment] [garment]

Your most-loved piece
[ ──── image ──── ]
Black Aritzia top · Worn 11 times

You might already own this
[pair] [pair]

Closet value          (optional, collapsed by default)
Cost per wear         (optional, collapsed by default)
```

Numbers stay secondary to imagery.

---

## 27. Wear history

Calendar or timeline of what was worn when, with garment thumbnails per day.
Tapping a day shows the look or the individual garments. Supports adding a past
wear.

---

## 28. You / Profile

```text
◯  Maya
   maya@example.com

Style preferences          →
Body profile               →
Connected accounts         →      (email, retailers; disconnect here)
Privacy & data             →      (delete body photos, try-ons, account)
Notifications              →
Appearance                 →
Help                       →
About Mira                 →
```

Privacy & data must expose, in one place: delete body images, delete try-ons,
disconnect email and delete derived candidates, export data, delete account.

---

## Cross-cutting requirements

Every screen must implement the states defined in
[states-and-errors.md](states-and-errors.md) and satisfy
[accessibility.md](accessibility.md) before it is considered done.
