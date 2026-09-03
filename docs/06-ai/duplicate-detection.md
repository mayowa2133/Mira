# Duplicate Detection

Runs before **every** garment creation, from **every** ingestion path (CAP-5).

---

## 1. The two failure modes

| Failure | Cost |
| ------- | ---- |
| **Missed duplicate** | The closet fills with the same dress three times; the stylist recommends a garment she doesn't have three of; trust erodes slowly |
| **False duplicate** | The user is interrupted with a wrong question and may merge two genuinely different garments |

Both are bad. Mira tunes for **high recall with an interruption budget**: surface
the question when a real signal exists, never on visual similarity alone.

And critically: **Mira must support legitimate duplicate ownership.** Owning two
identical black bodysuits is normal.

## 2. Signals

| Signal | Weight | Notes |
| ------ | ------ | ----- |
| Same barcode | Decisive | Same product, certainly |
| Same SKU + retailer | Decisive | Same product |
| Same product URL (normalized) | Decisive | Same product |
| Same order + same line | Decisive | Re-import of the same purchase |
| Perceptual image hash near-match | Strong | Often literally the same photo |
| Visual embedding similarity | Moderate | Never sufficient alone |
| Same brand + same normalized name | Strong | "Contour Bodysuit" vs "Contour Crew Bodysuit" |
| Same category + colour + size + brand | Moderate | |
| Purchase dates within 3 days | Weak | Supporting signal only |

Score is a weighted combination, but any **decisive** signal short-circuits to a
high score.

## 3. Thresholds

| Score | Behaviour |
| ----- | --------- |
| ≥ 0.90 | Show the duplicate sheet before saving |
| 0.70–0.899 | Show the duplicate sheet, worded more softly |
| 0.50–0.699 | Save silently; surface later in "You might already own this" insights |
| < 0.50 | Save silently |

Below 0.70 Mira does not interrupt the user mid-capture. It raises it later, in a
context where browsing is the point.

## 4. The resolution sheet

```text
This may already be in your closet.

Existing: Aritzia Contour Bodysuit — Black
New:      Aritzia Contour Crew Bodysuit — Black

[It's the same item]   [I own two]   [They're different]
```

Both garments are shown as images, because that is how the user will actually
decide. The signals that fired are summarized in one line
("Same brand and a very similar name").

| Choice | Effect |
| ------ | ------ |
| **It's the same item** | Merge: keep the existing garment; attach new images, newly learned attributes and the purchase record. Nothing is lost |
| **I own two** | Create a second garment; write a `garment_duplicates` row with `relation: owns_two` |
| **They're different** | Create separately; write `relation: different` — a **negative pair** for evaluation |

Negative pairs are as valuable as positive ones; they are the only way to measure
precision honestly.

## 5. Merge semantics

Merging never destroys information:

- Images from both are attached to the surviving garment.
- Attributes: the higher-precedence source wins per field
  (see `garment-understanding.md` §3), and the losing value is retained in
  `garment_attributes` as superseded.
- Purchase records from both are kept — she may genuinely have bought it twice.
- Provenance rows from both are kept (append-only).
- Wear events are combined.

## 6. Scope

Duplicate detection is **per user**. Two users owning the same dress is not a
duplicate. Queries never cross the `user_id` boundary (SEC-5).

## 7. Evaluation

Dataset: 50 duplicate pairs + 50 non-duplicate similar pairs.

| Metric | Target |
| ------ | ------ |
| Precision at the 0.90 threshold | ≥ 0.95 |
| Recall at the 0.70 threshold | ≥ 0.90 |
| False-duplicate rate on the similar-but-different set | ≤ 0.05 |
| Interruption rate (sheets shown per 100 additions) | ≤ 8 |

The similar-but-different set is deliberately hard: same brand, same colour,
different cut. That is exactly the case where a false merge is most damaging.
