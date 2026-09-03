# Environments

| Environment | Purpose | Data | Providers |
| ----------- | ------- | ---- | --------- |
| `local` | Development on a laptop | Seeded synthetic | Stubbed by default; real with a flag |
| `dev` | Shared integration | Seeded synthetic | Real, low quota |
| `staging` | Release candidate verification | Seeded synthetic | Real, production config |
| `production` | Users | Real | Real |

> **Production data is never copied into a lower environment.** Not for
> debugging, not for a demo, not once. Lower environments use the seed sets in
> `docs/04-data/seed-data.md`.

---

## Local

```bash
docker compose up -d          # postgres + redis
cp .env.example .env.local    # fill in what you need
npm install
npm run db:migrate
npm run db:seed -- --set=realistic
npm run api                   # apps/api
npm run worker                # apps/worker
npm run mobile                # Expo
```

AI providers are stubbed by default — canned responses, including malformed and
adversarial ones, so validation and fallback paths are exercised constantly rather
than only in tests. Set `AI_*_PROVIDER` to use real providers.

## Configuration

All configuration is environment variables (`.env.example` is the manifest).

| Prefix | Visibility |
| ------ | ---------- |
| `EXPO_PUBLIC_*` | **Shipped in the mobile bundle.** Never a secret |
| everything else | Server only (SEC-3) |

A CI check greps the built bundle for non-`EXPO_PUBLIC_` secret name patterns and
fails on a hit.

Secrets live in the platform's secret manager, never in the repository, never in
a shared document, never in a chat message.

## Feature flags

```text
FEATURE_EMAIL_IMPORT
FEATURE_TRY_ON
FEATURE_AUTO_IMPORT_HIGH_CONFIDENCE
```

Flags gate incomplete phases. A flag that has been on in production for a full
release cycle is removed — permanent flags become permanent branches.

## Data isolation

| Environment | Buckets | Database | Analytics |
| ----------- | ------- | -------- | --------- |
| local | local MinIO or a dev bucket | local Postgres | disabled |
| dev | `mira-dev-*` | dev instance | dev project |
| staging | `mira-staging-*` | staging instance | staging project |
| production | `mira-*` | production instance | production project |

No credential grants access across environments.

## Seed users

`@mira.local` addresses only. They can never receive real email, and they are not
present in production.

## Access

| Environment | Who |
| ----------- | --- |
| local | Everyone |
| dev | Everyone |
| staging | Engineering |
| production | Named on-call, with audited access |

**No one has an admin UI over user images in any environment**
(`docs/07-security/threat-model.md`).

## Simulator and devices

The iOS Simulator is the default verification surface (`AGENTS.md` Visual
Implementation Rule item 10). Camera-dependent flows are verified on a physical
device before a phase is considered complete — a simulator cannot photograph a
garment tag.
