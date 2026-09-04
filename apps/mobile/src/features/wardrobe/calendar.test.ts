import { describe, expect, it } from 'vitest';
import { monthGrid, monthRange, shiftMonth, type WearDay } from './calendar';

const wear = (worn_on: string): WearDay => ({ worn_on, garments: [], outfit_ids: [] });

describe('the month grid', () => {
  it('pads to whole weeks at both ends', () => {
    const cells = monthGrid(2026, 8, []); // September 2026
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((c) => c.day !== null)).toHaveLength(30);
  });

  it('starts the month on the right weekday, Monday first', () => {
    // 1 September 2026 is a Tuesday, so exactly one leading blank.
    const cells = monthGrid(2026, 8, []);
    expect(cells[0]!.day).toBeNull();
    expect(cells[1]!.day).toBe(1);
  });

  it('puts a wear on its own day', () => {
    const cells = monthGrid(2026, 8, [wear('2026-09-04')]);
    const fourth = cells.find((c) => c.day === 4);
    expect(fourth!.wears).not.toBeNull();
    expect(cells.filter((c) => c.wears !== null)).toHaveLength(1);
  });

  it('builds dates locally, not through UTC', () => {
    // `toISOString` converts to UTC first, and west of Greenwich that shifts
    // every date back a day — a wear logged on the 1st would land on the 31st
    // of the month before.
    const cells = monthGrid(2026, 0, [wear('2026-01-01')]);
    expect(cells.find((c) => c.day === 1)!.wears).not.toBeNull();
  });

  it('handles a February and a leap year', () => {
    expect(monthGrid(2026, 1, []).filter((c) => c.day !== null)).toHaveLength(28);
    expect(monthGrid(2028, 1, []).filter((c) => c.day !== null)).toHaveLength(29);
  });
});

describe('the range asked of the API', () => {
  it('covers the whole month', () => {
    expect(monthRange(2026, 8)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('gets February right', () => {
    expect(monthRange(2026, 1).to).toBe('2026-02-28');
    expect(monthRange(2028, 1).to).toBe('2028-02-29');
  });
});

describe('stepping months', () => {
  it('rolls backwards over a year boundary', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('rolls forwards over a year boundary', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
});
