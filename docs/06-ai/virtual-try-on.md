# Virtual Try-On

**Capability:** `tryon`
**Consumers:** F-15
**Phase:** 10 — after the closet is excellent

---

## 1. Definition

> Preserve the user's recognizable appearance and body while faithfully
> reproducing the **actual selected garment or outfit** as closely as technically
> possible.

It does **not** mean: generate a random fashionable outfit inspired by the
garment.

This distinction is the entire quality bar. A beautiful image of a *different*
black dress is a failure.

## 2. Inputs

```text
User body reference (1–3 images)
+ Garment image(s) — canonical cutout and original, per garment
+ Garment metadata — category, colour, pattern, material, fit, length
+ Optional outfit combination
```

Garment metadata is included because it constrains the generation: "midi length,
square neckline, sleeveless, satin, black" prevents drift that images alone allow.

## 3. Evaluation priorities

In order:

1. **Garment fidelity** — is it *this* garment?
2. **User identity consistency** — is it recognizably her?
3. **Body consistency** — is it her body?
4. Believable garment placement
5. Colour fidelity
6. Pattern fidelity
7. Accessory fidelity
8. Visual quality

Note what is last. A gorgeous image that changed the neckline is worse than a
plainer image that got the garment right.

## 4. Body profile

Optional, private, deletable (TRY-3). Front image required; side and additional
references improve results. Height and usual sizes are optional and used only as
generation hints.

**Copy rule (TRY-2):** Mira must never imply that a try-on guarantees fit.

> "Try-on shows how a piece looks — it can't promise how it fits."

Mira does not infer measurements from photographs, and does not comment on the
user's body.

## 5. Caching

```text
fingerprint = hash(body_profile_image_ids, sorted garment canonical image hashes)
```

A matching fingerprint returns the existing generation. The cache is invalidated
when a body image is deleted or a garment's canonical image changes.

This is the single largest cost control in Mira: re-viewing a look is free.

## 6. Generation flow

```text
POST /try-on { outfit_id, body_profile_id }
  → authorize both belong to the caller
  → fingerprint → cache hit? return it
  → enqueue tryon.generate
  → provider call with body reference + garment images + metadata
  → result → private tryon bucket
  → try_on_generations row → notification
```

Generation is backgroundable: the user may leave and be notified (PERF-7).

## 7. Multi-garment outfits

Full looks are harder than single garments. Strategy:

1. Generate the full look in one pass where the provider supports it.
2. Otherwise compose in layers — base garment first, then layers, then shoes and
   bag — with each step conditioned on the previous result.
3. Accessories that cannot be placed believably are omitted, and the result says
   which garments are shown.

Never silently drop a garment the user selected. Say what is in the image.

## 8. Privacy

| Rule | |
| ---- | - |
| Body images are private by default | TRY-3 |
| Body images are used only for that user's try-on | — |
| Generations are private and deletable | TRY-3, TRY-4 |
| Access via authenticated, expiring URLs only | TRY-4, SEC-4 |
| Never sent to analytics or error reporting | SEC-9 |
| Provider retention configured to exclude training | privacy rule 5 |
| Deleting a body image hard-deletes derivatives and invalidates the cache | — |

If a provider cannot meet these terms, it is not eligible, regardless of output
quality.

## 9. Failure handling

| Failure | Handling |
| ------- | -------- |
| Provider unavailable | "Try-on is unavailable right now" + notify when back |
| Generation timeout | Retry once, then fail with a retry affordance |
| Poor body reference | Guidance before generating, not after: full body, plain background, fitted clothing, good light |
| Garment unsuitable (tiny accessory) | Excluded from generation, named in the result |
| Result fails an automated quality check | Regenerate once, then surface with a "not quite right?" report affordance |

The user's report affordance feeds evaluation directly.

## 10. Evaluation

Dataset: 50 virtual try-on combinations spanning garment types, colours, patterns
and body references. Human-rated.

| Metric | Target |
| ------ | ------ |
| **Garment fidelity** (1–5, is it *this* garment) | ≥ 4.2 mean |
| **Identity consistency** (1–5) | ≥ 4.0 mean |
| Body consistency (1–5) | ≥ 4.0 mean |
| Colour fidelity (ΔE against the garment's true colour) | ≤ 8 |
| Pattern fidelity (1–5, patterned garments only) | ≥ 3.8 mean |
| Placement believability (1–5) | ≥ 3.8 mean |
| User rating in production | ≥ 4.0 mean |
| Catastrophic failure rate (wrong garment, distorted body) | ≤ 0.02 |

Garment fidelity is the gate. A provider that scores 4.8 on visual quality and 3.1
on garment fidelity does not ship — it is a beautiful picture of clothes she
doesn't own.

## 11. Why this is Phase 10

Try-on is far more useful once the user already has a real closet, clean garment
images, item metadata, saved outfits and style preferences.

> Mira must not become a virtual-try-on demo with a bad closet product attached.
