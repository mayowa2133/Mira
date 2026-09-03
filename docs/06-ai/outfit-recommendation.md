# Outfit Recommendation

The Mira stylist. Complete looks, built from garments the user actually owns.

**Capability:** `reasoning`
**Consumers:** F-11, F-12, Home "today's look"

---

## 1. The governing constraint

> Mira's first question is always: **what can we create from what you already own?**

Mira is not a shopping engine. Every look is made of owned, available garments.

## 2. Pipeline

```text
prompt + vibe + priority + anchor
  → interpret request  → { occasion, formality, weather_need, constraints }
  → eligibility filter → status = active, season match, occasion match
  → candidate set      → structured + vector retrieval, capped at ~60 garments
                         with short stable ids (g1, g2, …)
  → compose            → LLM builds N looks using ONLY candidate ids
  → validate           → every id exists · owned · eligible · slot-appropriate
                         any violation → that look is dropped and regenerated once
  → rank               → variety, priority alignment, recency spread
  → persist            → recommendations row (prompt, candidates, looks)
  → return
```

Step "validate" is what makes AI-6 an invariant. The model cannot name a garment
the user does not own, because it can only emit ids from a set the server built.

## 3. What the stylist considers

```text
wardrobe inventory        colours and garment compatibility
occasion                  season and temperature
dress code                footwear
weather (when authorized) bags
location (when relevant)  accessories
style preferences         recently worn pieces
favourite items           underused pieces
                          unavailable clothing (excluded)
```

## 4. Eligibility

Only `status = active` garments participate (INV-2). A dress in the `laundry` is
not recommended for tonight — that single rule is most of what makes the stylist
feel like it knows her life.

Other exclusions:
- garments worn in the last 3 days, unless `priority = favourite_pieces`
- garments whose season conflicts hard with the current one (a puffer in July)
- for `priority = havent_worn_lately`, garments worn in the last 60 days are
  down-weighted, not excluded

## 5. Priority modes

| Priority | Effect |
| -------- | ------ |
| `something_new` | Favour recently added garments |
| `havent_worn_lately` | Favour high `days_since_worn`; never-worn first |
| `favourite_pieces` | Favour `favorite = true` and high wear counts |
| `surprise_me` | Widen the candidate set; permit bolder combinations |

## 6. Output contract

```json
{
  "title": "Dinner downtown",
  "rationale": "Your black corset top with the wide-leg jeans, kept simple.",
  "items": [
    { "slot": "top", "garment_id": "g12" },
    { "slot": "bottom", "garment_id": "g44" },
    { "slot": "shoes", "garment_id": "g07" },
    { "slot": "bag", "garment_id": "g31" }
  ],
  "missing_slots": []
}
```

- `title` is short and occasion-shaped, never "Look 1".
- `rationale` is one line, shown sparingly. It is not an essay about her body or
  her taste.
- `missing_slots` is honesty: if she owns no heels, the look says so rather than
  inventing a pair (STY-4).

### Slot rules

- `dress` excludes `top` + `bottom` unless the request implies layering.
- `shoes` is required for a complete look.
- `bag` and `accessory` are optional but strongly preferred — forgetting them is
  one of the problems Mira exists to solve.
- `accessory` may repeat; every other slot is single.

## 7. Anchoring

"Give me something around this skirt" pins that garment into its slot. The
candidate set is then built around it, and every returned look contains it.

## 8. Swap

`POST /outfits/:id/swap` regenerates **only** the named slot. Options are ranked
by compatibility with the *unchanged* slots. The rest of the look is untouched —
that is what makes styling feel interactive rather than generative (F-12).

## 9. Clarifying questions

Mira may ask at most one or two, and only when the answer materially changes the
look (e.g. "Indoors or outdoors?" for an ambiguous winter event). Questions are
chips, never a chat turn. When in doubt, Mira produces looks and lets the user
adjust — a suggestion is faster to correct than a question is to answer.

## 10. Failure handling

| Failure | Handling |
| ------- | -------- |
| Closet too small for a full look | Return partial looks with `missing_slots` populated, and say so |
| Model returns an unknown id | Drop the look, regenerate once, then return fewer looks |
| Model returns fewer than requested | Return what is valid; never pad |
| Provider unavailable | Offer saved looks and previously worn combinations |
| No eligible garments (everything in laundry) | Say exactly that — it is useful information |

Returning two good looks beats returning three where one is wrong.

## 11. Tone

The rationale never comments on the user's body, weight, or attractiveness, and
never implies she should own something else. It describes the clothes.

## 12. Evaluation

Dataset: 100 outfit requests across occasions, against the `realistic` seed
closet, with stylist-rated outputs.

| Metric | Target |
| ------ | ------ |
| **Hallucinated garment rate** | **0.00** — hard gate |
| Ineligible garment rate (laundry, archived, etc.) | 0.00 — hard gate |
| Complete-look rate (all required slots filled when possible) | ≥ 0.95 |
| Occasion appropriateness (human-rated) | ≥ 0.85 |
| Colour/style coherence (human-rated) | ≥ 0.80 |
| Variety across the three returned looks | ≥ 0.75 distinct garments |
| User acceptance rate (saved, worn, or tried on) | ≥ 0.40 |
| Regeneration rate | ≤ 0.30 |

The first two are gates, not targets: a release that produces one hallucinated
garment does not ship.
