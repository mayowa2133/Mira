# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-09-03

## Context

Mira's specifications are canonical, and implementation choices must not silently
drift from them. `AGENTS.md` requires that architecture is not changed without
documenting the decision, but does not say where.

## Decision

Architecture decisions are recorded as ADRs in
`docs/03-architecture/adr/NNNN-title.md`, using this template:

```md
# ADR NNNN — Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
```

Product-level decisions (what Mira does) go in
`docs/09-decisions/decisions.md`. Architecture decisions (how it is built) go
here. An entry in `decisions.md` links to its ADR when both apply.

## Consequences

- Every architectural change carries a written rationale, reviewable in the same
  pull request as the code.
- ADRs are immutable once accepted; a change means a new ADR that supersedes the
  old one.

## Alternatives considered

- **A single decisions file** — rejected: mixes "what the product does" with "how
  it is built", and the two have different audiences and lifetimes.
- **No formal record** — rejected: `AGENTS.md` explicitly forbids undocumented
  architecture change.
