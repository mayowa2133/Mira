-- 0011 — Purchase automation data layer (tasks 8.3, 8.6, 8.7, and 4.3's imports)
--
-- docs/04-data/database-schema.md, and ADR 0003 / D-003: a detected purchase is
-- NEVER a garment. Candidates live here and reach the closet only by an explicit
-- transition to `confirmed_owned` (OWN-1).
--
-- Every table carries user_id and cascades. The deletion worker deletes one row
-- and lets the database do data-retention's ordered teardown (D-031), and
-- `deletion.integration.test.ts` fails if any table added here forgets to
-- cascade.

-- --------------------------------------------------------------------------
-- email_connections
--
-- Tokens are `bytea` and encrypted at rest (SEC-6). They are never logged and
-- never returned by any API response — the repository below does not select
-- them, so a careless serializer cannot leak one.
-- --------------------------------------------------------------------------
create table if not exists email_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  provider          text not null,
  email_address     citext not null,
  scopes            text[] not null default '{}',

  access_token_enc  bytea not null,
  refresh_token_enc bytea,
  token_expires_at  timestamptz,

  status            text not null default 'active',
  last_scan_at      timestamptz,
  -- Provider-side pagination position. Idempotent re-scanning depends on this
  -- advancing only after a batch is durably written.
  scan_cursor       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint email_connections_provider_valid check (provider in ('gmail', 'outlook')),
  constraint email_connections_status_valid check (
    status in ('active', 'expired', 'revoked', 'error')
  ),
  unique (user_id, provider, email_address)
);

create index if not exists email_connections_user_idx on email_connections (user_id);

-- --------------------------------------------------------------------------
-- purchase_candidates
-- --------------------------------------------------------------------------
create table if not exists purchase_candidates (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references users(id) on delete cascade,

  source_type                text not null,
  -- Message id, receipt import id, order id — whatever identifies the thing
  -- this was extracted from on the provider's side.
  source_id                  text not null,

  retailer                   text,
  order_number               text,
  purchase_date              date,
  purchase_price             numeric(12, 2),
  currency                   char(3),

  -- What the source literally said, kept verbatim. `product_name` is the
  -- cleaned-up version; keeping both means a bad clean-up is recoverable.
  raw_item_name              text not null,
  product_name               text,
  brand                      text,

  sku                        text,
  barcode                    text,
  product_url                text,
  image_url                  text,

  matched_product_confidence numeric(3, 2),

  status                     text not null default 'detected',
  -- `set null`, not cascade: deleting a garment must not erase the evidence
  -- that the purchase happened. purchase_records exists for the same reason.
  linked_garment_id          uuid references garments(id) on delete set null,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint purchase_candidates_source_valid check (source_type in (
    'email', 'receipt', 'retailer_integration', 'order_screenshot'
  )),
  -- taxonomy §12.
  constraint purchase_candidates_status_valid check (status in (
    'detected','processing','needs_review','confirmed_owned',
    'returned','not_mine','removed','uncertain','ignored'
  )),
  constraint purchase_candidates_confidence_range check (
    matched_product_confidence is null
      or (matched_product_confidence >= 0 and matched_product_confidence <= 1)
  ),
  -- OWN-1, at the database: only `confirmed_owned` may point at a garment.
  -- Application code enforces the transition; this makes a bug that skips it
  -- impossible to store rather than merely unlikely.
  constraint purchase_candidates_link_requires_confirmation check (
    linked_garment_id is null or status = 'confirmed_owned'
  )
);

create index if not exists purchase_candidates_user_status_idx
  on purchase_candidates (user_id, status);
create index if not exists purchase_candidates_user_retailer_idx
  on purchase_candidates (user_id, retailer);

-- What makes a re-scan idempotent: the same line of the same order, seen twice,
-- is one candidate.
create unique index if not exists purchase_candidates_source_unique
  on purchase_candidates (user_id, source_type, source_id, raw_item_name);

-- --------------------------------------------------------------------------
-- purchase_records
--
-- A confirmed purchase fact, retained even when no garment exists — because a
-- returned or deleted garment does not un-happen the purchase.
-- --------------------------------------------------------------------------
create table if not exists purchase_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  garment_id    uuid references garments(id) on delete set null,
  candidate_id  uuid references purchase_candidates(id) on delete set null,

  retailer      text,
  order_number  text,
  purchase_date date,
  price         numeric(12, 2),
  currency      char(3),
  source_type   text not null,

  created_at    timestamptz not null default now()
);

create index if not exists purchase_records_user_idx on purchase_records (user_id);
create index if not exists purchase_records_garment_idx on purchase_records (garment_id);

-- --------------------------------------------------------------------------
-- receipt_imports (task 4.3)
-- --------------------------------------------------------------------------
create table if not exists receipt_imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  storage_key   text,
  status        text not null default 'pending',
  retailer      text,
  purchase_date date,
  currency      char(3),
  total         numeric(12, 2),
  line_items    jsonb not null default '[]',
  error_code    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint receipt_imports_status_valid check (
    status in ('pending', 'parsing', 'needs_review', 'complete', 'failed')
  )
);

create index if not exists receipt_imports_user_idx on receipt_imports (user_id, status);

-- --------------------------------------------------------------------------
-- notifications (task 8.7)
--
-- Bodies never contain image data or purchase details that would appear on a
-- lock screen without consent (database-schema.md).
-- --------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),

  constraint notifications_kind_valid check (kind in (
    'purchase_detected', 'analysis_complete', 'import_complete', 'tryon_ready'
  ))
);

create index if not exists notifications_user_unread_idx
  on notifications (user_id, created_at desc) where read_at is null;

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5) — defence in depth beside repository scoping.
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'email_connections','purchase_candidates','purchase_records',
    'receipt_imports','notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I using (user_id = current_setting(''mira.user_id'', true)::uuid) '
      'with check (user_id = current_setting(''mira.user_id'', true)::uuid)',
      t || '_owner', t
    );
  end loop;
end $$;
