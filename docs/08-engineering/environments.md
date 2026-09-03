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

### Running the app on a simulator

```bash
npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
npm run api

cd apps/mobile
npx expo run:ios --device "<simulator UDID>"   # UDID, not name: a name can
                                               # resolve to a physical device
```

Two setup problems worth knowing, because both fail with unhelpful messages:

- **CocoaPods needs a UTF-8 locale.** Without one, `pod install` dies with
  `Unicode Normalization not appropriate for ASCII-8BIT`. Export
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before running it.
- **Pass a simulator UDID, not a name.** Given a name that does not match,
  `expo run:ios` falls back to `Any iOS Device` and fails with
  `iOS <version> is not installed`, which reads like a missing SDK rather than
  a wrong destination. `xcrun simctl list devices booted` gives the UDID.

### Signing in during development

There is no sign-in screen yet — that is task 0.5, whose API half is built and
tested but whose client half is not. Without a token every request 401s and the
closet screens can only be seen in their error state.

`apps/mobile/src/lib/dev-auth.ts` reads `EXPO_PUBLIC_DEV_AUTH_TOKEN` when
`__DEV__` is true, so the real screens can be exercised against the real API:

```bash
TOKEN=$(cd apps/api && node -e "const {SignJWT}=require('jose');
  new SignJWT({}).setProtectedHeader({alg:'HS256'})
    .setSubject('seed-realistic-1').setAudience('mira').setExpirationTime('30d')
    .sign(new TextEncoder().encode('miradev')).then(t=>console.log(t))")

EXPO_PUBLIC_DEV_AUTH_TOKEN="$TOKEN" npx expo start
```

It is inert in any release build, and the dev verifier that mints such a token
cannot run outside `MIRA_ENV=local`. Delete the module when 0.5 lands.
