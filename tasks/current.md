# Current

**Phase:** 0 — Foundation
**Updated:** 2026-09-03

The specification set is complete and the Phase 0 scaffold is in place.
`npm run verify` is green: typecheck, format, lint and 204 tests.

---

## In progress

Nothing. Phase 0 is complete except for the two items under **Blocked** below.

## Done in this phase

| # | Task | Exit criterion | Status |
| - | ---- | -------------- | ------ |
| 0.1 | Monorepo scaffold | `npm run typecheck` passes across all workspaces | **Met** |
| 0.2 | Expo app shell | Boots on the iOS Simulator; tab bar matches the spec | **Partial** — see Blocked |
| 0.3 | API skeleton | Layering enforced by structure; a repository method cannot be written without a `user_id` | **Met** |
| 0.4 | Database foundation | `db:migrate && db:seed --set=minimal` works from a clean checkout | **Met** — verified against a real Postgres |
| 0.5 | Authentication | Sign-in works on a device and `GET /auth/me` returns the user | **Partial** — verified at the HTTP layer; not on a device (B-2) |
| 0.6 | `packages/taxonomy` | A test asserting an invalid category fails to typecheck | **Met** |
| 0.7 | `packages/ui` tokens | A lint rule rejects literal hex in feature code | **Met** |
| 0.8 | Environments | Runs end to end locally with no real provider credentials | **Met** |
| 0.9 | CI | Security suite includes the cross-user 404 test and the redaction fixture test | **Met** (workflow authored; not yet run on a remote) |
| 0.10 | Analytics and error reporting | Redactor fixture suite passes; no event carries user content | **Met** |

## Blocked

### ~~B-1 — Docker daemon unavailable~~ — CLEARED 2026-09-03

Docker Desktop eventually finished warming up. Everything that was unverified
has now run against a real Postgres 16 + pgvector:

- migration `0001_foundation.sql` applied (and is idempotent: a second run
  applies 0)
- `npm run db:seed -- --set=minimal` seeded 1 user + 1 closet (and is
  idempotent: a second run creates 0)
- all 10 database integration tests executed — confirmed by the absence of skip
  warnings and by real round-trip timings

**The cross-user 404 test was verified load-bearing**, not merely passing: with
a deliberate IDOR bug injected into `findClosetById` (`where id = $2 or
user_id = $1`), the test fails; restored, it passes.

Three real bugs surfaced only by running this, none of which typechecking could
have caught — see `tasks/completed.md`.

### B-2 — No iOS Simulator on this machine

`xcode-select -p` points at `/Library/Developer/CommandLineTools`; full Xcode is
not installed, so `simctl` does not exist. The Expo app typechecks and its
routes match `docs/02-design/navigation.md`, but it has never been rendered.

`AGENTS.md` requires visual verification in the iOS Simulator before a screen is
considered complete, so **0.2 is not done** by Mira's own standard.

**To unblock:** install Xcode, then `sudo xcode-select -s /Applications/Xcode.app`,
then `npm run mobile` and press `i`.

## Next

Phase 1 — Closet core (`docs/08-engineering/implementation-plan.md`).

The database half of Phase 1 (garment schema, storage, garments CRUD) is now
unblocked and can start. The closet grid and garment detail cannot be signed off
until B-2 is cleared, because `AGENTS.md` requires visual verification in the
iOS Simulator.

## Local setup

```bash
npm install
npm run db:up          # Postgres on 5433, Redis on 6380
npm run db:migrate
npm run db:seed -- --set=minimal
npm run verify
```

Ports are 5433 and 6380, not the defaults: this machine already runs a native
Postgres and Redis on 5432/6379, and Mira must never compete with a developer's
own services.

## Notes

- Read `AGENTS.md` before starting anything.
- `npm run verify` runs typecheck + lint + test.
- `npm run generate:taxonomy` and `npm run generate:api-types` regenerate the
  two generated files. CI fails if they are stale.
