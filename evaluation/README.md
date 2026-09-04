# Evaluation manifests

Datasets live **outside** this repository. The repo holds manifests and expected
labels only (`docs/06-ai/evaluation.md` §1).

That is a privacy rule, not a size one: no production user image enters an
evaluation set without explicit, revocable consent
(`docs/07-security/privacy.md`, and Q-14 in `docs/09-decisions/open-questions.md`
is still open on exactly how that consent is captured).

A manifest names the images and the labels they are scored against:

```json
{
  "dataset": "garments",
  "version": "0.1.0",
  "cases": [
    {
      "id": "g0001",
      "image": "garments/g0001.jpg",
      "hasTag": false,
      "expected": { "category": "dresses", "colors": ["black"], "brand": null }
    }
  ]
}
```

Run against a local checkout:

```bash
MIRA_DATASET_ROOT=/path/to/datasets npm run evaluate -- --dataset garments
```

Datasets are immutable once published — changing one invalidates every
historical metric. Add cases as a new version.

## Status

`garments.manifest.json` currently holds a handful of **example** cases that
exercise the manifest shape. It is not the 200-photograph dataset the exit
criteria require, and no accuracy claim can be made from it.

---

## `duplicates.dataset.json`

The one dataset that lives **in** the repository, because it contains no images.
Duplicate detection weighs metadata — barcodes, SKUs, product URLs, order lines,
brands, names, colours, sizes — so the dataset *is* labels, and the privacy rule
that keeps datasets out of the repo has nothing to bite on. It is synthetic,
which `docs/06-ai/evaluation.md` §1 permits explicitly.

```bash
npm run evaluate:duplicates
```

50 duplicate pairs and 50 similar-but-different pairs (§7), each carrying a
`family` and a `why` so a reader can see what a headline number is made of.
Every case states only what DIFFERS between the two garments; the rest comes
from `base` and `defaults`.

### What it can and cannot tell you

It is authored alongside the scorer, so it is partly circular. It cannot tell
you how Mira behaves on a real wardrobe, and a good number here is not evidence
of real-world accuracy — that needs consented closets, which do not exist yet.

What it does do: make the thresholds falsifiable, force the hard cases to be
written down, and fail loudly when a change moves a boundary. It has already
earned that. On its first run the false-duplicate rate was **48%**, and the
family breakdown named the cause in one line — every "same style, different
colour" and "same style, different size" pair was being asked about, because the
scorer had no way to weigh evidence AGAINST a pair (D-028).

### Deliberately excluded

**Identical items owned twice.** Two of the same sock, or a staple replaced a
year later, are not "similar but different" — they are identical, and asking
about them is the designed behaviour: §1 requires Mira to support legitimate
duplicate ownership, and "I own two" is an answer on the sheet. Counting that
ask as a false duplicate would penalise the scorer for obeying the spec.

### Known tension inside the set

`dup-attributes-only` and `neg-attributes-only-different-items` present
**identical evidence** — same brand, colour, size and category, nothing else
known — with opposite labels. Both score 0.550. No scorer using these signals
can separate them, so one of the two is always counted wrong.

That is left in on purpose. It is the honest reason `Recall @0.70` sits below
its target, and removing it would buy a passing number by deleting the case that
explains the failure.
