# Model Strategy

Which model does what, why, and how that changes.

Providers and models are **configuration, not code**
(`docs/03-architecture/adr/0002-provider-independent-ai-layer.md`).

---

## 1. Current defaults

| Capability | Model | Why |
| ---------- | ----- | --- |
| Garment understanding | `claude-opus-5` | Multimodal accuracy and calibrated confidence matter more than cost here — this output becomes the user's closet |
| Tag reading | `claude-opus-5` | Same, plus small-text legibility |
| Receipt structuring | `claude-sonnet-5` | Structured extraction from OCR text; cheaper, high volume |
| Purchase extraction | `claude-sonnet-5` | High volume, well-structured inputs |
| Outfit generation | `claude-sonnet-5` | Composition over a constrained candidate set; latency matters |
| Query interpretation | `claude-sonnet-5` | Small, latency-critical (p95 < 600 ms) |
| Embeddings | provider-configured | Swappable; the vector space is versioned |
| OCR | provider-configured, vision-model fallback | Dedicated OCR is cheaper; vision is the safety net |
| Segmentation | provider-configured | A specialist task |
| Try-on | provider-configured | Selected on garment fidelity, not visual quality |

Configuration keys: `AI_VISION_MODEL`, `AI_REASONING_MODEL`,
`AI_EMBEDDING_MODEL`, `AI_TRYON_PROVIDER`, … (`.env.example`).

## 2. Selection principles

1. **Right-size per capability.** Classification-shaped work does not need the
   strongest model; composition and calibrated judgement do.
2. **Accuracy where output persists.** Garment understanding writes into the
   closet permanently. Query interpretation is discarded after one request. Spend
   accordingly.
3. **Latency where the user waits.** Search interpretation is in the critical
   path; receipt parsing is not.
4. **Never trade calibration for accuracy.** A model that is 2% more accurate but
   badly calibrated is worse for Mira, because confidence drives the entire review
   UI.
5. **Privacy terms are a hard filter.** A provider that cannot exclude training on
   user content is ineligible regardless of quality (privacy rule 5).

## 3. Changing a model

```text
1. Bench on the fixed evaluation datasets (evaluation.md)
2. Compare against the current baseline, per metric
3. No headline metric may regress without an explicit documented decision
4. Compare cost and p95 latency
5. Shadow-run on a sample of live traffic where privacy policy permits
6. Roll out behind a config flag, per capability
7. Watch: correction rate, validation-failure rate, fallback rate
8. Record the change in docs/09-decisions/changelog.md
```

A model change is a product change. It ships like one.

## 4. Embedding model changes

Changing an embedding model changes the vector space and silently degrades search
during a backfill. Therefore:

- `garment_embeddings.model` records the producing model.
- A new model writes **new** vectors; it never overwrites in place.
- Search filters to the active model until the backfill is complete, then
  switches atomically.

## 5. Try-on providers

Evaluated on the ordered priorities in
[virtual-try-on.md](virtual-try-on.md) §3 — garment fidelity first, visual
quality last. A provider is disqualified if it cannot meet the privacy terms in
§8 of that document, however good the images are.

Expect to change try-on providers more than any other capability. That is the
main reason the abstraction exists.

## 6. Cost posture

| Lever | Effect |
| ----- | ------ |
| Cache (embeddings, matches, try-on) | Largest single saving |
| Right-sized models | Second largest |
| Batching | Meaningful for embeddings and receipt lines |
| Rate limits and try-on budgets | Bounds the tail |
| Explicit re-analysis only | Prevents silent re-spend when models change |

Per-call cost and latency are recorded on every request
(`ai_call_completed` in `docs/05-api/events.md`) and are dashboards, not guesses.

## 7. Revision history

| Date | Change | Rationale |
| ---- | ------ | --------- |
| 2026-09-03 | Initial defaults set | Opus 5 for vision-critical understanding; Sonnet 5 for structured extraction and composition |
