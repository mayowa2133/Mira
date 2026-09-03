# ADR 0002 — Provider-independent AI layer

- **Status:** Accepted
- **Date:** 2026-09-03

## Context

Mira depends on AI for garment understanding, OCR, segmentation, embeddings,
receipt and email extraction, outfit generation and virtual try-on. These are
different problems with different best-in-class providers, and the landscape moves
faster than Mira's release cycle. The product specification states plainly that no
single model should be assumed to perform all tasks permanently.

Try-on in particular is likely to change providers more than once, and its quality
bar (garment fidelity) is unlike any other capability's.

## Decision

Services depend on **capability interfaces** exported by `@mira/ai` — `vision`,
`reasoning`, `embedding`, `ocr`, `segmentation`, `tryon` — never on a provider
SDK. Each capability's provider and model are independently configured by
environment.

Every provider response passes through: strict parse → schema validation →
taxonomy clamp → confidence normalization, before any persistence.

## Consequences

- A capability can be swapped, A/B tested or rolled back without touching call
  sites.
- Evaluation is per capability, which matches how quality actually varies.
- Slight indirection cost, and one place where provider-specific features must be
  deliberately surfaced rather than used ad hoc.
- Provider credentials exist in exactly one layer, which makes AI-8 auditable.

## Alternatives considered

- **Call provider SDKs directly from services** — rejected: couples business logic
  to vendors and makes swapping try-on providers a refactor.
- **A single "AI service" with one generic `run(prompt)` method** — rejected: too
  weak to carry per-capability schemas, confidence, evaluation or fallbacks.
