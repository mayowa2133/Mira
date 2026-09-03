# AI Fallbacks

> **An AI failure degrades a feature. It never blocks the user, and it never
> loses their work.**

---

## 1. Failure classes

| Class | Detection | Response |
| ----- | --------- | -------- |
| Provider unavailable | Connection error, 5xx | Circuit-break, use the fallback path, retry in background |
| Timeout | Exceeds `AI_REQUEST_TIMEOUT_MS` | Retry once with backoff, then fall back |
| Rate limited | 429 | Backoff per `Retry-After`, queue the work |
| Invalid output | Parse or schema failure | Retry once with a stricter instruction, then fall back |
| Taxonomy violation | Clamp step drops values | Continue with the clamped result, log |
| Low confidence | Below the display threshold | Not a failure — show as a question |
| Quality gate failure | Cutout or try-on check fails | Discard the artefact, use the fallback |

Every one of these is logged with a capability and reason code
(`ai_validation_failed`, `ai_fallback_used`).

## 2. Per-capability fallbacks

### Segmentation
```text
segmentation fails or fails the quality gate
  → the ORIGINAL photo becomes the canonical image
  → the garment is created normally
  → retry queued at low priority
```
The user still gets their garment. The closet looks slightly less clean, which is
far better than a torn cutout or a missing item.

### Garment understanding
```text
model unavailable      → garment saved with analysis_state: failed + retry affordance
invalid output (×2)    → category-only review screen
partial output         → keep what validated, prompt for the rest
brand not determinable → leave null and tappable — NEVER guess
```

### Tag reading
```text
barcode decoded, OCR failed  → match on barcode alone
OCR partial                  → prefill what was read
nothing legible              → fall back to photo capture (F-01)
```
A tag scan never dead-ends (CAP-4).

### Product matching
```text
no match  → keep SKU/barcode/URL verbatim on the garment; retry later
ambiguous → present up to 3 options as images
provider down → unmatched; the garment is unaffected
```

### Duplicate detection
```text
detector unavailable
  → fall back to exact-identifier checks only (barcode, SKU, product URL)
  → visual similarity is skipped
  → a missed duplicate surfaces later in insights
```
Mira never blocks a creation because the detector is down.

### Receipt understanding
```text
OCR fails         → receipt_unreadable + a helpful retry hint
structuring fails → show raw OCR lines for manual selection
totals mismatch   → import flagged, all lines shown, nothing pre-checked
provider down     → receipt stored, parsing retried later
```
The receipt image is stored before parsing, so nothing is lost.

### Purchase detection
```text
extraction fails on a message → skip and count it; the scan continues
provider down                 → scan paused, resumed from cursor
token expired                 → connection marked expired, one quiet prompt
```
Auto-import is **disabled** whenever confidence cannot be computed. Failing
closed here is mandatory: the alternative puts garments the user does not own into
her closet.

### Closet search
```text
interpretation unavailable → keyword + filter search
embeddings unavailable     → structured-only, ranked by recency
both unavailable           → simple text match over name, brand, colour
```
Mira never relaxes a stated filter to avoid an empty result.

### Outfit generation
```text
provider unavailable → offer saved looks and previously worn combinations
invalid garment id   → drop that look, regenerate once, then return fewer
too few valid looks  → return what is valid; never pad
no eligible garments → say exactly that ("everything's in the wash")
```

### Virtual try-on
```text
provider unavailable → "Try-on is unavailable right now" + notify when back
timeout              → retry once, then fail with a retry affordance
quality check fails  → regenerate once, then surface with a report affordance
body reference poor  → guidance BEFORE generating, not after
```

## 3. Circuit breakers

Per capability: after 5 consecutive failures within 60 seconds, open the circuit
for 30 seconds and route all calls to the fallback path immediately. Half-open
with a single probe.

This prevents a provider outage from becoming a queue of thousands of slow,
failing jobs.

## 4. Degradation is visible, not silent

The user is told when something is degraded, in one calm line:

- "Mira can't style you right now. Everything else still works."
- "We couldn't clean up that photo — we've kept your original."
- "Still looking through your older orders."

Silent degradation is worse than visible degradation, because the user cannot tell
the difference between "Mira is broken" and "Mira doesn't know my closet".

## 5. What must never happen

| Never | Because |
| ----- | ------- |
| Lose a captured photo | It is the user's work (REL-4) |
| Block garment creation on any AI step | Analysis is enrichment, not a precondition |
| Guess a brand to fill a field | She will believe it |
| Auto-import when confidence is unavailable | Puts unowned garments in the closet |
| Relax a search filter to avoid an empty result | Tells her Mira doesn't know her closet |
| Invent a garment in an outfit | Hard gate, `docs/06-ai/outfit-recommendation.md` |
| Show a raw provider error | `docs/05-api/error-contract.md` |
