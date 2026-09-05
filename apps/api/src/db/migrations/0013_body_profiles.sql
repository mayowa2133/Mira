-- 0013 — Body profiles (tasks 10.1, 10.7)
--
-- database-schema.md: "Private by default. Strictest access rules in the
-- system."
--
-- Two things differ from every other table here, both deliberate:
--
-- 1. `body_profile_images` are HARD deleted, never soft. data-retention.md is
--    explicit: "A user deleting a photograph of their own body must not be told
--    it is in a recycle bin for a month." So there is no `deleted_at` on the
--    images, and nothing in the application may add one.
-- 2. The bucket already has a 120-second signed-URL TTL against garments' 300,
--    because a leaked body-image URL is a different order of harm.

create table if not exists body_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  height_cm       integer,
  usual_sizes     jsonb not null default '{}',
  fit_preferences jsonb not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- The PROFILE may be soft-deleted; its images may not. Keeping the profile
  -- briefly lets a try-on cache be invalidated against it before it goes.
  deleted_at      timestamptz,

  constraint body_profiles_height_plausible check (
    height_cm is null or (height_cm between 50 and 260)
  )
);

-- One active profile per user. Two would make "which body" a question every
-- try-on had to answer.
create unique index if not exists body_profiles_one_active
  on body_profiles (user_id) where is_active and deleted_at is null;

create table if not exists body_profile_images (
  id              uuid primary key default gen_random_uuid(),
  body_profile_id uuid not null references body_profiles(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  kind            text not null,
  storage_key     text not null,
  width           integer,
  height          integer,
  created_at      timestamptz not null default now(),

  constraint body_profile_images_kind_valid check (
    kind in ('front', 'side', 'back', 'reference')
  )
  -- No deleted_at, on purpose. See the note above.
);

create index if not exists body_profile_images_profile_idx
  on body_profile_images (body_profile_id);
create index if not exists body_profile_images_user_idx on body_profile_images (user_id);

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5). Strictest in the system, and the same mechanism.
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['body_profiles','body_profile_images'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I using (user_id = current_setting(''mira.user_id'', true)::uuid) '
      'with check (user_id = current_setting(''mira.user_id'', true)::uuid)',
      t || '_owner', t
    );
  end loop;
end $$;
