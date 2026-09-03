# Auth Contract

Managed authentication (Supabase Auth or equivalent). Mira issues its own session
on top of the provider's identity.

---

## Providers

| Provider | Notes |
| -------- | ----- |
| Apple | Required on iOS when other social sign-in is offered |
| Google | — |
| Email | Magic link or OTP. **No password storage** (SEC-1) |

Mira stores no passwords in any form. If a password-based flow is ever added, it
is handled entirely by the managed provider.

---

## Session flow

```text
client → provider SDK → provider token
client → POST /auth/session { provider, token }
api    → verify token with the provider
       → find or create the Mira user
       → issue { access_token, refresh_token, expires_at }
client → store tokens in the device keychain
```

| Token | Lifetime | Storage |
| ----- | -------- | ------- |
| Access | 1 hour | Keychain / secure store, in memory during use |
| Refresh | 60 days, rotating | Keychain only |

**Never** in AsyncStorage, MMKV, Redux, or a log line (SEC-2).

## Refresh

```text
401 token_expired → POST /auth/refresh → new pair (refresh token rotates)
```

A refresh token is single-use. Reuse of a rotated token invalidates the whole
family and forces re-authentication — this is the stolen-token defence.

## Verification on every request

1. Signature and expiry validated against the provider's JWKS (cached, rotated).
2. `aud` must match `JWT_AUDIENCE`.
3. The subject resolves to a Mira `user_id`.
4. That `user_id` is passed into every repository call (SEC-5).

A request without a resolvable user never reaches a service.

---

## Authorization model

V1 has exactly one role: **owner**. A user can read and write their own data and
nothing else.

```text
garments · garment_images · garment_attributes · outfits · outfit_items ·
wear_events · purchase_candidates · purchase_records · body_profiles ·
try_on_generations · email_connections · style_preferences · search_history
```

Every one of these tables is scoped by `user_id` at the repository layer, and
additionally protected by row-level security where the deployment supports it.
Neither mechanism may be the only one.

**Cross-user access returns 404, never 403** — see
[error-contract.md](error-contract.md).

## Sign-out

```text
DELETE /auth/session
  → revoke the refresh token family
  → clear the keychain
  → clear the local cache, including cached garment images
```

Cached images are cleared because a shared device must not leak the previous
user's closet.

## Account deletion

```text
DELETE /auth/account
  → confirmation in the client, stating exactly what is removed
  → 202, deletion job enqueued
  → hard delete per docs/07-security/data-retention.md
  → provider identity deleted
  → sessions revoked immediately
```

Deletion is not reversible and is not a soft delete.

---

## Rules

1. No password is ever stored in plaintext (SEC-1).
2. No token is ever logged (SEC-2).
3. The service role key never leaves the server (SEC-3).
4. Tokens live in the keychain, never in general-purpose storage.
5. Refresh tokens rotate; reuse invalidates the family.
6. Biometric re-authentication gates the body profile and try-on surfaces when the
   device supports it.
7. Permission checks happen at the data layer, not in handlers.
