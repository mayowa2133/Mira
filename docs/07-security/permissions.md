# Permissions

Every permission Mira requests, why, when, and what happens when it is refused.

**Principle:** minimize requested permissions (privacy principle 10). Ask in
context, at the moment of use — never at launch, never in a batch.

---

## Device permissions

### Camera

- **Why:** scanning garments, tags and receipts — the fastest capture paths.
- **When:** the first time the user opens a capture screen.
- **Copy:** "Mira uses your camera to scan the clothes you already own."
- **If denied:** offer photo library and manual entry. Show `Open settings`.
  Never block the Add flow.

### Photo library

- **Why:** importing existing photos of clothing.
- **When:** the first time the user taps "Choose a photo".
- **If denied:** offer the camera. Support iOS **limited selection** — a user who
  grants access to five photos gets a working flow, not an error.

### Notifications

- **Why:** analysis complete, import complete, new purchase detected, try-on
  ready.
- **When:** after the first backgroundable job is started, not at launch.
- **If denied:** silent degradation. In-app states still show everything. Never
  re-prompt more than once.

### Location

- **Why:** weather-aware styling only.
- **When:** the first time the user asks for an outfit where weather matters.
- **Granularity:** city-level. Coordinates are never stored with garments or
  outfits.
- **If denied:** season-based styling, with one quiet notice. Never asked again.

### Face ID / Touch ID

- **Why:** gating the body profile and try-on surfaces.
- **When:** when the body profile is first created.
- **If denied:** the surfaces work; the extra gate is simply absent.

---

## Email permissions (SEC-8)

The most sensitive permission Mira requests, and the most valuable.

### Scope

Request the **narrowest read scope technically possible**. Prefer, in order:

1. Metadata + targeted query access, where the provider offers it.
2. Read-only access limited to messages matching a query.
3. Read-only mailbox access — only if nothing narrower exists.

Mira never requests send, modify, or delete scopes. There is no product reason to
have them, and holding them expands the blast radius of a token compromise.

### Consent

The explainer is shown **before** the OAuth screen, in plain language:

> **What Mira reads** — order and shipping confirmations from retailers.
> **What Mira keeps** — the item, price, retailer and date. Not your inbox.
> **You're in control** — disconnect any time, and delete what Mira found.

### In practice

- Messages are filtered on metadata (sender domain, subject keywords) **before**
  any body is opened. Marketing email is rejected without being read.
- Raw bodies are not retained beyond extraction
  ([data-retention.md](data-retention.md)).
- Tokens are encrypted at rest (SEC-6) and never returned by any API response.
- Disconnect is one action in `You → Connected accounts`, and offers deletion of
  every derived candidate.

### If declined

Return to "Build your closet" with the other three import methods intact and
equally prominent. Declining email must never feel like failing onboarding.

---

## Retailer connections

Not in MVP. When added: individually connectable and disconnectable, official
APIs or documented feeds only, and they produce `purchase_candidates` — never
garments directly.

---

## Rules

1. Never request a permission at launch.
2. Never request a permission the current screen does not need.
3. Never re-prompt more than once after a denial.
4. Every denial has a working alternative path.
5. Every permission has a visible disconnect or revoke path inside Mira.
6. Explain the benefit before the system dialog, never after.
7. A new permission requires an entry here and in
   `docs/07-security/threat-model.md`.
