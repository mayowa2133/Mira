/**
 * Laying out a wear-history month (§27, task 9.5).
 *
 * React-free: the awkward part is calendar arithmetic, not rendering, and
 * off-by-one errors in a month grid are invisible until someone notices their
 * Tuesday is on a Wednesday.
 */
export type WearDay = {
  /** `YYYY-MM-DD`, as the API returns it. */
  worn_on: string;
  garments: { id: string; image_url: string | null; name: string | null; brand: string | null }[];
  outfit_ids: string[];
};

export type CalendarCell = {
  /** `YYYY-MM-DD`, or null for the padding before the first of the month. */
  date: string | null;
  day: number | null;
  wears: WearDay | null;
};

/** Monday-first, which is what a wardrobe week looks like. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The cells for one month, padded to whole weeks.
 *
 * Dates are built as local `YYYY-MM-DD` strings rather than from `toISOString`,
 * which converts to UTC first — west of Greenwich that shifts every date back a
 * day, and a wear logged on the 1st would render on the 31st of the month
 * before.
 */
export function monthGrid(year: number, month: number, days: readonly WearDay[]): CalendarCell[] {
  const byDate = new Map(days.map((day) => [day.worn_on, day]));

  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; shift so Monday is 0.
  const leading = (first.getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leading; i += 1) cells.push({ date: null, day: null, wears: null });

  for (let day = 1; day <= length; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day, wears: byDate.get(date) ?? null });
  }

  // Pad to a whole final week so the grid does not reflow its last row.
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, wears: null });

  return cells;
}

/** The range to ask the API for, covering the whole month. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const length = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(length)}`,
  };
}

/** Step a month, rolling the year. */
export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const date = new Date(year, month + by, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
