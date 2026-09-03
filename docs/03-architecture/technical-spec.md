# Technical Specification

The single orientation document for how Mira is built. Deeper detail lives in the
sibling documents; decisions live in `docs/09-decisions/decisions.md` and
`adr/`.

---

## 1. Stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Mobile | React Native + Expo, TypeScript | iOS first; Android follows |
| API | Node.js + TypeScript | Single service in V1, modular internally |
| Database | PostgreSQL | With `pgvector` for embeddings |
| Auth | Supabase Auth (or equivalent managed) | Apple, Google, email |
| Object storage | S3-compatible, **private buckets only** | Signed, expiring URLs |
| Cache / queue | Redis | Job queue + short-lived caches |
| AI | Provider-independent abstraction | See `ai-architecture.md` |
| Search | Postgres filters + pgvector | Semantic and structured, merged |
| Jobs | Queue + workers | Analysis, receipts, email, matching, try-on |
| Analytics | PostHog | No image, email or body data |
| Errors | Sentry | Scrubbed payloads |

**Constraint:** the mobile client never holds a provider credential, a service
role key, or a storage secret. Every third-party call is server-side.

## 2. Repository shape

```text
apps/
  mobile/          Expo app
  api/             HTTP API
  worker/          Background job processors
packages/
  types/           Shared TypeScript types generated from the DB + OpenAPI
  taxonomy/        The canonical taxonomy as code, generated from docs/04-data
  ai/              Provider abstraction, prompts, output schemas
  ui/              Design-system primitives (tokens, Button, Chip, GarmentTile)
docs/              Specifications (canonical)
```

`packages/taxonomy` is **generated** from `docs/04-data/taxonomy.md`. Application
code never introduces taxonomy values (INV-1).

## 3. Services

One deployable API in V1, with clear internal module boundaries so services can
be split later without rewriting call sites.

| Module | Responsibility |
| ------ | -------------- |
| `closet` | Garments, images, attributes, status, favourites, outfits, wear events |
| `ingestion` | All capture paths; creates jobs; owns duplicate checks at write time |
| `matching` | Product matching, duplicate detection, similarity |
| `search` | Structured filtering + semantic retrieval + merge |
| `stylist` | Outfit generation, constraints, ranking |
| `tryon` | Body profiles, generation, caching |
| `purchases` | Candidates, records, email and receipt derived data |
| `identity` | Users, sessions, preferences, consent |
| `media` | Uploads, derivatives, signed URLs |
| `notify` | Push and in-app notifications |

## 4. Request model

- REST over HTTPS, JSON. Contract in `docs/05-api/api-contract.md` and
  `openapi.yaml`; the OpenAPI file is the source of truth for shapes.
- Auth: bearer JWT from the managed auth provider, verified per request.
- **Every query is scoped by `user_id` at the data-access layer**, not by
  convention in handlers (SEC-5).
- Idempotency keys on all creation endpoints, so a retried capture cannot create
  duplicates.
- Cursor pagination on all lists.
- Errors follow `docs/05-api/error-contract.md`.

## 5. Asynchronous work

Long or expensive work never blocks a request.

```text
POST /imports/photo
  → store upload
  → create garment in `analyzing` state
  → enqueue garment.analyze
  → 202 { garment_id, job_id }

worker: garment.analyze
  → segmentation → attributes → embedding → product match → duplicate check
  → update garment, emit notification/websocket event
```

Job classes: `garment.analyze`, `image.process`, `receipt.parse`,
`email.scan`, `purchase.match`, `duplicate.check`, `embedding.generate`,
`tryon.generate`.

Every job is idempotent, retried with backoff, and lands in a dead-letter queue
with a user-visible retryable state (REL-3).

## 6. Storage

Three private buckets: garments, body, try-on. Access only via short-lived signed
URLs issued after an authorization check. Body and try-on objects carry the
strictest rules and the shortest TTLs.

Derivatives generated on upload: thumb (grid), medium (detail), original
(retained), cutout (when segmentation succeeds). Originals are never discarded —
they are needed for re-analysis and for try-on fidelity.

## 7. Data

Schema in `docs/04-data/database-schema.md`. Principles:

- Provenance (`garment_sources`) is append-only and never overwritten (CAP-3).
- AI-derived attributes carry confidence and a source, and are separable from
  user-confirmed values.
- Purchase candidates are a distinct table from garments (OWN-2).
- Soft deletion for user-facing removal; hard deletion for privacy requests.

## 8. Client architecture

See `frontend-architecture.md`. Summary: Expo Router, TanStack Query for server
state, a thin local store for capture queues and drafts, MMKV for cache, and a
design-system package that owns every token.

## 9. Environments

`local` · `dev` · `staging` · `production`. Details in
`docs/08-engineering/environments.md`. Production data is never copied into lower
environments; seeded synthetic closets are used instead.

## 10. Non-functional targets

See `docs/01-product/requirements.md` §8–9 for the numbers. Architecturally they
imply: paged and thumbnailed grids, cached closet reads, asynchronous analysis,
streamed or progressive generation UI, and aggressive reuse of try-on results.

## 11. Security posture

`docs/07-security/security-rules.md` is binding. The three rules that shape
architecture most:

1. No provider or storage credential reaches the client.
2. Authorization is enforced at the data layer, for every entity, every time.
3. AI output — and anything extracted from a photo, receipt or email — is
   untrusted input.
