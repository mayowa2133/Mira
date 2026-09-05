-- 0012 — Auto-import provenance (task 8.8)
--
-- feature-specs.md F-05: "every auto-import is undoable for at least 30 days"
-- and "auto-imported garments are visually flagged in the closet until
-- acknowledged".
--
-- Both need state that did not exist. A garment that appeared without anyone
-- asking is a different thing from one someone added, and the closet has to be
-- able to say so.

alter table garments
  -- When Mira added this without being asked. Null for everything a person
  -- added, which is the overwhelming majority and the reason this is nullable
  -- rather than a boolean plus a timestamp.
  add column if not exists auto_imported_at timestamptz,
  -- When the user acknowledged it. The flag in the closet clears on this, not
  -- on the undo window expiring: an unacknowledged garment stays flagged even
  -- after it can no longer be undone, because the point is that the user has
  -- seen it.
  add column if not exists auto_import_acknowledged_at timestamptz;

-- Only auto-imported garments can be acknowledged. Without this an
-- acknowledgement could be recorded against a garment nobody was asked about,
-- which would read as "the user reviewed this" in any later audit.
alter table garments drop constraint if exists garments_acknowledged_requires_auto_import;
alter table garments add constraint garments_acknowledged_requires_auto_import check (
  auto_import_acknowledged_at is null or auto_imported_at is not null
);

-- The closet's flag query: unacknowledged auto-imports, newest first.
create index if not exists garments_auto_imported_idx
  on garments (user_id, auto_imported_at desc)
  where auto_imported_at is not null and auto_import_acknowledged_at is null;
