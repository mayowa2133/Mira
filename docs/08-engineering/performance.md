# Performance

Mira is an image-heavy app used one-handed, often on a phone with a full camera
roll and a mediocre connection. Performance is a design constraint, not a
follow-up task.

Targets are `PERF-*` in `docs/01-product/requirements.md` §8.

---

## Budgets

| Surface | Target |
| ------- | ------ |
| Closet grid, warm cache, first paint | < 400 ms |
| Closet grid scroll | 60 fps on iPhone 12+ |
| Capture → visible as "analyzing" | < 1 s |
| Garment analysis end to end | p50 < 6 s, p95 < 15 s |
| Closet search | p95 < 800 ms |
| Outfit generation | p50 < 5 s, p95 < 12 s |
| Try-on generation | p95 < 40 s, with progressive UI |
| App cold start to interactive Home | < 2 s |

---

## Images — the dominant cost

1. **Serve the right variant.** Grids use `thumb` (400 px); detail uses `medium`
   (1080 px). Never the original in a list (INV-6).
2. **Placeholders, not spinners.** Blurhash renders instantly; the image fades in.
3. **Prefetch** the next page of grid images and the hero of the likely next
   screen.
4. **Disk cache** the bytes; cache URLs only until `urlExpiresAt`.
5. **Downscale before upload** (2048 px longest edge) — smaller uploads, faster
   analysis, less storage.

## Lists

- `FlashList` with a stable `estimatedItemSize`.
- Memoized rows; the favourite toggle does not re-render the tile.
- No inline objects or lambdas in row props.
- Cursor pagination; page size 40.

## Perceived performance

The user's sense of speed is mostly about **when they see their own content**:

- The captured photo appears instantly from the local file, before any upload.
- The garment tile appears in the closet in an "analyzing" state immediately.
- Favourite, wear and status changes are optimistic.
- Generation shows real progress (pieces assembling), not an indeterminate
  spinner.

Asynchronous analysis is a performance decision as much as an architectural one.

## Backend

- Every `garments` filter path is indexed
  (`docs/04-data/database-schema.md`).
- `worn_count` and `last_worn_at` are denormalized to keep list queries single-pass.
- Cursor pagination everywhere; no `OFFSET` on large tables.
- Structured search skips the interpretation model call entirely for simple
  queries.
- HNSW indexes for vector search.
- Cache: closet counts, product matches, embeddings by image hash, try-on by
  fingerprint.

## AI latency

| Lever | Effect |
| ----- | ------ |
| Right-sized model per capability | Largest |
| Cap the candidate set (~60 garments) for the stylist | Large |
| Skip interpretation for simple queries | Large on the common path |
| Batch embeddings | Throughput |
| Cache aggressively | Removes the call entirely |

## Cold start

- Defer non-critical work behind `InteractionManager`.
- Home renders from cache first, revalidates second.
- No blocking network call before first paint.

## Regression protection

- Screenshot and render-count tests on Closet and Home.
- API p95 by route on the system dashboard, alerting above budget.
- A pull request touching a list or an image path states its performance impact.

## Anti-patterns

- Loading original images into a grid.
- Blocking the UI on analysis.
- Fetching the whole closet to compute a count.
- Re-running embeddings on every save when nothing relevant changed.
- A spinner where a skeleton belongs.
