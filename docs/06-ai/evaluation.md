# AI Evaluation

AI behaviour requires evaluation in addition to traditional tests. A capability
change without an evaluation run does not ship.

---

## 1. Datasets

Fixed, versioned, and immutable once published — changing a dataset invalidates
every historical metric.

| Dataset | Size | Covers |
| ------- | ---- | ------ |
| `garments` | 200 photographs | Every category; hanger, flat, worn; good and poor lighting |
| `tags` | 100 photographs | Brand, care, size, SKU labels; barcodes; faded and curved |
| `receipts` | 50 | Paper, thermal, screenshot, PDF; multiple retailers and currencies |
| `purchase-emails` | 100 | Orders, shipments, receipts, **plus** marketing and return negatives |
| `searches` | 100 queries | Structured, temporal, semantic; with labelled relevant garments |
| `outfit-requests` | 100 | Occasions, vibes, anchors, and closet-too-small cases |
| `duplicates` | 50 pairs | True duplicates across ingestion paths |
| `non-duplicates` | 50 pairs | Similar-but-different: same brand, same colour, different cut |
| `try-on` | 50 combinations | Garment types, colours, patterns, body references |

### Provenance

Evaluation data is synthetic or explicitly consented. **No production user image
enters an evaluation set without explicit, revocable consent**
(`docs/07-security/privacy.md`). Datasets live outside the repository; the repo
holds only manifests and expected labels.

## 2. Metrics

Targets are defined in each capability document and collected here.

| Capability | Headline metric | Target |
| ---------- | --------------- | ------ |
| Garment understanding | Category accuracy | ≥ 0.95 |
| | Primary colour accuracy | ≥ 0.93 |
| | Brand precision without a tag | ≥ 0.95 |
| | Confidence calibration error | ≤ 0.10 |
| Image processing | Cutout acceptance rate | ≥ 0.90 |
| | False-accept (bad cutout) | ≤ 0.02 |
| Product matching | Match precision | ≥ 0.98 |
| | Wrong-match rate | ≤ 0.01 |
| Duplicate detection | Precision @0.90 | ≥ 0.95 |
| | Recall @0.70 | ≥ 0.90 |
| Receipt understanding | Line-item recall | ≥ 0.93 |
| | Price accuracy | ≥ 0.98 |
| Purchase detection | False purchase detection | ≤ 0.01 |
| | Auto-import precision | ≥ 0.99 |
| Closet search | Recall@10 | ≥ 0.90 |
| | False inclusion (violates a filter) | ≤ 0.01 |
| Outfit recommendation | **Hallucinated garment rate** | **0.00 (gate)** |
| | **Ineligible garment rate** | **0.00 (gate)** |
| | Occasion appropriateness | ≥ 0.85 |
| Virtual try-on | **Garment fidelity (1–5)** | **≥ 4.2 (gate)** |
| | Identity consistency (1–5) | ≥ 4.0 |

**Gates** are pass/fail. Everything else is compared against the current baseline.

## 3. Calibration

Confidence must mean something. For each capability, bucket predictions by
reported confidence and compare with observed accuracy:

```text
reported 0.9–1.0  → observed accuracy should be 0.90–1.00
reported 0.6–0.85 → observed accuracy should be 0.60–0.85
```

Expected calibration error ≤ 0.10. A miscalibrated model fails evaluation even
when its raw accuracy improves, because confidence drives the entire review UI.

## 4. Running evaluations

```bash
npm run eval -- --capability=garment-understanding
npm run eval -- --capability=all --baseline=main
npm run eval -- --capability=try-on --human-rating
```

Output: a per-metric table with the delta against the baseline, plus a list of
regressions. Runs are archived with model, prompt version and dataset version.

## 5. When to run

| Trigger | Scope |
| ------- | ----- |
| Prompt change | That capability |
| Model or provider change | That capability, plus anything downstream of it |
| Taxonomy change | Every capability that emits taxonomy values |
| Pipeline change (merge order, thresholds) | That capability |
| Before a release | Every capability with a gate |
| Weekly, scheduled | All, to catch provider-side drift |

Provider-side drift is real: the same prompt and model can move. The weekly run
exists to catch it before users do.

## 6. Human rating

Try-on and outfit quality need human judgement. Protocol:

- Three raters per item, 1–5 scales defined in the capability document.
- Raters see the garment(s) and the output, never the model name.
- Inter-rater agreement is reported; below 0.7 the rubric is the problem.
- Ratings are stored with the run.

## 7. Production feedback

The best signals come from real use, and cost nothing to collect:

| Signal | Meaning |
| ------ | ------- |
| `garment_corrected` by field | Understanding accuracy, per field |
| `duplicate_resolved` | Duplicate precision and recall |
| `closet_search_interpretation_corrected` | Interpretation accuracy |
| `ai_outfit_saved` / `ai_outfit_requested` | Stylist usefulness |
| `try_on_rated` | Try-on quality |
| `ai_validation_failed`, `ai_taxonomy_clamped` | Prompt or model regression |
| `purchase_auto_import_undone` | Auto-import precision in the wild |

These are monitored continuously. A rise in correction rate on one field is a
regression alarm even when offline metrics look fine.

Corrections feed evaluation only where privacy policy permits, and never carry
user imagery into a dataset without consent.

## 8. Regression policy

1. A **gate** failure blocks the release. No exceptions.
2. A non-gate regression greater than 2 points requires an explicit, written
   decision in `docs/09-decisions/decisions.md` naming what was traded for what.
3. Improvements are recorded in `docs/09-decisions/changelog.md`.
4. Baselines are updated only on release, never mid-development — otherwise a
   slow regression becomes invisible.
