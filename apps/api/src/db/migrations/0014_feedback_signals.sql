-- 0014 — Feedback signals (task 11.2)
--
-- 11.2 lists four signals: saves, wears, swaps, regenerations.
--
-- Two of them already have homes. A save is `outfits.favorite`; a wear is a row
-- in `wear_events`. Copying those here would be a third statement of the same
-- fact, and the copy would eventually disagree with the original — so this
-- table holds ONLY the signals with nowhere else to live, and
-- `preference-signals.ts` reads the other two from where they already are.
--
-- Swaps and regenerations come from the stylist (Phase 7), so nothing emits
-- them yet. The table exists now because 11.3 reads it, and because a signal
-- with no schema is a signal nobody records.

create table if not exists feedback_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,

  kind         text not null,
  -- What the signal is about: an outfit for a swap or regeneration, a garment
  -- for a swap's replacement. Nullable because a regeneration is about the
  -- request rather than any one thing.
  entity_type  text,
  entity_id    uuid,

  -- For a swap: what went out and what came in. Both garment ids. This is the
  -- signal with the most in it — a swap says the stylist was close but wrong
  -- in a specific, learnable way.
  replaced_id  uuid,
  replacement_id uuid,

  created_at   timestamptz not null default now(),

  constraint feedback_events_kind_valid check (kind in ('swap', 'regeneration')),
  -- A swap without both halves says nothing learnable.
  constraint feedback_events_swap_complete check (
    kind <> 'swap' or (replaced_id is not null and replacement_id is not null)
  )
);

create index if not exists feedback_events_user_idx
  on feedback_events (user_id, created_at desc);

alter table feedback_events enable row level security;
drop policy if exists feedback_events_owner on feedback_events;
create policy feedback_events_owner on feedback_events
  using (user_id = current_setting('mira.user_id', true)::uuid)
  with check (user_id = current_setting('mira.user_id', true)::uuid);
