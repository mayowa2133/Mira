# Frontend Architecture

React Native + Expo + TypeScript. iOS first.

---

## 1. Structure

```text
apps/mobile/
├── app/                      Expo Router routes
│   ├── (onboarding)/
│   ├── (tabs)/
│   │   ├── index.tsx         Home
│   │   ├── closet/
│   │   ├── mira/
│   │   ├── looks/
│   │   └── you/
│   ├── garment/[id].tsx
│   ├── look/[id].tsx
│   ├── capture/              full-screen modals
│   └── tryon/
├── features/                 feature modules (ui + hooks + api per feature)
│   ├── closet/
│   ├── capture/
│   ├── purchases/
│   ├── stylist/
│   ├── looks/
│   └── tryon/
├── lib/
│   ├── api/                  generated client from openapi.yaml
│   ├── query/                TanStack Query config, keys, invalidation
│   ├── storage/              MMKV, capture queue, drafts
│   ├── analytics/
│   └── media/                image sizing, prefetch, blurhash
└── ui/                       re-export of @mira/ui primitives
```

Feature modules own their screens, hooks and API calls. Cross-feature imports go
through `ui/` or `lib/`, never into another feature's internals.

## 2. Navigation

Expo Router, file-based, matching `docs/02-design/navigation.md` exactly. Camera
and try-on results are full-screen modals with no tab bar.

## 3. State

| Kind | Tool | Notes |
| ---- | ---- | ----- |
| Server state | TanStack Query | The default for anything the API owns |
| Capture queue | Zustand + MMKV | Survives kill; drives offline capture (REL-2) |
| Drafts | Zustand + MMKV | Unsaved garment edits, stylist prompt |
| UI state | Local component state | Sheets, chips, scroll |
| Session | Auth SDK + secure store | Tokens in the keychain, never in MMKV |

**Rule:** no global store for server data. Query keys are the cache.

### Query keys

```ts
['garments', filters, cursor]
['garment', id]
['closet', 'counts']
['search', query]
['outfits', tab]
['outfit', id]
['recommendations', requestId]
['purchase-candidates', status]
['tryon', id]
['insights']
```

Mutations invalidate the narrowest key that can be wrong. Optimistic updates for
favourite, wear, status; rollback with a visible undo on failure.

## 4. Offline

- The closet list and garment details are persisted to MMKV and served
  immediately, then revalidated (REL-1).
- Captures taken offline write the image to the file system and a job to the
  capture queue; a header indicator shows pending work (REL-2).
- Mutations that can be queued are queued; mutations that cannot (stylist,
  try-on) are disabled with an explanation, per
  `docs/02-design/states-and-errors.md`.

## 5. Images

Images are the product; they are also the performance budget.

- Request the derivative that matches the render size — never the original in a
  grid (INV-6).
- `expo-image` with blurhash/thumbhash placeholders and disk caching.
- Prefetch the next page of grid images and the hero image of the likely next
  screen.
- Signed URLs are cached with their expiry; refresh transparently before use.
- Full resolution is loaded only on detail and try-on.

## 6. Design system

`@mira/ui` owns tokens and primitives (Button, Chip, Sheet, GarmentTile, LookCard,
SectionHeader, EmptyState, Skeleton, GlassPanel). Components read tokens; **no
literal hex, spacing or duration values in feature code**. This is what keeps a
dark-mode swap a one-file change.

## 7. Camera

`expo-camera` with three configured modes — garment, tag (close focus + barcode
detection), receipt (edge detection + auto-shutter). Each mode is a thin wrapper
over one shared capture screen so the chrome stays identical.

Captures write locally first, then upload. The UI never waits on the network to
show the user their own photo.

## 8. Performance rules

- Grids use `FlashList` with a stable `estimatedItemSize`.
- Garment tiles are memoized; the favourite control does not re-render the tile.
- No inline object or lambda props in list item components.
- Heavy screens (Home, Closet) mount in under two frames of work; anything
  expensive is deferred with `InteractionManager`.
- Reanimated for all gestures and transitions; nothing animates on the JS thread.

## 9. Error handling

- An error boundary per route group, rendering the standard error state.
- Query errors map to the taxonomy in `docs/02-design/states-and-errors.md`.
- Sentry receives errors with scrubbed payloads — never image bytes, email
  content, or body data.

## 10. Testing

| Layer | Tool |
| ----- | ---- |
| Units and hooks | Jest + React Native Testing Library |
| Component contracts | RNTL, including accessibility queries |
| Visual | Screenshot tests at default and largest Dynamic Type |
| E2E | Maestro on the eight critical journeys |

Accessibility queries (`getByRole`, `getByLabelText`) are preferred over test IDs,
so tests fail when labels regress.
