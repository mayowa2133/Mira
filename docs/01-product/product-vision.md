# Mira — Product Vision

## Identity

**Mira**

> Your closet. Your stylist. Your mirror.

Mira is an AI-powered personal wardrobe that learns everything a user owns, makes
digitizing an existing closet dramatically easier, automatically detects future
purchases, helps users discover and style the clothes they already own, and lets
them visualize those exact outfits on their own body.

## The problem

People with large wardrobes often own far more clothing than they can mentally
keep track of. The user may:

- forget clothes she already owns
- leave unworn clothes with tags attached
- buy items similar to things she already owns
- struggle to find a particular garment
- know she owns many clothes while still feeling like she has "nothing to wear"
- struggle to decide which pieces work together
- avoid trying on many outfit combinations because it takes too much time
- forget shoes, bags or accessories that could complete an outfit
- have clothing spread across online orders, physical stores and older purchases

Traditional digital closet apps make the user manually catalogue every item. For
somebody with hundreds of garments, that is unacceptable.

## The principle everything else follows from

> **Mira should do as much of the closet-building work as possible for the user.**

Never solve an engineering problem by shifting unnecessary data entry onto the
user.

## The vision

Mira should become a **digital twin of a person's real wardrobe**.

Eventually Mira should understand, for every item:

what it looks like · its category · brand · colour · size · material · fit ·
style · season · the occasions it works for · when it was purchased · how much it
cost · where it came from · whether it still has tags · whether it has ever been
worn · when it was last worn · what it works well with · whether similar items
already exist · whether it is currently available · whether it is in the laundry ·
whether it was returned, sold or donated.

Mira should then use that knowledge to answer questions like:

- "Show me all of my black dresses."
- "What heels do I own?"
- "Do I already have a beige bag?"
- "What did I buy from Fashion Nova last year?"
- "Show me things I've never worn."
- "What should I wear to dinner tonight?"
- "Make me an outfit around these jeans."
- "Give me something I haven't worn recently."
- "Do I already own something similar to this?"
- "Show me how this outfit would look on me."

## The five pillars

### 1. Capture

Get clothing into Mira with as little effort as possible. Supported ingestion
methods: clothing photograph · multiple photographs · tag photograph · barcode/QR
scan · paper receipt · receipt screenshot · order screenshot · email purchase
detection · product URL · retailer integration · manual entry.

### 2. Understand

Extract or infer category, subcategory, brand, product name, colour, secondary
colours, pattern, material, size, fit, sleeve type and length, neckline, length,
style descriptors, season, occasions, purchase source, price, date, product
identifier, SKU, barcode and source URL.

Attach confidence to every machine-generated field. Low-confidence information is
presented for confirmation, never silently treated as fact.

### 3. Inventory

A searchable, browsable representation of the physical closet — visual first.

### 4. Style

An AI personal stylist that primarily recommends clothes the user already owns.

> Mira's first question is always: **what can we create from what you already own?**

Mira is not primarily a shopping recommendation engine.

### 5. Mirror

Virtual try-on of the exact selected garments on the user's own body.

## The ultimate experience

The user buys clothing. Mira knows.

She opens Mira and asks *"What should I wear tonight?"* Mira understands where she
is going, the weather, what she likes, what she owns, what she has recently worn,
what is currently available, and what pieces she has neglected. It generates
several outfits from her actual clothes. She taps one. Mira shows the outfit on
her. She likes it. She gets dressed.

That entire journey should happen without the user mentally searching through
hundreds of pieces of clothing.

**That is Mira.**

## Related

- [PRD](prd.md) · [Personas](personas.md) · [Roadmap](roadmap.md) ·
  [Non-goals](non-goals.md)
