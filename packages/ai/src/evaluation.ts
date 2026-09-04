/**
 * Evaluation metrics (`docs/06-ai/evaluation.md`).
 *
 * > A capability change without an evaluation run does not ship.
 *
 * The metrics live here, as pure functions over labelled cases, because they
 * are the part that has to be *right*: a scoring bug does not fail loudly, it
 * quietly reports a passing grade. The datasets themselves live outside the
 * repository — the repo holds manifests and expected labels only, and no
 * production image enters an evaluation set without explicit consent.
 *
 * Two of these metrics are deliberately not the obvious ones, and the reasons
 * are on each function.
 */
import { CONFIDENCE } from '@mira/taxonomy';

/** One labelled case. `image` is a path into a dataset kept outside the repo. */
export type EvaluationCase = {
  id: string;
  image: string;
  /** Whether a legible tag is present — brand is scored differently without one. */
  hasTag: boolean;
  expected: {
    category: string;
    /** Ordered; the first is primary. */
    colors?: string[];
    brand?: string | null;
    subcategory?: string | null;
    pattern?: string | null;
  };
};

/** What the pipeline produced for a case. */
export type Prediction = {
  id: string;
  category: string;
  colors: string[];
  brand: string | null;
  subcategory: string | null;
  pattern: string | null;
  confidence: Record<string, number>;
};

export type Metric = {
  name: string;
  value: number;
  target: number;
  /** Most metrics want to be high; error metrics want to be low. */
  direction: 'at_least' | 'at_most';
  passed: boolean;
  /** How many cases the metric could actually be computed over. */
  n: number;
};

/**
 * `emptyPasses` distinguishes two very different kinds of "no measurement".
 *
 * For most metrics, nothing measured means no evidence, and an evaluation that
 * reports success because it measured nothing is worse than none at all — so
 * the default is to FAIL.
 *
 * Brand precision is the exception, and deliberately so: a model that declines
 * to name a brand on every untagged garment has asserted nothing wrong, which
 * is exactly the behaviour D-014 asks for. §8 accepts the trade explicitly —
 * "recall may be low, that is correct" — so silence there is a pass, not an
 * absence of evidence.
 */
const metric = (
  name: string,
  value: number,
  target: number,
  direction: 'at_least' | 'at_most',
  n: number,
  emptyPasses = false,
): Metric => ({
  name,
  value,
  target,
  direction,
  passed:
    n === 0 ? emptyPasses : direction === 'at_least' ? value >= target : value <= target,
  n,
});

/** Case-insensitive, whitespace-tolerant. Brands are free text. */
function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a ?? null;
  const right = b ?? null;
  // Both absent is a match: a model that correctly declined to name a brand
  // agrees with a label that says there is none.
  if (left === null || right === null) return left === right;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function categoryAccuracy(cases: EvaluationCase[], predictions: Prediction[]): Metric {
  const byId = new Map(predictions.map((p) => [p.id, p]));
  let correct = 0;
  let total = 0;

  for (const testCase of cases) {
    const prediction = byId.get(testCase.id);
    if (!prediction) continue;
    total += 1;
    if (prediction.category === testCase.expected.category) correct += 1;
  }

  return metric('category_accuracy', total === 0 ? 0 : correct / total, 0.95, 'at_least', total);
}

/**
 * Primary colour only — the FIRST colour, not set overlap.
 *
 * A garment's primary colour is what someone would call it. Scoring set overlap
 * would let a model that returns every plausible colour score well while being
 * useless in a closet, where "the black dress" has to mean something.
 */
export function primaryColorAccuracy(
  cases: EvaluationCase[],
  predictions: Prediction[],
): Metric {
  const byId = new Map(predictions.map((p) => [p.id, p]));
  let correct = 0;
  let total = 0;

  for (const testCase of cases) {
    const expected = testCase.expected.colors?.[0];
    const prediction = byId.get(testCase.id);
    if (!expected || !prediction) continue;

    total += 1;
    if (prediction.colors[0] === expected) correct += 1;
  }

  return metric('primary_color_accuracy', total === 0 ? 0 : correct / total, 0.93, 'at_least', total);
}

/**
 * Brand PRECISION without a tag, not accuracy.
 *
 * `garment-understanding.md` §8: "Brand precision, no tag ≥ 0.95 (recall may be
 * low — that is correct)." A model that returns null for every untagged garment
 * scores perfectly here, and should: guessing Zara from a silhouette is the
 * failure mode this metric exists to punish (D-014).
 *
 * Only cases where the model ASSERTED a brand count. Declining to answer is not
 * a wrong answer.
 */
export function brandPrecisionWithoutTag(
  cases: EvaluationCase[],
  predictions: Prediction[],
): Metric {
  const byId = new Map(predictions.map((p) => [p.id, p]));
  let correct = 0;
  let asserted = 0;

  for (const testCase of cases) {
    if (testCase.hasTag) continue;
    const prediction = byId.get(testCase.id);
    if (!prediction?.brand) continue;

    asserted += 1;
    if (sameText(prediction.brand, testCase.expected.brand)) correct += 1;
  }

  return metric(
    'brand_precision_no_tag',
    asserted === 0 ? 1 : correct / asserted,
    0.95,
    'at_least',
    asserted,
    // Never guessing is the desired behaviour, not a missing measurement.
    true,
  );
}

/**
 * Expected calibration error: does a confidence of 0.9 mean right 90% of the
 * time?
 *
 * Bucketed by the bands the product actually uses, because those are what the
 * user experiences — a tick, a statement, a question. A model that is
 * well-calibrated on a scale nobody sees is not calibrated for Mira.
 *
 * §4: "A model that reports brand 0.9 from silhouette alone is miscalibrated
 * and fails evaluation, even if it happens to be right."
 */
export function calibrationError(
  cases: EvaluationCase[],
  predictions: Prediction[],
  field: 'category' | 'brand' | 'pattern' | 'subcategory' = 'category',
): Metric {
  const byId = new Map(predictions.map((p) => [p.id, p]));

  const buckets: { lower: number; upper: number; hits: number[]; confidences: number[] }[] = [
    { lower: CONFIDENCE.high, upper: 1.01, hits: [], confidences: [] },
    { lower: CONFIDENCE.medium, upper: CONFIDENCE.high, hits: [], confidences: [] },
    { lower: CONFIDENCE.low, upper: CONFIDENCE.medium, hits: [], confidences: [] },
    { lower: 0, upper: CONFIDENCE.low, hits: [], confidences: [] },
  ];

  let total = 0;

  for (const testCase of cases) {
    const prediction = byId.get(testCase.id);
    if (!prediction) continue;

    const confidence = prediction.confidence[field];
    if (typeof confidence !== 'number') continue;

    const predicted = prediction[field];
    const expected = testCase.expected[field] ?? null;
    const correct = sameText(
      typeof predicted === 'string' ? predicted : null,
      typeof expected === 'string' ? expected : null,
    );

    const bucket = buckets.find((b) => confidence >= b.lower && confidence < b.upper);
    if (!bucket) continue;

    bucket.hits.push(correct ? 1 : 0);
    bucket.confidences.push(confidence);
    total += 1;
  }

  if (total === 0) return metric(`calibration_error_${field}`, 1, 0.1, 'at_most', 0);

  // Weighted average gap between stated confidence and observed accuracy.
  let error = 0;
  for (const bucket of buckets) {
    if (bucket.hits.length === 0) continue;
    const accuracy = bucket.hits.reduce((a, b) => a + b, 0) / bucket.hits.length;
    const meanConfidence =
      bucket.confidences.reduce((a, b) => a + b, 0) / bucket.confidences.length;
    error += (bucket.hits.length / total) * Math.abs(accuracy - meanConfidence);
  }

  return metric(`calibration_error_${field}`, error, 0.1, 'at_most', total);
}

export type EvaluationReport = {
  dataset: string;
  cases: number;
  predictions: number;
  metrics: Metric[];
  passed: boolean;
};

/**
 * Score a run.
 *
 * A run with no cases FAILS rather than passing vacuously — an evaluation that
 * reports success because it measured nothing is worse than no evaluation at
 * all, because it is believed.
 */
export function evaluate(
  dataset: string,
  cases: EvaluationCase[],
  predictions: Prediction[],
): EvaluationReport {
  const metrics = [
    categoryAccuracy(cases, predictions),
    primaryColorAccuracy(cases, predictions),
    brandPrecisionWithoutTag(cases, predictions),
    calibrationError(cases, predictions, 'category'),
  ];

  return {
    dataset,
    cases: cases.length,
    predictions: predictions.length,
    metrics,
    passed: cases.length > 0 && metrics.every((m) => m.passed),
  };
}

/** A short, readable summary. */
export function formatReport(report: EvaluationReport): string {
  const lines = [
    `dataset: ${report.dataset}`,
    `cases: ${report.cases}, predictions: ${report.predictions}`,
    '',
  ];

  for (const m of report.metrics) {
    const comparison = m.direction === 'at_least' ? '>=' : '<=';
    lines.push(
      `${m.passed ? 'PASS' : 'FAIL'}  ${m.name.padEnd(28)} ` +
        `${m.value.toFixed(3)} ${comparison} ${m.target} (n=${m.n})`,
    );
  }

  lines.push('', report.passed ? 'PASSED' : 'FAILED');
  return lines.join('\n');
}
