# Receipt Understanding

Turning a receipt — paper, screenshot or PDF — into garments.

**Capabilities:** `ocr`, `reasoning`
**Consumer:** receipt import (F-03)

---

## 1. Output contract

```json
{
  "retailer": "Zara",
  "purchase_date": "2026-08-14",
  "currency": "CAD",
  "order_number": "0047382910",
  "subtotal": 209.96,
  "total": 237.25,
  "line_items": [
    {
      "raw_name": "SATIN EFFECT MIDI DRESS",
      "product_name": "Satin Effect Midi Dress",
      "quantity": 1,
      "unit_price": 79.90,
      "size": "S",
      "color": "black",
      "sku": "2731/450",
      "is_clothing": true,
      "suggested_category": "dresses",
      "confidence": { "raw_name": 0.99, "sku": 0.91, "is_clothing": 0.97 }
    }
  ],
  "confidence": { "retailer": 0.96, "purchase_date": 0.94, "currency": 0.99 }
}
```

## 2. Rules

1. **`raw_name` is preserved verbatim.** It is the ground truth for matching and
   for the user's recognition. `product_name` is the cleaned version.
2. **Totals are checked.** If line items plus tax do not reconcile with the total,
   confidence drops and the import is flagged for review — a missed line is a
   missed garment.
3. **Non-clothing lines are classified, not dropped.** They are hidden behind
   "Show all lines" so the user can rescue a misclassification.
4. **Quantity > 1 creates that many garments**, each duplicate-checked, because
   buying two of something is normal.
5. Currency comes from the receipt, never from the device locale.
6. A receipt line never becomes a garment without the user's confirmation step.

## 3. Pipeline

```text
image / PDF
  → deskew, denoise, orientation
  → OCR (layout-preserving)
  → reasoning call: structure the text into the contract
  → validate schema
  → reconcile totals
  → classify clothing / non-clothing
  → per line: product matching, duplicate check
  → confirmation list
  → user selects → garments created
```

OCR text is **untrusted content**. A receipt can contain adversarial text; it is
delimited as data and no model output causes an action (R4).

## 4. Difficult inputs

| Input | Handling |
| ----- | -------- |
| Crumpled or curved paper | Deskew and dewarp; low confidence flags review |
| Thermal receipt, faded | Contrast normalization; often partial extraction |
| Multi-page PDF | All pages processed, line items merged |
| Screenshot of an order page | Treated as a receipt; often the *best* input |
| Handwritten | Not supported; degrade to manual entry |
| Two receipts in one photo | Ask which one, or process both |
| Foreign language | Supported for retailer, date, price, line names |

Partial extraction is a success, not a failure: three of four garments captured
still beats zero.

## 5. Retailer-specific hints

Common retailers have recognizable receipt shapes (SKU formats, size notation,
line layout). These are hints that raise confidence — never hard parsers that
break when a retailer redesigns its receipt. The general path must handle every
retailer.

## 6. Failure handling

| Failure | Handling |
| ------- | -------- |
| Unreadable | `receipt_unreadable`, with a helpful retry hint |
| No line items found | `no_items_extracted`; offer manual entry with retailer and date prefilled |
| Totals don't reconcile | Import flagged, all lines shown, none pre-checked |
| A line is ambiguous | Included, unchecked, with a suggested category |
| Provider unavailable | Receipt is stored; parsing is retried later |

The receipt image is stored first, so a parsing failure never loses it.

## 7. Evaluation

Dataset: 50 receipts (paper, thermal, screenshot, PDF; multiple retailers and
currencies).

| Metric | Target |
| ------ | ------ |
| Retailer accuracy | ≥ 0.95 |
| Date accuracy | ≥ 0.95 |
| Line-item recall (clothing lines found) | ≥ 0.93 |
| Line-item precision | ≥ 0.97 |
| Price accuracy | ≥ 0.98 |
| Size extraction, when printed | ≥ 0.85 |
| Clothing/non-clothing classification | ≥ 0.95 |
| Totals reconciliation rate | ≥ 0.90 |

Line-item **recall** matters most here: a missed line is a garment the user then
has to add by hand, which is exactly the work Mira exists to remove.
