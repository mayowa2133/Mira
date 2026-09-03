# Accessibility

Mira is a visual product. That makes accessibility harder and more important, not
less. The requirements below are testable; they map to `A11Y-*` in
`docs/01-product/requirements.md`.

Target: **WCAG 2.2 AA**, plus iOS platform conventions.

---

## 1. Contrast

| Pair | Ratio | Status |
| ---- | ----- | ------ |
| `text #171717` on `bg #FAF9F7` | 15.1:1 | Pass AAA |
| `text #171717` on `surface #FFFFFF` | 16.4:1 | Pass AAA |
| `textSecondary #77736F` on `bg #FAF9F7` | 4.6:1 | Pass AA (body) |
| `textTertiary #A8A29C` on `bg #FAF9F7` | 2.5:1 | **Decorative / large only** |
| `inverseText #FFFFFF` on `inverseBg #171717` | 16.4:1 | Pass AAA |
| `accent #C98F8A` on `bg` | 2.8:1 | **Never for text.** Fills and icons only |

**Rules**

- `textTertiary` is never used for information the user must read.
- `accent` is never a text colour on a light background. Accent text sits on
  `inverseBg`, or accent is used as a fill behind `text`.
- Text over photography always sits on a scrim or a glass panel, and is verified
  against the darkest and lightest images in the set.

## 2. Type scaling

- All type tokens scale with Dynamic Type.
- Layouts must remain usable at the largest accessibility size: garment tiles may
  reflow to a single column, metadata may wrap to more lines, and chips may
  wrap — nothing may truncate to unreadability or overlap.
- Never disable scaling to preserve a layout.

## 3. Touch targets

- Minimum 44×44 pt (`space.tapMin`), including the favourite heart on garment
  tiles and the ✕ on filter chips.
- Adjacent targets are at least 8 pt apart.

## 4. Screen readers

| Element | Label |
| ------- | ----- |
| Garment tile | "Zara satin midi dress, black, size small. Favourited." |
| Garment image in detail | The garment's descriptive summary, not "image" |
| Favourite control | "Favourite" / "Remove from favourites", as a toggle |
| Filter chip | "Black, applied filter. Double tap to remove." |
| Outfit card | "Look 1 of 3. Dinner downtown. Black corset top, blue wide-leg jeans, black heels, silver shoulder bag." |
| Try-on result | "Try-on of look 2 on your body reference." |
| Camera shutter | "Take photo" |
| Confidence tick | "Confirmed" — absence of a tick reads as "Needs your confirmation" |

**Rules**

- Meaningful imagery exposes a text description (A11Y-5). Decorative imagery is
  hidden from the accessibility tree.
- Grids expose row/column position.
- Live regions announce: analysis complete, generation complete, items added,
  errors.
- Sheets trap focus and are dismissible with the standard escape gesture.
- Reading order follows visual order.

## 5. Colour is never the only signal

- Colour filter swatches carry their colour **name**.
- Confidence is carried by a tick and by wording, not by colour.
- Status (laundry, archived) is carried by a label, not only by dimming.
- Selection is carried by fill **and** by an accessibility selected state.

## 6. Motion

- Respect `prefers-reduced-motion`: replace transforms and parallax with
  cross-fades, keep durations, never remove completion feedback.
- No content depends on an animation completing to become readable.
- Nothing flashes more than three times per second.

## 7. Camera and capture

- Capture screens announce guidance ("Place one item in frame") via a live region.
- Shutter is reachable and labelled; `Upload instead` is always available for
  users who cannot frame a shot.
- Barcode detection announces success audibly and haptically.

## 8. Forms and correction

- Every input has a persistent visible label (not placeholder-only).
- Errors are associated with their field and announced.
- Editing an AI-detected field is reachable by keyboard/switch control, not only
  by tapping a chip.

## 9. Haptics

Haptics reinforce, never replace, a visual or audible signal.

## 10. Testing

| Check | How |
| ----- | --- |
| Contrast | Automated token-pair test in CI |
| Labels | Snapshot of the accessibility tree per screen |
| Dynamic Type | Screenshot tests at default and largest sizes |
| VoiceOver flow | Manual pass on the eight critical journeys, per release |
| Reduced motion | Manual pass with the setting enabled |
| Colour-only meaning | Manual review at design sign-off |

An accessibility pass is part of
`docs/08-engineering/definition-of-done.md`. A screen that has not been navigated
with VoiceOver has not been finished.
