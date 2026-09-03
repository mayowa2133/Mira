# Database Schema

PostgreSQL. Enumerated values come from [taxonomy.md](taxonomy.md) and are
implemented as Postgres enums or as `text` with a check constraint referencing a
lookup table — never as free text.

**Universal rules**

- Every user-owned table carries `user_id` and is queried through a repository
  that requires it (SEC-5).
- Timestamps are `timestamptz`, `created_at` / `updated_at` on every table.
- Soft deletion via `deleted_at` for user-facing removal; hard deletion for
  privacy requests.
- Identifiers are `uuid` (v7 where available, for index locality).
- Money is `numeric(12,2)` plus a `currency` char(3). Never floats.

---

## users

```sql
id                uuid primary key
auth_provider_id  text unique not null      -- from the managed auth provider
email             citext unique
display_name      text
avatar_url        text
locale            text default 'en'
timezone          text
onboarding_state  text not null default 'not_started'
                    -- not_started | in_progress | completed | skipped
auto_import_enabled boolean not null default false
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
deleted_at        timestamptz
```

## closets

One per user in V1; the table exists so multi-closet is additive later.

```sql
id          uuid primary key
user_id     uuid not null references users(id) on delete cascade
name        text not null default 'My closet'
is_default  boolean not null default true
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()

unique (user_id, is_default) where is_default
```

## body_profiles

Private by default. Strictest access rules in the system.

```sql
id                uuid primary key
user_id           uuid not null references users(id) on delete cascade
height_cm         integer
usual_sizes       jsonb          -- { "tops": "S", "shoe_us": 7.5 }
fit_preferences   jsonb
is_active         boolean not null default true
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
deleted_at        timestamptz
```

## body_profile_images

```sql
id               uuid primary key
body_profile_id  uuid not null references body_profiles(id) on delete cascade
user_id          uuid not null references users(id) on delete cascade
kind             text not null      -- front | side | back | reference
storage_key      text not null      -- private bucket: body
width            integer
height           integer
created_at       timestamptz not null default now()
deleted_at       timestamptz
```

Deletion here is **hard** deletion of the object and its derivatives, and
invalidates the try-on cache.

---

## garments

The central entity.

```sql
id                 uuid primary key
user_id            uuid not null references users(id) on delete cascade
closet_id          uuid not null references closets(id) on delete cascade

name               text
brand_id           uuid references brands(id)
brand_raw          text                     -- as detected/entered, kept verbatim
category           text not null            -- taxonomy §1
subcategory        text                     -- taxonomy §1, must belong to category

primary_color      text                     -- taxonomy §2
secondary_colors   text[] not null default '{}'
pattern            text                     -- taxonomy §3
materials          text[] not null default '{}'

size_raw           text
size_normalized    text
size_system        text                     -- taxonomy §15
fit                text                     -- taxonomy §5

season             text[] not null default '{}'
occasion           text[] not null default '{}'
style_tags         text[] not null default '{}'

purchase_date      date
purchase_price     numeric(12,2)
currency           char(3)
retailer           text

sku                text
barcode            text
product_url        text

source_type        text not null            -- taxonomy §11
source_reference   text                     -- receipt import id, message id, order id

status             text not null default 'active'   -- taxonomy §10

favorite           boolean not null default false
worn_count         integer not null default 0       -- derived from wear_events
last_worn_at       timestamptz                       -- derived from wear_events

tags_attached      boolean
notes              text

analysis_state     text not null default 'pending'
                     -- pending | analyzing | complete | failed | skipped
ai_confidence      numeric(3,2)             -- overall; per-field in garment_attributes

created_at         timestamptz not null default now()
updated_at         timestamptz not null default now()
deleted_at         timestamptz
```

**Indexes**

```sql
create index on garments (user_id, status) where deleted_at is null;
create index on garments (user_id, category, subcategory) where deleted_at is null;
create index on garments (user_id, primary_color) where deleted_at is null;
create index on garments (user_id, brand_id) where deleted_at is null;
create index on garments (user_id, last_worn_at nulls first) where deleted_at is null;
create index on garments (user_id, created_at desc) where deleted_at is null;
create index on garments (user_id, sku) where sku is not null;
create index on garments (user_id, barcode) where barcode is not null;
create index on garments using gin (season);
create index on garments using gin (occasion);
create index on garments using gin (style_tags);
```

`worn_count` and `last_worn_at` are denormalized for list performance and are
recomputed whenever a wear event is created or deleted.

## garment_images

```sql
id           uuid primary key
garment_id   uuid not null references garments(id) on delete cascade
user_id      uuid not null references users(id) on delete cascade
kind         text not null              -- taxonomy §13
storage_key  text not null              -- private bucket: garments
width        integer
height       integer
blurhash     text
image_hash   text                       -- perceptual hash, for duplicate detection
is_canonical boolean not null default false
position     integer not null default 0
created_at   timestamptz not null default now()
deleted_at   timestamptz

unique (garment_id, is_canonical) where is_canonical
```

## garment_attributes

Per-field AI provenance and confidence, kept separate from the flattened values on
`garments` so a user correction never erases what the model said (AI-1, AI-5).

```sql
id           uuid primary key
garment_id   uuid not null references garments(id) on delete cascade
user_id      uuid not null references users(id) on delete cascade
field        text not null              -- 'category' | 'brand' | 'primary_color' | …
value        jsonb not null
confidence   numeric(3,2) not null      -- [0,1]
source       text not null              -- ai | user | receipt | tag | retailer | barcode
provider     text                       -- ai provider, when source = ai
model        text
model_version text
superseded_by uuid references garment_attributes(id)
created_at   timestamptz not null default now()

unique (garment_id, field, created_at)
```

The current value of a field is the most recent non-superseded row, with
`source = 'user'` always winning over `source = 'ai'` at equal recency.

## garment_sources

Append-only provenance. Never updated, never deleted while the garment lives
(CAP-3).

```sql
id             uuid primary key
garment_id     uuid not null references garments(id) on delete cascade
user_id        uuid not null references users(id) on delete cascade
source_type    text not null            -- taxonomy §11
reference_id   text
reference_kind text                     -- receipt_import | email_message | order | url | job
metadata       jsonb not null default '{}'
created_at     timestamptz not null default now()
```

## garment_embeddings

```sql
garment_id  uuid primary key references garments(id) on delete cascade
user_id     uuid not null references users(id) on delete cascade
image_vec   vector(1024)
text_vec    vector(1024)
model       text not null
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()
```

```sql
create index on garment_embeddings using hnsw (image_vec vector_cosine_ops);
create index on garment_embeddings using hnsw (text_vec vector_cosine_ops);
```

## garment_duplicates

Records resolved duplicate decisions, including negatives, which feed evaluation.

```sql
id                uuid primary key
user_id           uuid not null references users(id) on delete cascade
garment_a_id      uuid not null references garments(id) on delete cascade
garment_b_id      uuid not null references garments(id) on delete cascade
relation          text not null      -- same_item | owns_two | different
detector_score    numeric(4,3)
resolved_by       text not null      -- user | system
created_at        timestamptz not null default now()

check (garment_a_id < garment_b_id)
unique (garment_a_id, garment_b_id)
```

---

## brands

```sql
id             uuid primary key
name           text not null
normalized_name text not null unique
logo_url       text
website        text
created_at     timestamptz not null default now()
```

Global, not per user. Unrecognized brands are stored on the garment as
`brand_raw` until they are promoted here.

## categories

Materialization of taxonomy §1, generated — not hand-edited.

```sql
id            text primary key            -- 'tops' | 't_shirt' | …
parent_id     text references categories(id)
display_order integer not null default 0
is_active     boolean not null default true
```

---

## purchase_candidates

**Never a garment.** See ADR 0003.

```sql
id                        uuid primary key
user_id                   uuid not null references users(id) on delete cascade

source_type               text not null      -- email | receipt | retailer_integration | order_screenshot
source_id                 text not null      -- message id, receipt import id, order id

retailer                  text
order_number              text
purchase_date             date
purchase_price            numeric(12,2)
currency                  char(3)

raw_item_name             text not null
product_name              text
brand                     text

sku                       text
barcode                   text
product_url               text
image_url                 text

matched_product_confidence numeric(3,2)

status                    text not null default 'detected'   -- taxonomy §12
linked_garment_id         uuid references garments(id) on delete set null

created_at                timestamptz not null default now()
updated_at                timestamptz not null default now()
```

```sql
create index on purchase_candidates (user_id, status);
create index on purchase_candidates (user_id, retailer);
create unique index on purchase_candidates (user_id, source_type, source_id, raw_item_name);
```

The unique index is what makes a re-scan idempotent.

## purchase_records

A confirmed purchase fact, retained even when no garment exists.

```sql
id             uuid primary key
user_id        uuid not null references users(id) on delete cascade
garment_id     uuid references garments(id) on delete set null
candidate_id   uuid references purchase_candidates(id) on delete set null
retailer       text
order_number   text
purchase_date  date
price          numeric(12,2)
currency       char(3)
source_type    text not null
created_at     timestamptz not null default now()
```

## receipt_imports

```sql
id            uuid primary key
user_id       uuid not null references users(id) on delete cascade
storage_key   text                       -- private bucket
status        text not null default 'pending'   -- pending | parsing | needs_review | complete | failed
retailer      text
purchase_date date
currency      char(3)
total         numeric(12,2)
line_items    jsonb not null default '[]'
error_code    text
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
```

## email_connections

```sql
id                 uuid primary key
user_id            uuid not null references users(id) on delete cascade
provider           text not null              -- gmail | outlook
email_address      citext not null
scopes             text[] not null
access_token_enc   bytea not null             -- encrypted at rest (SEC-6)
refresh_token_enc  bytea
token_expires_at   timestamptz
status             text not null default 'active'   -- active | expired | revoked | error
last_scan_at       timestamptz
scan_cursor        text
created_at         timestamptz not null default now()
updated_at         timestamptz not null default now()

unique (user_id, provider, email_address)
```

Tokens are never logged and never returned by any API response.

## retailer_connections

```sql
id           uuid primary key
user_id      uuid not null references users(id) on delete cascade
retailer     text not null
status       text not null default 'active'
credentials_enc bytea
last_sync_at timestamptz
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()

unique (user_id, retailer)
```

---

## outfits

```sql
id            uuid primary key
user_id       uuid not null references users(id) on delete cascade
name          text
occasion      text                       -- taxonomy §8
season        text[] not null default '{}'
origin        text not null              -- user | mira
source_recommendation_id uuid references recommendations(id) on delete set null
cover_image_key text
favorite      boolean not null default false
worn_count    integer not null default 0
last_worn_at  timestamptz
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
deleted_at    timestamptz
```

## outfit_items

```sql
id          uuid primary key
outfit_id   uuid not null references outfits(id) on delete cascade
garment_id  uuid not null references garments(id) on delete cascade
user_id     uuid not null references users(id) on delete cascade
slot        text not null              -- taxonomy §14
position    integer not null default 0
created_at  timestamptz not null default now()

unique (outfit_id, garment_id)
```

## wear_events

```sql
id          uuid primary key
user_id     uuid not null references users(id) on delete cascade
garment_id  uuid references garments(id) on delete cascade
outfit_id   uuid references outfits(id) on delete set null
worn_on     date not null
note        text
created_at  timestamptz not null default now()

check (garment_id is not null or outfit_id is not null)
```

```sql
create index on wear_events (user_id, worn_on desc);
create index on wear_events (garment_id, worn_on desc);
```

## favorites

Favouriting is a boolean on `garments` and `outfits` for read performance. This
table records the history, which personalization uses.

```sql
id           uuid primary key
user_id      uuid not null references users(id) on delete cascade
entity_type  text not null              -- garment | outfit | try_on
entity_id    uuid not null
favorited    boolean not null
created_at   timestamptz not null default now()
```

## style_preferences

```sql
user_id            uuid primary key references users(id) on delete cascade
preferred_styles   text[] not null default '{}'   -- taxonomy §9
avoided_styles     text[] not null default '{}'
preferred_colors   text[] not null default '{}'
avoided_colors     text[] not null default '{}'
fit_preferences    jsonb not null default '{}'
modesty_preferences jsonb not null default '{}'
updated_at         timestamptz not null default now()
```

## recommendations

Every stylist response is stored, with its candidate set, so results are
reproducible and evaluable.

```sql
id             uuid primary key
user_id        uuid not null references users(id) on delete cascade
prompt         text
vibe           text[] not null default '{}'
priority       text
context        jsonb not null default '{}'    -- season, weather, time of day
candidate_ids  uuid[] not null default '{}'
looks          jsonb not null default '[]'    -- validated garment ids per slot
model          text
latency_ms     integer
accepted_outfit_id uuid references outfits(id) on delete set null
created_at     timestamptz not null default now()
```

## try_on_generations

```sql
id                uuid primary key
user_id           uuid not null references users(id) on delete cascade
outfit_id         uuid references outfits(id) on delete set null
body_profile_id   uuid not null references body_profiles(id) on delete cascade
input_fingerprint text not null              -- hash(body ref, sorted garment image hashes)
storage_key       text                       -- private bucket: tryon
status            text not null default 'queued'  -- queued | generating | complete | failed
provider          text
model             text
error_code        text
favorite          boolean not null default false
rating            smallint                   -- user feedback, 1–5
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
deleted_at        timestamptz

unique (user_id, input_fingerprint) where deleted_at is null
```

The unique fingerprint is the try-on cache (cost control, §9 of
`backend-architecture.md`).

## search_history

```sql
id            uuid primary key
user_id       uuid not null references users(id) on delete cascade
query         text not null
interpretation jsonb                       -- what Mira understood
result_count  integer
interacted    boolean not null default false   -- feeds the search-success metric
created_at    timestamptz not null default now()
```

## ingestion_jobs

The user-visible mirror of the queue, so failures are retryable in the UI (REL-3).

```sql
id            uuid primary key
user_id       uuid not null references users(id) on delete cascade
job_type      text not null      -- garment.analyze | receipt.parse | email.scan | tryon.generate | …
entity_type   text
entity_id     uuid
status        text not null default 'queued'   -- queued | running | complete | failed | cancelled
attempts      integer not null default 0
error_code    text
error_message text
started_at    timestamptz
finished_at   timestamptz
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
```

## notifications

```sql
id          uuid primary key
user_id     uuid not null references users(id) on delete cascade
kind        text not null      -- purchase_detected | analysis_complete | import_complete | tryon_ready
title       text not null
body        text
entity_type text
entity_id   uuid
read_at     timestamptz
created_at  timestamptz not null default now()
```

Notification bodies never contain image data or full purchase details that would
appear on a lock screen without consent.

---

## Row-level security

If the deployment uses Postgres RLS (recommended with Supabase), every user-owned
table has a policy of the form:

```sql
alter table garments enable row level security;

create policy garments_owner on garments
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

RLS is defence in depth. The repository layer still requires `user_id` on every
query (SEC-5) — neither mechanism is permitted to be the only one.

---

## Derived values and their triggers

| Value | Recomputed when |
| ----- | --------------- |
| `garments.worn_count`, `last_worn_at` | wear_event insert/delete |
| `outfits.worn_count`, `last_worn_at` | wear_event insert/delete |
| `garment_images.is_canonical` | image processing completes, or user reorders |
| `garments.ai_confidence` | garment_attributes written |
| try-on cache validity | body image deleted, or a garment image changes |
