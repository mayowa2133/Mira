# Analytics Events

Emitted to PostHog. **No image bytes, no image URLs, no email content, no body
data, no prompt text containing user content** (AN-2, SEC-9).

Naming: `snake_case`, `object_verb_past_tense`. Properties are low-cardinality
dimensions and numbers.

---

## Global properties

Attached to every event: `user_id` (opaque), `session_id`, `platform`,
`app_version`, `mira_env`, `closet_size_bucket`
(`0` · `1-19` · `20-99` · `100-299` · `300+`).

`closet_size_bucket` is bucketed rather than exact, because closet size is
identifying at the tail.

---

## Onboarding

| Event | Properties |
| ----- | ---------- |
| `onboarding_started` | — |
| `onboarding_import_method_chosen` | `method` (email · receipt · photo · tag · skip) |
| `onboarding_completed` | `items_added`, `duration_seconds`, `methods_used[]` |
| `onboarding_skipped` | `at_step` |

`items_added` at completion is the **closet activation** metric.

## Garment capture

| Event | Properties |
| ----- | ---------- |
| `garment_add_started` | `method` (camera · library · tag · barcode · receipt · email · url · manual) |
| `garment_added` | `method`, `category`, `had_ai_prefill`, `fields_corrected_count`, `actions_taken` |
| `garment_analysis_started` | `method` |
| `garment_analysis_completed` | `duration_ms`, `category_confidence_band`, `brand_matched` |
| `garment_analysis_failed` | `reason_code`, `stage` (upload · segmentation · classification · matching) |
| `garment_corrected` | `field`, `was_confidence_band` |
| `garment_add_abandoned` | `at_step` |

`actions_taken` counts taps from entry to save — the **import efficiency** metric.

## Tag and receipt

| Event | Properties |
| ----- | ---------- |
| `tag_scan_started` | — |
| `tag_scan_succeeded` | `identification` (full · partial · none), `used_barcode` |
| `tag_scan_failed` | `reason_code` |
| `receipt_import_started` | `input` (camera · library · pdf) |
| `receipt_import_completed` | `lines_extracted`, `clothing_lines`, `items_added`, `duration_ms` |
| `receipt_import_failed` | `reason_code` |

## Email and purchases

| Event | Properties |
| ----- | ---------- |
| `email_connect_started` | `provider` |
| `email_connected` | `provider` |
| `email_connect_declined` | `at_step` |
| `email_disconnected` | `deleted_candidates` |
| `purchase_scan_completed` | `candidates_found`, `retailer_count`, `duration_ms` |
| `purchase_candidate_detected` | `retailer`, `match_confidence_band` |
| `purchase_candidate_reviewed` | `decision` (owned · returned · sold · not_mine · unsure · removed) |
| `purchase_candidate_confirmed` | `retailer`, `match_confidence_band` |
| `purchase_auto_imported` | `retailer`, `confidence_band` |
| `purchase_auto_import_undone` | `hours_since_import` |

`retailer` is low-cardinality by design; unrecognized retailers report `other`.

## Duplicates

| Event | Properties |
| ----- | ---------- |
| `duplicate_detected` | `signals[]`, `score_band`, `ingestion_method` |
| `duplicate_resolved` | `resolution` (same_item · owns_two · different), `score_band` |

`duplicate_resolved` is the precision/recall signal for
`docs/06-ai/duplicate-detection.md`.

## Closet, search and filters

| Event | Properties |
| ----- | ---------- |
| `closet_viewed` | `category` |
| `closet_search` | `query_length`, `is_natural_language`, `result_count`, `duration_ms` |
| `closet_search_interacted` | `position`, `result_count` |
| `closet_search_interpretation_corrected` | `chip_removed` |
| `closet_filter_used` | `filters[]`, `result_count` |
| `garment_detail_viewed` | `category`, `entry_point` |

`closet_search_interacted` / `closet_search` is the **search success** metric.

## Outfits and stylist

| Event | Properties |
| ----- | ---------- |
| `outfit_created` | `slot_count`, `origin` (user) |
| `ai_outfit_requested` | `has_prompt`, `vibe[]`, `priority`, `anchor_used` |
| `ai_outfit_returned` | `look_count`, `duration_ms`, `missing_slot_count` |
| `ai_outfit_failed` | `reason_code` |
| `ai_outfit_saved` | `look_index` |
| `ai_outfit_regenerated` | `look_index` |
| `outfit_item_swapped` | `slot`, `from_recommended` |
| `outfit_worn` | `origin`, `slot_count` |

Saved-or-worn-or-tried-on ÷ `ai_outfit_requested` is the **stylist usefulness**
metric.

## Try-on

| Event | Properties |
| ----- | ---------- |
| `body_profile_started` | — |
| `body_profile_completed` | `image_count`, `provided_height` |
| `body_profile_abandoned` | `at_step` |
| `try_on_started` | `from_cache`, `garment_count` |
| `try_on_completed` | `duration_ms`, `from_cache` |
| `try_on_failed` | `reason_code` |
| `try_on_saved` | — |
| `try_on_rated` | `rating` |
| `try_on_compared` | `look_count` |
| `try_on_deleted` | — |

## Wardrobe intelligence

| Event | Properties |
| ----- | ---------- |
| `insight_viewed` | `kind` |
| `insight_garment_tapped` | `kind` |
| `garment_marked_worn` | `entry_point` |
| `garment_favorited` | `favorited` |
| `garment_status_changed` | `from`, `to` |

## AI operations (server-side)

| Event | Properties |
| ----- | ---------- |
| `ai_call_completed` | `capability`, `provider`, `model`, `duration_ms`, `cost_usd`, `tokens` |
| `ai_validation_failed` | `capability`, `reason` (parse · schema · taxonomy), `retried` |
| `ai_fallback_used` | `capability`, `fallback` |
| `ai_taxonomy_clamped` | `capability`, `field` |

`ai_validation_failed` and `ai_taxonomy_clamped` are quality alarms: a rise means
a prompt or model regression.

---

## Rules

1. Never send image bytes, image URLs, storage keys, or blurhashes.
2. Never send email addresses, subjects, or message bodies.
3. Never send body measurements, body images, or try-on images.
4. Never send raw prompt text — send `query_length` and `has_prompt`, not the
   query.
5. Never send exact prices at the event level; use bands where price matters.
6. Brand and retailer are allowed as low-cardinality dimensions, capped to a
   known list plus `other`.
7. Every event added here needs a line in this file in the same change (AN-1).
