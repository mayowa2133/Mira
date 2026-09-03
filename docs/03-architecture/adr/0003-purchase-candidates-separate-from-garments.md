# ADR 0003 — Purchase candidates are a separate entity from garments

- **Status:** Accepted
- **Date:** 2026-09-03

## Context

Mira detects purchases from email and receipts. A detected purchase may have been
returned, sold, donated, bought for someone else, or not be clothing at all.
Treating a detected purchase as an owned garment would corrupt the closet — the
one thing Mira must get right — and would make the stylist recommend clothes the
user does not have.

## Decision

`purchase_candidates` is a distinct table from `garments`. Candidates never appear
in closet queries. The only bridge is an explicit user transition to
`confirmed_owned`, which then runs duplicate detection and creates a garment,
linked back via `linked_garment_id`.

Automatic import is opt-in, confidence-gated, notified, and undoable for at least
30 days.

## Consequences

- The closet is only ever things the user said they own.
- Purchase history is retained independently and remains useful (spend, retailer
  history) even when a garment is never created.
- Two review surfaces exist rather than one, which is more work — and is the
  point.
- Requirement OWN-1/OWN-2 becomes structurally enforced rather than a rule people
  must remember.

## Alternatives considered

- **Create garments with an `unconfirmed` status** — rejected: every closet query,
  every stylist call, every count and every insight would then need to remember to
  exclude them. One forgotten filter silently breaks the product's core promise.
