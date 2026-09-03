# Completed

Finished work, newest first. Each entry names the phase, what shipped, and
anything learned that changed a specification.

---

## 2026-09-03 — Phase 0 scaffolding

**Phase:** 0 — Foundation

npm workspaces monorepo on Node 22, TypeScript strict throughout.
`npm run verify` green: typecheck, format, lint, 204 tests across 10 files.

**Packages**

- `@mira/taxonomy` — **generated** from `docs/04-data/taxonomy.md` (11
  categories, 65 distinct subcategories, 32 colours, 19 closed value sets), plus
  the clamp helpers that drop out-of-taxonomy AI output rather than coercing it.
- `@mira/types` — **generated** from `docs/05-api/openapi.yaml` via
  `openapi-typescript`, plus domain aliases and a `Result` type.
- `@mira/ai` — capability interfaces (ADR 0002), Zod output contracts, the
  parse → validate → clamp → normalize pipeline, and stub providers that
  deliberately exercise the fallback paths.
- `@mira/ui` — the full token set from `docs/02-design/design-system.md`, plus
  WCAG contrast maths asserted in CI.

**Apps**

- `@mira/api` — Fastify, layered route → validation → authorization → service →
  repository. Health and `/auth/me` routes, JWT verification (JWKS in
  deployed environments, HS256 dev verifier locally), the error contract, a
  forward-only migration runner with checksum drift detection, and the
  `minimal` seed set.
- `@mira/worker` — job contracts and a queue abstraction with idempotency,
  backoff and dead-lettering. No queue dependency yet: there are no real jobs
  until Phase 2, and an unused dependency is a cost.
- `@mira/mobile` — Expo SDK 57 / RN 0.86 with expo-router, the five tabs from
  `docs/02-design/navigation.md`, monorepo Metro config, and screens that read
  tokens only.

**Enforcement that is now structural rather than aspirational**

- **INV-1** — `packages/taxonomy/src/type-tests.ts` makes widening the taxonomy
  a compile error. Verified load-bearing: removing a `@ts-expect-error` fails
  the build, and adding an unnecessary one also fails it.
- **SEC-5** — `scopedQuery` refuses to run a statement against a user-owned
  table without a `user_id` predicate. A repository method that cannot scope by
  user genuinely cannot be written.
- **SEC-2 / SEC-9** — every log line and analytics event passes through a
  redactor that matches on key name, so a field added tomorrow is redacted
  tomorrow. 49 fixture tests.
- **AI-6** — `resolveCandidateIds` rejects any garment id the server did not
  offer, so a hallucinated garment cannot reach a response.
- **A11Y-2** — the palette is asserted against WCAG in CI.
- **D-009 / design system** — ESLint rejects literal hex and rgba in feature
  code. Verified the rule actually fires.

**Two defects found and fixed**

1. **`textSecondary` failed WCAG AA.** `#77736F` on the ivory ground computes to
   4.47:1, below the 4.5 required for body text — and that token carries brand,
   name and colour on every closet tile. Darkened one step to `#76726E`
   (4.53:1 on ivory, 4.77:1 on white), which is visually indistinguishable.
   The documented ratios in `accessibility.md` were estimates and were several
   points off; they are now computed values, asserted in CI.
2. **Prettier broke the taxonomy generator.** Reformatting
   `docs/04-data/taxonomy.md` inserted a blank line between a label and its
   fenced block, which the parser required to be adjacent. Fixed both ends:
   `docs/` and `tasks/` are excluded from formatting (they are hand-authored
   prose containing deliberate ASCII wireframes), and the parser now tolerates
   the blank line.

**Three bugs found by running against a real database** — none catchable by
typechecking, all found the first time the migration actually executed:

1. **`--experimental-strip-types` cannot run the CLI scripts.** Node strips
   types but does not rewrite the `.js` import specifiers that NodeNext
   requires, so `migrate.ts` failed to resolve `pool.js`. The `db:migrate`,
   `db:seed` and `dev` scripts now build first and run the compiled output.
2. **`tsc` does not copy `.sql` files.** The migration runner resolved
   `migrations/` relative to its own module, which exists in `src/` but not in
   `dist/`. Migrations are source, not build output, so they are now resolved
   from the package root and read from `src/` in both cases.
3. **The scope guard rejected every INSERT.** `unscopedTables` required a
   `user_id = $n` predicate, which an INSERT legitimately cannot have. Reads and
   writes scope differently: SELECT/UPDATE/DELETE must *filter* on the user,
   while an INSERT must *name* `user_id` among its columns so a row cannot be
   created ownerless. The guard now distinguishes the two, still rejects an
   INSERT that omits `user_id`, and still requires a predicate on the SELECT
   side of an `INSERT ... SELECT`. Four tests pin the distinction.

**Port collision avoided.** This machine already runs a native Postgres and
Redis on 5432/6379, so `localhost` resolved to those rather than the containers
(`role "mira" does not exist`). Mira's containers moved to 5433 and 6380 rather
than competing with a developer's own services.

**Verification that the security tests are load-bearing.** Both were confirmed
by breaking them deliberately, not by observing them pass:

- Taxonomy widening: removing a `@ts-expect-error` fails the build; adding an
  unnecessary one also fails it.
- Cross-user access: injecting a classic IDOR (`where id = $2 or user_id = $1`)
  into `findClosetById` makes the test fail; restored, it passes.

**Decisions recorded:** D-015 (moderate transitive advisories under
`expo-router` are accepted; CI gates at high).

**Verified end to end:** 207 tests across 10 files, including all 10 database
integration tests against a real Postgres 16 + pgvector. Migration and seed are
both idempotent.

**Still not verified.** No full Xcode on this machine, so the Expo app has never
been rendered in a simulator. `AGENTS.md` requires visual verification, so task
0.2 is not done by Mira's own standard. Recorded in `tasks/current.md` as B-2
rather than papered over.

---

## 2026-09-03 — Repository brain

**Phase:** 0 (documentation)

Established the complete Mira specification set from the product brief.

- Root: `AGENTS.md` (including the Visual Implementation Rule), `CLAUDE.md`,
  `README.md`, `.env.example`, `package.json`, `.gitignore`
- `docs/01-product/` — vision, PRD, personas, user stories, feature specs,
  requirements, non-goals, terminology, roadmap
- `docs/02-design/` — design system, UX principles, UX flows, screen specs (28
  screens), navigation, states and errors, accessibility, visual references with
  wireframes
- `docs/03-architecture/` — technical spec, system, frontend, backend and AI
  architecture, data flow, integrations, ADRs 0001–0003
- `docs/04-data/` — database schema, data models, canonical taxonomy, storage
  strategy, migrations, seed data
- `docs/05-api/` — API contract, `openapi.yaml` (34 paths, 31 schemas), events,
  error contract, auth contract
- `docs/06-ai/` — AI product spec plus 13 capability documents, prompts,
  evaluation, fallbacks
- `docs/07-security/` — security rules, privacy, threat model, permissions, data
  retention
- `docs/08-engineering/` — implementation plan, coding standards, testing
  strategy, observability, performance, environments, deployment, definition of
  done
- `docs/09-decisions/` — assumptions, open questions, decisions (D-001–D-014),
  changelog
- `tasks/` — current, backlog, completed

**Decisions recorded:** D-001 through D-014.

**Notable:** ADR 0003 makes "purchase ≠ ownership" a structural property of the
schema rather than a rule to remember — `purchase_candidates` is a separate table
that never joins into closet queries.

**Next:** Phase 0 scaffolding — see `tasks/current.md`.
