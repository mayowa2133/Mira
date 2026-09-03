# Privacy

Mira processes some of the most private information a consumer app can hold:
photographs of a person's body, their purchase history, and the contents of their
home.

---

## The twelve principles

1. **Body photos are private by default.**
2. **Closet contents are private by default.**
3. **Try-on images are private by default.**
4. **No public closet exists in V1.**
5. **Do not train models on user images** unless explicitly permitted by policy
   and user consent.
6. **Users must be able to delete body images.**
7. **Users must be able to delete generated try-ons.**
8. **Users must be able to disconnect email.**
9. **Users must understand what email access is used for.**
10. **Minimize requested permissions.**
11. **Store only what Mira needs.**
12. **Never expose provider credentials to mobile clients.**

---

## What Mira holds, and why

| Data | Why | Retention |
| ---- | --- | --------- |
| Garment photographs | The product | Life of the garment + window |
| Garment metadata | Search, styling, insights | Life of the garment |
| Purchase history | Cost per wear, duplicate prevention, spend | Life of the account |
| Email-derived purchase data | Closet reconstruction | Life of the connection; deletable |
| Body reference photos | Try-on only | Until deleted by the user |
| Try-on generations | Comparison and saving | Until deleted by the user |
| Wear history | Rediscovery, cost per wear, stylist recency | Life of the account |
| Style preferences | Personalization | Life of the account |
| Location (if authorized) | Weather-aware styling | Not stored — used in-request only |

Anything not in this table is not collected.

## Permissions

Requested **in context, at the moment of use**, never at launch:

| Permission | Asked when | If denied |
| ---------- | ---------- | --------- |
| Camera | First scan | Photo library, or manual entry |
| Photo library | First "Choose a photo" | Camera instead; iOS limited selection supported |
| Notifications | After the first backgroundable job | Silent degradation; never re-prompted more than once |
| Location | First weather-aware styling | Season-based styling, one quiet notice |
| Email | Explicit opt-in only | Everything else still works |

## Email access

The explainer the user sees before connecting:

> **What Mira reads** — order and shipping confirmations from retailers.
> **What Mira keeps** — the item, price, retailer and date. Not your inbox.
> **You're in control** — disconnect any time, and delete what Mira found.

Behind it: the narrowest scope available, retailer/order heuristics before any
message is opened, no retention of raw bodies beyond extraction, and one-tap
disconnect with deletion of derived data.

## Body profile and try-on

- Optional. Mira is fully usable without ever adding a body photo.
- Private by default, with no sharing surface in V1.
- Used **only** to generate try-ons for that same user.
- Never sent to analytics or error reporting.
- Deletable individually or wholesale; deletion is a hard delete that also
  invalidates the try-on cache.
- Providers must be configured to exclude training on this content. A provider
  that cannot is ineligible, regardless of output quality.
- Mira does not infer measurements from photographs, and does not comment on the
  user's body.

## Training and improvement

Mira does not train models on user images.

User **corrections** (e.g. "that's not Aritzia, it's Zara") are used to measure
and improve accuracy, because they are the highest-value signal Mira has. They are
used as:

- structured feedback (field, previous value, corrected value, confidence band),
- **not** as imagery, unless the user has given explicit, revocable consent to
  contribute images to an evaluation set.

Evaluation datasets are synthetic or explicitly consented
(`docs/06-ai/evaluation.md` §1).

## Sharing

- No public closet, no profiles, no feed, no followers in V1
  (`docs/01-product/non-goals.md`).
- The OS share sheet may be used to share a single generated look. That is a
  user-initiated export, not a Mira-hosted page.

## User rights

| Right | How |
| ----- | --- |
| See what Mira holds | `You → Privacy & data → Export my data` |
| Delete a body image | `You → Body profile` — immediate hard delete |
| Delete a try-on | On the try-on, `⋯ → Delete` — immediate hard delete |
| Disconnect email | `You → Connected accounts` — one action, offers data deletion |
| Delete everything | `You → Privacy & data → Delete account` |

Windows and mechanics: [data-retention.md](data-retention.md).

## Children

Mira is not directed at children and is not designed for users under the age of
digital consent in their jurisdiction.

## Changes

A change that alters what Mira collects, how long it keeps it, or who it is shared
with requires a written entry in `docs/09-decisions/decisions.md` and an update to
this document in the same change.
