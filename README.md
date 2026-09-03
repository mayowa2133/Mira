# Mira

**Your closet. Your stylist. Your mirror.**

Mira is an AI-powered personal wardrobe. It learns everything you own, makes
digitizing an existing closet dramatically easier, detects future purchases
automatically, helps you style the clothes you already own, and lets you
visualize those exact outfits on your own body.

## Why Mira exists

People with large wardrobes own far more clothing than they can mentally track.
They forget what they own, leave tags on unworn pieces, buy duplicates, and still
feel like they have nothing to wear.

Existing digital closet apps solve this by asking the user to manually catalogue
every item. For someone with 300 garments, that is unacceptable.

> **Mira's most important product principle:** Mira should do as much of the
> closet-building work as possible for the user.

## The five pillars

| Pillar         | What it does                                                     |
| -------------- | ---------------------------------------------------------------- |
| **Capture**    | Get clothing into Mira with as little effort as possible          |
| **Understand** | Work out exactly what each item is                                |
| **Inventory**  | A searchable representation of the physical closet                |
| **Style**      | An AI stylist that recommends clothes the user already owns       |
| **Mirror**     | Virtual try-on of those exact garments on the user's own body     |

## Repository layout

```text
docs/01-product/       Vision, PRD, personas, requirements, roadmap
docs/02-design/        Design system, UX flows, screen specs, visual references
docs/03-architecture/  System, frontend, backend and AI architecture + ADRs
docs/04-data/          Database schema, data models, canonical taxonomy
docs/05-api/           API contract, openapi.yaml, error and auth contracts
docs/06-ai/            AI product specs, prompts, evaluation, fallbacks
docs/07-security/      Security rules, privacy, threat model, retention
docs/08-engineering/   Implementation plan, standards, testing, deployment
docs/09-decisions/     Assumptions, open questions, decisions, changelog
tasks/                 current.md, backlog.md, completed.md
```

## Start here

1. `AGENTS.md` — instructions for anyone (human or agent) writing code here
2. `docs/01-product/prd.md` — what we are building
3. `docs/08-engineering/implementation-plan.md` — the order we build it in
4. `tasks/current.md` — what is in flight right now

## Status

Phase 0 — Foundation. The specification set is complete; application code has
not been scaffolded yet. See `docs/08-engineering/implementation-plan.md`.

## Principles worth repeating

- **Existing closets are first-class.** Mira is not a product that only tracks
  clothing bought after installation.
- **A detected purchase is not an owned garment.** Ownership requires user
  confirmation unless the user explicitly enables automatic import.
- **Inventory before try-on.** Mira must not become a virtual try-on demo with a
  bad closet product attached.
- **Private by default.** Closets, body profiles and try-on images are private.
