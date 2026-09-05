import { describe, expect, it } from 'vitest';
import { BODY_PROFILE_COPY, FORBIDDEN_FIT_CLAIMS, PHOTO_SLOTS } from './copy';

describe('body profile copy (TRY-2)', () => {
  const allCopy = Object.values(BODY_PROFILE_COPY).join(' ').toLowerCase();

  it('never implies a garment will fit', () => {
    // TRY-2. Try-on shows how a piece LOOKS; a sentence promising fit is the
    // one thing this surface must not say, and it is easy to loosen during a
    // redesign without noticing.
    for (const claim of FORBIDDEN_FIT_CLAIMS) {
      expect(allCopy).not.toContain(claim);
    }
  });

  it('says outright what try-on cannot do', () => {
    expect(BODY_PROFILE_COPY.limitation).toContain("can't promise how it fits");
  });

  it('says the photos are private and deletable, in the same breath', () => {
    // Someone deciding whether to photograph their body needs both facts at
    // the moment of deciding, not in a settings screen afterwards.
    expect(BODY_PROFILE_COPY.privacy).toContain('private');
    expect(BODY_PROFILE_COPY.privacy).toContain('delete');
  });

  it('requires only the front photo', () => {
    expect(PHOTO_SLOTS.filter((s) => s.required).map((s) => s.kind)).toEqual(['front']);
  });
});
