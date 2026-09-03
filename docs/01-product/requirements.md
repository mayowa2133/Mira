# Requirements

Numbered, testable requirements. `MUST` / `SHOULD` / `MAY` follow RFC 2119 sense.
Referenced by tests and by `docs/08-engineering/definition-of-done.md`.

---

## 1. Capture

| ID | Requirement |
| -- | ----------- |
| CAP-1 | The system MUST support garment creation from: camera photo, photo library, tag scan, barcode, receipt, email purchase, product URL, and manual entry. |
| CAP-2 | Creating a garment from a photo MUST NOT require the user to type any field. |
| CAP-3 | Every garment MUST record its `source_type` and `source_reference`, and this provenance MUST NOT be discarded or overwritten by later edits. |
| CAP-4 | A failed automatic identification MUST degrade to partial prefill or manual entry, never to a dead end. |
| CAP-5 | Duplicate detection MUST run before every garment creation, from every ingestion path. |
| CAP-6 | The user MUST be able to record legitimate ownership of two identical garments. |
| CAP-7 | Image upload MUST survive app backgrounding and MUST retry on transient network failure. |
| CAP-8 | Analysis MUST be asynchronous; the user MUST NOT be blocked on a modal spinner while a model runs. |

## 2. Purchases and ownership

| ID | Requirement |
| -- | ----------- |
| OWN-1 | A detected purchase MUST NOT create a garment without explicit user confirmation, unless the user has enabled automatic high-confidence import. |
| OWN-2 | Purchase candidates MUST be stored separately from garments. |
| OWN-3 | Every automatic import MUST be undoable for at least 30 days. |
| OWN-4 | Candidate states MUST be limited to the canonical set in `docs/04-data/taxonomy.md`. |
| OWN-5 | Disconnecting an email connection MUST be available in one action and MUST offer deletion of derived candidates. |

## 3. Understanding and AI output

| ID | Requirement |
| -- | ----------- |
| AI-1 | Every machine-generated garment field MUST carry a confidence value in `[0,1]`. |
| AI-2 | AI output MUST be schema-validated before persistence; invalid output MUST be rejected, not coerced silently. |
| AI-3 | AI-proposed categories, subcategories, colours, occasions and seasons MUST be constrained to the canonical taxonomy. |
| AI-4 | Fields below the display confidence threshold MUST be presented as a question, not as a stated fact. |
| AI-5 | Every AI-generated field MUST be user-editable. |
| AI-6 | A generated outfit MUST reference only garment IDs that exist in the requesting user's closet. |
| AI-7 | AI provider responses MUST be treated as untrusted input, including for prompt-injection content inside images, receipts and emails. |
| AI-8 | AI provider credentials MUST NOT be present in any client bundle. |

## 4. Inventory and search

| ID | Requirement |
| -- | ----------- |
| INV-1 | Categories and subcategories MUST come from the canonical taxonomy; application code MUST NOT introduce new values. |
| INV-2 | Only garments with an outfit-eligible status MUST participate in generated outfits. |
| INV-3 | Filters MUST be combinable with AND semantics and MUST be visible while browsing results. |
| INV-4 | Search MUST support both structured filter queries and natural language. |
| INV-5 | Closet listing MUST paginate and MUST remain responsive at 1,000 garments. |
| INV-6 | Garment list images MUST be served at a size appropriate to the grid, not full resolution. |

## 5. Styling

| ID | Requirement |
| -- | ----------- |
| STY-1 | A stylist request MUST return complete outfits, not garment lists. |
| STY-2 | The user MUST be able to swap a single slot without regenerating the other slots. |
| STY-3 | The stylist MUST respect explicit user constraints in the prompt (e.g. "around these jeans"). |
| STY-4 | If the closet cannot support a request, Mira MUST say so plainly rather than inventing garments. |

## 6. Try-on

| ID | Requirement |
| -- | ----------- |
| TRY-1 | Try-on MUST reproduce the actual selected garments; producing a merely similar outfit is a failure. |
| TRY-2 | Try-on MUST NOT be presented as a guarantee of physical fit. |
| TRY-3 | Body images and generations MUST be private by default and MUST be deletable by the user. |
| TRY-4 | Try-on results MUST be accessible only to their owner, via authenticated, expiring URLs. |

## 7. Privacy and security

| ID | Requirement |
| -- | ----------- |
| SEC-1 | Passwords MUST NOT be stored in plaintext. |
| SEC-2 | Authentication tokens and OAuth tokens MUST NOT be logged. |
| SEC-3 | Backend secrets MUST NOT be exposed to mobile clients. |
| SEC-4 | All private images MUST require authenticated access; public buckets MUST NOT be used for user content. |
| SEC-5 | A user MUST only be able to access their own closet, body profile and try-ons. |
| SEC-6 | OAuth credentials MUST be encrypted at rest. |
| SEC-7 | Deletion requests MUST remove the applicable private data across primary storage, caches and derived artefacts. |
| SEC-8 | Email ingestion MUST use the minimum permissions technically possible. |
| SEC-9 | Analytics MUST NOT receive image contents, email contents, or body data. |

## 8. Performance

| ID | Requirement | Target |
| -- | ----------- | ------ |
| PERF-1 | Closet grid first contentful paint on a warm cache | < 400 ms |
| PERF-2 | Closet grid scroll | 60 fps on iPhone 12 and newer |
| PERF-3 | Garment photo capture → visible in closet as "analyzing" | < 1 s |
| PERF-4 | Garment analysis end-to-end (p50 / p95) | < 6 s / < 15 s |
| PERF-5 | Closet search response (p95) | < 800 ms |
| PERF-6 | Outfit generation (p50 / p95) | < 5 s / < 12 s |
| PERF-7 | Try-on generation (p95) | < 40 s, with progressive UI |

## 9. Reliability and offline

| ID | Requirement |
| -- | ----------- |
| REL-1 | The closet MUST be browsable from cache without a network connection. |
| REL-2 | Captures taken offline MUST be queued and uploaded when connectivity returns. |
| REL-3 | A failed background job MUST surface as a retryable state in the UI, not silent loss. |
| REL-4 | No ingestion path MUST be able to create a partially-saved garment with no images and no attributes. |

## 10. Accessibility

| ID | Requirement |
| -- | ----------- |
| A11Y-1 | All interactive elements MUST have accessible labels. |
| A11Y-2 | Text MUST meet WCAG AA contrast against its background. |
| A11Y-3 | Layouts MUST remain usable at the largest Dynamic Type setting. |
| A11Y-4 | Colour MUST NOT be the only carrier of meaning (e.g. colour filters carry names too). |
| A11Y-5 | Meaningful garment imagery MUST expose a text description to screen readers. |

## 11. Analytics

| ID | Requirement |
| -- | ----------- |
| AN-1 | The events in `docs/05-api/events.md` MUST be emitted where specified. |
| AN-2 | Analytics payloads MUST NOT contain image bytes, email bodies, or body measurements. |
