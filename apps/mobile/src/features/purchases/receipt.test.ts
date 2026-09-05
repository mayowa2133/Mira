import { describe, expect, it } from 'vitest';
import {
  addLabel,
  foundLabel,
  hiddenCount,
  reconcile,
  reconciliationNote,
  showAllLabel,
  visibleLines,
  type ReceiptLine,
} from './receipt';

const line = (over: Partial<ReceiptLine> = {}): ReceiptLine => ({
  id: over.id ?? 'l1',
  rawText: over.rawText ?? 'BLACK MINI DRESS',
  productName: over.productName ?? 'Black Mini Dress',
  price: over.price ?? 49.99,
  isGarment: over.isGarment ?? true,
});

describe('which lines are shown (§11)', () => {
  const lines = [
    line({ id: 'a' }),
    line({ id: 'b', price: 69.99 }),
    line({ id: 'tax', rawText: 'GST', productName: null, price: 15.6, isGarment: false }),
  ];

  it('shows only what Mira thinks is a garment', () => {
    expect(visibleLines(lines, false).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('keeps the rest available rather than discarding it', () => {
    // A receipt that hid part of itself is impossible to reconcile against the
    // paper version in someone's hand.
    expect(visibleLines(lines, true)).toHaveLength(3);
    expect(hiddenCount(lines)).toBe(1);
    expect(showAllLabel(hiddenCount(lines))).toBe('Show all lines (1 hidden)');
  });

  it('does not offer to show all when nothing is hidden', () => {
    expect(showAllLabel(0)).toBeNull();
  });
});

describe('the labels', () => {
  it('says what was found, and what will happen', () => {
    expect(foundLabel(4)).toBe('We found 4 possible items');
    expect(foundLabel(1)).toBe('We found 1 possible item');
    expect(addLabel(4)).toBe('Add 4 items');
  });

  it('does not claim to have found things when it found none', () => {
    expect(foundLabel(0)).toBe("We couldn't find any items");
    expect(addLabel(0)).toBe('Select items to add');
  });
});

describe('totals reconciliation (4.4)', () => {
  it('balances when the lines reach the total', () => {
    const lines = [line({ price: 49.99 }), line({ id: 'b', price: 50.01 })];
    expect(reconcile(lines, 100)?.balanced).toBe(true);
  });

  it('tolerates a cent of rounding', () => {
    expect(reconcile([line({ price: 49.99 })], 50)?.balanced).toBe(true);
  });

  it('notices a missing item rather than importing three of four', () => {
    const result = reconcile([line({ price: 49.99 })], 119.98);
    expect(result?.balanced).toBe(false);
    expect(reconciliationNote(result)).toContain('may be missing');
  });

  it('counts non-garment lines toward the total', () => {
    // Tax is not a garment but it is on the receipt, and excluding it would
    // report every receipt as short.
    const lines = [line({ price: 100 }), line({ id: 't', price: 13, isGarment: false })];
    expect(reconcile(lines, 113)?.balanced).toBe(true);
  });

  it('says nothing when there is no total to check against', () => {
    expect(reconcile([line()], null)).toBeNull();
    expect(reconciliationNote(null)).toBeNull();
  });

  it('is silent when it balances', () => {
    expect(reconciliationNote({ balanced: true, difference: 0 })).toBeNull();
  });
});
