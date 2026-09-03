# Testing Strategy

Traditional tests prove the code does what it says. AI evaluation proves the model
does what the product needs. Mira needs both.

---

## Layers

```text
Unit tests
Integration tests
API tests
Database tests
E2E tests
Visual tests
AI evaluations
Security tests
```

| Layer | Scope | Tool | Runs |
| ----- | ----- | ---- | ---- |
| Unit | Pure logic: taxonomy clamping, confidence bands, cost-per-wear, ranking, merge rules | Vitest / Jest | Every commit |
| Integration | Service + real Postgres in Docker | Vitest | Every commit |
| API | Handlers against `openapi.yaml` | Supertest + schema assertions | Every commit |
| Database | Migrations, constraints, RLS policies | SQL fixtures | Every commit |
| Component | Screens and primitives, via accessibility queries | RNTL | Every commit |
| Visual | Screenshots at default and largest Dynamic Type | Storybook + snapshot | Every commit |
| E2E | The eight critical journeys, on a simulator | Maestro | Pre-merge + nightly |
| AI evaluation | Fixed datasets per capability | `npm run eval` | On AI change + weekly |
| Security | Authorization, redaction, injection | Vitest + custom | Every commit |

---

## The eight critical E2E journeys

These are the product. They run before every merge.

| # | Journey |
| - | ------- |
| 1 | Create account → photograph dress → confirm AI details → appears in closet |
| 2 | Scan tag → identify item → confirm → appears in closet |
| 3 | Scan receipt → detect multiple items → select → add to closet |
| 4 | Connect email → detect purchases → review → confirm ownership |
| 5 | Search "black dresses" → relevant owned garments returned |
| 6 | Ask Mira for a dinner outfit → outfit uses available owned garments |
| 7 | Select outfit → virtual try-on → result generated |
| 8 | Potential duplicate detected → user chooses the correct duplicate action |

Journeys 4 and 7 run against stubbed providers in CI and against real providers in
a nightly job.

---

## Security tests (non-negotiable)

These run on every commit and are as important as the E2E journeys.

| Test | Assertion |
| ---- | --------- |
| Cross-user access, **every** entity | Returns 404, never 403, never data |
| Repository scoping | No repository method can be called without a `user_id` |
| RLS policies | A direct query as another user returns zero rows |
| Log redaction | Tokens, image bytes, email bodies, body data never appear in output |
| Analytics allowlist | No event carries a disallowed property |
| Client bundle secrets | The built bundle contains no non-`EXPO_PUBLIC_` secret name |
| Signed URL scoping | An upload key outside the caller's prefix is rejected |
| Prompt injection | Adversarial receipt / email fixtures produce data, never a status change |
| Immutable fields | `source_type` cannot be changed via PATCH |

The prompt-injection fixture set includes messages instructing the model to mark
items owned, to disable duplicate detection, and to exfiltrate. All must produce
ordinary extracted data.

---

## AI evaluation

Separate from tests, and required. See `docs/06-ai/evaluation.md`.

**Gates that block a release:**

- Hallucinated garment rate in outfit generation = 0.00
- Ineligible garment rate in outfit generation = 0.00
- Try-on garment fidelity ≥ 4.2

**Hard rule:** a model, prompt or taxonomy change does not ship without the
corresponding evaluation run.

---

## What to test, by kind of change

| Change | Required |
| ------ | -------- |
| A pure function | Unit |
| A service rule | Unit + integration |
| A new endpoint | API + authorization + integration |
| A new table | Database + RLS + migration safety |
| A screen | Component + visual + accessibility + one E2E if it is on a journey |
| A prompt | AI evaluation for that capability |
| A model swap | AI evaluation for that capability and everything downstream |
| A taxonomy change | Database migration + every capability that emits taxonomy values |
| Anything touching user data | The full security test list above |

---

## Principles

1. **Test behaviour, not implementation.** Component tests use accessibility
   queries (`getByRole`, `getByLabelText`), so a regression in labels fails a test
   rather than passing silently.
2. **Real Postgres, not a mock.** Constraints and RLS are the thing being tested.
3. **Stub providers, not the pipeline.** Validation, clamping and fallback logic
   are tested with real code paths and canned provider responses — including
   malformed and adversarial ones.
4. **Every bug gets a test.** The test is written before the fix.
5. **Flaky tests are bugs.** A quarantined test is a broken test with extra steps.
6. **Fixtures are seeded, not hand-built** (`docs/04-data/seed-data.md`).

---

## Fixtures worth having

- A garment mid-analysis (`analysis_state: analyzing`)
- A garment whose analysis failed
- A garment with no images
- A closet where everything is in the laundry (stylist edge case)
- A user with 0, 1, and 1,200 garments
- Malformed AI responses: invalid JSON, missing fields, out-of-taxonomy values,
  a garment id not in the candidate set
- Adversarial receipts and emails containing injected instructions
- An expired signed URL
- A soft-deleted garment referenced by a saved outfit

---

## CI

```text
commit
  → typecheck · lint
  → unit · integration · api · database · component · security
  → visual snapshots
  → build
  → E2E (simulator)
  → [if AI files changed] evaluation for the affected capabilities
```

Green means: correct, authorized, accessible, and — where AI is involved — no
regressed gate.
