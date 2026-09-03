# Roadmap

Sequenced by dependency, not by date. Each phase ends with something a real user
could hold.

---

## Phase 0 — Foundation

Repository · Expo application · backend · database · authentication ·
environments · CI · analytics · error reporting.

**Exit:** a signed-in user sees an empty closet on a real device, and CI is green.

## Phase 1 — Closet core

Garment schema · storage · closet grid · garment details · categories ·
add/edit/delete · favourites.

**Exit:** a garment can be created manually and browsed beautifully.

## Phase 2 — Photo capture

Camera · library · uploads · image processing · segmentation · confirmation flow.

**Exit:** photograph a dress → it appears in the closet as a clean cutout.

## Phase 3 — Garment intelligence

Classification · attributes · confidence · correction UI · product matching.

**Exit:** photographing a garment fills in category, colour and often brand, with
confidence surfaced honestly.

## Phase 4 — Bulk existing-closet import

Tag scanning · barcode/SKU · receipt scanning · multi-item confirmation.

**Exit:** a user with 200 garments can make real progress in one sitting.

## Phase 5 — Search

Filters · natural-language search · embeddings · relevance evaluation.

**Exit:** "black dresses" and "things that still have tags" both work.

## Phase 6 — Outfits

Outfit data model · builder · saved outfits · favourites.

**Exit:** the user can compose and save a look.

## Phase 7 — Mira stylist

Outfit recommendations · occasion understanding · wardrobe constraints ·
personalization.

**Exit:** "dinner downtown tonight" returns three wearable looks from owned
clothes. **This is the first moment Mira is worth opening daily.**

## Phase 8 — Purchase automation

Email connection · receipt detection · purchase extraction · candidate queue ·
product matching · duplicate checking · notifications.

**Exit:** the closet stays current with near-zero user effort.

## Phase 9 — Wardrobe intelligence

Worn tracking · unworn · underused · duplicate ownership · cost per wear ·
wardrobe statistics.

**Exit:** Mira gives the user a reason to open it even when she isn't getting
dressed.

## Phase 10 — Virtual try-on

Body profile · image requirements · provider abstraction · generation · storage ·
comparison · garment-fidelity evaluation.

**Exit:** she sees the outfit on herself, and it is recognizably *that* garment on
*her*.

## Phase 11 — Personalization

Style learning · recommendation feedback · preference learning · outfit ranking.

**Exit:** Mira's third suggestion is better than its first was a month ago.

---

## Sequencing rules

1. **Inventory before try-on.** Phase 10 does not start early, however tempting the
   demo is.
2. **Capture before intelligence.** Phases 2 and 4 remove far more friction than any
   model improvement in Phase 3 can.
3. **Search before stylist.** The stylist is a retrieval problem wearing a
   fashion coat; Phase 5 is its foundation.
4. A phase is not complete until it satisfies
   `docs/08-engineering/definition-of-done.md`.
