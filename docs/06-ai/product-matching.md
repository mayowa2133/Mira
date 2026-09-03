# Product Matching

Resolving a photographed or detected item to a real, identified product.

**Consumers:** photo import, tag scan, receipt import, purchase candidates

---

## 1. Why it matters

A matched product gives Mira: the real product name, the retailer's clean
photography, authoritative material and colour, and a stable identifier that makes
duplicate detection precise. It converts a guess into a fact.

## 2. Signal precedence

```text
1. barcode / UPC / EAN          exact
2. SKU + retailer               exact
3. product URL                  exact
4. order line + retailer + date  strong
5. brand + product name         moderate
6. visual similarity             weak — never sufficient alone
```

**Rule:** visual similarity alone never produces a `matched` result. It may
produce a *suggestion* the user confirms, at medium confidence at most.

## 3. Outcomes

| Outcome | Condition | Effect |
| ------- | --------- | ------ |
| `matched` | An exact signal resolved to one product | Fields filled at high confidence; retailer image attached |
| `probable` | Strong signals, one clear leading candidate | Fields filled at medium confidence, shown without ticks |
| `ambiguous` | Several plausible candidates | Present up to 3 for the user to choose |
| `unmatched` | Nothing resolved | Degrade to partial prefill (CAP-4) |

`ambiguous` is presented as *"Is this one of these?"* with images — a choice, not
a form.

## 4. Sources

| Source | Use | Constraints |
| ------ | --- | ----------- |
| User-supplied product URL | Authoritative | Fetched server-side, rate-limited, cached |
| Retailer APIs / feeds | Preferred where available | Per `docs/03-architecture/integrations.md` |
| Barcode databases | UPC/EAN resolution | Cached aggressively |
| Cached prior matches | Same SKU seen before | First lookup, always |

Fetched pages are **untrusted content**. A product page can contain text designed
to steer a model; it is delimited as data and cannot cause an action (R4).

## 5. Caching

Cache key precedence: `barcode` → `retailer+sku` → `normalized(product_url)`.

Matches are cached globally (a product is a product), but a *garment's* link to a
match is per user. Cached entries carry a TTL, because prices and availability
change; names and materials do not, and are treated as stable.

## 6. Failure handling

| Failure | Handling |
| ------- | -------- |
| No match | `unmatched`; keep SKU/barcode verbatim on the garment for later |
| Retailer unreachable | Retry with backoff; degrade to unmatched |
| Page unparseable | Degrade to unmatched, log |
| Match contradicts a legible tag | Tag wins for size; match wins for name and material; conflict is logged |
| Match contradicts the user | User always wins |

An unmatched item still keeps its identifiers. Matching can be retried later, when
coverage improves, without asking the user for anything.

## 7. Evaluation

| Metric | Target |
| ------ | ------ |
| Match precision (a `matched` result is correct) | ≥ 0.98 |
| Match recall with a barcode present | ≥ 0.85 |
| Match recall from an email order line | ≥ 0.70 |
| Ambiguous-set hit rate (correct product among the 3 shown) | ≥ 0.90 |
| Wrong-match rate | ≤ 0.01 |

Precision dominates. A wrong match writes a wrong brand, a wrong name and a wrong
image into the user's closet, and she will believe all three.
