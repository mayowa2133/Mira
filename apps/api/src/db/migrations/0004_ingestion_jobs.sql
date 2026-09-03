-- 0004 — Ingestion jobs
--
-- The user-visible mirror of the queue (docs/04-data/database-schema.md —
-- ingestion_jobs), so a failed import is something the user can see and retry
-- rather than a photograph that silently went nowhere (REL-3).
--
-- This exists as a TABLE and not merely as queue state because the queue is
-- infrastructure: it can be drained, migrated or lost, and none of that should
-- cost a user the record that their photo failed to process.

create table if not exists ingestion_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  job_type      text not null,
  entity_type   text,
  entity_id     uuid,
  status        text not null default 'queued',
  attempts      integer not null default 0,
  error_code    text,
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ingestion_jobs_status_valid check (status in (
    'queued','running','complete','failed','cancelled'
  )),
  -- The job types from docs/03-architecture/backend-architecture.md §3.
  constraint ingestion_jobs_type_valid check (job_type in (
    'image.process','garment.analyze','product.match','duplicate.check',
    'receipt.parse','email.scan','purchase.match','embedding.generate',
    'tryon.generate'
  )),
  -- A finished job says when it finished; an unfinished one does not pretend to.
  constraint ingestion_jobs_finished_consistent check (
    (status in ('complete','failed','cancelled')) = (finished_at is not null)
  )
);

create index if not exists ingestion_jobs_user_idx
  on ingestion_jobs (user_id, created_at desc);
-- "What is still happening for this user?" — the query the closet polls.
create index if not exists ingestion_jobs_pending_idx
  on ingestion_jobs (user_id, status) where status in ('queued','running');
create index if not exists ingestion_jobs_entity_idx
  on ingestion_jobs (user_id, entity_type, entity_id);

create trigger ingestion_jobs_set_updated_at before update on ingestion_jobs
  for each row execute function set_updated_at();

comment on table ingestion_jobs is
  'User-visible mirror of the job queue so failures are retryable in the UI (REL-3).';

-- --------------------------------------------------------------------------
-- Row-level security (SEC-5) — defence in depth.
-- --------------------------------------------------------------------------
alter table ingestion_jobs enable row level security;
drop policy if exists ingestion_jobs_owner on ingestion_jobs;
create policy ingestion_jobs_owner on ingestion_jobs
  using (user_id = current_setting('mira.user_id', true)::uuid)
  with check (user_id = current_setting('mira.user_id', true)::uuid);
