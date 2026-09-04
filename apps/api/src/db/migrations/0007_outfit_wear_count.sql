-- 0007 — An outfit's worn_count counts the look, not its pieces
--
-- Wearing a look records one event for the look and one for EACH garment in it
-- (api-contract.md — Wear tracking). The garment events keep `outfit_id` so the
-- history can say "worn as part of Evening" — that provenance is worth having.
--
-- But 0006's trigger counted every row with that outfit_id, so wearing a
-- two-piece look once reported the look as worn three times. The more pieces in
-- a look, the more inflated the number: exactly the sort of derived value that
-- looks plausible and is wrong, and the Phase 9 insights would have been built
-- on it.
--
-- The look's own wear is the event with no garment. Garment events are wears of
-- the garment, which is why they are counted there and not here.

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
             select count(*) from wear_events w
              where w.outfit_id = o.id and w.garment_id is null
           ),
           last_worn_at = (
             select max(w.worn_on)::timestamptz from wear_events w
              where w.outfit_id = o.id and w.garment_id is null
           )
     where o.id = target_outfit;
  end if;

  return null;
end;
$$ language plpgsql;

-- Repair anything already counted the old way.
update outfits o
   set worn_count = (
         select count(*) from wear_events w
          where w.outfit_id = o.id and w.garment_id is null
       ),
       last_worn_at = (
         select max(w.worn_on)::timestamptz from wear_events w
          where w.outfit_id = o.id and w.garment_id is null
       );
