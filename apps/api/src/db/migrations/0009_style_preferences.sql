-- 0009 — Style preferences (task 11.1)
--
-- docs/04-data/database-schema.md §style_preferences.
--
-- Keyed by user_id rather than carrying its own id: a user has one set of
-- preferences, and a surrogate key would allow two rows that disagree.
--
-- The array columns hold taxonomy §9 style tags and §3 colours. They are NOT
-- constrained to those sets at the database, for the same reason `garments`
-- constrains category through a lookup table and leaves style_tags free: the
-- taxonomy is generated into `@mira/taxonomy` and enforced in the service, and
-- a check constraint here would be a third copy that drifts (INV-1).

create table if not exists style_preferences (
  user_id             uuid primary key references users(id) on delete cascade,

  preferred_styles    text[] not null default '{}',
  avoided_styles      text[] not null default '{}',
  preferred_colors    text[] not null default '{}',
  avoided_colors      text[] not null default '{}',

  fit_preferences     jsonb  not null default '{}',
  modesty_preferences jsonb  not null default '{}',

  updated_at          timestamptz not null default now(),

  -- A style cannot be both wanted and avoided. Without this the stylist would
  -- have to decide which of two contradictory instructions to obey, and any
  -- answer it picked would look like a bug to the person who set them.
  constraint style_preferences_styles_not_contradictory check (
    not (preferred_styles && avoided_styles)
  ),
  constraint style_preferences_colors_not_contradictory check (
    not (preferred_colors && avoided_colors)
  )
);

alter table style_preferences enable row level security;
drop policy if exists style_preferences_owner on style_preferences;
create policy style_preferences_owner on style_preferences
  using (user_id = current_setting('mira.user_id', true)::uuid)
  with check (user_id = current_setting('mira.user_id', true)::uuid);
