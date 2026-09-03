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
| 0.4 | Database foundation | `db:migrate && db:seed --set=minimal` works from a clean checkout | **Unverified** — see Blocked |
| 0.5 | Authentication | Sign-in works on a device and `GET /auth/me` returns the user | **Partial** — see Blocked |
| 0.6 | `packages/taxonomy` | A test asserting an invalid category fails to typecheck | **Met** |
| 0.7 | `packages/ui` tokens | A lint rule rejects literal hex in feature code | **Met** |
| 0.8 | Environments | Runs end to end locally with no real provider credentials | **Met** |
| 0.9 | CI | Security suite includes the cross-user 404 test and the redaction fixture test | **Met** (workflow authored; not yet run on a remote) |
| 0.10 | Analytics and error reporting | Redactor fixture suite passes; no event carries user content | **Met** |

## Blocked

### B-1 — Docker daemon unavailable on this machine

`docker compose up` never completes: Docker Desktop launches, `docker ps`
answers, but image pulls and `docker version` hang indefinitely. The registry is
reachable (`registry-1.docker.io` returns 401 as expected), so this is a local
Docker Desktop problem, not a network one.

**Consequence.** These are written and typechecked but have never executed:

- migration `0001_foundation.sql` against a real Postgres
- `npm run db:seed -- --set=minimal`
- `apps/api/src/db/integration.test.ts` — including the cross-user 404 test,
  which is the one security test that needs a real database

The integration tests skip with a warning when no database is reachable, so the
suite is green — but green does not mean those assertions ran.

**To unblock:** open Docker Desktop and complete its first-run setup, then:

```bash
npm run db:up && npm run db:migrate && npm run db:seed -- --set=minimal && npm test
```

CI runs Postgres as a service container, so these tests will execute there
regardless.

### B-2 — No iOS Simulator on this machine

`xcode-select -p` points at `/Library/Developer/CommandLineTools`; full Xcode is
not installed, so `simctl` does not exist. The Expo app typechecks and its
routes match `docs/02-design/navigation.md`, but it has never been rendered.

`AGENTS.md` requires visual verification in the iOS Simulator before a screen is
considered complete, so **0.2 is not done** by Mira's own standard.

**To unblock:** install Xcode, then `sudo xcode-select -s /Applications/Xcode.app`,
then `npm run mobile` and press `i`.

## Next

Phase 1 — Closet core (`docs/08-engineering/implementation-plan.md`). Do not
start it until B-1 and B-2 are cleared: Phase 1 is the garment schema and the
closet grid, and neither can be verified without a database and a simulator.

## Notes

- Read `AGENTS.md` before starting anything.
- `npm run verify` runs typecheck + lint + test.
- `npm run generate:taxonomy` and `npm run generate:api-types` regenerate the
  two generated files. CI fails if they are stale.
