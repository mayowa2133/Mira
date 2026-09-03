# Observability

Enough signal to know Mira is healthy and honest — and not one byte of user
content.

---

## Logs

Structured JSON. Every request carries `request_id`, `user_id` (opaque id only),
route, method, status, latency and outcome. Workers carry `job_id`, `job_type`,
`attempt` and the same correlation id.

### Never logged

```text
authentication tokens · OAuth tokens · any secret
image bytes · image URLs · storage keys
email addresses · subjects · bodies
body measurements · body images
prompts containing user content
raw search queries
```

A redaction layer strips these before write, and is unit-tested against a fixture
containing every shape Mira handles (SEC-2, SEC-9).

Retention: 30 days.

## Traces

API → queue → worker → provider, on one correlation id. Spans carry capability,
provider and model for AI calls — never the prompt or the response body.

## Metrics

### Product health

| Metric | Why |
| ------ | --- |
| Closet activation (20+ items in setup) | North star |
| Actions per imported garment | Import efficiency — lower is better |
| Search success rate | Search usefulness |
| Stylist acceptance rate | Stylist usefulness |
| Manual edits after setup | Maintenance burden — should trend down |

### System health

| Metric | Alert |
| ------ | ----- |
| API p95 latency by route | Above `requirements.md` §8 |
| Error rate by code | Sustained increase |
| Queue depth and age by job type | Age > 10 min |
| Dead-letter count | Any, for deletion jobs |
| Crash-free sessions | < 99.5% |

### AI health

| Metric | Alert |
| ------ | ----- |
| Latency p50/p95 per capability | Above target |
| Cost per capability per day | Above budget |
| `ai_validation_failed` rate | Any sustained increase — usually a prompt or model regression |
| `ai_taxonomy_clamped` rate | Sustained increase |
| `ai_fallback_used` rate | Sustained increase |
| Correction rate per garment field | Sustained increase — model regression in the wild |
| Circuit breaker state | Open for > 5 min |

Correction rate is the most valuable production quality signal Mira has: it
measures accuracy against the only ground truth that matters, the user.

## Alerts that page

```text
Deletion job in the dead-letter queue          ← "we failed to delete your photo"
Body or try-on image served without auth
Any 5xx rate above 1% for 5 minutes
Queue age above 30 minutes
Crash-free sessions below 99%
AI validation failure rate doubling
```

The first two are severity 1 regardless of volume.

## Dashboards

1. **Product** — activation, import efficiency, search success, stylist
   acceptance, try-on ratings.
2. **Ingestion funnel** — capture → analyzed → confirmed → in closet, by method,
   with drop-off.
3. **AI** — latency, cost, validation failures, fallbacks, correction rates, per
   capability.
4. **System** — latency, errors, queues, crashes.

## What good looks like

- Ingestion funnel drop-off is concentrated at user decisions, not failures.
- Fallback rate is low and flat.
- Correction rate is flat or falling.
- Queue age is measured in seconds.
- No deletion job has ever reached the dead-letter queue.
