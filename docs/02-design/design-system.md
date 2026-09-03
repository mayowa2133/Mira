# Mira Design System

Mira should feel **soft, expensive and modern** — not aggressively pink, not
stereotypically feminine, and never like inventory software.

> The interface gets out of the way so the clothing dominates.
> **The clothes supply the colour. The UI supplies the calm.**

The design formula:

```text
40%  Fashion Nova      large garments, models, visual product grids
25%  Aritzia / SSENSE  premium typography, whitespace, minimal chrome
20%  Pinterest / LTK    outfit inspiration, discovery, saved looks
15%  Apple              animation, sheets, haptics, camera, polish
```

---

## 1. Brand

### Wordmark

```text
MIRA
```

Black, slightly letter-spaced. Occasionally paired with the line:

> **MIRA** — *Your closet. Your stylist. Your mirror.*

**Never:** a gradient AI logo, robot imagery, sparkles as decoration, or the word
"AI" in the wordmark. Users should think *fashion brand*, not *AI utility*.

### Voice

Warm, brief, second person, lowercase-friendly. "You haven't worn this in
8 months." Never "Utilization rate: 37.4%". See
`docs/01-product/terminology.md` for banned words.

---

## 2. Colour

### Core tokens

| Token | Value | Use |
| ----- | ----- | --- |
| `color.bg` | `#FAF9F7` | Warm ivory. App background. |
| `color.surface` | `#FFFFFF` | Cards, sheets, garment tiles. |
| `color.surfaceSunken` | `#F5F3F0` | Image placeholders, skeletons, wells. |
| `color.text` | `#171717` | Near-black. Primary text. |
| `color.textSecondary` | `#76726E` | Warm grey. Secondary text, metadata. |
| `color.textTertiary` | `#A8A29C` | Hints, disabled, timestamps. |
| `color.accent` | `#C98F8A` | Dusty rose. Mira's accent — used sparingly. |
| `color.accentSoft` | `#F3E7E4` | Pale blush. Selected chips, soft backgrounds. |
| `color.accentPressed` | `#B87C77` | Accent pressed state. |
| `color.success` | `#7D8F7B` | Muted sage. Confirmations. |
| `color.successSoft` | `#EAEFE8` | Success backgrounds. |
| `color.warning` | `#C7994F` | Muted amber. Needs-review states. |
| `color.warningSoft` | `#F7EFE0` | Warning backgrounds. |
| `color.danger` | `#B4544B` | Muted brick. Destructive actions only. |
| `color.dangerSoft` | `#F6E7E5` | Danger backgrounds. |
| `color.divider` | `#EDEAE6` | Very light warm grey. Hairlines. |
| `color.border` | `#DEDAD5` | Input and secondary-button borders. |
| `color.overlay` | `rgba(23,23,23,0.45)` | Sheet scrim. |
| `color.glass` | `rgba(255,255,255,0.72)` | Floating panels over imagery (blurred). |
| `color.inverseBg` | `#171717` | Primary button, full-bleed image screens. |
| `color.inverseText` | `#FFFFFF` | Text on inverse. |

### Rules

1. **Accent is punctuation, not paint.** Dusty rose appears on selection,
   favourites and the Mira tab — not on every button.
2. **Primary button is near-black with white text.** Not rose.
3. The app must never look "covered in pink."
4. Colour filter swatches use true garment colours from the taxonomy palette, not
   brand colours.
5. Every colour that carries meaning also carries text or an icon (A11Y-4).

### Dark mode

V1 ships light only. The token set is authored so dark mode is a token swap:
`bg #141312`, `surface #1E1C1A`, `text #F5F3F0`, `textSecondary #A29D97`,
`divider #2B2825`, accent unchanged. Do not hard-code hex values in components —
always read tokens, so this remains a one-file change.

---

## 3. Typography

UI type is the system sans (SF Pro on iOS, Inter as the cross-platform fallback).
Editorial headings may use a slightly more fashion-forward face; if unavailable,
system sans at heavier tracking is an acceptable substitute.

| Token | Size / Line | Weight | Tracking | Use |
| ----- | ----------- | ------ | -------- | --- |
| `type.display` | 34 / 40 | 600 | -0.4 | "Good evening, Maya" |
| `type.title1` | 28 / 34 | 600 | -0.3 | Screen titles — "Closet" |
| `type.title2` | 22 / 28 | 600 | -0.2 | Section headers |
| `type.title3` | 18 / 24 | 600 | -0.1 | Card titles, garment names |
| `type.body` | 16 / 22 | 400 | 0 | Body copy |
| `type.bodyStrong` | 16 / 22 | 600 | 0 | Emphasis, buttons |
| `type.subhead` | 14 / 20 | 400 | 0 | Grid metadata |
| `type.caption` | 13 / 18 | 400 | 0 | Secondary metadata |
| `type.micro` | 11 / 14 | 600 | 0.6 | Overlines, uppercase labels |
| `type.wordmark` | 20 / 24 | 600 | 3.0 | MIRA |
| `type.brand` | 13 / 18 | 600 | 0.8 | Brand name above garment name (uppercase) |

**Rules**

- At most two type sizes on a garment card.
- Brand name above product name, uppercase, `type.brand`, `textSecondary`.
- Never centre-align body copy.
- All sizes scale with Dynamic Type (A11Y-3).

---

## 4. Spacing and layout

4pt base scale: `2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72`.

| Token | Value |
| ----- | ----- |
| `space.screenX` | 20 — horizontal screen padding |
| `space.gridGap` | 12 — gap between garment tiles |
| `space.sectionY` | 32 — vertical gap between home sections |
| `space.cardPad` | 16 |
| `space.tapMin` | 44 — minimum touch target |

**Grid:** the closet is **two columns**, never three. Image size beats density.
Tiles are square to slightly portrait (1:1 to 4:5).

---

## 5. Radii, elevation, borders

| Token | Value | Use |
| ----- | ----- | --- |
| `radius.sm` | 10 | Chips, small controls |
| `radius.md` | 16 | Garment tiles, inputs, buttons |
| `radius.lg` | 20 | Cards, hero images |
| `radius.xl` | 22 | Sheets, floating glass panels |
| `radius.full` | 999 | Avatars, shutter, pills |

Shadows are **extremely subtle** — they exist to lift a surface off ivory, never
to decorate.

| Token | Value |
| ----- | ----- |
| `shadow.card` | `0 1px 2px rgba(23,23,23,0.04)` |
| `shadow.raised` | `0 4px 16px rgba(23,23,23,0.06)` |
| `shadow.float` | `0 8px 32px rgba(23,23,23,0.10)` |

Borders are 1px hairlines in `color.divider`. Prefer a hairline or a background
shift over a shadow.

---

## 6. Components

### Button

| Variant | Appearance |
| ------- | ---------- |
| Primary | `inverseBg` fill, `inverseText`, `radius.md`, height 52, full width by default |
| Secondary | `surface` fill, 1px `border`, `text` label, height 52 |
| Tertiary | Text only, `text`, no fill |
| Destructive | Text `danger`; confirmation required |
| Icon | 44×44 tap area, thin line icon, no fill |

Pressed state: 0.96 scale + 8% opacity drop. Never a colour flash.

### Chip

Height 36, `radius.full`, `space` 12 horizontal padding.
- **Unselected:** `surface` fill, 1px `border`, `textSecondary`.
- **Selected:** `accentSoft` fill, no border, `text`.
- **Dismissible (applied filter):** selected style plus a trailing ✕.

### Garment tile

```text
┌──────────────────┐
│                  │   image: 1:1 → 4:5, radius.md,
│   GARMENT IMAGE  │   surfaceSunken placeholder,
│                  │   favourite heart bottom-right over image
└──────────────────┘
ARITZIA                 type.brand, textSecondary, uppercase
Contour Bodysuit        type.subhead, text, 1 line, truncate
Black · S          ♡    type.caption, textSecondary
```

Maximum three text lines. Purchase date, SKU, wear count and source belong on the
detail screen, never on the tile.

### Sheet

Bottom sheet, `radius.xl` top corners, `surface`, drag handle, `overlay` scrim.
Filters use a full-height sheet with a sticky footer CTA showing the live count.

### Floating glass panel

Used over full-bleed imagery (try-on result, look detail). `color.glass` with a
backdrop blur, `radius.xl`, `shadow.float`. Content must remain legible over both
light and dark photography — apply a subtle gradient scrim beneath.

### Input

Height 52, `surface`, 1px `border`, `radius.md`, 16px padding. Search inputs are
`radius.full` with a leading thin search icon.

### Icons

Thin line icons, 1.5px stroke, 24×24 default. No filled icons except the
favourite heart in its active state and the active tab indicator.

---

## 7. Motion

| Token | Duration | Curve |
| ----- | -------- | ----- |
| `motion.fast` | 150 ms | ease-out |
| `motion.base` | 240 ms | ease-out |
| `motion.sheet` | 320 ms | spring(0.9, 0.8) |
| `motion.hero` | 420 ms | spring — shared element into garment detail |

**Signature microinteractions**

- **Adding an item** — light haptic; the garment card drops smoothly into the
  closet grid.
- **Favourite** — heart fills with a soft scale bounce; light haptic.
- **Swiping looks** — slight card scaling on the neighbouring cards.
- **Mira generating** — *not* a generic spinner. The outfit pieces appear one by
  one and assemble:
  ```text
  Top ✓
  Bottom ✓
  Shoes ✓
  Bag ✓
  ```
- **Try-on reveal** — soft shimmer wipe over the generated image.

Respect `prefers-reduced-motion`: replace transforms with cross-fades, keep
durations, never remove the completion feedback.

---

## 8. Imagery

- Garment images are **cutouts on a neutral ground** wherever segmentation
  succeeds; original photography is kept and remains viewable.
- Aspect: garment tiles 1:1–4:5; look cards 3:4; try-on results full-bleed.
- Placeholders are `surfaceSunken` with a very subtle shimmer — never a spinner
  over an empty box.
- Progressive load: blurhash/thumbhash → grid-sized image → full resolution only
  on detail.

---

## 9. Anti-patterns

Do **not**:

- put counts and percentages at the top of Home
- show three or more columns of garments
- use sparkle icons or "AI" badges to mark AI features
- render a chat transcript in the Mira tab
- surface SKU, source type or confidence numbers in the closet grid
- use pure `#FFFFFF` as the app background (it is ivory `#FAF9F7`)
- use pure `#000000` for text (it is `#171717`)
- add a fifth accent colour because a state needed distinguishing

---

## 10. Implementation notes

- Tokens live in one module and are the only source of colour, type, spacing,
  radius and motion values. No literal hex in components.
- Token names in code match this document exactly.
- Any new token requires a line in this file in the same change.
