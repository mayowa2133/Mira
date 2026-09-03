# Security Rules

**These are hard requirements. They are not negotiable against a deadline, a
convenience, or a demo.**

```text
Never store plaintext passwords.

Never log authentication tokens.

Never log email OAuth tokens.

Never expose backend secrets to mobile clients.

All private images require authenticated access.

Use expiring signed URLs where applicable.

Users may only access their own closet.

Users may only access their own body profile.

Users may only access their own try-ons.

External AI responses must be treated as untrusted input.

Validate all structured AI output.

OAuth credentials must be encrypted appropriately.

Deletion requests must remove applicable private data.

Email ingestion should use the minimum permissions technically possible.
```

---

## How each rule is enforced

### Passwords (SEC-1)

Mira stores no passwords in any form. Authentication is delegated to a managed
provider (Apple, Google, email magic link / OTP). There is no password field in
the schema, so there is nothing to get wrong.

### Tokens are never logged (SEC-2)

- A log redaction layer strips `authorization`, `access_token`, `refresh_token`,
  `id_token`, `code`, and any key matching `*token*`, `*secret*`, `*password*`.
- The redactor is unit-tested against a fixture containing every token shape Mira
  handles.
- Sentry payloads pass through the same redactor before send.

### No backend secret reaches the client (SEC-3)

- Only `EXPO_PUBLIC_*` variables are available to the mobile bundle.
- A CI check greps the built bundle for known secret name patterns and fails the
  build on a hit.
- Every third-party call — AI providers, storage, email — is server-side.

### Private images (SEC-4)

- All four buckets are private. There is no public bucket.
- Reads use signed URLs with short TTLs (2 minutes for body and try-on, 5 for
  everything else), issued only after an ownership check.
- The client caches bytes, not URLs.

### Users access only their own data (SEC-5)

Two independent mechanisms, both required:

1. **Repository scoping.** Every repository method takes a `user_id` and filters
   on it. A method that cannot scope by user does not exist.
2. **Row-level security.** Postgres RLS policies on every user-owned table.

Neither is permitted to be the only mechanism.

**Cross-user access returns 404, never 403.** A 403 confirms the resource exists.

### AI output is untrusted (AI-7)

Parse strictly → validate against a schema → clamp to the taxonomy → normalize
confidence, before anything is persisted. Model output can only ever be data: it
never selects an action, changes ownership state, or triggers a side effect
(`docs/06-ai/ai-product-spec.md` R4).

This is also the prompt-injection defence. Photos, tags, receipts, emails and
product pages can all contain text engineered to steer a model. They are delimited
as data, and no output path exists for them to become instructions.

### OAuth credentials encrypted (SEC-6)

Email tokens are stored in `bytea` columns, encrypted with
`EMAIL_TOKEN_ENCRYPTION_KEY` (AES-256-GCM, key from the environment, rotatable).
They are never returned by any API response and never logged.

### Deletion removes the data (SEC-7)

See [data-retention.md](data-retention.md). Deletion jobs are idempotent, retried,
and alert on final failure — "we failed to delete your photo" is not an acceptable
silent outcome.

### Minimum email permissions (SEC-8)

The narrowest read scope the provider offers. Only messages matching
retailer/order heuristics are opened. Raw bodies are not retained beyond
extraction.

---

## Additional binding rules

| Rule | Detail |
| ---- | ------ |
| **EXIF stripped before upload** | Location metadata in a garment photo is a privacy leak with no product value |
| **No user content in analytics** | No image bytes or URLs, no email content, no body data, no prompt text (SEC-9) |
| **No user content in error reports** | Same redaction, applied to Sentry |
| **Idempotency keys on every create** | A retried capture cannot create duplicates |
| **Rate limits on expensive endpoints** | Analysis, generation, try-on |
| **Signed upload URLs are scoped** | The key must match the caller's storage prefix |
| **Biometric gate on body surfaces** | Where the device supports it |
| **Cache cleared on sign-out** | Including cached garment images — shared devices must not leak a closet |
| **Dependencies pinned and audited** | `npm audit` in CI; no new dependency without justification |

---

## Code review checklist

Every change touching user data must answer:

- [ ] Does every new query filter by `user_id`?
- [ ] Is there an RLS policy for any new table?
- [ ] Does a cross-user request return 404?
- [ ] Are new secrets server-only, and in `.env.example` with a comment?
- [ ] Does any new log line risk containing a token, image, email body or body data?
- [ ] Is new AI output schema-validated and taxonomy-clamped?
- [ ] Can any model output cause a side effect? (It must not.)
- [ ] Does new user content get a deletion path?
- [ ] Do new analytics properties comply with `docs/05-api/events.md` §Rules?

---

## Reporting

Security issues go to the maintainers privately, not into public issues. A fix
that touches these rules requires a written note in
`docs/09-decisions/decisions.md`.
