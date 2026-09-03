-- 0001 — Foundation
--
-- Phase 0 schema: extensions, users and closets. Enough to authenticate a user
-- and land them on an empty closet.
--
-- Garments and everything downstream arrive in Phase 1
-- (docs/08-engineering/implementation-plan.md).
--
-- Follows docs/04-data/database-schema.md and docs/04-data/migrations.md
-- (forward-only, safe on a large table, RLS on every user-owned table).

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "citext";

-- --------------------------------------------------------------------------
-- users
-- --------------------------------------------------------------------------
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  auth_provider_id    text not null unique,
  email               citext unique,
  display_name        text,
  avatar_url          text,
  locale              text not null default 'en',
  timezone            text,
  onboarding_state    text not null default 'not_started'
                        check (onboarding_state in ('not_started','in_progress','completed','skipped')),
  auto_import_enabled boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists users_auth_provider_id_idx on users (auth_provider_id);

-- --------------------------------------------------------------------------
-- closets
--
-- One per user in V1. The table exists so multi-closet is additive later.
-- --------------------------------------------------------------------------
create table if not exists closets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null default 'My closet',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists closets_user_id_idx on closets (user_id);
create unique index if not exists closets_one_default_per_user
  on closets (user_id) where is_default;

-- --------------------------------------------------------------------------
-- updated_at maintenance
-- --------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists closets_set_updated_at on closets;
create trigger closets_set_updated_at before update on closets
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5)
--
-- Defence in depth. The repository layer ALSO requires a user_id on every
-- query; neither mechanism is permitted to be the only one.
-- --------------------------------------------------------------------------
alter table closets enable row level security;

drop policy if exists closets_owner on closets;
create policy closets_owner on closets
  using (user_id = current_setting('mira.user_id', true)::uuid)
  with check (user_id = current_setting('mira.user_id', true)::uuid);
