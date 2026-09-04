-- 0006 — Outfits, outfit items and wear events
--
-- docs/04-data/database-schema.md — outfits / outfit_items / wear_events.
--
-- Two rules live here rather than in application code, because both are
-- invariants the product depends on and neither survives being enforced in one
-- place while three ingestion paths write:
--
--   * a garment appears at most once in an outfit
--   * worn_count and last_worn_at are DERIVED from wear_events, never set
--
-- Slot exclusivity (dress vs top+bottom) is deliberately NOT enforced here.
-- taxonomy §14 says the user may override it — layering a top over a dress is
-- legitimate — so it is a default the builder applies, not a constraint the
-- database imposes. A check constraint would make a legitimate outfit
-- impossible to save.

create table if not exists outfits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text,
  occasion      text,
  season        text[] not null default '{}',
  origin        text not null default 'user',
  cover_image_key text,
  favorite      boolean not null default false,
  worn_count    integer not null default 0,
  last_worn_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint outfits_origin_valid check (origin in ('user', 'mira')),
  constraint outfits_occasion_valid check (occasion is null or occasion in (
    'casual','work','school','brunch','dinner','date','going_out','party','club',
    'wedding','formal','vacation','beach','gym','lounge','travel'
  ))
);

create index if not exists outfits_user_idx on outfits (user_id, created_at desc);
create index if not exists outfits_user_worn_idx on outfits (user_id, last_worn_at desc nulls last);
create index if not exists outfits_favorite_idx on outfits (user_id) where favorite;

create trigger outfits_set_updated_at before update on outfits
  for each row execute function set_updated_at();

create table if not exists outfit_items (
  id          uuid primary key default gen_random_uuid(),
  outfit_id   uuid not null references outfits(id) on delete cascade,
  garment_id  uuid not null references garments(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  slot        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint outfit_items_slot_valid check (slot in (
    'top','bottom','dress','layer','shoes','bag','accessory'
  )),
  -- A garment is in a look or it is not; twice is a bug, not a style choice.
  unique (outfit_id, garment_id)
);

create index if not exists outfit_items_outfit_idx on outfit_items (outfit_id, position);
create index if not exists outfit_items_garment_idx on outfit_items (garment_id);
create index if not exists outfit_items_user_idx on outfit_items (user_id);

create table if not exists wear_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  garment_id  uuid references garments(id) on delete cascade,
  outfit_id   uuid references outfits(id) on delete set null,
  worn_on     date not null,
  note        text,
  created_at  timestamptz not null default now(),

  -- An event about nothing is not an event.
  constraint wear_events_subject check (garment_id is not null or outfit_id is not null)
);

create index if not exists wear_events_user_idx on wear_events (user_id, worn_on desc);
create index if not exists wear_events_garment_idx on wear_events (garment_id, worn_on desc);
create index if not exists wear_events_outfit_idx on wear_events (outfit_id, worn_on desc);

-- --------------------------------------------------------------------------
-- Derived wear counters
--
-- `garments.worn_count` and `last_worn_at` are denormalized for list
-- performance (schema doc), which makes them a lie waiting to happen: any path
-- that inserts a wear event and forgets to update them leaves the closet
-- reporting a number nobody can explain.
--
-- Recomputed from the events rather than incremented, so a delete is as correct
-- as an insert and a double-fire cannot drift the count.
-- --------------------------------------------------------------------------
create or replace function recompute_wear_counters() returns trigger as $$
declare
  target_garment uuid := coalesce(new.garment_id, old.garment_id);
  target_outfit  uuid := coalesce(new.outfit_id, old.outfit_id);
begin
  if target_garment is not null then
    update garments g
       set worn_count = (
             select count(*) from wear_events w where w.garment_id = g.id
           ),
           last_worn_at = (
             select max(w.worn_on)::timestamptz from wear_events w where w.garment_id = g.id
           )
     where g.id = target_garment;
  end if;

  if target_outfit is not null then
    update outfits o
       set worn_count = (
             select count(*) from wear_events w where w.outfit_id = o.id
           ),
           last_worn_at = (
             select max(w.worn_on)::timestamptz from wear_events w where w.outfit_id = o.id
           )
     where o.id = target_outfit;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists wear_events_recompute on wear_events;
create trigger wear_events_recompute
  after insert or update or delete on wear_events
  for each row execute function recompute_wear_counters();

comment on function recompute_wear_counters is
  'Keeps garments/outfits worn_count and last_worn_at derived from wear_events.';

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5) — defence in depth.
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['outfits','outfit_items','wear_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I using (user_id = current_setting(''mira.user_id'', true)::uuid) '
      'with check (user_id = current_setting(''mira.user_id'', true)::uuid)',
      t || '_owner', t
    );
  end loop;
end $$;
