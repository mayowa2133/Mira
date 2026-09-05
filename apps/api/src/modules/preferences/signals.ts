/**
 * Feedback signals (task 11.2).
 *
 * 11.2 names four: saves, wears, swaps, regenerations. They live in three
 * different places on purpose:
 *
 * | Signal        | Where it lives          | Why |
 * | ------------- | ----------------------- | --- |
 * | save          | `outfits.favorite`      | already recorded |
 * | wear          | `wear_events`           | already recorded |
 * | swap          | `feedback_events`       | nowhere else to live |
 * | regeneration  | `feedback_events`       | nowhere else to live |
 *
 * Copying the first two into a feedback table would state the same fact twice,
 * and the copy would eventually disagree with the original. So this module
 * READS them where they are and returns one shape — which is what 11.3 will
 * consume, and which is the only place that needs to know they are stored
 * differently.
 *
 * Nothing emits a swap or a regeneration yet: both come from the stylist
 * (Phase 7). The counts are honest about that rather than reporting zero as
 * though nothing had happened.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';

export type SignalCounts = {
  saves: number;
  wears: number;
  swaps: number;
  regenerations: number;
  /**
   * Signals nothing can emit yet, so a zero here means "not built" rather than
   * "never happened". 11.3 must not learn from the difference.
   */
  unavailable: string[];
};

export class SignalRepository {
  constructor(private readonly db: Queryable) {}

  async counts(scope: UserScope): Promise<SignalCounts> {
    const [saves, wears, feedback] = await Promise.all([
      scopedQuery<{ n: string }>(
        this.db,
        scope,
        `select count(*) as n from outfits
          where user_id = $1 and favorite and deleted_at is null`,
        [scope.userId],
      ),
      scopedQuery<{ n: string }>(
        this.db,
        scope,
        // Garment wears only. An outfit wear writes a row per garment as well,
        // and counting both would double every look someone wore.
        `select count(*) as n from wear_events where user_id = $1 and garment_id is not null`,
        [scope.userId],
      ),
      scopedQuery<{ kind: string; n: string }>(
        this.db,
        scope,
        `select kind, count(*) as n from feedback_events where user_id = $1 group by kind`,
        [scope.userId],
      ),
    ]);

    const byKind = new Map(feedback.rows.map((r) => [r.kind, Number(r.n)]));

    return {
      saves: Number(saves.rows[0]?.n ?? 0),
      wears: Number(wears.rows[0]?.n ?? 0),
      swaps: byKind.get('swap') ?? 0,
      regenerations: byKind.get('regeneration') ?? 0,
      // Both are Phase 7's to emit.
      unavailable: ['swap', 'regeneration'],
    };
  }

  /**
   * Record a swap or a regeneration.
   *
   * Called by the stylist when it exists. Present now so the signal has a
   * schema and a writer before there is something to write — a signal with
   * neither is a signal nobody records.
   */
  async record(
    scope: UserScope,
    input: {
      kind: 'swap' | 'regeneration';
      entityType: string | null;
      entityId: string | null;
      replacedId?: string | null;
      replacementId?: string | null;
    },
  ): Promise<void> {
    await scopedQuery(
      this.db,
      scope,
      `insert into feedback_events
         (user_id, kind, entity_type, entity_id, replaced_id, replacement_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        scope.userId,
        input.kind,
        input.entityType,
        input.entityId,
        input.replacedId ?? null,
        input.replacementId ?? null,
      ],
    );
  }
}
