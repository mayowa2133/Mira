-- 0002 — Closet core
--
-- The garment schema from docs/04-data/database-schema.md.
--
-- Enumerated values come from docs/04-data/taxonomy.md and are enforced by
-- check constraints against the `categories` lookup table where a hierarchy
-- matters, and by plain checks where the set is flat. Application code never
-- introduces new values (INV-1); `packages/taxonomy` is generated from the
-- same document.
--
-- Every user-owned table carries user_id, is indexed on it, and has an RLS
-- policy. The repository layer ALSO requires user_id on every query — neither
-- mechanism is permitted to be the only one (SEC-5).

-- --------------------------------------------------------------------------
-- brands
--
-- Global, not per user. Unrecognized brands live on the garment as `brand_raw`
-- until they are promoted here.
-- --------------------------------------------------------------------------
create table if not exists brands (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null unique,
  logo_url        text,
  website         text,
  created_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- categories
--
-- Materialization of taxonomy §1. Populated by `npm run db:seed` from
-- @mira/taxonomy — never hand-edited, and never extended by application code.
-- --------------------------------------------------------------------------
create table if not exists categories (
  id            text primary key,
  parent_id     text references categories(id),
  display_order integer not null default 0,
  is_active     boolean not null default true
);

create index if not exists categories_parent_idx on categories (parent_id);

-- --------------------------------------------------------------------------
-- garments
-- --------------------------------------------------------------------------
create table if not exists garments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  closet_id          uuid not null references closets(id) on delete cascade,

  name               text,
  brand_id           uuid references brands(id),
  brand_raw          text,

  category           text not null references categories(id),
  subcategory        text references categories(id),

  primary_color      text,
  secondary_colors   text[] not null default '{}',
  pattern            text,
  materials          text[] not null default '{}',

  size_raw           text,
  size_normalized    text,
  size_system        text,
  fit                text,

  season             text[] not null default '{}',
  occasion           text[] not null default '{}',
  style_tags         text[] not null default '{}',

  purchase_date      date,
  purchase_price     numeric(12, 2),
  currency           char(3),
  retailer           text,

  sku                text,
  barcode            text,
  product_url        text,

  -- Provenance. Immutable after creation and never overwritten (CAP-3).
  source_type        text not null,
  source_reference   text,

  status             text not null default 'active',

  favorite           boolean not null default false,
  -- Denormalized from wear_events for list performance; recomputed on write.
  worn_count         integer not null default 0,
  last_worn_at       timestamptz,

  tags_attached      boolean,
  notes              text,

  analysis_state     text not null default 'pending',
  ai_confidence      numeric(3, 2),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint garments_status_valid check (status in (
    'active','laundry','unavailable','lent_out','returned','sold','donated','lost','archived'
  )),
  constraint garments_source_type_valid check (source_type in (
    'manual','camera','photo_library','tag_scan','barcode','receipt','email',
    'retailer_integration','product_url','order_screenshot'
  )),
  constraint garments_analysis_state_valid check (analysis_state in (
    'pending','analyzing','complete','failed','skipped'
  )),
  constraint garments_price_non_negative check (purchase_price is null or purchase_price >= 0),
  constraint garments_currency_with_price check (purchase_price is null or currency is not null),
  constraint garments_confidence_range check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  ),
  constraint garments_worn_count_non_negative check (worn_count >= 0)
);

create index if not exists garments_user_status_idx
  on garments (user_id, status) where deleted_at is null;
create index if not exists garments_user_category_idx
  on garments (user_id, category, subcategory) where deleted_at is null;
create index if not exists garments_user_color_idx
  on garments (user_id, primary_color) where deleted_at is null;
create index if not exists garments_user_brand_idx
  on garments (user_id, brand_id) where deleted_at is null;
create index if not exists garments_user_last_worn_idx
  on garments (user_id, last_worn_at nulls first) where deleted_at is null;
-- Cursor pagination orders by (created_at desc, id desc); the composite index
-- makes that a single ordered scan rather than a sort.
create index if not exists garments_user_created_idx
  on garments (user_id, created_at desc, id desc) where deleted_at is null;
create index if not exists garments_user_sku_idx
  on garments (user_id, sku) where sku is not null;
create index if not exists garments_user_barcode_idx
  on garments (user_id, barcode) where barcode is not null;
create index if not exists garments_season_idx on garments using gin (season);
create index if not exists garments_occasion_idx on garments using gin (occasion);
create index if not exists garments_style_tags_idx on garments using gin (style_tags);

drop trigger if exists garments_set_updated_at on garments;
create trigger garments_set_updated_at before update on garments
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------------
-- garment_images
-- --------------------------------------------------------------------------
create table if not exists garment_images (
  id           uuid primary key default gen_random_uuid(),
  garment_id   uuid not null references garments(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  kind         text not null,
  storage_key  text not null,
  width        integer,
  height       integer,
  blurhash     text,
  image_hash   text,
  is_canonical boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint garment_images_kind_valid check (kind in (
    'canonical','original','cleaned','front','back','side','detail','retailer'
  ))
);

create index if not exists garment_images_garment_idx on garment_images (garment_id, position);
create index if not exists garment_images_user_idx on garment_images (user_id);
create index if not exists garment_images_hash_idx
  on garment_images (user_id, image_hash) where image_hash is not null;
-- Exactly one canonical image per garment.
create unique index if not exists garment_images_one_canonical
  on garment_images (garment_id) where is_canonical and deleted_at is null;

-- --------------------------------------------------------------------------
-- garment_attributes
--
-- Per-field AI provenance and confidence, kept separate from the flattened
-- values on `garments` so a user correction never erases what the model said
-- (AI-1, AI-5, D-007).
-- --------------------------------------------------------------------------
create table if not exists garment_attributes (
  id            uuid primary key default gen_random_uuid(),
  garment_id    uuid not null references garments(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  field         text not null,
  value         jsonb not null,
  confidence    numeric(3, 2) not null,
  source        text not null,
  provider      text,
  model         text,
  model_version text,
  superseded_by uuid references garment_attributes(id),
  created_at    timestamptz not null default now(),

  constraint garment_attributes_source_valid check (source in (
    'ai','user','receipt','tag','retailer','barcode'
  )),
  constraint garment_attributes_confidence_range check (confidence >= 0 and confidence <= 1)
);

create index if not exists garment_attributes_garment_field_idx
  on garment_attributes (garment_id, field, created_at desc);
create index if not exists garment_attributes_user_idx on garment_attributes (user_id);

-- --------------------------------------------------------------------------
-- garment_sources
--
-- Append-only provenance. Never updated, never deleted while the garment lives
-- (CAP-3).
-- --------------------------------------------------------------------------
create table if not exists garment_sources (
  id             uuid primary key default gen_random_uuid(),
  garment_id     uuid not null references garments(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  source_type    text not null,
  reference_id   text,
  reference_kind text,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists garment_sources_garment_idx on garment_sources (garment_id);
create index if not exists garment_sources_user_idx on garment_sources (user_id);

-- Enforce append-only at the database, not by convention.
create or replace function reject_mutation() returns trigger as $$
begin
  raise exception 'garment_sources is append-only (CAP-3): provenance is never overwritten';
end;
$$ language plpgsql;

drop trigger if exists garment_sources_append_only on garment_sources;
create trigger garment_sources_append_only before update or delete on garment_sources
  for each row execute function reject_mutation();

-- --------------------------------------------------------------------------
-- garment_embeddings (populated in Phase 5)
-- --------------------------------------------------------------------------
create table if not exists garment_embeddings (
  garment_id uuid primary key references garments(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  image_vec  vector(1024),
  text_vec   vector(1024),
  model      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists garment_embeddings_user_idx on garment_embeddings (user_id);

-- --------------------------------------------------------------------------
-- garment_duplicates
--
-- Records resolved duplicate decisions INCLUDING negatives, which are what make
-- precision measurable (docs/06-ai/duplicate-detection.md §4).
-- --------------------------------------------------------------------------
create table if not exists garment_duplicates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  garment_a_id   uuid not null references garments(id) on delete cascade,
  garment_b_id   uuid not null references garments(id) on delete cascade,
  relation       text not null,
  detector_score numeric(4, 3),
  resolved_by    text not null,
  created_at     timestamptz not null default now(),

  constraint garment_duplicates_relation_valid check (relation in (
    'same_item','owns_two','different'
  )),
  constraint garment_duplicates_resolved_by_valid check (resolved_by in ('user','system')),
  -- Canonical ordering, so a pair is stored once regardless of arrival order.
  constraint garment_duplicates_ordered check (garment_a_id < garment_b_id)
);

create unique index if not exists garment_duplicates_pair
  on garment_duplicates (garment_a_id, garment_b_id);
create index if not exists garment_duplicates_user_idx on garment_duplicates (user_id);

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5) — defence in depth.
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'garments','garment_images','garment_attributes','garment_sources',
    'garment_embeddings','garment_duplicates'
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
