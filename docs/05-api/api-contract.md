# API Contract

REST over HTTPS, JSON, bearer JWT. [openapi.yaml](openapi.yaml) is the machine
source of truth for shapes; this document explains behaviour.

**Base:** `https://api.mira.app/v1`

---

## Conventions

| Concern | Convention |
| ------- | ---------- |
| Auth | `Authorization: Bearer <jwt>` on everything except `/auth/*` and `/health` |
| Scoping | Every response contains only the authenticated user's data (SEC-5) |
| Not found vs forbidden | Another user's resource returns **404**, never 403 — never confirm existence |
| Pagination | `?cursor=&limit=` → `{ data, next_cursor }`. Default limit 40, max 100 |
| Idempotency | `Idempotency-Key` **required** on every POST that creates |
| Concurrency | `If-Match: <updated_at>` on PATCH; mismatch → 409 |
| Errors | [error-contract.md](error-contract.md) |
| Dates | ISO 8601, UTC. Dates without time are `YYYY-MM-DD` |
| Money | `{ "amount": 59.99, "currency": "USD" }` |
| Long work | 202 + a job id; poll `GET /jobs/:id` or receive a push |

---

## Auth

```text
POST   /auth/session          exchange provider token → Mira session
POST   /auth/refresh
DELETE /auth/session          sign out
GET    /auth/me
DELETE /auth/account          account deletion (see data-retention.md)
```

Details: [auth-contract.md](auth-contract.md).

---

## Closet and garments

```text
GET    /closet                        closet summary: counts by category, recent
GET    /garments                      list + filter + sort + paginate
POST   /garments                      create (manual, or from a confirmed candidate)
GET    /garments/:id
PATCH  /garments/:id                  edit; source_type is immutable
DELETE /garments/:id                  soft delete
POST   /garments/:id/restore
POST   /garments/:id/favorite         { favorite: boolean }
POST   /garments/:id/status           { status }  — taxonomy §10
GET    /garments/:id/similar          owned garments visually similar to this one
GET    /garments/:id/goes-with        owned garments that pair well with this one
```

### `GET /garments` query parameters

```text
category[]  subcategory[]  brand_id[]  color[]  size[]  season[]  occasion[]
material[]  style_tag[]    retailer[]  status[]
favorite    tags_attached  never_worn  not_worn_since_days
purchased_after  purchased_before  price_min  price_max
sort   = recent | recently_worn | never_worn | brand | color | price_desc | price_asc
cursor limit
```

All filters AND together; array values OR within a field (INV-3).
`status` defaults to `active` when omitted — the closet does not show archived
pieces unless asked.

---

## Analysis and identification

```text
POST   /garments/analyze              202 → { garment_id, job_id }
POST   /garments/tag-scan             202 → { job_id } or immediate match
POST   /garments/check-duplicate      → duplicate candidates, before creation
POST   /garments/:id/reanalyze        re-run understanding with current models
```

`POST /garments/check-duplicate` accepts the same payload a create would, and is
called by **every** ingestion path before writing (CAP-5).

---

## Images

Every garment image is returned in one shape:

```json
{
  "id": "…",
  "kind": "original",
  "url": "…",            // full-size, always present
  "thumb_url": "…",      // 400px WebP, or null
  "medium_url": "…",     // 1080px WebP, or null
  "url_expires_at": "…",
  "width": 1200, "height": 1600,
  "blurhash": "…",
  "is_canonical": true,
  "position": 0
}
```

`thumb_url` and `medium_url` are null until `image.process` has run, and stay
null if derivative generation failed — a derivative failure must never cost the
user their garment (`docs/06-ai/image-processing.md` §8). **Clients fall back to
`url`**, they do not hide the image.

Use `thumb_url` in the closet grid and `medium_url` on detail. The original is
kept for re-analysis, try-on and export, not for display: it is roughly an order
of magnitude larger than the grid can use.

Every variant carries its own signature, bound to the requesting user. A
derivative is exactly as private as the photograph it came from (SEC-4).

---

## Media

```text
POST   /media/upload-url              → scoped, short-lived PUT URL
GET    /media/:id/url                 → refreshed signed read URL
```

Upload keys are validated against the authenticated user's storage prefix.

---

## Imports

```text
POST   /imports/photo                 { upload_key }        → 202
POST   /imports/receipt               { upload_key }        → 202
POST   /imports/product-url           { url }               → 202
POST   /imports/email                 start a scan          → 202
GET    /imports/:id                   status + extracted items
POST   /imports/:id/confirm           { selected_item_ids } → creates garments
DELETE /imports/:id
```

`POST /imports/:id/confirm` is the only way a receipt import becomes garments, and
it runs duplicate detection per line.

---

## Purchase candidates

```text
GET    /purchase-candidates           ?status=&retailer=&cursor=
GET    /purchase-candidates/summary   counts by retailer and status
GET    /purchase-candidates/:id
PATCH  /purchase-candidates/:id       { status }   — taxonomy §12
POST   /purchase-candidates/bulk      { ids[], status }
```

Transitioning to `confirmed_owned` runs duplicate detection and creates a garment,
returning `linked_garment_id`. **No other transition creates a garment** (OWN-1).

---

## Email connections

```text
GET    /integrations/email
POST   /integrations/email/connect    → OAuth start URL
GET    /integrations/email/callback   OAuth redirect
DELETE /integrations/email/:id        ?delete_candidates=true
POST   /integrations/email/:id/scan   trigger a scan
```

Tokens are never returned in any response.

---

## Search

```text
GET    /closet/search                 ?q=&cursor=&limit=
POST   /closet/search                 { query, filters }   — for long queries
```

Responses always include `interpretation` — the filters and terms Mira understood
— which the client renders as removable chips.

---

## Outfits

```text
GET    /outfits                       ?tab=saved|worn|mira|mine&limit=
POST   /outfits                       create from selected garments
GET    /outfits/:id
PATCH  /outfits/:id
DELETE /outfits/:id
POST   /outfits/:id/favorite
POST   /outfits/generate              the stylist
POST   /outfits/:id/swap              { slot, garment_id } → updated outfit
GET    /outfits/swap-options          ?outfit_id=&slot=  → recommended + rest
```

### `POST /outfits/generate`

```json
{
  "prompt": "dinner with my boyfriend tonight",
  "vibe": ["classy"],
  "priority": "havent_worn_lately",
  "anchor_garment_id": null,
  "count": 3
}
```

Returns `OutfitProposal[]`. Every `garment_id` is validated against the
server-built candidate set before the response is returned (AI-6). If the closet
cannot fill a slot, the proposal names it in `missing_slots` rather than inventing
a garment (STY-4).

---

## Wear tracking

```text
POST   /wear-events                   { garment_id | outfit_id, worn_on }
GET    /wear-events                   ?from=&to=&cursor=
DELETE /wear-events/:id
```

Creating a wear event for an outfit creates one for each of its garments.

---

## Body profile and try-on

```text
GET    /body-profile
PUT    /body-profile
POST   /body-profile/images           { upload_key, kind }
DELETE /body-profile/images/:id       hard delete
DELETE /body-profile                  hard delete, invalidates try-on cache

POST   /try-on                        { outfit_id, body_profile_id } → 202
GET    /try-on/:id
GET    /try-on                        ?outfit_id=&cursor=
POST   /try-on/:id/favorite
POST   /try-on/:id/rating             { rating: 1..5 }
DELETE /try-on/:id                    hard delete
```

`POST /try-on` returns an existing generation when the input fingerprint matches
(cache hit) rather than regenerating.

---

## Wardrobe insights

```text
GET    /wardrobe/insights             ?kinds=forgotten,never_worn,tags_attached,most_loved
GET    /wardrobe/stats                closet value, cost per wear aggregates
GET    /wardrobe/wear-history         ?from=&to=  → wears grouped by day
```

Insights return hydrated garments so the client can render imagery without a
second round trip.

Each insight carries a `total` alongside its `garments`: the headline counts
everything that qualifies while the rail shows a preview of it ("17 pieces
deserve another chance", three on screen). `most_loved` is a single hero rather
than a rail, so its `total` is 1.

An insight the closet cannot support is **omitted**, not returned empty — a
section reading "0 pieces deserve another chance" is a dashboard cell, and this
screen is fashion content (`screen-specs.md` §26). A new or small closet
therefore returns few insights or none, which is correct.

---

## Jobs and notifications

```text
GET    /jobs/:id                      status, attempts, error_code
POST   /jobs/:id/retry
GET    /notifications                 ?unread=true
POST   /notifications/:id/read
```

---

## Preferences

```text
GET    /preferences/style
PUT    /preferences/style
GET    /preferences/notifications
PUT    /preferences/notifications
```

---

## Health

```text
GET    /health                        liveness
GET    /health/ready                  DB, queue, storage reachability
```

---

## Rate limits

| Endpoint group | Limit |
| -------------- | ----- |
| Read endpoints | 300 / min / user |
| `/garments/analyze`, `/imports/*` | 60 / min / user |
| `/outfits/generate` | 20 / min / user |
| `/try-on` | 10 / min / user, plus a monthly budget |
| `/closet/search` | 60 / min / user |

Exceeding a limit returns 429 with `Retry-After`.

---

## Versioning

Additive changes only within `/v1`: new optional fields, new endpoints, new enum
values that clients must tolerate. Any breaking change requires a new version path
and an ADR.
