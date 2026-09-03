# Navigation

## Primary tabs

```text
Home      Closet      MIRA      Looks      You
```

| Tab | Purpose |
| --- | ------- |
| **Home** | Personalized fashion dashboard — today's look, ask Mira, rediscovery |
| **Closet** | Everything she owns |
| **Mira** | The AI stylist |
| **Looks** | Saved, worn, Mira-generated and self-made outfits |
| **You** | Profile, style preferences, body profile, connected accounts, settings |

The **Mira** tab may carry a slightly distinctive icon or subtle animation, but it
must still feel native. It is not a floating action button and not a chat icon.

**Adding garments does not consume a tab.** `+ Add` is a persistent action in the
Home and Closet headers and opens the Add sheet from anywhere in those stacks.

## Stacks

```text
Home
├── Look detail
│   ├── Swap item (sheet)
│   └── Try-on → Try-on result
├── Garment detail
└── Wardrobe insights

Closet
├── Search
├── Filters (full-height sheet)
├── Garment detail
│   ├── Edit garment
│   ├── Style it → Outfit results
│   └── Try it on → Try-on result
└── Add sheet
    ├── Scan an item → AI item review
    ├── Scan a tag → AI item review
    ├── Scan a receipt → Receipt items → AI item review (per item)
    ├── Find purchases → Email connect → Purchase review
    ├── Choose photo → AI item review
    ├── Product link → AI item review
    └── Add manually → Garment form

Mira
└── Outfit results (swipeable looks)
    ├── Swap item (sheet)
    ├── Look detail
    └── Try-on → Try-on result

Looks
├── Look detail
└── Try-on result

You
├── Style preferences
├── Body profile
│   └── Body capture
├── Connected accounts
├── Privacy & data
└── Settings
```

## Rules

1. **Depth is capped at three** from any tab root before a modal is used instead.
2. **Camera and try-on results are full-screen modals** — no tab bar, no nav bar.
3. **Sheets are for choices**; pushes are for content.
4. **Back always returns to the originating context.** Try-on entered from a look
   returns to that look, not to Looks.
5. **Deep links** resolve into the correct stack:
   `mira://garment/:id` · `mira://look/:id` · `mira://tryon/:id` ·
   `mira://purchases` (candidate review) · `mira://add`.
6. **Notification taps** land on the reviewable surface, never on a raw list.
   A new-purchase notification opens that candidate's review card.
7. **Onboarding is a separate root stack** and is exited, not popped.

## Tab bar behaviour

- Tapping the active tab scrolls its root to top; tapping again resets filters.
- The tab bar hides on full-screen imagery (try-on result, outfit results,
  camera).
- Badge counts are used only for pending purchase candidates, and only when the
  user has connected email.
