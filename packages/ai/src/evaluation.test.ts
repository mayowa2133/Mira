import { describe, expect, it } from 'vitest';
import {
  brandPrecisionWithoutTag,
  calibrationError,
  categoryAccuracy,
  evaluate,
  primaryColorAccuracy,
  type EvaluationCase,
  type Prediction,
} from './evaluation.js';

const testCase = (over: Partial<EvaluationCase> & { id: string }): EvaluationCase => ({
  image: `datasets/garments/${over.id}.jpg`,
  hasTag: false,
  expected: { category: 'dresses', colors: ['black'], brand: null },
  ...over,
});

const prediction = (over: Partial<Prediction> & { id: string }): Prediction => ({
  category: 'dresses',
  colors: ['black'],
  brand: null,
  subcategory: null,
  pattern: null,
  confidence: {},
  ...over,
});

describe('categoryAccuracy', () => {
  it('scores what it got right', () => {
    const cases = [testCase({ id: 'a' }), testCase({ id: 'b' }), testCase({ id: 'c' })];
    const predictions = [
      prediction({ id: 'a' }),
      prediction({ id: 'b', category: 'tops' }),
      prediction({ id: 'c' }),
    ];

    const metric = categoryAccuracy(cases, predictions);
    expect(metric.value).toBeCloseTo(2 / 3, 3);
    expect(metric.target).toBe(0.95);
    expect(metric.passed).toBe(false);
  });

  it('ignores cases the run produced no prediction for', () => {
    // A crashed case must not be counted as a wrong answer — it is a missing
    // measurement, and `n` says so.
    const metric = categoryAccuracy(
      [testCase({ id: 'a' }), testCase({ id: 'b' })],
      [prediction({ id: 'a' })],
    );
    expect(metric.value).toBe(1);
    expect(metric.n).toBe(1);
  });
});

describe('primaryColorAccuracy', () => {
  it('scores the FIRST colour, not set overlap', () => {
    // A model returning every plausible colour would score well on overlap and
    // be useless in a closet, where "the black dress" has to mean something.
    const metric = primaryColorAccuracy(
      [testCase({ id: 'a', expected: { category: 'dresses', colors: ['black'] } })],
      [prediction({ id: 'a', colors: ['red', 'black'] })],
    );
    expect(metric.value).toBe(0);
  });

  it('accepts the right primary with extras after it', () => {
    const metric = primaryColorAccuracy(
      [testCase({ id: 'a', expected: { category: 'dresses', colors: ['black'] } })],
      [prediction({ id: 'a', colors: ['black', 'cream'] })],
    );
    expect(metric.value).toBe(1);
  });
});

describe('brandPrecisionWithoutTag', () => {
  it('rewards declining to guess', () => {
    // Recall may be low and that is correct: guessing a brand from silhouette
    // is the failure this metric exists to punish (D-014).
    const cases = [
      testCase({ id: 'a', expected: { category: 'tops', brand: 'Ganni' } }),
      testCase({ id: 'b', expected: { category: 'tops', brand: 'Toteme' } }),
    ];
    const predictions = [prediction({ id: 'a', brand: null }), prediction({ id: 'b', brand: null })];

    const metric = brandPrecisionWithoutTag(cases, predictions);
    expect(metric.value).toBe(1);
    expect(metric.passed).toBe(true);
    // Nothing was asserted, and the metric says so.
    expect(metric.n).toBe(0);
  });

  it('punishes a confident wrong guess', () => {
    const cases = [
      testCase({ id: 'a', expected: { category: 'tops', brand: 'Ganni' } }),
      testCase({ id: 'b', expected: { category: 'tops', brand: 'Toteme' } }),
    ];
    const predictions = [
      prediction({ id: 'a', brand: 'Ganni' }),
      prediction({ id: 'b', brand: 'Zara' }),
    ];

    expect(brandPrecisionWithoutTag(cases, predictions).value).toBe(0.5);
  });

  it('ignores tagged cases, which are scored separately', () => {
    const metric = brandPrecisionWithoutTag(
      [testCase({ id: 'a', hasTag: true, expected: { category: 'tops', brand: 'Ganni' } })],
      [prediction({ id: 'a', brand: 'Zara' })],
    );
    expect(metric.n).toBe(0);
  });

  it('compares brands case-insensitively', () => {
    const metric = brandPrecisionWithoutTag(
      [testCase({ id: 'a', expected: { category: 'tops', brand: 'Ganni' } })],
      [prediction({ id: 'a', brand: '  ganni ' })],
    );
    expect(metric.value).toBe(1);
  });
});

describe('calibrationError', () => {
  it('is near zero when confidence matches reality', () => {
    // Ten cases at 0.9 confidence, nine correct.
    const cases = Array.from({ length: 10 }, (_, i) => testCase({ id: `c${i}` }));
    const predictions = cases.map((c, i) =>
      prediction({
        id: c.id,
        category: i === 0 ? 'tops' : 'dresses',
        confidence: { category: 0.9 },
      }),
    );

    const metric = calibrationError(cases, predictions);
    expect(metric.value).toBeLessThan(0.05);
    expect(metric.passed).toBe(true);
  });

  it('catches a model that is confidently wrong', () => {
    // §4: high confidence that is not borne out fails, even where it happens to
    // be right sometimes.
    const cases = Array.from({ length: 10 }, (_, i) => testCase({ id: `c${i}` }));
    const predictions = cases.map((c, i) =>
      prediction({
        id: c.id,
        category: i < 5 ? 'tops' : 'dresses',
        confidence: { category: 0.98 },
      }),
    );

    const metric = calibrationError(cases, predictions);
    expect(metric.value).toBeGreaterThan(0.4);
    expect(metric.passed).toBe(false);
  });

  it('does not punish low confidence that is honestly low', () => {
    const cases = Array.from({ length: 10 }, (_, i) => testCase({ id: `c${i}` }));
    const predictions = cases.map((c, i) =>
      prediction({
        id: c.id,
        category: i < 6 ? 'tops' : 'dresses',
        confidence: { category: 0.4 },
      }),
    );

    // 40% right at 0.4 stated confidence is well calibrated.
    expect(calibrationError(cases, predictions).value).toBeLessThan(0.05);
  });

  it('fails rather than passes when nothing could be measured', () => {
    const metric = calibrationError([testCase({ id: 'a' })], [prediction({ id: 'a' })]);
    expect(metric.n).toBe(0);
    expect(metric.passed).toBe(false);
  });
});

describe('evaluate', () => {
  it('fails an empty run rather than passing vacuously', () => {
    // An evaluation that reports success because it measured nothing is worse
    // than no evaluation, because it is believed.
    const report = evaluate('garments', [], []);
    expect(report.passed).toBe(false);
    expect(report.cases).toBe(0);
  });

  it('passes only when every metric passes', () => {
    const cases = Array.from({ length: 20 }, (_, i) => testCase({ id: `c${i}` }));
    const predictions = cases.map((c) => prediction({ id: c.id, confidence: { category: 0.96 } }));

    const report = evaluate('garments', cases, predictions);
    expect(report.passed).toBe(true);

    // One wrong category takes accuracy to 0.95 exactly — still passing — but
    // two does not.
    const worse = predictions.map((p, i) => (i < 2 ? { ...p, category: 'tops' } : p));
    expect(evaluate('garments', cases, worse).passed).toBe(false);
  });
});
