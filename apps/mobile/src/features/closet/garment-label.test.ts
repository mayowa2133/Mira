import { describe, expect, it } from 'vitest';
import { describeUnnamed, garmentLabel, type LabelInput } from './garment-label';

const input = (over: Partial<LabelInput> = {}): LabelInput => ({
  brand: 'Ganni',
  name: 'Slip Midi Dress',
  subtitle: 'black · S',
  category: 'dresses',
  favorite: false,
  isAnalyzing: false,
  ...over,
});

describe('garmentLabel', () => {
  it('reads as one phrase, not four fragments', () => {
    expect(garmentLabel(input())).toBe('Ganni, Slip Midi Dress, black · S');
  });

  describe('it never leaves the listener without an identity', () => {
    it('never returns an empty string', () => {
      // An empty label made iOS read the tile's children, so a dress
      // announced itself as "♡".
      const bare = garmentLabel(
        input({ brand: null, name: null, subtitle: '', category: 'dresses' }),
      );
      expect(bare).not.toBe('');
      expect(bare).toBe('A dress');
    });

    it('leads with what the thing is when only a colour is known', () => {
      // "black" is true and useless: the listener learns the colour of
      // something they cannot identify.
      expect(garmentLabel(input({ brand: null, name: null, subtitle: 'black' }))).toBe(
        'A dress, black',
      );
    });

    it('falls back for a category with no natural phrase', () => {
      expect(
        garmentLabel(input({ brand: null, name: null, subtitle: '', category: 'other' })),
      ).toBe('A piece in your closet');
    });
  });

  describe('identity', () => {
    it('uses the name when there is no brand', () => {
      expect(garmentLabel(input({ brand: null }))).toBe('Slip Midi Dress, black · S');
    });

    it('does not repeat the name when it is the identity', () => {
      const label = garmentLabel(input({ brand: null, subtitle: '' }));
      expect(label).toBe('Slip Midi Dress');
      expect(label.match(/Slip Midi Dress/g)).toHaveLength(1);
    });

    it('uses the brand and the name together when both exist', () => {
      expect(garmentLabel(input({ subtitle: '' }))).toBe('Ganni, Slip Midi Dress');
    });
  });

  describe('state', () => {
    it('announces favourite state, because colour alone cannot carry it', () => {
      expect(garmentLabel(input({ favorite: true }))).toContain('Favourited');
    });

    it('announces that a piece is still being analyzed', () => {
      const label = garmentLabel(
        input({ brand: null, name: null, subtitle: '', category: 'other', isAnalyzing: true }),
      );
      // A capture taken seconds ago: it says what it is and what is happening.
      expect(label).toBe('A piece in your closet, Still being analyzed');
    });

    it('puts state last, after the description', () => {
      const label = garmentLabel(input({ favorite: true, isAnalyzing: true }));
      expect(label.indexOf('Ganni')).toBeLessThan(label.indexOf('Favourited'));
      expect(label.indexOf('Favourited')).toBeLessThan(label.indexOf('Still being analyzed'));
    });
  });

  it('ignores a blank subtitle rather than emitting a stray comma', () => {
    expect(garmentLabel(input({ subtitle: '   ' }))).toBe('Ganni, Slip Midi Dress');
  });
});

describe('describeUnnamed', () => {
  it('says what a person would say pointing across a room', () => {
    expect(describeUnnamed('shoes')).toBe('A pair of shoes');
    expect(describeUnnamed('dresses')).toBe('A dress');
  });

  it('has something to say about a category it does not know', () => {
    expect(describeUnnamed('spacesuit')).toBe('A piece in your closet');
  });
});
