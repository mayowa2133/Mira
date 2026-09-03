# UX Principles

Seven principles. When two conflict, the earlier one wins.

---

## 1. Images first

Clothing is visual. Garment photography dominates every browsing surface.
Metadata supports the garment; it never competes with it.

**In practice:** two-column grids, not three. At most three text lines on a tile.
Purchase date, SKU, source and wear counts live on detail screens.

## 2. Mira does the work

Getting an item into Mira should require as little work as technically possible.
Never solve an engineering problem by shifting data entry onto the user.

**In practice:** photograph → confirmation screen, not photograph → form. Every
field is prefilled by default. Manual entry exists, and is always the last option
in the hierarchy.

## 3. Honest about what it knows

Machine-generated information carries confidence. Low-confidence values are
presented as questions, not stated as fact. Everything is editable.

**In practice:** "Mira found — Brand: Aritzia ✓, Material: Nylon blend" (no tick
where confidence is low). Never invent a product name to fill a slot.

## 4. Ownership is a user decision

A detected purchase is a *candidate*, not a garment. Only the user turns a
candidate into something in her closet.

**In practice:** candidates live on a review surface, never in the closet grid.
Automatic import is opt-in, notified, and undoable.

## 5. Premium, not busy

The interface gets out of the way so the clothing dominates. Restraint everywhere:
one accent colour used as punctuation, hairline dividers, extremely subtle shadows,
thin icons.

**In practice:** if a screen needs a fifth colour or a third font size, the layout
is wrong.

## 6. Fashion, not analytics

Mira turns data into fashion content, never fashion into a dashboard.

| Wrong | Right |
| ----- | ----- |
| "Utilization rate: 37.4%" | "17 pieces deserve another chance" |
| "You own 328 items · 52 Tops · 31 Dresses" | "Good evening, Maya. What are we wearing tonight?" |
| "Unworn: 14" | "You've never worn these 👀" |

## 7. AI without AI clutter

Avoid sparkle icons and "AI" labels. Mira itself is the intelligence. The stylist
is a fashion surface, not a chat transcript.

**In practice:** the Mira tab shows a prompt, vibe chips and a `Style me` button —
not a message thread. Generation shows outfit pieces assembling, not a spinner.

---

## Interaction conventions

- **Sheets over navigation** for choices — add item, filters, swap, duplicate
  resolution.
- **Sticky CTAs** in sheets that show live consequence: `Show 38 items`,
  `Add 97 items to my closet`.
- **Swipe between looks**, tap into detail. Horizontal for alternatives, vertical
  for depth.
- **Optimistic UI** for favourites, wear marking and status changes; reconcile
  silently, revert visibly with an undo affordance if the write fails.
- **Haptics** on add, favourite, and try-on completion. Nowhere else.
- **Undo, not confirm**, for reversible actions. Confirm only for destructive ones.

## Copy conventions

- Second person, warm, brief. "You haven't worn this in 8 months."
- Never blame the user or the model. "That photo was hard to read — try again with
  the tag flat?" not "Invalid input."
- Numbers appear inside sentences, not as figures. "$180 jacket · 9 wears ·
  $20 / wear" is acceptable because it reads as a fact about a garment.
- Banned words are listed in `docs/01-product/terminology.md`.
