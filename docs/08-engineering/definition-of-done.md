# Definition of Done

> A Mira feature is **NOT** complete simply because the happy path technically
> renders.

A feature is complete only when:

```text
Requirements satisfied
Loading state implemented
Empty state implemented
Error state implemented
Permission-denied state considered
Offline/network failure considered
Mobile UI verified
Accessibility considered
Analytics implemented
API validation implemented
Authorization implemented
Tests pass
AI evaluation updated where relevant
Documentation updated
No TypeScript errors
No lint errors
No unexpected console errors
Feature tested end-to-end
```

---

## The checklist, with what each item actually means

### Product

- [ ] **Requirements satisfied** — the numbered requirements in
      `docs/01-product/requirements.md` that this feature touches are met, and
      named in the pull request.
- [ ] **Specification reconciled** — the behaviour matches
      `docs/01-product/feature-specs.md`. Where it does not, the spec was updated
      deliberately, not silently.

### States (`docs/02-design/states-and-errors.md`)

- [ ] **Loading** — skeletons shaped like the real content, not a centred spinner.
- [ ] **Empty** — a warm sentence and one obvious route out.
- [ ] **Error** — plain language, a retry, no raw provider text or error codes.
- [ ] **Permission denied** — explained, with an alternative path.
- [ ] **Offline** — cached content served; unavailable actions disabled and
      explained; queued work indicated.
- [ ] **Partial / degraded** — when some work succeeded, it shows, and what is
      missing is named.

### Design (`AGENTS.md` — Visual Implementation Rule)

- [ ] The assigned visual reference in
      `docs/02-design/visual-references.md` was read.
- [ ] Only design-system tokens are used — no literal hex, spacing or duration.
- [ ] Imagery carries more visual weight than metadata.
- [ ] **Verified visually in the iOS Simulator.**

### Accessibility (`docs/02-design/accessibility.md`)

- [ ] Every interactive element has an accessible label.
- [ ] Contrast passes AA for all text.
- [ ] Usable at the largest Dynamic Type setting.
- [ ] Colour is not the only carrier of meaning.
- [ ] **Navigated once with VoiceOver.**

### API and data

- [ ] Request validation implemented (Zod, derived from `openapi.yaml`).
- [ ] `openapi.yaml` updated, and handlers match it.
- [ ] Authorization enforced at the repository layer; every new query scoped by
      `user_id`.
- [ ] RLS policy added for any new table.
- [ ] A cross-user request returns **404**.
- [ ] Idempotency key handled on any new create endpoint.
- [ ] Migration is safe on a large table (`docs/04-data/migrations.md`).

### AI (if touched)

- [ ] Output is schema-validated and taxonomy-clamped.
- [ ] Confidence is stored, not discarded.
- [ ] A fallback path exists (`docs/06-ai/ai-fallbacks.md`).
- [ ] No model output can cause a side effect.
- [ ] **Relevant evaluation re-run**, and no gate regressed
      (`docs/06-ai/evaluation.md`).

### Security and privacy

- [ ] No secret reachable from the client.
- [ ] No token, image, email body or body data in any log, analytics event or
      error report.
- [ ] Any new user content has a deletion path
      (`docs/07-security/data-retention.md`).
- [ ] New permissions documented in `docs/07-security/permissions.md`.

### Analytics

- [ ] Events from `docs/05-api/events.md` emitted where specified.
- [ ] New events added to that document in the same change.
- [ ] No user content in any property.

### Engineering

- [ ] Tests at the appropriate layers pass
      (`docs/08-engineering/testing-strategy.md`).
- [ ] No TypeScript errors.
- [ ] No lint errors.
- [ ] No unexpected console errors or warnings.
- [ ] Performance targets met for the surfaces touched
      (`docs/01-product/requirements.md` §8).

### Documentation

- [ ] Affected specifications updated in the same pull request.
- [ ] Any decision not covered by the specs added to
      `docs/09-decisions/decisions.md`.
- [ ] `tasks/current.md` updated; completed work moved to `tasks/completed.md`.

---

## Not on this list, and deliberately so

- A changelog entry for every commit.
- Documentation for its own sake.
- Test coverage percentages.
- A screenshot in the pull request for a backend change.

Add what the change needs. Not more.

---

## The short version

If you cannot answer **"what happens when this is empty, slow, offline, denied, or
broken?"** — it is not done.
