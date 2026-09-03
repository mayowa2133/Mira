import { describe, expect, it } from 'vitest';
import { MAX_EDGE, constrain } from './preprocess-core';

describe('constrain', () => {
  it('pins the long edge of a portrait photo — the common garment case', () => {
    // A 4:3 phone photo held upright. Pinning width would leave the height at
    // 2730px, well over the budget.
    expect(constrain(3024, 4032)).toEqual({ height: MAX_EDGE });
  });

  it('pins the long edge of a landscape photo', () => {
    expect(constrain(4032, 3024)).toEqual({ width: MAX_EDGE });
  });

  it('pins either edge of a square photo', () => {
    expect(constrain(3000, 3000)).toEqual({ width: MAX_EDGE });
  });

  it('does not upscale a photo that is already small', () => {
    expect(constrain(900, 1200)).toBeNull();
    expect(constrain(MAX_EDGE, MAX_EDGE)).toBeNull();
  });

  it('resizes when only one edge is over budget', () => {
    expect(constrain(1000, MAX_EDGE + 1)).toEqual({ height: MAX_EDGE });
  });
});
