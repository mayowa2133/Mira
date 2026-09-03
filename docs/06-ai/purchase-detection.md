# Purchase Detection

Finding clothing the user already bought, from their email.

**Capabilities:** `reasoning`, `ocr` (for image-based order emails)
**Consumer:** F-04, F-05
**Phase:** 8

> **The rule this whole document exists to protect:**
> A detected purchase is **not** an owned garment (OWN-1). See ADR 0003.

---

## 1. Scope and consent

- Off by default. Connected only after an explicit, plain-language explainer.
- The narrowest read scope technically available (SEC-8).
- Only messages matching retailer/order heuristics are opened.
- Raw bodies are not retained beyond extraction
  (`docs/07-security/data-retention.md`).
- Disconnection is one action and offers deletion of everything derived.

## 2. Message classification

```text
message metadata (sender, subject, date)
  → candidate? (retailer domain, order/shipping keywords)
      no → never opened
  → open → classify:
        order_confirmation | shipping_confirmation | receipt |
        return_confirmation | marketing | other
  → extract only from the first three
  → return_confirmation → downgrade matching candidates toward `returned`
```

Marketing email is the dominant volume and must be cheaply rejected on metadata
alone. Opening it costs money and privacy for nothing.

**Return confirmations are as valuable as orders**: they are the strongest
automatic signal that a purchase should not become a garment.

## 3. Output contract

```json
{
  "message_kind": "order_confirmation",
  "retailer": "Fashion Nova",
  "order_number": "FN-2839103",
  "purchase_date": "2026-07-02",
  "currency": "USD",
  "items": [
    {
      "raw_item_name": "Rosette Mini Dress - Black",
      "product_name": "Rosette Mini Dress",
      "brand": "Fashion Nova",
      "color": "black",
      "size": "S",
      "quantity": 1,
      "unit_price": 59.99,
      "sku": "FN10293",
      "product_url": "https://…",
      "image_url": "https://…",
      "is_clothing": true,
      "confidence": { "product_name": 0.93, "size": 0.88, "is_clothing": 0.97 }
    }
  ]
}
```

Every item becomes a `purchase_candidates` row with status `needs_review` — never
a garment.

## 4. Candidate lifecycle

```text
detected → processing → needs_review
                              ↓ user decision
   confirmed_owned → duplicate check → GARMENT CREATED
   returned | not_mine | removed | ignored → no garment, ever
   uncertain → stays reviewable
```

The review sheet's options map exactly:

| User says | Status |
| --------- | ------ |
| Yes — in my closet | `confirmed_owned` |
| Returned it | `returned` |
| Sold / donated | `removed` |
| Bought for someone else | `not_mine` |
| Not clothing | `ignored` |
| Not sure | `uncertain` |

## 5. Idempotency

Re-scanning must not duplicate candidates. The unique key is
`(user_id, source_type, source_id, raw_item_name)`
(`docs/04-data/database-schema.md`). A scan cursor tracks progress so scans
resume rather than restart.

## 6. Automatic import (opt-in)

Off by default. When enabled, a candidate auto-creates a garment only if **all**
hold:

1. `matched_product_confidence ≥ 0.92`,
2. an exact identifier matched (SKU, barcode or product URL),
3. no return confirmation exists for that order line,
4. duplicate detection returns nothing above 0.70,
5. `is_clothing` confidence ≥ 0.95.

Even then: the user is notified, the garment is flagged in the closet until
acknowledged, and the import is undoable for at least 30 days (OWN-3).

## 7. Prompt-injection posture

Email is the highest-risk untrusted input in Mira: anyone can send the user a
message. Therefore:

- Message content is delimited and labelled as data.
- The extraction call returns **data only**; it cannot set a status, create a
  garment, or trigger any action (R4).
- Ownership transitions are user-initiated or gated by the numeric policy in §6 —
  never by anything a message says.
- A message claiming to be from Mira, or containing instructions, is ordinary
  content and is treated identically to any other.

## 8. Failure handling

| Failure | Handling |
| ------- | -------- |
| Token expired | Connection marked `expired`; user prompted once, quietly |
| Scope insufficient | `email_scope_insufficient`; explain and offer reconnect |
| Provider rate limit | Backoff; resume from cursor |
| Message unparseable | Skipped and counted; never blocks the scan |
| Zero candidates found | Honest empty state, plus the receipt-scanning alternative |

## 9. Evaluation

Dataset: 100 purchase-email examples across retailers, plus negatives (marketing,
returns, non-fashion orders).

| Metric | Target |
| ------ | ------ |
| Order-email classification accuracy | ≥ 0.97 |
| Item extraction recall | ≥ 0.90 |
| Item extraction precision | ≥ 0.97 |
| **False purchase detection rate** (marketing treated as an order) | ≤ 0.01 |
| Return-confirmation detection | ≥ 0.95 |
| Size extraction, when present | ≥ 0.85 |
| Auto-import precision (opt-in path) | ≥ 0.99 |

Auto-import precision is the strictest number in Mira. A wrong auto-import puts a
garment the user does not own into the closet, and the stylist will recommend it.
