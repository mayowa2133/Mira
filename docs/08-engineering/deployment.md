# Deployment

---

## Pipeline

```text
pull request
  → CI: typecheck · lint · unit · integration · api · database · security · visual
  → build
  → E2E on a simulator
  → [if AI files changed] evaluation for the affected capabilities
  → review
  → merge to main
       → deploy to dev automatically
       → promote to staging manually
       → verification on staging
       → promote to production manually
```

Nothing reaches production without passing through staging.

## Backend

- Containerized API and worker, deployed independently — a stuck queue must not
  require an API deploy.
- Rolling deploy, health-gated on `GET /health/ready` (database, queue and
  storage reachable).
- Migrations run **before** the new application version, and must be backward
  compatible with the running version (`docs/04-data/migrations.md`).
- Rollback: redeploy the previous image. Because migrations are forward-only and
  expand/contract, the previous version always tolerates the current schema.

## Mobile

- EAS Build for iOS.
- **Over-the-air updates** for JavaScript-only changes, within the same native
  runtime version.
- A **store submission** is required for: native module changes, permission
  string changes, SDK upgrades.
- Staged rollout: 10% → 50% → 100%, watching crash-free sessions and the
  stylist/capture funnels.
- The minimum supported version is enforced by the API; below it, the client shows
  an update prompt rather than failing obscurely.

## Release checklist

- [ ] All AI evaluation **gates** pass (`docs/06-ai/evaluation.md`)
- [ ] The eight critical E2E journeys pass
- [ ] Security test suite green
- [ ] Migrations reviewed against the large-table checklist
- [ ] Feature flags set correctly for the target environment
- [ ] Analytics events for new surfaces verified as arriving
- [ ] Specifications updated for anything that changed
- [ ] `docs/09-decisions/changelog.md` updated
- [ ] Rollback plan stated in the release notes

## Post-deploy watch

For 30 minutes after a production deploy:

| Signal | Threshold |
| ------ | --------- |
| Error rate | No increase beyond baseline noise |
| API p95 latency | Within `requirements.md` §8 |
| Crash-free sessions | ≥ 99.5% |
| `garment_analysis_failed` rate | No increase |
| `ai_validation_failed` rate | No increase |
| `ai_fallback_used` rate | No increase |
| Queue depth | Draining |

A rise in `ai_validation_failed` after a deploy usually means a prompt or model
change slipped through without an evaluation run.

## Incidents

1. Stop the rollout.
2. Roll back if the cause is not obvious within 10 minutes.
3. Communicate in-app if user data or private images are implicated.
4. Write it up in `docs/09-decisions/decisions.md` if it changes a rule.

**Any incident touching body images, try-on images or email tokens is treated as
severity 1**, regardless of the number of users affected.

## Backups

- Database: continuous archiving, 35-day retention, restore tested quarterly.
- Object storage: versioning **off** deliberately — a deleted photo must be gone
  (`docs/07-security/data-retention.md`).
- A restore re-applies the deletion log, so a restore never resurrects deleted
  user content.
