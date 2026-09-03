# Closet Search

One field, two mechanisms: structured filtering and semantic retrieval, merged.

**Capabilities:** `reasoning` (query interpretation), `embedding`
**Consumer:** F-07

---

## 1. What must work

```text
black dresses
white going-out tops
heels I haven't worn recently
clothes from Zara
outfits I bought this summer
bags that work with a red dress
things that still have tags
show me everything I've never worn
something cute for dinner
```

These span three query kinds, and the router must handle all three in one field.

| Kind | Example | Path |
| ---- | ------- | ---- |
| **Structured** | "black dresses" | Filters only |
| **Structured + temporal** | "heels I haven't worn recently" | Filters + sort |
| **Semantic** | "something cute for dinner" | Filters + vector retrieval |

## 2. Interpretation contract

```json
{
  "filters": {
    "category": ["shoes"],
    "subcategory": ["heels"],
    "not_worn_since_days": 90
  },
  "semantic_terms": [],
  "sort": "never_worn",
  "confidence": 0.91
}
```

Every filter value must exist in the taxonomy (AI-3). Unknown values become
`semantic_terms` instead of being dropped — "cottagecore" is not a style tag, but
it is a meaningful retrieval term.

## 3. Retrieval

```text
interpretation
  ├── structured: SQL over garments + attributes (always runs)
  └── semantic:   pgvector over garment_embeddings (runs when semantic_terms exist)
        ↓
      merge: structured results are the candidate universe;
             semantic similarity reorders within it
        ↓
      rank → dedupe → paginate
```

**The structured filter is a hard constraint, not a hint.** If the user said
"black dresses", a beige dress never appears no matter how similar its embedding
is. Semantic search reorders; it does not smuggle in results.

Exception: when interpretation confidence is below 0.5 and no filters were
extracted, retrieval falls back to pure semantic over the whole closet.

## 4. Ranking

Within the constrained set:

```text
score = 0.55 · semantic_similarity
      + 0.20 · exact_field_match_bonus
      + 0.15 · recency_or_relevance_of_intent
      + 0.10 · favourite_and_wear_signals
```

"Not worn recently" inverts the recency term. Availability (`status = active`)
boosts but does not exclude, because a user searching for a garment may be
looking for one in the wash.

## 5. Showing the interpretation

Search results **always** return `interpretation`, and the client renders it as
removable chips:

```text
Mira understood
[Shoes ✕] [Heels ✕] [Not worn in 90 days ✕]
```

This is a requirement, not a nicety. It makes a wrong interpretation visible and
correctable in one tap, which is what makes semantic search trustworthy instead of
mysterious.

## 6. Embeddings

| Vector | Built from |
| ------ | ---------- |
| `image_vec` | Canonical garment image |
| `text_vec` | Brand, name, category, subcategory, colours, pattern, materials, style tags, occasions |

Both are regenerated when the garment's attributes or canonical image change.
The embedding model is recorded per row; a model change adds vectors rather than
overwriting them (`docs/04-data/migrations.md`).

## 7. Failure handling

| Failure | Handling |
| ------- | -------- |
| Interpretation unavailable | Keyword + filter search over name, brand, colour, category |
| Embeddings unavailable | Structured-only results, ranked by recency |
| Empty result | Honest empty state with suggested queries; never silently widen the filters |
| Query too vague ("stuff") | Return recents and offer the filter sheet |

Mira must never quietly relax a filter to avoid an empty result. An empty result
that reflects the closet is honest; a padded one is not.

## 8. Performance

| Metric | Target |
| ------ | ------ |
| Structured-only search p95 | < 300 ms |
| Semantic search p95 | < 800 ms (PERF-5) |
| Interpretation call p95 | < 600 ms |

Structured-only queries skip the interpretation call entirely when the input
matches a simple pattern ("black dresses", "zara").

## 9. Evaluation

Dataset: 100 closet searches with human-labelled relevant garments over the
`realistic` seed closet.

| Metric | Target |
| ------ | ------ |
| Recall@10 | ≥ 0.90 |
| Precision@10 | ≥ 0.80 |
| Interpretation filter accuracy | ≥ 0.92 |
| False-inclusion rate (violates a stated filter) | ≤ 0.01 |
| Search-success rate (a result is tapped) | ≥ 0.60 |

False inclusion is near-zero-tolerance: showing a beige dress for "black dresses"
tells the user Mira doesn't know her closet.
