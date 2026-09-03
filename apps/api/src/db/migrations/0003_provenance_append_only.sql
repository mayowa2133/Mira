-- 0003 — Correct the garment_sources append-only rule
--
-- 0002 blocked both UPDATE and DELETE on garment_sources. That was too strong:
-- it also blocked the `on delete cascade` from garments, so deleting a garment
-- became impossible.
--
-- docs/04-data/database-schema.md states the rule precisely:
--
--   > Append-only provenance. Never updated, never deleted WHILE THE GARMENT
--   > LIVES (CAP-3).
--
-- So UPDATE is blocked unconditionally — provenance is never rewritten — while
-- deletion is governed by the garment's own lifecycle through the foreign key.
-- No application code path deletes a garment_sources row directly: the
-- repository exposes no such method, and rows are only ever removed as a
-- consequence of their garment being removed.

drop trigger if exists garment_sources_append_only on garment_sources;

create trigger garment_sources_no_update before update on garment_sources
  for each row execute function reject_mutation();

comment on table garment_sources is
  'Append-only provenance (CAP-3). Never updated. Deleted only by cascade when its garment is deleted.';
