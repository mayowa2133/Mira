-- 0008 — Account deletion
--
-- `DELETE /auth/account` is a 202: the request is recorded and a job does the
-- ordered hard delete in docs/07-security/data-retention.md.
--
-- The record deliberately does NOT live in `ingestion_jobs`. That table is
-- `user_id ... on delete cascade`, so the job that deletes a user would delete
-- itself halfway through its own work — and data-retention is explicit that a
-- deletion which reaches its final attempt must ALERT and be "tracked until
-- resolved". Tracking cannot live in a row that vanishes with the thing it is
-- tracking.
--
-- For the same reason there is no foreign key on `user_id` here.

create table if not exists account_deletions (
  id                uuid primary key default gen_random_uuid(),

  -- No FK: the user row is the thing being deleted.
  user_id           uuid not null,

  -- Kept because step 5 deletes the provider identity, which happens AFTER the
  -- user row is gone and cannot be looked up from it.
  provider_subject  text not null,

  -- Step 7: "confirm by email if an address is on file". Held only until that
  -- confirmation is sent, then cleared — see `account_deletions_email_cleared`.
  -- Retaining it indefinitely would make "hard delete" untrue.
  email             citext,

  status            text not null default 'queued',
  attempts          integer not null default 0,
  last_error        text,

  requested_at      timestamptz not null default now(),
  completed_at      timestamptz,
  -- Set when a job exhausts its attempts. "We failed to delete your photo" is
  -- not an acceptable silent outcome.
  alerted_at        timestamptz,

  constraint account_deletions_status_valid check (status in (
    'queued','running','complete','failed'
  )),
  constraint account_deletions_finished_consistent check (
    (status = 'complete') = (completed_at is not null)
  ),
  -- The address is evidence of an obligation, not a retained contact detail: it
  -- must be gone once the deletion is complete.
  constraint account_deletions_email_cleared check (
    status <> 'complete' or email is null
  )
);

-- One outstanding request per user. A second DELETE is not a second deletion.
create unique index if not exists account_deletions_pending
  on account_deletions (user_id) where status in ('queued','running');

create index if not exists account_deletions_status_idx
  on account_deletions (status, requested_at);

-- Deliberately NOT row-level-secured and not user-scoped at the repository
-- layer: it is an operational record that must remain readable after its user
-- is gone, which is exactly when SEC-5's scoping has nothing left to scope to.
