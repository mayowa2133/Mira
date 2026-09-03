# Current

**Phase:** 0 — Foundation
**Updated:** 2026-09-03

The specification set is complete. No application code exists yet.

---

## In progress

Nothing yet.

## Ready to start

These are Phase 0 from `docs/08-engineering/implementation-plan.md`, in
dependency order. Take the top one that is not claimed.

### 0.1 — Monorepo scaffold
Set up `apps/{mobile,api,worker}` and `packages/{types,taxonomy,ai,ui}` as npm
workspaces. TypeScript strict everywhere. No feature code.
**Done when:** `npm run typecheck` passes across all workspaces.

### 0.2 — Expo app shell
Expo Router with the five tabs from `docs/02-design/navigation.md`
(Home · Closet · Mira · Looks · You). Empty screens.
**Done when:** it boots on the iOS Simulator and the tab bar matches the spec.

### 0.3 — API skeleton
Route → validation → authorization → service → repository layering from
`docs/03-architecture/backend-architecture.md`. One endpoint: `GET /health`.
**Done when:** the layering is enforced by structure, and a repository method
cannot be written without a `user_id` parameter.

### 0.4 — Database foundation
Postgres in Docker, forward-only migration runner, seed command.
**Done when:** `npm run db:migrate && npm run db:seed -- --set=minimal` works from
a clean checkout.

### 0.5 — Authentication
Apple, Google and email via the managed provider. Tokens in the keychain.
Per-request verification resolving to a `user_id`.
**Done when:** sign-in works on a device and `GET /auth/me` returns the user.

### 0.6 — `packages/taxonomy`
Generate the taxonomy package from `docs/04-data/taxonomy.md`. Types must be
narrow enough that application code cannot widen them.
**Done when:** a test asserting that an invalid category fails to typecheck passes.

### 0.7 — `packages/ui` tokens
Every token from `docs/02-design/design-system.md`. Button, Chip, Skeleton,
EmptyState primitives.
**Done when:** a lint rule rejects literal hex values in feature code.

### 0.8 — Environments
`local`, `dev`, `staging`, `production` per
`docs/08-engineering/environments.md`, with stubbed AI providers locally.
**Done when:** the app runs end to end locally with no real provider credentials.

### 0.9 — CI
typecheck · lint · unit · integration · api · database · security · build.
**Done when:** the security suite includes the cross-user 404 test and the log
redaction fixture test.

### 0.10 — Analytics and error reporting
PostHog and Sentry, **with redaction in place from the first commit** — not
retrofitted.
**Done when:** the redactor's fixture suite passes and no event carries user
content.

---

## Blocked

Nothing.

## Notes

- Read `AGENTS.md` before starting anything.
- Phase 0 has no user-visible features. Resist adding one.
- Security tests and redaction exist from Phase 0. They are not a later concern.
