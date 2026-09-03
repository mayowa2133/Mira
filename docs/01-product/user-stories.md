# User Stories

Format: `As <persona>, I want <capability>, so that <outcome>.`
Each story carries acceptance criteria that a test can assert.

---

## Epic A — Get my existing closet into Mira

**A1.** As Maya, I want to photograph a garment and have Mira work out what it is,
so that I don't have to fill in a form.
- Given a clear photo of one garment, when analysis completes, then category and
  primary colour are populated with confidence ≥ the display threshold.
- The review screen shows at most the fields Mira is unsure about as prompts.
- Every populated field is editable before saving.

**A2.** As Maya, I want to scan a clothing tag, so that Mira gets the brand and
size right without me typing them.
- Given a legible brand + size label, brand and size are prefilled.
- Given an unreadable label, the flow degrades to photo capture rather than
  failing.

**A3.** As Maya, I want to scan a receipt and add several pieces at once, so that
a shopping trip becomes one action instead of four.
- Line items are extracted with prices and pre-checked.
- I can uncheck any line before adding.
- Non-clothing lines are excluded by default.

**A4.** As Maya, I want Mira to find things I already bought online, so that my
closet is populated without me doing anything.
- After connecting email, Mira presents candidates grouped by retailer.
- No candidate becomes a closet item until I confirm ownership.
- I can disconnect email and delete derived data at any time.

**A5.** As Maya, I want Mira to notice when I'm adding something I already own,
so that my closet doesn't fill with duplicates.
- A likely duplicate triggers the resolution sheet before saving.
- Choosing "I own two" creates a second garment and links them.

---

## Epic B — Know what I own

**B1.** As Maya, I want to browse my closet visually, so that it feels like
looking at clothes rather than reading a list.
- Two-column grid, large imagery, at most four short lines of metadata per card.

**B2.** As Maya, I want to search in my own words, so that I don't have to know
Mira's categories.
- "black dresses" returns dresses whose primary colour is black.
- "heels I haven't worn recently" returns heel-subcategory shoes ordered by
  last-worn ascending, excluding never-worn only if the query implies prior wear.
- "things that still have tags" returns garments with `tags_attached = true`.

**B3.** As Maya, I want to combine filters, so that I can narrow to exactly what I
mean.
- Category + colour + occasion + status combine with AND semantics.
- Applied filters are visible as removable chips while browsing.

**B4.** As Maya, I want to see everything about one piece on one screen, so that I
can decide whether to wear it.
- Detail shows images, brand, name, colour, size, material, purchase info, source,
  wear history and status.

---

## Epic C — Decide what to wear

**C1.** As Maya, I want to describe where I'm going and get complete outfits, so
that I don't have to assemble one myself.
- Every returned look contains only garments I own with an outfit-eligible status.
- At least three looks are returned when the closet can support them.
- Each look names the occasion it was built for.

**C2.** As Maya, I want to swap one piece I don't like, so that a good outfit
isn't wasted by one bad choice.
- Tapping a slot shows recommended alternatives plus the rest of that category.
- Selecting an alternative updates the look without changing the other slots.

**C3.** As Maya, I want to build an outfit myself, so that I can plan ahead.
- Slots can be filled from a filtered closet view and saved with a name.

**C4.** As Maya, I want Mira to skip things in the laundry, so that its suggestions
are actually wearable tonight.
- Garments with status `laundry`, `lent_out`, `unavailable`, `lost`, `returned`,
  `sold`, `donated` or `archived` never appear in a generated look.

**C5.** As Alex, I want Mira to show me things I've forgotten, so that I stop
wearing the same 20% of my closet.
- The home surface includes at least one rediscovery card when eligible garments
  exist.

---

## Epic D — See it on me

**D1.** As Maya, I want to add body photos privately, so that Mira can show
clothes on me.
- Body images are private by default, are never used for anything but try-on, and
  can be deleted.

**D2.** As Maya, I want to see a specific outfit on my body, so that I don't have
to physically try it on.
- The generated image reproduces the actual selected garments, not similar ones.
- The result screen names every garment in the look.

**D3.** As Maya, I want to compare two looks on me, so that I can pick one.
- Compare mode moves between generated looks for the same body reference.

**D4.** As Maya, I want to delete a try-on, so that I control images of myself.
- Deletion removes the stored generation and its cached copies.

---

## Epic E — Keep it effortless

**E1.** As Maya, I want new purchases to appear automatically, so that my closet
stays current without maintenance.
- A detected purchase produces a notification with Add / Returned / Not mine.

**E2.** As Nina, I want to know what a piece has cost me per wear, so that I buy
better.
- Cost per wear appears on garments with a known price and ≥1 wear event.

**E3.** As Maya, I want to correct anything Mira got wrong, so that my closet is
actually accurate.
- Every AI-generated field is editable from garment detail.
