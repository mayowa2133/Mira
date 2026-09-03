# Mira Agent Instructions

## Product

Mira is an AI-powered personal wardrobe.

Mira exists to:

1. Know everything the user currently owns.
2. Make importing an existing wardrobe dramatically easier.
3. Keep the wardrobe automatically updated when possible.
4. Understand individual garments.
5. Make the closet naturally searchable.
6. Generate outfits exclusively or primarily from owned clothing.
7. Help users rediscover underused garments.
8. Eventually visualize exact garments on the user's body.

## Product North Star

Getting an item into Mira should require as little work as technically possible.

Never solve an engineering problem by shifting unnecessary data entry onto the user.

## Before Implementation

Read the relevant canonical specifications.

At minimum inspect:

- docs/01-product/prd.md
- docs/02-design/ux-flows.md
- docs/02-design/screen-specs.md
- docs/02-design/design-system.md
- docs/03-architecture/technical-spec.md
- docs/03-architecture/ai-architecture.md
- docs/04-data/database-schema.md
- docs/04-data/taxonomy.md
- docs/05-api/api-contract.md
- docs/07-security/security-rules.md
- docs/08-engineering/testing-strategy.md

## Rules

- Never invent product behaviour when a specification exists.
- Never silently alter canonical data contracts.
- Never bypass authorization.
- Never expose secrets client-side.
- Never treat AI-generated metadata as guaranteed truth.
- Preserve AI confidence information.
- Validate AI responses.
- Never assume purchase = ownership.
- Never create duplicate garments without duplicate detection.
- Never make private body/try-on images publicly accessible.
- Do not introduce unnecessary dependencies.
- Do not change architecture without documenting the decision.
- Every meaningful feature requires appropriate tests.
- AI behaviour requires evaluation as well as traditional tests.
- Update specifications when product behaviour changes.

## Development Workflow

Before coding:

1. Understand the requirement.
2. Read relevant specifications.
3. Inspect existing implementation.
4. Identify affected systems.
5. Create implementation plan.
6. Implement the smallest correct solution.
7. Test.
8. Run relevant AI evaluations.
9. Verify UX visually.
10. Update documentation.

## Visual Implementation Rule

Before implementing or significantly redesigning a Mira screen:

1. Read `docs/02-design/design-system.md`.
2. Read `docs/02-design/visual-references.md`.
3. Identify the specific visual reference assigned to the screen.
4. Inspect the relevant Mira wireframe.
5. Implement Mira's interpretation of the interaction pattern.
6. Do not directly clone another application's branding or exact layout.
7. Clothing imagery should generally have greater visual weight than metadata.
8. Prefer fashion-commerce interaction conventions over enterprise inventory
   conventions.
9. AI functionality should feel integrated into the fashion experience rather
   than presented as a generic chatbot.
10. Verify the final screen visually in the iOS Simulator before considering
    the implementation complete.

## Canonical Decision Hierarchy

When instructions conflict:

```text
AGENTS.md
    ↓
Product Vision / PRD
    ↓
Feature Specifications
    ↓
UX Specifications
    ↓
Architecture
    ↓
Database / API Contracts
    ↓
Documented Decisions
    ↓
Implementation Plan
    ↓
Individual Task
```

Individual coding prompts do not silently override Mira's product definition.
