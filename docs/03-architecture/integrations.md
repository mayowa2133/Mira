# Integrations

Every third-party dependency, what it is for, and what it is allowed to see.

---

## 1. Authentication — Supabase Auth (or equivalent)

Apple, Google and email sign-in. The client holds only a short-lived JWT; the
service role key is server-only (SEC-3). Tokens live in the device keychain,
never in general-purpose storage, and are never logged (SEC-2).

## 2. Object storage — S3-compatible

Three private buckets: `garments`, `body`, `tryon`. No public read, ever
(SEC-4). Access is by signed URL with a short TTL, issued only after an ownership
check. Body and try-on buckets use the shortest TTL and an extra assertion at
issue time.

## 3. AI providers

Accessed only through `@mira/ai` capability interfaces
(`docs/03-architecture/ai-architecture.md`). Credentials are server-side only
(AI-8). Provider responses are untrusted input (AI-7).

| Capability | Notes |
| ---------- | ----- |
| Vision | Garment understanding, tag reading |
| Reasoning | Outfit generation, query interpretation, receipt structuring |
| Embeddings | Visual and text vectors for search and duplicate detection |
| OCR | Tags and receipts, with a vision-model fallback |
| Segmentation | Cutouts and background removal |
| Try-on | Evaluated on garment fidelity first; see `docs/06-ai/virtual-try-on.md` |

Data sent to providers is the minimum required for the task. Provider retention
and training settings must be configured to exclude training on user content
unless policy and explicit consent allow it (privacy rule 5).

## 4. Email purchase detection

**Phase 8. Optional. Off by default.**

- Provider: Gmail first, via OAuth.
- Scope: the narrowest read scope technically possible (SEC-8). Prefer
  metadata + targeted query access over full mailbox read where the provider
  offers it.
- Tokens are encrypted at rest with `EMAIL_TOKEN_ENCRYPTION_KEY` (SEC-6) and never
  logged.
- Only messages matching retailer/order heuristics are opened.
- Raw bodies are not retained beyond extraction
  (`docs/07-security/data-retention.md`).
- Disconnection is one action and offers deletion of derived candidates.
- Content extracted from email is untrusted and may contain injection attempts.

## 5. Retailer integrations

Not required for MVP. Potential targets: Amazon, Fashion Nova, Zara, Aritzia,
H&M, Nike, SSENSE, ASOS, Shein, Shopify-based retailers.

Email receipt ingestion is the more universal initial strategy and covers
retailers with no API at all.

When a retailer integration is added it must: use official APIs or documented
affiliate feeds where they exist, respect robots and terms, be individually
disconnectable, and produce `purchase_candidates` — never garments directly.

## 6. Product matching data

Product matching may consult retailer product pages via a URL the user supplied
(`product_url`) or a resolved SKU. Rules: server-side only, rate-limited, cached,
respectful of robots directives, and treated as untrusted content. A failed match
degrades to partial prefill (CAP-4).

## 7. Weather

Used only to inform styling, only when the user authorizes location, and only at
city granularity. Denial degrades to season-based styling with a single quiet
notice. Coordinates are never stored with garment or outfit records.

## 8. Push notifications — Expo Push

Used for: analysis complete, import complete, new purchase detected, try-on ready.
Payloads contain identifiers and short titles only — never garment images, prices,
or purchase details that would appear on a lock screen without consent.

## 9. Analytics — PostHog

Event list in `docs/05-api/events.md`. Never receives image bytes, email content,
body data, or prompt text containing user content (AN-2, SEC-9).

## 10. Error reporting — Sentry

Payloads are scrubbed before send: no tokens, no image bytes, no email content, no
body data, no prompts containing user content. Breadcrumbs carry route names and
identifiers only.

## 11. Adding a new integration

1. Write an ADR in `adr/` covering purpose, data shared, retention, and removal.
2. Add it here, with its data boundary.
3. Add its secrets to `.env.example` with a server-only comment.
4. Add a disconnect/delete path if it touches user data.
5. Update `docs/07-security/threat-model.md` and
   `docs/07-security/data-retention.md`.
