# Error Contract

Every non-2xx response has the same shape.

```json
{
  "error": {
    "code": "garment_not_found",
    "message": "This piece isn't in your closet any more.",
    "details": [{ "field": "category", "issue": "not_in_taxonomy" }],
    "request_id": "req_01J...",
    "retry_after": null
  }
}
```

| Field | Purpose |
| ----- | ------- |
| `code` | Stable, machine-readable. Never changes meaning. |
| `message` | User-presentable, in the user's terms. Never a stack trace or provider text. |
| `details` | Optional per-field issues, for validation errors. |
| `request_id` | For support. May be shown in small text. |
| `retry_after` | Seconds, on 429 and some 503s. |

---

## Status codes

| Code | Meaning | Client behaviour |
| ---- | ------- | ---------------- |
| 400 | Malformed request | Bug. Report, do not retry. |
| 401 | Missing or invalid credentials | Refresh once, then sign in |
| 403 | Authenticated but not permitted | Rare — see the 404 rule below |
| 404 | Not found, **or not the caller's resource** | Treat as gone |
| 409 | Concurrency or idempotency conflict | Refetch and re-present |
| 413 | Payload too large | Downscale and retry |
| 415 | Unsupported media type | Bug |
| 422 | Failed validation | Show inline, do not retry unchanged |
| 429 | Rate limited | Back off for `retry_after` |
| 500 | Server error | Show the error state, offer retry |
| 503 | Dependency unavailable | Retry with backoff |

> **The 404 rule.** A resource that exists but belongs to another user returns
> **404**, never 403. A 403 would confirm the resource exists. 403 is reserved for
> the caller's *own* resources under a policy restriction (e.g. a feature not
> enabled for that account).

---

## Codes

### Auth
```text
unauthenticated · token_expired · token_invalid · account_deleted ·
provider_rejected
```

### Resources
```text
garment_not_found · outfit_not_found · candidate_not_found ·
try_on_not_found · body_profile_not_found · import_not_found · job_not_found ·
wear_event_not_found
```

### Validation
```text
validation_failed · not_in_taxonomy · subcategory_mismatch ·
immutable_field · invalid_status_transition · invalid_size_format ·
missing_idempotency_key
```

`not_in_taxonomy` and `subcategory_mismatch` are the enforcement points for INV-1
and taxonomy §1.

### Conflict
```text
version_conflict · idempotency_key_reused · duplicate_unresolved ·
outfit_slot_conflict
```

`duplicate_unresolved` is returned when a create is attempted while a duplicate
candidate is outstanding and no `duplicate_resolution` was supplied (CAP-5).

### Ingestion
```text
upload_key_invalid · upload_not_found · unsupported_image_format ·
image_too_large · no_garment_detected · tag_unreadable ·
receipt_unreadable · no_items_extracted
```

None of these are fatal to the user's work: each maps to a degraded path in
`docs/02-design/states-and-errors.md` and
`docs/06-ai/ai-fallbacks.md`.

### Purchases and integrations
```text
email_connection_failed · email_scope_insufficient · email_token_expired ·
email_scan_failed · retailer_unavailable
```

### AI
```text
ai_unavailable · ai_timeout · ai_invalid_output · ai_rate_limited ·
try_on_generation_failed · try_on_unsupported_input
```

`ai_invalid_output` is never surfaced verbatim: the client shows the degraded
state, and the code exists for logging and alerting.

### Limits
```text
rate_limited · try_on_budget_exceeded · closet_limit_reached
```

---

## Messages

Message copy is part of the product, not an afterthought.

| Code | Message |
| ---- | ------- |
| `garment_not_found` | "This piece isn't in your closet any more." |
| `wear_event_not_found` | "We couldn't find that wear." |
| `no_garment_detected` | "We couldn't find a garment in that photo. Try one item at a time?" |
| `tag_unreadable` | "That tag was hard to read — try again with it flat and well lit?" |
| `receipt_unreadable` | "We couldn't read that receipt. A flatter photo usually helps." |
| `ai_unavailable` | "Mira can't style you right now. Everything else still works." |
| `try_on_generation_failed` | "That try-on didn't come out right. Want to try again?" |
| `rate_limited` | "Mira's a bit busy. Try again in a moment." |
| `duplicate_unresolved` | "You may already own this — tell us which it is." |
| `version_conflict` | "This piece changed somewhere else. We've refreshed it." |

**Rules**

- Never blame the user or the model.
- Never expose a provider's error text, a stack trace, or a SQL error.
- Every message implies the next action.
- `request_id` may appear in `type.caption` beneath the message; the code may not.

---

## Logging

- Every error logs `code`, `request_id`, `user_id`, route and latency.
- 5xx logs the underlying cause; 4xx does not need a stack.
- **Never logged:** tokens, OAuth credentials, image bytes, storage keys, email
  bodies, prompts containing user content, body data (SEC-2, SEC-9).
- Sentry payloads are scrubbed before send.
