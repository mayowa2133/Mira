# Coding Standards

TypeScript everywhere, strict. The rules below exist because they prevent a
specific Mira failure, not because they are conventional.

---

## TypeScript

- `strict: true`. No `any` — use `unknown` and narrow.
- No non-null assertions (`!`) on values that can genuinely be null. Handle it.
- Types for API payloads are **generated** from `openapi.yaml`, never hand-written.
- Taxonomy types are **generated** from `docs/04-data/taxonomy.md`. Application
  code cannot widen them (INV-1).
- Prefer `type` for shapes, `interface` for capability contracts that get
  implemented.
- Discriminated unions over optional-field soup — especially for states.

## Naming

| Thing | Convention |
| ----- | ---------- |
| Files | `kebab-case.ts`; React components `PascalCase.tsx` |
| Components | `PascalCase` |
| Hooks | `useThing` |
| Database columns | `snake_case` |
| API JSON | `snake_case` |
| TypeScript fields | `camelCase` (mapped at the boundary) |
| Taxonomy values | `snake_case`, matching the taxonomy document exactly |
| Booleans | `isX`, `hasX`, `canX` — except database columns matching the schema |

Use Mira's words (`docs/01-product/terminology.md`): `garment` in code,
`outfit` in code, "piece" and "look" in copy. Never `item` as a type name — it
means nothing.

## Structure

- Feature modules own their screens, hooks and API calls. No cross-feature
  imports into internals — go through `ui/` or `lib/`.
- Backend layering is strict: route → validation → authorization → service →
  repository. No SQL in a service, no business logic in a route.
- **Every repository method takes a `user_id`.** A method that cannot scope by
  user does not exist (SEC-5).

## Error handling

- Never swallow an error. Handle it, or let it propagate to a boundary that does.
- Errors thrown across a layer boundary are typed and mapped to a code from
  `docs/05-api/error-contract.md`.
- Never `catch (e) { console.log(e) }`.
- Client errors map to a state from `docs/02-design/states-and-errors.md`.

## Async

- No floating promises. Await, or explicitly `void` with a comment saying why.
- Every external call has a timeout.
- Every job is idempotent, retried with backoff, and dead-lettered on final
  failure.
- Cancel in-flight work on unmount.

## React Native

- Components read design tokens. **No literal hex, spacing, radius or duration
  values in feature code** — this is what keeps dark mode a one-file change.
- Memoize list items; no inline object or lambda props in list rows.
- `FlashList` with a stable `estimatedItemSize` for every grid.
- Animations run on the UI thread (Reanimated), never on JS.
- Accessibility labels are written when the component is written, not added later.

## AI code

- Services call capability interfaces, never a provider SDK
  (ADR 0002).
- Every response: parse → validate → clamp → normalize confidence. No shortcuts,
  no `as` casts past a schema.
- Prompts live in versioned files, not inline template literals.
- Never let model output select an action.

## SQL

- Parameterized queries only.
- Index anything used in a `where` on `garments` — it is the hot table.
- Prefer explicit column lists over `select *` in application queries.
- Migrations follow `docs/04-data/migrations.md`.

## Comments

Comment **why**, not what. A comment explaining a non-obvious product rule or a
provider quirk is valuable; a comment restating the code is noise.

Match the density of the surrounding file.

## Dependencies

- Do not introduce a dependency without justification. `AGENTS.md` is explicit
  about this.
- Prefer the platform, then the existing stack, then a small focused package,
  then a large framework — in that order.
- A new dependency needs: a reason, a size check, a maintenance check, and a note
  in the pull request.

## Formatting

Prettier and ESLint decide. Do not argue with the formatter, and do not add
`eslint-disable` without a comment explaining why.

## Pull requests

- One concern per PR.
- The description names the requirements satisfied and the specs consulted.
- Checklist: `docs/08-engineering/definition-of-done.md`.
- Specification updates ship in the same PR as the behaviour change.
