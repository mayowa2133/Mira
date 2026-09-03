# States and Errors

A screen is not done when the happy path renders. Every screen implements the
states below or explicitly documents why one does not apply.

---

## The six required states

| State | Requirement |
| ----- | ----------- |
| **Loading** | Skeletons shaped like the real content. Never a centred spinner on an empty screen. |
| **Empty** | A warm sentence plus one obvious route out. Never "No data." |
| **Error** | What happened, in the user's terms, plus a retry. Never an error code alone. |
| **Permission denied** | Explain what the permission unlocks and offer the settings route. Never a dead end. |
| **Offline** | Serve cached content, disable what genuinely needs network, say so plainly. |
| **Partial / degraded** | When some of the work succeeded, show it and name what is still missing. |

---

## Loading

- **Grids** — skeleton tiles at the real aspect ratio, `surfaceSunken`, subtle
  shimmer. Show the same number of tiles the viewport fits.
- **Detail screens** — hero placeholder plus two text bars.
- **Generation (stylist, try-on)** — never a generic spinner. The stylist
  assembles pieces (`Top ✓ Bottom ✓ Shoes ✓ Bag ✓`); try-on shows a soft shimmer
  with an honest estimate.
- **Long work is backgroundable.** If it may exceed ~10 s, the user can leave and
  be notified.
- Optimistic operations (favourite, mark worn, status change) show no loading
  state at all.

---

## Empty states

| Screen | Copy | Route out |
| ------ | ---- | --------- |
| Closet (no items) | "Your closet is empty. Let's find what you already own." | The four import options |
| Closet (filtered) | "No pieces match those filters." | `Clear filters` |
| Search (no results) | "Nothing matched. Try 'black dresses' or 'things I've never worn'." | Suggested queries |
| Looks — Saved | "No saved looks yet." | `Ask Mira for a look` |
| Looks — Worn | "Nothing marked worn yet." | `Browse your closet` |
| Purchase review | "We couldn't find purchases in that account." | `Try another account` / `Scan a receipt instead` |
| Wardrobe insights | "Mira needs a bit more history first." | `Add more pieces` |
| Wear history | "No wears recorded yet." | `Mark something worn` |
| Try-on (no body profile) | "Add a few photos so Mira can show your wardrobe on you." | `Set up body profile` |

Empty states use imagery or a single warm line — never an illustration of a
robot, never an exclamation mark.

---

## Error taxonomy

| Class | User-visible behaviour | Retry |
| ----- | ---------------------- | ----- |
| **Network** | "You're offline. We'll finish this when you're back." | Automatic |
| **Timeout** | "That's taking longer than usual." | Manual + automatic backoff |
| **Validation** | Inline, next to the field. | On correction |
| **Authorization** | Route to sign-in; never leak that another user's resource exists. | After sign-in |
| **Not found** | "This piece isn't in your closet any more." | Back |
| **Rate limited** | "Mira's a bit busy. Try again in a moment." | After the stated delay |
| **AI unavailable** | Degrade per `docs/06-ai/ai-fallbacks.md`; never block the user. | Manual |
| **AI invalid output** | Silent to the user; retried once, then degrade. Logged. | Automatic once |
| **Storage / upload** | "We couldn't upload that photo." Local queue retains it. | Automatic + manual |
| **Server (5xx)** | "Something went wrong on our side." | Manual |

**Rules**

- Never surface a raw provider error, stack trace, or error code as primary copy.
  An error id may appear in `type.caption` for support.
- Never blame the user or the model. "That photo was hard to read — try again with
  the tag flat?" beats "Invalid input."
- Every error message states what the user can do next.
- Errors that lose user work are unacceptable: captures queue locally, drafts
  persist, candidate decisions are saved as they are made.

---

## Permission denied

| Permission | If denied |
| ---------- | --------- |
| Camera | "Mira needs the camera to scan your clothes." + `Open settings` + `Choose a photo instead` |
| Photo library | Offer camera instead; support limited-selection mode on iOS. |
| Notifications | Silently degrade. Never re-prompt more than once. |
| Location | Weather-aware styling degrades to season-only. Say so once, quietly. |
| Email (OAuth declined) | Return to Build your closet with other options intact. |

Permissions are requested **in context, at the moment of use**, never at launch.

---

## Offline behaviour

| Capability | Offline |
| ---------- | ------- |
| Browse closet | Works from cache |
| Garment detail | Works from cache |
| Favourite, mark worn, mark laundry | Queued, optimistic, synced later |
| Capture a garment | Photo queued locally; analysis runs when online |
| Search | Local filter-based search works; semantic search disabled with a note |
| Mira stylist | Disabled, with "Mira needs a connection to style you." |
| Try-on | Disabled, same treatment |
| Purchase review | Decisions queued and synced |

A queued-work indicator appears in the Closet header when items are pending.

---

## Degraded AI states

| Situation | Behaviour |
| --------- | --------- |
| Segmentation failed | Keep the original photo as canonical; garment is still created |
| Classification failed | Ask for category only; everything else optional |
| Brand match failed | Leave brand empty and tappable. Never guess a brand |
| Confidence below threshold | Show the field as a question, without a tick |
| Embedding unavailable | Semantic search falls back to structured filters |
| Stylist unavailable | Offer saved looks and recently worn combinations |
| Try-on provider unavailable | "Try-on is unavailable right now" + notify when back |

Full policy: `docs/06-ai/ai-fallbacks.md`.

---

## Destructive actions

- **Undo, not confirm**, wherever reversible: a snackbar with `Undo` for archive,
  status change, and auto-imports.
- **Confirm** only for genuine deletion: garment removal, body photo deletion,
  try-on deletion, account deletion.
- Deletion confirmations state exactly what is removed and whether it can be
  recovered.
- Account deletion follows `docs/07-security/data-retention.md`.

---

## Analytics on failure

Failure events (`garment_analysis_failed`, `try_on_failed`, …) are emitted with a
reason code and never with image bytes, email content, or body data.
