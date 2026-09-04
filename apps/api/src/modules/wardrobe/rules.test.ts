import { describe, expect, it } from 'vitest';
import {
  MIN_CLOSET_FOR_INSIGHTS,
  closetValue,
  costPerWear,
  headlineFor,
  shouldShow,
} from './rules.js';

describe('shouldShow', () => {
  describe('a new closet is told nothing', () => {
    it('suppresses every insight below the closet threshold', () => {
      // Telling someone who joined last week that they never wear their clothes
      // is useless and faintly rude.
      const verdict = shouldShow(5, { kind: 'never_worn', itemCount: 5 });
      expect(verdict).toEqual({ show: false, reason: 'closet_too_small' });
    });

    it('says which reason, so an empty screen is explicable', () => {
      const small = shouldShow(4, { kind: 'forgotten', itemCount: 3 });
      const thin = shouldShow(MIN_CLOSET_FOR_INSIGHTS, { kind: 'forgotten', itemCount: 1 });

      expect(small).toMatchObject({ reason: 'closet_too_small' });
      expect(thin).toMatchObject({ reason: 'not_enough_items' });
    });
  });

  it('needs more than one item to call something a pattern', () => {
    // "1 piece deserves another chance" is a sentence about a wardrobe of four
    // things, not an insight.
    expect(shouldShow(50, { kind: 'forgotten', itemCount: 1 }).show).toBe(false);
    expect(shouldShow(50, { kind: 'forgotten', itemCount: 2 }).show).toBe(true);
  });

  describe('most loved', () => {
    it('needs enough wears to be a favourite rather than a Tuesday', () => {
      expect(shouldShow(50, { kind: 'most_loved', itemCount: 1, topWearCount: 1 }).show).toBe(
        false,
      );
      expect(shouldShow(50, { kind: 'most_loved', itemCount: 1, topWearCount: 3 }).show).toBe(true);
    });

    it('is allowed to be a single piece, unlike the others', () => {
      expect(shouldShow(50, { kind: 'most_loved', itemCount: 1, topWearCount: 9 }).show).toBe(true);
    });

    it('says nothing when there is no wear history at all', () => {
      expect(shouldShow(50, { kind: 'most_loved', itemCount: 0 })).toMatchObject({
        show: false,
      });
    });
  });
});

describe('headlineFor', () => {
  it('reads as an observation, not an instruction', () => {
    // "fashion content, not a dashboard" — a dashboard is what you get when
    // every card tells the user to do something.
    expect(headlineFor('forgotten', 17)).toBe('17 pieces deserve another chance');
    expect(headlineFor('never_worn', 2)).toBe("You've never worn these 👀");
  });

  it('gets singular and plural right', () => {
    expect(headlineFor('forgotten', 1)).toBe('1 piece deserves another chance');
    expect(headlineFor('tags_attached', 1)).toBe('One piece still has its tags');
    expect(headlineFor('tags_attached', 4)).toBe('4 pieces still have their tags');
  });
});

describe('costPerWear', () => {
  it('divides price by wears', () => {
    expect(costPerWear(120, 4)).toBe(30);
  });

  it('rounds to the penny', () => {
    expect(costPerWear(100, 3)).toBe(33.33);
  });

  it('is null for a piece that has never been worn', () => {
    // Reporting the full price is arithmetically true and reads as an
    // accusation.
    expect(costPerWear(120, 0)).toBeNull();
  });

  it('is null when there is no price', () => {
    expect(costPerWear(null, 5)).toBeNull();
    expect(costPerWear(0, 5)).toBeNull();
  });
});

describe('closetValue', () => {
  it('totals the prices it knows', () => {
    expect(closetValue([20, 30.5, 49.5])).toEqual({ total: 100, priced: 3, unpriced: 0 });
  });

  it('reports how much of the closet it could see', () => {
    // "Your closet is worth £480" means something very different over 12 pieces
    // than over 200.
    expect(closetValue([20, null, 30, null, null])).toEqual({
      total: 50,
      priced: 2,
      unpriced: 3,
    });
  });

  it('treats a zero price as unknown rather than free', () => {
    expect(closetValue([0, 25])).toEqual({ total: 25, priced: 1, unpriced: 1 });
  });

  it('is zero, not an error, for a closet with no prices', () => {
    expect(closetValue([null, null])).toEqual({ total: 0, priced: 0, unpriced: 2 });
  });
});
