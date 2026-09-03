/**
 * Seed runner.
 *
 * Seeds exist so every environment can demonstrate a believable closet
 * (`docs/04-data/seed-data.md`). Production data is NEVER copied into a lower
 * environment; seeds are synthetic.
 *
 * Seeds are idempotent: running twice produces the same database, not double
 * the rows.
 *
 * Phase 0 supports the `minimal` set (a seed user and their closet). The
 * `realistic`, `large` and `edge` sets arrive with garments in Phase 1.
 *
 *   npm run db:seed -- --set=minimal
 */
import { getPool, closePool } from './pool.js';
import {
  UNMATCHED_BRANDS,
  buildEdgeCases,
  buildRealisticCloset,
  type SeedGarment,
} from './seed-garments.js';
import { categoryRowId } from './sync-taxonomy.js';
import { encodeBlurhash, imageHash, renderGarmentImage } from './seed-images.js';
import { buildStorageKey, createLocalStorage } from '../lib/storage.js';
import { resolveStorageRoot } from '../lib/storage-root.js';
import { COLOR_SWATCHES, type Color } from '@mira/taxonomy';
import { createLogger } from '../lib/logger.js';
import { isEntrypoint } from '../lib/entrypoint.js';
import { env } from '../config/env.js';

export const SEED_SETS = ['minimal', 'realistic', 'large', 'edge'] as const;
export type SeedSet = (typeof SEED_SETS)[number];

/** Seed users use @mira.local addresses and can never receive real email. */
// Each set gets its own address: `users.email` is unique, and the upsert keys
// on auth_provider_id, so two sets sharing an email collide on a constraint
// neither of them keys against.
const SEED_USERS: Record<SeedSet, { authProviderId: string; email: string; name: string }[]> = {
  minimal: [{ authProviderId: 'seed-minimal-1', email: 'maya+minimal@mira.local', name: 'Maya' }],
  realistic: [
    { authProviderId: 'seed-realistic-1', email: 'maya+realistic@mira.local', name: 'Maya' },
  ],
  large: [{ authProviderId: 'seed-large-1', email: 'perf+large@mira.local', name: 'Perf' }],
  edge: [
    { authProviderId: 'seed-edge-empty', email: 'empty+edge@mira.local', name: 'Empty closet' },
    { authProviderId: 'seed-edge-single', email: 'single+edge@mira.local', name: 'One piece' },
  ],
};

export function parseSeedSet(argv: readonly string[]): SeedSet {
  const arg = argv.find((a) => a.startsWith('--set='));
  const value = arg?.slice('--set='.length) ?? 'minimal';
  if (!(SEED_SETS as readonly string[]).includes(value)) {
    throw new Error(`Unknown seed set "${value}". Expected one of: ${SEED_SETS.join(', ')}`);
  }
  return value as SeedSet;
}

export async function seed(set: SeedSet, logger = createLogger({ level: env().LOG_LEVEL })) {
  const config = env();
  if (config.MIRA_ENV === 'production') {
    throw new Error('Refusing to seed the production environment (docs/04-data/seed-data.md).');
  }

  const pool = getPool();
  let users = 0;
  let closets = 0;

  for (const user of SEED_USERS[set]) {
    // Idempotent: re-running updates rather than inserting a duplicate.
    const { rows } = await pool.query<{ id: string }>(
      `insert into users (auth_provider_id, email, display_name, onboarding_state)
       values ($1, $2, $3, 'completed')
       on conflict (auth_provider_id)
       do update set email = excluded.email, display_name = excluded.display_name
       returning id`,
      [user.authProviderId, user.email, user.name],
    );
    const userId = rows[0]?.id;
    if (!userId) throw new Error(`failed to seed user ${user.authProviderId}`);
    users += 1;

    const closet = await pool.query(
      `insert into closets (user_id, name, is_default)
       values ($1, 'My closet', true)
       on conflict (user_id) where is_default do nothing`,
      [userId],
    );
    closets += closet.rowCount ?? 0;
  }

  // Garments, for the sets that have them.
  let garments = 0;
  if (set !== 'minimal') {
    const primary = SEED_USERS[set][0];
    if (!primary) throw new Error(`seed set ${set} declares no users`);

    const { rows: userRows } = await pool.query<{ id: string }>(
      'select id from users where auth_provider_id = $1',
      [primary.authProviderId],
    );
    const userId = userRows[0]?.id;
    if (!userId) throw new Error('seed user missing after upsert');

    const { rows: closetRows } = await pool.query<{ id: string }>(
      'select id from closets where user_id = $1 and is_default',
      [userId],
    );
    const closetId = closetRows[0]?.id;
    if (!closetId) throw new Error('seed closet missing after upsert');

    const items =
      set === 'edge'
        ? buildEdgeCases()
        : set === 'large'
          ? [
              ...buildRealisticCloset(1),
              ...buildRealisticCloset(2),
              ...buildRealisticCloset(3),
              ...buildRealisticCloset(4),
              ...buildRealisticCloset(5),
              ...buildRealisticCloset(6),
            ]
          : buildRealisticCloset();

    garments = await insertGarments(pool, userId, closetId, items, logger);
  }

  logger.info('seed complete', { set, users, closets, garments });
  return { users, closets, garments };
}

/**
 * Insert seed garments.
 *
 * Idempotent by construction: the whole seeded closet is cleared first, so
 * re-running produces the same closet rather than doubling it
 * (`docs/04-data/seed-data.md` — Rules).
 */
async function insertGarments(
  pool: ReturnType<typeof getPool>,
  userId: string,
  closetId: string,
  items: SeedGarment[],
  logger: ReturnType<typeof createLogger>,
): Promise<number> {
  // Deleting the garments cascades their images away too, so a re-seed does not
  // leave orphaned rows pointing at files it is about to overwrite.
  await pool.query('delete from garments where user_id = $1', [userId]);

  const config = env();
  const storage = createLocalStorage({
    root: resolveStorageRoot(config.STORAGE_LOCAL_ROOT),
    secret: config.STORAGE_SIGNING_SECRET,
    publicBaseUrl: `${config.API_BASE_URL}/v1`,
  });

  // Some brands are deliberately never promoted to the `brands` table, so the
  // brand_raw-only path stays exercised.
  const unmatched = new Set<string>(UNMATCHED_BRANDS);

  const brands = new Map<string, string>();
  for (const item of items) {
    if (!item.brandRaw || unmatched.has(item.brandRaw)) continue;
    const normalized = item.brandRaw.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!normalized || brands.has(normalized)) continue;
    const { rows } = await pool.query<{ id: string }>(
      `insert into brands (name, normalized_name) values ($1, $2)
       on conflict (normalized_name) do update set name = brands.name
       returning id`,
      [item.brandRaw, normalized],
    );
    const id = rows[0]?.id;
    if (id) brands.set(normalized, id);
  }

  let inserted = 0;
  for (const item of items) {
    const normalized = item.brandRaw?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';
    const brandId = brands.get(normalized) ?? null;
    const lastWorn =
      item.lastWornDaysAgo === null
        ? null
        : new Date(Date.now() - item.lastWornDaysAgo * 86_400_000).toISOString();

    const { rows } = await pool.query<{ id: string }>(
      `insert into garments (
         user_id, closet_id, name, brand_id, brand_raw, category, subcategory,
         primary_color, secondary_colors, pattern, materials,
         size_raw, size_normalized, size_system, fit,
         season, occasion, style_tags,
         purchase_date, purchase_price, currency, retailer,
         source_type, status, favorite, tags_attached, notes,
         worn_count, last_worn_at, analysis_state
       ) values (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,
         $12,$13,$14,$15,
         $16,$17,$18,
         $19,$20,$21,$22,
         $23,$24,$25,$26,$27,
         $28,$29,'complete'
       ) returning id`,
      [
        userId,
        closetId,
        item.name,
        brandId,
        item.brandRaw,
        item.category,
        categoryRowId(item.category, item.subcategory),
        item.primaryColor,
        item.secondaryColors,
        item.pattern,
        item.materials,
        item.sizeRaw,
        item.sizeNormalized,
        item.sizeSystem,
        item.fit,
        item.season,
        item.occasion,
        item.styleTags,
        item.purchaseDate,
        item.purchasePrice,
        item.currency,
        item.retailer,
        item.sourceType,
        item.status,
        item.favorite,
        item.tagsAttached,
        item.notes,
        item.wornCount,
        lastWorn,
      ],
    );

    const garmentId = rows[0]?.id;
    if (garmentId) {
      await pool.query(
        `insert into garment_sources (garment_id, user_id, source_type, reference_kind)
         values ($2, $1, $3, 'seed')`,
        [userId, garmentId, item.sourceType],
      );

      // Synthetic imagery, so the closet grid can be judged on the thing it
      // exists to show (`docs/04-data/seed-data.md` — Images).
      await attachSeedImage(pool, storage, userId, garmentId, item);
      inserted += 1;
    }
  }

  logger.info('garments seeded', { count: inserted, brands: brands.size });
  return inserted;
}

/**
 * Draw and store a placeholder image for a seeded garment.
 *
 * Written through the same storage driver the API reads from, so the seeded
 * closet exercises the real signed-URL path rather than a shortcut.
 */
async function attachSeedImage(
  pool: ReturnType<typeof getPool>,
  storage: ReturnType<typeof createLocalStorage>,
  userId: string,
  garmentId: string,
  item: SeedGarment,
): Promise<void> {
  const swatch = COLOR_SWATCHES[item.primaryColor as Color] ?? '#9A9691';
  const { png, width, height, pixels } = renderGarmentImage({
    category: item.category,
    colorHex: swatch,
  });

  const storageKey = buildStorageKey('garments', userId, garmentId, 'canonical.png');
  await storage.put(storageKey, png);

  await pool.query(
    `insert into garment_images
       (garment_id, user_id, kind, storage_key, width, height, blurhash, image_hash,
        is_canonical, position)
     values ($2, $1, 'canonical', $3, $4, $5, $6, $7, true, 0)`,
    [
      userId,
      garmentId,
      storageKey,
      width,
      height,
      encodeBlurhash(pixels, width, height),
      imageHash(png),
    ],
  );
}

if (isEntrypoint(import.meta.url)) {
  const set = parseSeedSet(process.argv.slice(2));
  seed(set)
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      await closePool();
      process.exit(1);
    });
}
