import { describe, expect, it } from 'vitest';
import {
  ASK_SOFTLY_THRESHOLD,
  ASK_THRESHOLD,
  NOTE_THRESHOLD,
  bandFor,
  bucketKeys,
  combine,
  compare,
  diceSimilarity,
  findPairs,
  nameTokens,
  normalizeProductUrl,
  sameBrand,
  scoreAgainst,
  signalsBetween,
  summarize,
  tokenize,
  type DuplicateSubject,
} from './index.js';

function garment(overrides: Partial<DuplicateSubject> = {}): DuplicateSubject {
  return {
    name: null,
    brandId: null,
    brandRaw: null,
    category: 'tops',
    primaryColor: null,
    sizeNormalized: null,
    sizeRaw: null,
    barcode: null,
    sku: null,
    retailer: null,
    productUrl: null,
    purchaseDate: null,
    sourceType: 'manual',
    sourceReference: null,
    imageHashes: [],
    ...overrides,
  };
}

describe('name comparison', () => {
  it('treats the spec’s own example as the same name', () => {
    // duplicate-detection.md §2: "Contour Bodysuit" vs "Contour Crew Bodysuit".
    const similarity = diceSimilarity(
      tokenize('Contour Bodysuit'),
      tokenize('Contour Crew Bodysuit'),
    );
    expect(similarity).toBeCloseTo(0.8, 5);
  });

  it('keeps one different word apart', () => {
    // One character apart, a genuinely different garment.
    expect(diceSimilarity(tokenize('black midi dress'), tokenize('black mini dress'))).toBeCloseTo(
      2 / 3,
      5,
    );
  });

  it('does not let a short name be swallowed by a longer one', () => {
    expect(diceSimilarity(tokenize('dress'), tokenize('black dress'))).toBeCloseTo(2 / 3, 5);
  });

  it('strips the brand out of a name that repeats it', () => {
    expect(nameTokens('Aritzia Contour Bodysuit', 'Aritzia')).toEqual(['contour', 'bodysuit']);
  });

  it('keeps the name when it is only the brand', () => {
    // Stripping would leave nothing, and an empty set scores 0 — which reads as
    // "different" rather than "unknown".
    expect(nameTokens('Aritzia', 'Aritzia')).toEqual(['aritzia']);
  });
});

describe('brand identity', () => {
  it('matches on brand id', () => {
    expect(sameBrand(garment({ brandId: 'b1' }), garment({ brandId: 'b1' }))).toBe(true);
  });

  it('matches unrecognized brands on their raw text', () => {
    expect(sameBrand(garment({ brandRaw: 'A.P.C.' }), garment({ brandRaw: 'apc' }))).toBe(true);
  });

  it('does NOT treat two unknown brands as the same brand', () => {
    // The most common shape in a real closet is "no brand recorded". If that
    // counted as a match, every unbranded top would be a duplicate of every
    // other one.
    expect(sameBrand(garment(), garment())).toBe(false);
  });
});

describe('product URL normalization', () => {
  it('ignores tracking parameters and cosmetic differences', () => {
    expect(normalizeProductUrl('https://WWW.Shop.com/p/dress-123/?utm_source=ig&gclid=x')).toBe(
      normalizeProductUrl('http://shop.com/p/dress-123'),
    );
  });

  it('keeps parameters that identify the variant', () => {
    // Plenty of retailers put the actual garment in a query parameter; dropping
    // them all would merge a size 6 with a size 12.
    expect(normalizeProductUrl('https://shop.com/p/dress?variant=6')).not.toBe(
      normalizeProductUrl('https://shop.com/p/dress?variant=12'),
    );
  });

  it('returns null for something that is not a URL', () => {
    expect(normalizeProductUrl('dress-123')).toBeNull();
  });

  it('does not make two unparseable values look decisive', () => {
    const a = garment({ productUrl: 'not a url' });
    const b = garment({ productUrl: 'not a url' });
    expect(signalsBetween(a, b)).not.toContain('product_url');
  });
});

describe('decisive signals', () => {
  it('short-circuits on a barcode, however it was transcribed', () => {
    const match = compare(
      garment({ barcode: '0 12345-67890 5' }),
      garment({ barcode: '012345678905' }),
    );
    expect(match.signals).toContain('barcode');
    expect(match.band).toBe('ask');
  });

  it('needs the retailer as well as the SKU', () => {
    // A SKU is only unique within the retailer that issued it.
    const withoutRetailer = signalsBetween(garment({ sku: 'AB-1' }), garment({ sku: 'ab1' }));
    expect(withoutRetailer).not.toContain('sku_retailer');

    const withRetailer = signalsBetween(
      garment({ sku: 'AB-1', retailer: 'SSENSE' }),
      garment({ sku: 'ab1', retailer: 'ssense' }),
    );
    expect(withRetailer).toContain('sku_retailer');
  });

  it('compares order lines only on sources that have orders', () => {
    // Two camera captures sharing a local reference are not one purchase.
    expect(
      signalsBetween(
        garment({ sourceType: 'camera', sourceReference: 'IMG_0001' }),
        garment({ sourceType: 'camera', sourceReference: 'IMG_0001' }),
      ),
    ).not.toContain('order_line');

    expect(
      signalsBetween(
        garment({ sourceType: 'email', sourceReference: 'order-99:line-2' }),
        garment({ sourceType: 'email', sourceReference: 'order-99:line-2' }),
      ),
    ).toContain('order_line');
  });
});

describe('scoring bands', () => {
  const SAME_PHOTO = 'ffee00112233aabb';
  const OTHER_PHOTO = '0011ffee5544ccdd';

  it('asks softly on one strong signal, and never more than that', () => {
    const score = combine(['image_hash']);
    expect(score).toBeGreaterThanOrEqual(ASK_SOFTLY_THRESHOLD);
    expect(score).toBeLessThan(ASK_THRESHOLD);
    expect(bandFor(score)).toBe('ask_softly');
  });

  it('asks outright when two strong signals agree', () => {
    expect(bandFor(combine(['image_hash', 'brand_name']))).toBe('ask');
  });

  it('does NOT interrupt on same brand, colour and size alone', () => {
    // duplicate-detection.md §7 calls this the hard negative: same brand, same
    // colour, different cut is exactly where a false merge is most damaging.
    const score = combine(['category_color_size_brand']);
    expect(score).toBeGreaterThanOrEqual(NOTE_THRESHOLD);
    expect(score).toBeLessThan(ASK_SOFTLY_THRESHOLD);
    expect(bandFor(score)).toBe('note');
  });

  it('never surfaces anything on purchase dates alone', () => {
    expect(bandFor(combine(['purchase_window']))).toBe('ignore');
  });

  it('lets a weak signal support without deciding', () => {
    const alone = combine(['category_color_size_brand']);
    const supported = combine(['category_color_size_brand', 'purchase_window']);
    expect(supported).toBeGreaterThan(alone);
    expect(bandFor(supported)).toBe('note');
  });

  it('only ever raises the score as evidence accumulates', () => {
    // Absent evidence is not evidence of difference.
    let previous = 0;
    const signals = ['purchase_window', 'category_color_size_brand', 'brand_name'] as const;
    for (let i = 1; i <= signals.length; i += 1) {
      const score = combine(signals.slice(0, i));
      expect(score).toBeGreaterThan(previous);
      previous = score;
    }
  });

  it('shows the sheet for the spec’s worked example, worded softly', () => {
    // "Aritzia Contour Bodysuit — Black" against "Aritzia Contour Crew
    // Bodysuit — Black", the pair §4 puts in the sheet.
    //
    // It lands in `ask_softly`, not `ask`, and that is the point: both bands
    // show the sheet and differ only in wording. A very similar name plus the
    // same colour and size is precisely §7's hard case — "same brand, same
    // colour, different cut" — where a confident question would nudge someone
    // into merging two garments they own separately.
    const existing = garment({
      id: 'g1',
      name: 'Contour Bodysuit',
      brandRaw: 'Aritzia',
      primaryColor: 'black',
      sizeRaw: 'S',
    });
    const incoming = garment({
      name: 'Aritzia Contour Crew Bodysuit',
      brandRaw: 'Aritzia',
      primaryColor: 'black',
      sizeRaw: 's',
    });

    const match = compare(incoming, existing);
    expect(match.signals).toContain('brand_name');
    expect(match.signals).toContain('category_color_size_brand');
    expect(match.band).toBe('ask_softly');
    expect(match.summary).toBe('Same brand and a very similar name · Same brand, colour and size');
  });

  it('recognizes a re-uploaded photograph', () => {
    const match = compare(
      garment({ imageHashes: [SAME_PHOTO] }),
      garment({ id: 'g1', imageHashes: [OTHER_PHOTO, SAME_PHOTO] }),
    );
    expect(match.signals).toContain('image_hash');
  });

  it('does not fire on unrelated photographs', () => {
    expect(
      signalsBetween(
        garment({ imageHashes: [SAME_PHOTO] }),
        garment({ imageHashes: [OTHER_PHOTO] }),
      ),
    ).not.toContain('image_hash');
  });
});

describe('summaries', () => {
  it('says what a person would say, not what the signal is called', () => {
    expect(summarize(['brand_name'])).toBe('Same brand and a very similar name');
  });

  it('lets a decisive signal stand alone', () => {
    expect(summarize(['purchase_window', 'barcode', 'brand_name'])).toBe('The same barcode');
  });

  it('leads with the strongest reason', () => {
    expect(summarize(['purchase_window', 'brand_name'])).toBe(
      'Same brand and a very similar name · Bought within a few days of each other',
    );
  });

  it('is empty when nothing fired', () => {
    expect(summarize([])).toBe('');
  });
});

describe('scoring a closet', () => {
  const incoming = garment({
    name: 'Contour Bodysuit',
    brandRaw: 'Aritzia',
    primaryColor: 'black',
    sizeRaw: 'S',
  });

  it('returns the strongest match first', () => {
    const weak = garment({
      id: 'weak',
      brandRaw: 'Aritzia',
      primaryColor: 'black',
      sizeRaw: 'S',
    });
    const strong = garment({
      id: 'strong',
      name: 'Contour Crew Bodysuit',
      brandRaw: 'Aritzia',
      primaryColor: 'black',
      sizeRaw: 'S',
    });

    const scored = scoreAgainst(incoming, [weak, strong]);
    expect(scored.map((c) => c.garmentId)).toEqual(['strong', 'weak']);
  });

  it('skips a candidate it could not then show the user', () => {
    // A match with no garment behind it would open a sheet with one picture.
    expect(
      scoreAgainst(incoming, [garment({ name: 'Contour Bodysuit', brandRaw: 'Aritzia' })]),
    ).toEqual([]);
  });

  it('never matches a garment with itself', () => {
    const self = { ...incoming, id: 'g1' };
    expect(scoreAgainst(self, [self])).toEqual([]);
  });

  it('drops everything below the noticing threshold', () => {
    const unrelated = garment({ id: 'other', name: 'Wool Coat', brandRaw: 'Toteme' });
    expect(scoreAgainst(incoming, [unrelated])).toEqual([]);
  });
});

describe('finding pairs across a closet', () => {
  it('surfaces a pair that would only have been noted, never asked about', () => {
    const a = garment({ id: 'a', brandRaw: 'Aritzia', primaryColor: 'black', sizeRaw: 'S' });
    const b = garment({ id: 'b', brandRaw: 'Aritzia', primaryColor: 'black', sizeRaw: 'S' });

    const [pair] = findPairs([a, b]);
    expect(pair?.a).toBe('a');
    expect(pair?.b).toBe('b');
    expect(pair?.band).toBe('note');
  });

  it('scores a pair once however many things it has in common', () => {
    const shared = {
      brandRaw: 'Aritzia',
      primaryColor: 'black',
      sizeRaw: 'S',
      barcode: '111',
      productUrl: 'https://shop.com/p/1',
    };
    expect(
      findPairs([garment({ id: 'a', ...shared }), garment({ id: 'b', ...shared })]),
    ).toHaveLength(1);
  });

  it('leaves unrelated garments alone', () => {
    expect(
      findPairs([
        garment({ id: 'a', brandRaw: 'Aritzia', name: 'Bodysuit' }),
        garment({ id: 'b', brandRaw: 'Toteme', name: 'Wool Coat' }),
      ]),
    ).toEqual([]);
  });

  it('pairs up near-identical photographs, which no key could', () => {
    // A hash near-match is not an equality, so it cannot be a bucket key.
    const a = garment({ id: 'a', imageHashes: ['ffee00112233aabb'] });
    const b = garment({ id: 'b', imageHashes: ['ffee00112233aabf'] });

    expect(findPairs([a, b])).toEqual([]);
    expect(findPairs([a, b], { imagePairs: [['a', 'b']] })).toHaveLength(1);
  });

  it('never loses a pair the scorer would have found', () => {
    // The property that makes bucketing safe: if two garments share any signal
    // that can surface on its own, they share a bucket. A bucket that quietly
    // missed a signal would cost recall with nothing failing.
    //
    // Written as a cross-product rather than one field at a time. The first
    // version varied a single field per subject, which meant the compound
    // signals — brand + name, SKU + retailer, category + colour + size + brand
    // — could never fire on either side. It searched 3 pairs and covered 2 of
    // the 6 signals, and passed. Hence `fired` below: a search that stops
    // finding things must fail, not go quiet.
    const AXES = {
      brandRaw: [null, 'Aritzia', 'Toteme'],
      name: [null, 'Contour Bodysuit', 'Contour Crew Bodysuit'],
      primaryColor: [null, 'black'],
      sizeRaw: [null, 'S'],
      barcode: [null, '111'],
      sku: [null, 'AB1'],
      retailer: [null, 'SSENSE'],
      productUrl: [null, 'https://shop.com/p/1'],
      sourceType: ['manual', 'email'],
      sourceReference: [null, 'order-1'],
    } as const;

    // One subject per combination is 3·3·2·2·2·2·2·2·2·2 = 2304, and squaring
    // that is too many. Sampling deterministically covers every value of every
    // axis many times over without the run time.
    const subjects: DuplicateSubject[] = [];
    let seed = 7;
    const pick = <T>(values: readonly T[]): T => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      // The HIGH bits. A linear congruential generator with a power-of-two
      // modulus has a period of 2 in its lowest bit, so `seed % 2` alternates
      // — which made every two-valued axis perfectly correlated and stopped
      // four of the six signals from ever firing.
      return values[Math.floor(seed / 65536) % values.length] as T;
    };

    for (let i = 0; i < 220; i += 1) {
      subjects.push(
        garment({
          id: `g${i}`,
          brandRaw: pick(AXES.brandRaw),
          name: pick(AXES.name),
          primaryColor: pick(AXES.primaryColor),
          sizeRaw: pick(AXES.sizeRaw),
          barcode: pick(AXES.barcode),
          sku: pick(AXES.sku),
          retailer: pick(AXES.retailer),
          productUrl: pick(AXES.productUrl),
          sourceType: pick(AXES.sourceType),
          sourceReference: pick(AXES.sourceReference),
        }),
      );
    }

    const fired = new Set<string>();
    for (const a of subjects) {
      for (const b of subjects) {
        if (a.id === b.id) continue;

        const signals = signalsBetween(a, b).filter(
          (signal) => signal !== 'purchase_window' && signal !== 'image_hash',
        );
        if (signals.length === 0) continue;
        for (const signal of signals) fired.add(signal);

        const shared = bucketKeys(a).some((key) => bucketKeys(b).includes(key));
        expect(shared, `${signals.join(',')} fired but no bucket was shared`).toBe(true);
      }
    }

    // Every signal a bucket is supposed to cover was actually exercised.
    expect([...fired].sort()).toEqual([
      'barcode',
      'brand_name',
      'category_color_size_brand',
      'order_line',
      'product_url',
      'sku_retailer',
    ]);
  });
});

describe('evidence against a pair', () => {
  const staple = (color: string, size = 'S') =>
    garment({ brandRaw: 'Everlane', name: 'Cotton Crew Tee', primaryColor: color, sizeRaw: size });

  it('stops asking about a staple owned in two colours', () => {
    // Same brand, same name, different colour. Before conflicts counted, this
    // scored 0.72 and interrupted the save — and someone who owns a tee in
    // three colours would have been asked about it every time.
    const match = compare(staple('black'), { ...staple('white'), id: 'g2' });

    expect(match.signals).toContain('brand_name');
    expect(match.conflicts).toEqual(['primary_color']);
    expect(match.band).toBe('note');
  });

  it('still raises it while browsing rather than dropping it', () => {
    // `note` is not silence: §3 sends this band to "you might already own
    // this". Two colours of one tee is worth mentioning, never worth asking.
    expect(compare(staple('black'), { ...staple('white'), id: 'g2' }).score).toBeGreaterThanOrEqual(
      0.5,
    );
  });

  it('says nothing at all when colour AND size both disagree', () => {
    const match = compare(staple('black', 'S'), { ...staple('white', 'L'), id: 'g2' });
    expect(match.conflicts).toEqual(['primary_color', 'size']);
    expect(match.band).toBe('ignore');
  });

  it('does not let a conflict overturn a barcode', () => {
    // The same barcode with two recorded colours means one path misread the
    // colour, not that there are two garments.
    const match = compare(
      garment({ barcode: '111', primaryColor: 'black' }),
      garment({ id: 'g2', barcode: '111', primaryColor: 'grey' }),
    );
    expect(match.conflicts).toEqual(['primary_color']);
    expect(match.band).toBe('ask');
  });

  it('treats an unknown colour as unknown, not as a difference', () => {
    // Absent evidence is still not evidence of difference.
    const match = compare(
      garment({ brandRaw: 'Aritzia', name: 'Contour Bodysuit', primaryColor: 'black' }),
      garment({ id: 'g2', brandRaw: 'Aritzia', name: 'Contour Bodysuit' }),
    );
    expect(match.conflicts).toEqual([]);
    expect(match.band).toBe('ask_softly');
  });

  it('does not read a size written two ways as a conflict', () => {
    const match = compare(
      garment({ brandRaw: 'Aritzia', name: 'Contour Bodysuit', sizeRaw: 'S' }),
      garment({ id: 'g2', brandRaw: 'Aritzia', name: 'Contour Bodysuit', sizeRaw: 'Small' }),
    );
    expect(match.conflicts).toEqual([]);
  });

  it('does not treat a category disagreement as a conflict', () => {
    // The same jumpsuit is legitimately filed as `tops` on one path and `sets`
    // on another; that is a taxonomy artefact as often as a real difference.
    const match = compare(
      garment({ brandRaw: 'Aritzia', name: 'Babaton Jumpsuit', category: 'tops' }),
      garment({ id: 'g2', brandRaw: 'Aritzia', name: 'Babaton Jumpsuit', category: 'sets' }),
    );
    expect(match.conflicts).toEqual([]);
  });

  it('names the difference in the summary', () => {
    expect(compare(staple('black'), { ...staple('white'), id: 'g2' }).summary).toBe(
      'Same brand and a very similar name, in a different colour',
    );
  });

  it('matches a plural against its singular', () => {
    const match = compare(
      garment({ brandRaw: 'Lululemon', name: 'Align Legging' }),
      garment({ id: 'g2', brandRaw: 'Lululemon', name: 'Align Leggings' }),
    );
    expect(match.signals).toContain('brand_name');
  });

  it('does not stem a word into a different one', () => {
    // "dress" must survive; the guard is the `ss` ending.
    expect(nameTokens('Slip Dress', null)).toEqual(['slip', 'dress']);
  });
});
