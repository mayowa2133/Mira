/**
 * Style preference storage.
 *
 * One row per user, so every write is an upsert — there is no "create
 * preferences" step, and a user who has never opened the screen is not
 * different from one who cleared everything.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import { EMPTY_PREFERENCES, type StylePreferences } from './service.js';

export class PreferencesRepository {
  constructor(private readonly db: Queryable) {}

  async get(scope: UserScope): Promise<StylePreferences> {
    const { rows } = await scopedQuery<StylePreferences>(
      this.db,
      scope,
      `select preferred_styles, avoided_styles, preferred_colors, avoided_colors
         from style_preferences where user_id = $1`,
      [scope.userId],
    );
    // Absent is the same as empty. Returning null would make every caller
    // handle a state that means nothing different.
    return rows[0] ?? EMPTY_PREFERENCES;
  }

  async put(scope: UserScope, input: StylePreferences): Promise<StylePreferences> {
    const { rows } = await scopedQuery<StylePreferences>(
      this.db,
      scope,
      `insert into style_preferences
         (user_id, preferred_styles, avoided_styles, preferred_colors, avoided_colors)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set
         preferred_styles = excluded.preferred_styles,
         avoided_styles   = excluded.avoided_styles,
         preferred_colors = excluded.preferred_colors,
         avoided_colors   = excluded.avoided_colors,
         updated_at       = now()
       returning preferred_styles, avoided_styles, preferred_colors, avoided_colors`,
      [
        scope.userId,
        input.preferred_styles,
        input.avoided_styles,
        input.preferred_colors,
        input.avoided_colors,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error('style preferences upsert returned no row');
    return row;
  }
}
