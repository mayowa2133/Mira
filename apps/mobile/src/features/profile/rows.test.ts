import { describe, expect, it } from 'vitest';
import { DELETE_ACCOUNT_CONFIRMATION, PRIVACY_ACTIONS, PROFILE_ROWS } from './rows';

describe('the You screen', () => {
  it('offers every row §28 lists', () => {
    expect(PROFILE_ROWS.map((r) => r.label)).toEqual([
      'Style preferences',
      'Body profile',
      'Connected accounts',
      'Privacy & data',
      'Notifications',
      'Appearance',
      'Help',
      'About Mira',
    ]);
  });

  it('never leaves a row that goes nowhere and says nothing', () => {
    // CAP-4: degrade rather than dead-end. A settings row that opens nothing
    // and explains nothing reads as broken.
    for (const row of PROFILE_ROWS) {
      if (row.to === null && row.status === null) {
        expect(['help', 'about']).toContain(row.key);
      }
    }
  });

  it('keeps Privacy & data reachable', () => {
    expect(PROFILE_ROWS.find((r) => r.key === 'privacy')?.to).toBe('/profile/privacy');
  });
});

describe('Privacy & data', () => {
  it('lists everything privacy.md promises, including what is not built', () => {
    // Omitting an unkeepable promise would hide the gap between the policy and
    // the app. Labelling it shows it.
    expect(PRIVACY_ACTIONS.map((a) => a.key)).toEqual([
      'export',
      'body-images',
      'try-ons',
      'account',
    ]);
  });

  it('says why anything unavailable is unavailable', () => {
    for (const action of PRIVACY_ACTIONS) {
      if (!action.available) expect(action.blockedBy).toBeTruthy();
    }
  });

  it('can delete an account, because that is built', () => {
    expect(PRIVACY_ACTIONS.find((a) => a.key === 'account')?.available).toBe(true);
  });

  it('states exactly what deletion removes, and that it cannot be undone', () => {
    // auth-contract.md: "confirmation in the client, stating exactly what is
    // removed". A vague "all your data" leaves someone guessing.
    const { body } = DELETE_ACCOUNT_CONFIRMATION;
    for (const thing of ['closet', 'outfits', 'wear history', 'photographs', 'preferences']) {
      expect(body).toContain(thing);
    }
    expect(body).toContain('cannot be undone');
  });

  it('does not put the destructive word on the escape route', () => {
    expect(DELETE_ACCOUNT_CONFIRMATION.cancel.toLowerCase()).not.toContain('delete');
  });
});
