/**
 * Preference routes (`docs/05-api/api-contract.md` — Preferences).
 *
 * PUT rather than PATCH, as the contract specifies: preferences are small and
 * wholly replaceable, and a partial update cannot be checked for contradiction
 * against the fields it did not send.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { validationFailed } from '../../http/errors.js';
import { getPool } from '../../db/pool.js';
import { PreferencesRepository } from './repository.js';
import { validatePreferences } from './service.js';

const list = z.array(z.string()).default([]);

const StylePreferencesSchema = z.object({
  preferred_styles: list,
  avoided_styles: list,
  preferred_colors: list,
  avoided_colors: list,
});

export async function registerPreferenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/preferences/style', { onRequest: requireAuth }, async (request) => {
    return new PreferencesRepository(getPool()).get(requireScope(request));
  });

  app.put('/preferences/style', { onRequest: requireAuth }, async (request) => {
    const parsed = StylePreferencesSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          issue: issue.message,
        })),
      );
    }

    const valid = validatePreferences(parsed.data);
    return new PreferencesRepository(getPool()).put(requireScope(request), valid);
  });
}
