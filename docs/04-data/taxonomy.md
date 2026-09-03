# Canonical Taxonomy

**This file is the single source of truth for every enumerated value in Mira.**

- `packages/taxonomy` is **generated** from this document. Application code reads
  it; application code never adds to it.
- AI systems cannot invent incompatible values. Model output is clamped to this
  taxonomy before persistence (AI-3).
- Adding, renaming or removing a value requires: an edit here, a regenerated
  package, a migration, and a line in `docs/09-decisions/changelog.md`.
- Every enum includes `other` where a real-world value may not fit. `other` is a
  valid answer; inventing a new value is not.

Storage convention: `snake_case` string values in the database. Display labels
live in the client's copy layer, not in the data.

---

## 1. Categories and subcategories

```text
TOPS
├── t_shirt
├── tank
├── blouse
├── shirt
├── sweater
├── cardigan
├── hoodie
├── bodysuit
├── crop_top
└── other

BOTTOMS
├── jeans
├── trousers
├── leggings
├── shorts
├── skirt
├── sweatpants
└── other

DRESSES
├── mini_dress
├── midi_dress
├── maxi_dress
├── bodycon_dress
├── cocktail_dress
├── slip_dress
├── formal_dress
└── other

SETS
├── co_ord
├── suit
├── jumpsuit
├── romper
└── other

OUTERWEAR
├── jacket
├── denim_jacket
├── leather_jacket
├── blazer
├── coat
├── trench
├── puffer
├── vest
└── other

SHOES
├── heels
├── flats
├── sneakers
├── boots
├── ankle_boots
├── sandals
├── loafers
├── mules
└── other

BAGS
├── shoulder_bag
├── tote
├── crossbody
├── clutch
├── mini_bag
├── backpack
└── other

ACCESSORIES
├── jewelry
├── belt
├── hat
├── scarf
├── sunglasses
├── hair_accessory
├── gloves
├── watch
└── other

ACTIVEWEAR
├── sports_bra
├── active_top
├── active_leggings
├── active_shorts
├── active_set
└── other

SWIMWEAR
├── bikini
├── one_piece
├── cover_up
└── other

OTHER
└── other
```

**Rules**

- Every garment has exactly one category and at most one subcategory.
- A subcategory must belong to its category. `dresses/heels` is invalid.
- The closet category chips show: All · Tops · Bottoms · Dresses · Shoes · Bags ·
  Outerwear · Accessories · Sets · Activewear · Swimwear · Other.

---

## 2. Colours

Canonical colour names with swatch values. The swatch is for the colour filter
UI (Reference 03); it is not the garment's real colour.

| Value | Swatch | Value | Swatch |
| ----- | ------ | ----- | ------ |
| `black` | `#000000` | `red` | `#C0392B` |
| `white` | `#FFFFFF` | `burgundy` | `#6E1F2B` |
| `ivory` | `#F6F1E7` | `pink` | `#E8A0B4` |
| `cream` | `#EFE6D6` | `blush` | `#F0D3D1` |
| `beige` | `#D8C7AE` | `hot_pink` | `#D6237D` |
| `tan` | `#C09A6B` | `orange` | `#D97136` |
| `brown` | `#7A5334` | `peach` | `#F2C0A0` |
| `chocolate` | `#4A3227` | `yellow` | `#E9C349` |
| `grey` | `#9A9691` | `mustard` | `#C39A2E` |
| `charcoal` | `#3B3A38` | `green` | `#3F7A52` |
| `silver` | `#C4C6C8` | `olive` | `#6B6A3A` |
| `gold` | `#C0A062` | `sage` | `#A3B29A` |
| `navy` | `#1E2A45` | `emerald` | `#1F6B54` |
| `blue` | `#3A5DA8` | `purple` | `#6B4A8C` |
| `light_blue` | `#A9C4E0` | `lilac` | `#C3AED6` |
| `denim` | `#4A6484` | `multicolor` | *gradient* |

**Rules**

- One `primary_color`, plus any number of `secondary_colors`.
- `multicolor` is a primary colour only when no single colour dominates.
- Colour swatches in the UI always carry the colour **name** as well (A11Y-4).

---

## 3. Patterns

```text
solid · striped · floral · animal_print · plaid · checked · polka_dot ·
geometric · abstract · tie_dye · camouflage · logo · lace · sequin ·
metallic · embroidered · other
```

---

## 4. Materials

```text
cotton · linen · silk · satin · wool · cashmere · denim · leather ·
faux_leather · suede · polyester · nylon · viscose · rayon · modal ·
spandex · knit · mesh · velvet · corduroy · fleece · down · other
```

A garment may have several materials. Material is frequently low-confidence from a
photograph alone — it is a prime example of a field that should be shown without a
tick rather than asserted.

---

## 5. Fit

```text
slim · fitted · bodycon · regular · relaxed · oversized · loose ·
straight · skinny · wide_leg · flare · bootcut · tapered · cropped · a_line
```

---

## 6. Sleeves, necklines, lengths

**Sleeve length**
```text
sleeveless · cap · short · three_quarter · long · extra_long
```

**Sleeve type**
```text
none · set_in · raglan · puff · bishop · bell · dolman ·
off_shoulder · one_shoulder · strapless · spaghetti_strap · halter
```

**Neckline**
```text
crew · v_neck · scoop · square · sweetheart · halter · off_shoulder ·
one_shoulder · turtleneck · mock_neck · cowl · collared · boat ·
plunge · strapless · other
```

**Length**
```text
cropped · hip · tunic · mini · midi · maxi · ankle · floor
```

---

## 7. Season

```text
spring · summer · fall · winter
```

A garment may belong to several seasons. Empty means all-season.

---

## 8. Occasion

```text
casual · work · school · brunch · dinner · date · going_out · party ·
club · wedding · formal · vacation · beach · gym · lounge · travel
```

The stylist maps free-text prompts onto these values; the mapping lives in
`docs/06-ai/outfit-recommendation.md`.

---

## 9. Style tags

```text
minimal · classic · edgy · feminine · romantic · sporty · streetwear ·
preppy · bohemian · glam · y2k · coquette · western · grunge · business
```

Style tags are descriptive, not exclusive. They power the Vibe chips and
personalization.

---

## 10. Garment status

| Value | Meaning | Outfit-eligible |
| ----- | ------- | --------------- |
| `active` | In the closet and wearable | **Yes** |
| `laundry` | In the wash | No |
| `unavailable` | Temporarily not wearable (repair, storage) | No |
| `lent_out` | Lent to someone | No |
| `returned` | Returned to the retailer | No |
| `sold` | Sold | No |
| `donated` | Donated or given away | No |
| `lost` | Lost | No |
| `archived` | Kept in Mira, hidden from the closet | No |

> Only `active` participates in generated outfits (INV-2). A dress marked
> `laundry` is not recommended for tonight.

`returned`, `sold`, `donated` and `lost` are retained rather than deleted, because
purchase history and cost-per-wear remain meaningful.

---

## 11. Garment source

```text
manual · camera · photo_library · tag_scan · barcode · receipt ·
email · retailer_integration · product_url · order_screenshot
```

**Provenance is never discarded or overwritten** (CAP-3). Editing a garment does
not change how it entered Mira.

---

## 12. Purchase candidate status

```text
detected · processing · needs_review · confirmed_owned ·
returned · not_mine · removed · uncertain · ignored
```

| Value | Meaning | Creates a garment |
| ----- | ------- | ----------------- |
| `detected` | Found, not yet processed | No |
| `processing` | Being matched | No |
| `needs_review` | Awaiting the user | No |
| `confirmed_owned` | User says they own it | **Yes** |
| `returned` | User returned it | No |
| `not_mine` | Bought for someone else, or not the user's | No |
| `removed` | User dismissed it | No |
| `uncertain` | "Not sure" — stays reviewable | No |
| `ignored` | Not clothing, or otherwise irrelevant | No |

---

## 13. Garment image kind

```text
canonical · original · cleaned · front · back · side · detail · retailer
```

`canonical` is the primary display image — usually the cleaned cutout, falling
back to the original when segmentation fails.

---

## 14. Outfit slots

```text
top · bottom · dress · layer · shoes · bag · accessory
```

`dress` is mutually exclusive with `top` + `bottom` by default; the user may
override (layering a top over a dress is legitimate). `accessory` may repeat.

---

## 15. Sizes

Sizes are stored as entered plus a normalized form, because retailers disagree.

| System | Examples |
| ------ | -------- |
| `alpha` | XXS · XS · S · M · L · XL · XXL · XXXL |
| `numeric_us` | 00 · 0 · 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 |
| `numeric_eu` | 32 · 34 · 36 · 38 · 40 · 42 · 44 |
| `waist` | 24 · 25 · 26 · 27 · 28 · 29 · 30 · 31 · 32 |
| `shoe_us` | 5 · 5.5 · 6 · … · 12 |
| `shoe_eu` | 35 · 36 · 37 · … · 43 |
| `one_size` | OS |

`size_raw` keeps exactly what the tag or receipt said. `size_normalized` and
`size_system` are derived and may be null.

---

## 16. Confidence bands

| Band | Range | UI treatment |
| ---- | ----- | ------------ |
| High | ≥ 0.85 | Shown as confirmed, with a tick |
| Medium | 0.60 – 0.849 | Shown without a tick, tappable to confirm |
| Low | 0.35 – 0.599 | Shown as a question ("Is this…?") |
| Very low | < 0.35 | Not shown; the field stays empty and tappable |

Auto-accept for opt-in automatic purchase import requires ≥ 0.92 **and** a
matching SKU, barcode or product URL.

---

## 17. Changing this file

1. Edit here.
2. Regenerate `packages/taxonomy`.
3. Write a migration if existing rows need remapping.
4. Update any AI prompt that enumerates the values.
5. Add a line to `docs/09-decisions/changelog.md`.
6. Re-run the affected AI evaluations — taxonomy changes move accuracy metrics.
