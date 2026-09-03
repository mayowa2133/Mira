# Backend Architecture

Node.js + TypeScript. One deployable API plus a worker fleet, with strict internal
module boundaries.

---

## 1. Layering

```text
route  →  validation  →  authorization  →  service  →  repository  →  DB
                                             │
                                             └──▶ queue / storage / AI layer
```

- **Route** — HTTP only. No business logic.
- **Validation** — Zod schema per endpoint, derived from `openapi.yaml`.
- **Authorization** — resolves the actor and the resource owner. Fails closed.
- **Service** — business rules. The only place taxonomy and lifecycle rules live.
- **Repository** — SQL. **Every query takes a `user_id` and filters on it.**

> Authorization is enforced at the repository layer, not by handler convention
> (SEC-5). A repository method that cannot scope by user does not exist.

## 2. Modules

`closet` · `ingestion` · `matching` · `search` · `stylist` · `tryon` ·
`purchases` · `identity` · `media` · `notify`.

Modules communicate through exported service interfaces, never by reaching into
each other's repositories. This is what makes a later service split mechanical.

## 3. Jobs

Redis-backed queue (BullMQ). Every job:

- is **idempotent** — keyed so a retry cannot double-create
- has a **retry policy** with exponential backoff and a max attempt count
- lands in a **dead-letter queue** on final failure, and sets a user-visible
  retryable state on the affected entity (REL-3)
- carries a `user_id` and a correlation id for tracing

| Job | Trigger | Produces |
| --- | ------- | -------- |
| `image.process` | upload | derivatives, cutout, blurhash |
| `garment.analyze` | capture | attributes + confidence, embedding |
| `product.match` | analyze | brand/product candidates |
| `duplicate.check` | pre-create | duplicate candidates |
| `receipt.parse` | receipt upload | line items |
| `email.scan` | connect / schedule | purchase candidates |
| `purchase.match` | candidate created | product match, image |
| `embedding.generate` | garment change | vectors for search |
| `tryon.generate` | user request | generated image |

## 4. Media

Upload → private bucket → `image.process` → derivatives. Reads are always via
short-lived signed URLs issued after an authorization check; the bucket is never
public (SEC-4).

Body-profile and try-on objects use a separate bucket with the shortest TTL and
an additional ownership assertion at issue time.

## 5. AI boundary

Services never call a provider SDK directly. They call `@mira/ai` capability
interfaces (`vision`, `reasoning`, `embedding`, `ocr`, `segmentation`, `tryon`).
See `ai-architecture.md`.

Every response is schema-validated and taxonomy-clamped before it reaches a
repository (AI-2, AI-3).

## 6. Data access

- `pg` with a query builder; no ORM lazy-loading surprises.
- Migrations are forward-only and reviewed; see `docs/04-data/migrations.md`.
- Vectors in `pgvector` with an HNSW index.
- Soft delete (`deleted_at`) for user-facing removal; hard delete for privacy
  requests, following `docs/07-security/data-retention.md`.

## 7. API conventions

- Cursor pagination: `?cursor=&limit=` → `{ data, next_cursor }`.
- Idempotency: `Idempotency-Key` header required on all creates.
- Concurrency: `If-Match` / `updated_at` optimistic locking on garment updates.
- Errors: `docs/05-api/error-contract.md`.
- Versioning: additive changes only within `v1`; breaking changes need a new path
  and an ADR.

## 8. Observability

- Structured JSON logs with `request_id`, `user_id` (id only, never PII), route,
  latency, outcome.
- **Never log** tokens, OAuth credentials, image bytes, email bodies, prompts
  containing user content, or body data (SEC-2, SEC-9).
- Traces across API → queue → worker → provider.
- Per-capability AI metrics: latency, cost, validation-failure rate, fallback
  rate.

## 9. Rate limiting and cost control

- Per-user limits on expensive endpoints (`/garments/analyze`,
  `/outfits/generate`, `/try-on`).
- A per-user monthly budget for try-on generations, enforced server-side.
- Cache try-on results by (body reference, outfit fingerprint).
- Batch embedding generation.

## 10. Testing

Unit tests on services; integration tests against a real Postgres in Docker;
contract tests asserting handlers match `openapi.yaml`; authorization tests that
attempt cross-user access on **every** entity and expect 404, not 403 (never
confirm existence).
