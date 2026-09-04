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
