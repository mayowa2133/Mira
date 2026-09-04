/**
 * Duplicate detection, as the closet uses it
 * (`docs/06-ai/duplicate-detection.md`).
 *
 * The scoring itself lives in `@mira/duplicates` and knows nothing about a
 * database. This is the part that decides which garments are worth scoring,
 * remembers what the user already said, and turns a decision into rows.
 */
import {
  scoreAgainst,
  type DuplicateBand,
  type DuplicateSignal,
  type DuplicateSubject,
} from '@mira/duplicates';
import { SAME_IMAGE_MAX_DISTANCE, hammingDistance } from '@mira/imaging';
import { subjectFromRow } from './duplicate-subject.js';
import type { UserScope } from '../../db/scope.js';
import type { DuplicateRepository } from './duplicate-repository.js';
import type { GarmentRow } from './repository.js';
import type { SerializedGarment } from './service.js';

/** A candidate, ready for the sheet in §4. */
export type DuplicateCandidateView = {
  /** Named as `openapi.yaml` has named it since before this was built. */
  existing_garment: SerializedGarment;
  score: number;
  band: DuplicateBand;
  signals: DuplicateSignal[];
  summary: string;
};

/**
 * Bands that stop a save and ask (§3).
 *
 * `note` deliberately is not one of them: below 0.70 Mira does not interrupt
 * mid-capture, it raises it later where browsing is the point (Phase 9.2).
 */
export function interrupts(band: DuplicateBand): boolean {
  return band === 'ask' || band === 'ask_softly';
}

/**
 * A previous answer that settles this pair for good.
 *
 * `owns_two` and `different` are both the user saying "yes, two garments" —
 * asking again is asking a question they have answered. `same_item` is not
 * here because that pair no longer exists as two garments.
 */
const SETTLED = new Set(['owns_two', 'different']);

export class DuplicateService {
  constructor(
    private readonly repo: DuplicateRepository,
    private readonly serialize: (
      scope: UserScope,
      rows: GarmentRow[],
    ) => Promise<SerializedGarment[]>,
  ) {}

  /**
   * What this garment might already be.
   *
   * Returns everything from `note` upwards, ordered strongest first, so one
   * call serves both the sheet before a save and the "you might already own
   * this" surface later. The caller decides which bands interrupt.
   */
  async check(scope: UserScope, subject: DuplicateSubject): Promise<DuplicateCandidateView[]> {
    // Image hashes come first because they identify candidates the SQL
    // predicate cannot: a re-uploaded photograph of a garment with no brand,
    // no barcode and no name has nothing else to match on.
    const hashes = await this.repo.imageHashes(scope);
    const imageMatchIds = subject.imageHashes.length > 0 ? nearMatches(subject, hashes) : [];

    const rows = await this.repo.candidates(scope, subject, imageMatchIds);
    if (rows.length === 0) return [];

    const settled = subject.id ? await this.settledIds(scope, subject.id) : new Set<string>();

    const candidates = rows
      .filter((row) => !settled.has(row.id))
      .map((row) => subjectFromRow(row, hashes.get(row.id) ?? []));

    const scored = scoreAgainst(subject, candidates);
    if (scored.length === 0) return [];

    const byId = new Map(rows.map((row) => [row.id, row]));
    const serialized = await this.serialize(
      scope,
      scored.map((match) => byId.get(match.garmentId)).filter((row): row is GarmentRow => !!row),
    );
    const views = new Map(serialized.map((garment) => [garment.id, garment]));

    return scored.flatMap((match) => {
      const garment = views.get(match.garmentId);
      if (!garment) return [];
      return [
        {
          existing_garment: garment,
          score: match.score,
          band: match.band,
          signals: match.signals,
          summary: match.summary,
        },
      ];
    });
  }

  private async settledIds(scope: UserScope, garmentId: string): Promise<Set<string>> {
    const resolved = await this.repo.resolvedAgainst(scope, garmentId);
    return new Set(
      resolved.filter((pair) => SETTLED.has(pair.relation)).map((pair) => pair.garmentId),
    );
  }

  /** Write the user's answer, negatives included (§4). */
  async record(
    scope: UserScope,
    input: {
      garmentA: string;
      garmentB: string;
      relation: 'same_item' | 'owns_two' | 'different';
      score: number | null;
    },
  ): Promise<void> {
    await this.repo.record(scope, { ...input, resolvedBy: 'user' });
  }
}

/** Garments whose photographs are near-identical to the subject's. */
function nearMatches(subject: DuplicateSubject, hashes: Map<string, string[]>): string[] {
  const matches: string[] = [];
  for (const [garmentId, garmentHashes] of hashes) {
    if (garmentId === subject.id) continue;
    const close = garmentHashes.some((hash) =>
      subject.imageHashes.some((own) => {
        const distance = hammingDistance(own, hash);
        return distance !== null && distance <= SAME_IMAGE_MAX_DISTANCE;
      }),
    );
    if (close) matches.push(garmentId);
  }
  return matches;
}
