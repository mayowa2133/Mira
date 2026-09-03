# Migrations

Forward-only, reviewed, and reversible in effect if not in file.

---

## Principles

1. **Forward-only.** No `down` migrations in production. A mistake is fixed by a
   new migration, which is auditable; a rollback is not.
2. **Expand → migrate → contract.** Never change a column's meaning in one step.
3. **No long locks.** Anything touching `garments` must be safe on a large table:
   concurrent index creation, no table rewrites during a deploy.
4. **Data migrations are jobs, not migrations.** Schema changes are DDL; backfills
   run as batched, resumable, idempotent jobs.
5. **Every migration is tested against a seeded database** in CI.

## Naming

```text
migrations/
  20260903_1200_add_garment_analysis_state.sql
  20260904_0930_backfill_garment_embeddings.ts     ← a job, not DDL
```

Timestamp prefix, imperative description, one concern per file.

## The expand/contract pattern

Renaming `garments.colour` → `garments.primary_color`:

```text
1. expand    add primary_color, dual-write in the application
2. backfill  batched job copies colour → primary_color
3. verify    counts match, no nulls where colour was set
4. switch    reads move to primary_color, ship, observe
5. contract  drop colour, in a later release
```

Never steps 1 and 5 in the same deploy.

## Taxonomy changes

Changing [taxonomy.md](taxonomy.md) is a schema change:

1. Edit `taxonomy.md`.
2. Regenerate `packages/taxonomy`.
3. Migration adds the new value to the enum / lookup table.
4. Backfill job remaps existing rows if a value was renamed or removed.
5. Update AI prompts that enumerate values.
6. Re-run affected AI evaluations — accuracy metrics move when the label set moves.
7. Line in `docs/09-decisions/changelog.md`.

Removing a taxonomy value requires remapping every row that uses it. There is no
"deprecated but still present" state in the database.

## Safe patterns

| Change | How |
| ------ | --- |
| Add a column | Nullable, or with a default that does not rewrite the table |
| Add an index | `CREATE INDEX CONCURRENTLY`, outside a transaction |
| Add a constraint | `NOT VALID`, then `VALIDATE CONSTRAINT` separately |
| Change a type | New column + backfill + switch + drop |
| Drop a column | Only after a release where nothing reads it |
| Add an enum value | `ALTER TYPE ... ADD VALUE`, never inside a transaction with dependent DDL |

## Vector columns

Changing an embedding model changes the vector space. Therefore:

- `garment_embeddings.model` records which model produced the vector.
- A model change adds a new column or a new row set; it never overwrites vectors
  in place, because search would silently degrade during the backfill.
- Search filters by the active model until the backfill completes.

## Review checklist

- [ ] Safe on a table with 10M rows?
- [ ] Any lock held longer than a second?
- [ ] Does the running application version tolerate this schema? (deploy order)
- [ ] Is the backfill batched, resumable and idempotent?
- [ ] Does it touch a taxonomy value? If so, is the whole checklist above done?
- [ ] Are new columns covered by row-level security policies?
- [ ] Is the change reflected in `database-schema.md` in the same pull request?
