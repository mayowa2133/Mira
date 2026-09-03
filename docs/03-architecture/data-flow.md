# Data Flow

How data moves through Mira, and where it is transformed, validated and stored.

---

## 1. Photograph → garment

```text
[device]
  camera → local file → optimistic tile in closet ("analyzing")
     │
     ├─ POST /imports/photo (multipart, Idempotency-Key)
     ▼
[api]
  authorize → store original in private bucket
  create garment (status: analyzing, source_type: camera)
  create garment_sources row (append-only)
  enqueue image.process, garment.analyze
  → 202 { garment_id, job_id }
     │
     ▼
[worker: image.process]
  derivatives (thumb, medium), blurhash
  segmentation → cutout → canonical image
     │
     ▼
[worker: garment.analyze]
  vision → GarmentUnderstanding (validated, taxonomy-clamped)
  write garment_attributes with confidence + provider + model
  embedding.generate → vector
  product.match → brand/product candidates
  duplicate.check → candidates
     │
     ▼
[api] push/websocket → [device] invalidates ['garment', id] and ['garments']
     │
     ▼
[device] AI Item Review → user corrections → PATCH /garments/:id
  corrections stored as user-confirmed values, AI values retained for evaluation
```

**Invariants:** the original is never discarded · provenance is never overwritten
· the garment exists before analysis completes, so nothing is lost if analysis
fails.

## 2. Receipt → garments

```text
capture/PDF → POST /imports/receipt → receipt_imports row
   → worker: receipt.parse → OCR → structured line items (validated)
   → classify clothing vs non-clothing
   → per line: product.match, duplicate.check
   → GET /imports/:id → confirmation list
   → user selects → POST /garments (bulk, one Idempotency-Key per line)
   → garments created with source_type: receipt, shared source_reference
   → purchase_records created and linked
```

## 3. Email → candidates → garments

```text
consent → OAuth → email_connections (tokens encrypted at rest)
   → worker: email.scan (narrowest scope, retailer heuristics)
   → extract purchases (validated) → purchase_candidates (status: needs_review)
   → worker: purchase.match → product, image, brand
   → GET /purchase-candidates → review UI
   → PATCH /purchase-candidates/:id { status }
        confirmed_owned → duplicate.check → garment created, candidate linked
        returned | not_mine | removed | ignored → no garment, ever
        uncertain → stays reviewable
```

**Boundary:** `purchase_candidates` never joins into the closet view. The only
bridge is an explicit status transition to `confirmed_owned` (OWN-1, OWN-2).

Raw message bodies are not retained beyond extraction; see
`docs/07-security/data-retention.md`.

## 4. Search

```text
query text
   → interpretQuery (LLM, validated) → { filters, semantic_terms, sort }
   → structured: SQL over garments + attributes (taxonomy-constrained)
   → semantic: pgvector similarity over garment embeddings
   → merge + rank + dedupe
   → return results AND the interpretation (shown as removable chips)
```

Returning the interpretation is a data-flow requirement, not a UI nicety: it is
what makes a wrong interpretation correctable.

## 5. Stylist

```text
prompt + vibe + priority
   → eligibility filter (status ∈ outfit-eligible, season, occasion)
   → candidate set (structured + vector retrieval, capped)
   → LLM composes looks from candidate IDs only
   → validate every ID: exists · owned by user · eligible
   → persist recommendation (with the candidate set, for evaluation)
   → return looks
   → user saves → outfits + outfit_items
   → user wears → wear_events for each garment
```

## 6. Try-on

```text
outfit_id + body_reference_id
   → authorize both
   → fingerprint = hash(body_reference_id, sorted garment image hashes)
   → cache hit → return existing try_on_generations row
   → miss → enqueue tryon.generate
        inputs: body reference image(s) + garment canonical images + metadata
        → provider → result image → private try-on bucket
        → try_on_generations row (status: complete)
   → notify → device fetches via signed URL
```

Body images leave Mira's storage only as provider inputs, under the constraints in
`docs/07-security/privacy.md`, and never enter logs or analytics.

## 7. Wear tracking

```text
"Wear this" on a look   → wear_events for every garment in the look + the outfit
"Mark worn" on garment  → one wear_event
   → increments worn_count, sets last_worn_at (derived, recomputed on delete)
   → feeds: rediscovery, cost per wear, stylist recency, insights
```

## 8. What flows to analytics

| Flows | Never flows |
| ----- | ----------- |
| Event names, counts, durations | Image bytes or URLs |
| Category / brand as low-cardinality dimensions | Email content or addresses |
| Success / failure reason codes | Body measurements or body images |
| User id (opaque) | Prompt text containing user content |
| AI latency and cost | Try-on images |

See `docs/05-api/events.md` and requirement AN-2.

## 9. Deletion

```text
delete garment      → soft delete; images retained until retention window closes
delete body image   → hard delete object + derivatives + provider-side artefacts
                      where the provider supports it; invalidate try-on cache
delete try-on       → hard delete object + row + cached copies
disconnect email    → revoke token, delete connection, offer candidate deletion
delete account      → hard delete per docs/07-security/data-retention.md
```
