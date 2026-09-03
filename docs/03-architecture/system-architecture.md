# System Architecture

```text
                        ┌────────────────────┐
                        │    Mira Mobile     │
                        │ React Native/Expo  │
                        └──────────┬─────────┘
                                   │  HTTPS + JWT
                                   ▼
                        ┌────────────────────┐
                        │      Mira API      │
                        └──────────┬─────────┘
                                   │
            ┌──────────────────────┼─────────────────────┐
            │                      │                     │
            ▼                      ▼                     ▼
     Closet Service         Ingestion Service       User Service
            │                      │                     │
            │                      ▼                     │
            │               AI Processing                │
            │                      │                     │
            ▼                      ▼                     ▼
       PostgreSQL          AI Provider Layer        PostgreSQL
            │
            ▼
       Object Storage

Additional services:

Email Integration
Receipt Parser
Product Matcher
Embedding Search
Stylist Engine
Try-On Engine
Background Workers
Analytics
```

---

## Runtime components

| Component | Responsibility | Scaling |
| --------- | -------------- | ------- |
| **Mobile app** | Capture, browse, style, try on | Per device |
| **API** | Request handling, authorization, contracts | Horizontal, stateless |
| **Workers** | Analysis, parsing, matching, generation | Horizontal by queue depth |
| **PostgreSQL** | Source of truth, incl. vectors | Vertical, then read replicas |
| **Redis** | Queue + short-lived cache | Managed |
| **Object storage** | Private images | Managed |
| **AI provider layer** | Vision, reasoning, embeddings, OCR, segmentation, try-on | Per-capability providers |

## Trust boundaries

```text
┌── untrusted ──────────────────────────────────────────────┐
│ user photos · receipts · email bodies · retailer pages    │
│ AI provider responses                                     │
└───────────────────────────────────────────────────────────┘
                    ↓ validated, schema-checked, taxonomy-clamped
┌── trusted ────────────────────────────────────────────────┐
│ Mira database                                             │
└───────────────────────────────────────────────────────────┘
```

Content extracted from an image, receipt or email may contain text engineered to
influence the model. It is **data, never instruction**. Prompt construction keeps
extracted content in clearly delimited user-content regions, and every model
response is validated against a schema before it can touch the database.

## Key flows

### Capture → closet

```text
mobile ──upload──▶ API ──▶ storage (private)
                    │
                    ├──▶ DB: garment (status: analyzing)
                    └──▶ queue: garment.analyze
                                   │
worker ────────────────────────────┘
  segmentation → classification → attributes → embedding
  → product match → duplicate check
  → DB update → push/websocket → mobile refresh
```

### Ask Mira

```text
mobile ──prompt+constraints──▶ API
   → stylist: fetch eligible garments (status + season + occasion filtered)
   → build candidate set (structured + vector retrieval)
   → LLM composes looks, constrained to candidate garment IDs
   → validate: every ID exists, belongs to user, is eligible
   → persist recommendation → return looks
```

The LLM never picks from the whole closet freely: it selects from a
server-constructed candidate set, and its output is validated against that set.
This is what makes AI-6 ("no hallucinated garments") enforceable rather than
hopeful.

### Try-on

```text
mobile ──outfit_id + body_reference_id──▶ API
   → authorize both belong to the user
   → cache lookup (body_reference, outfit fingerprint)
   → hit: return existing generation
   → miss: enqueue tryon.generate → provider → private storage
   → notify → mobile fetches via signed URL
```

## Failure isolation

- An AI provider outage degrades features per `docs/06-ai/ai-fallbacks.md`; the
  closet remains fully browsable.
- A worker outage delays analysis; captures are still accepted and queued.
- A storage outage blocks new uploads but not browsing (client cache + CDN-less
  signed reads of already-cached derivatives).
- The email integration is fully optional and never on the critical path.

## What is deliberately *not* in V1

- Multi-region deployment
- A separate media service
- gRPC between modules (they are in-process)
- Event sourcing
- A dedicated vector database (pgvector is sufficient at this scale)

Each of these is a fine future change; none is needed to prove the product.
