/**
 * Environment configuration.
 *
 * Every value is validated at startup, so a misconfigured deployment fails
 * loudly rather than at the first request.
 *
 * SECURITY: nothing here is ever sent to a client. Only `EXPO_PUBLIC_*`
 * variables reach the mobile bundle (SEC-3,
 * `docs/08-engineering/environments.md` — Configuration).
 */
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MIRA_ENV: z.enum(['local', 'dev', 'staging', 'production']).default('local'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().default('postgresql://mira:mira@localhost:5432/mira'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Auth. JWKS is required in every environment except local, where a dev
  // verifier is used instead (see src/modules/identity/verify.ts).
  SUPABASE_URL: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().optional(),
  JWT_AUDIENCE: z.string().default('mira'),
  /** Local-only shared secret for the dev token verifier. Never set in staging or production. */
  DEV_AUTH_SECRET: z.string().optional(),

  // AI. Local development uses the stub providers by default, so validation and
  // fallback paths are exercised constantly (docs/08-engineering/environments.md).
  AI_VISION_PROVIDER: z.string().default('stub'),
  AI_REASONING_PROVIDER: z.string().default('stub'),
  AI_EMBEDDING_PROVIDER: z.string().default('stub'),
  AI_TRYON_PROVIDER: z.string().default('stub'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default('https://us.i.posthog.com'),

  FEATURE_EMAIL_IMPORT: z.coerce.boolean().default(false),
  FEATURE_TRY_ON: z.coerce.boolean().default(false),
  FEATURE_AUTO_IMPORT_HIGH_CONFIDENCE: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  const env = parsed.data;

  // A dev auth secret outside local is a security hole, not a convenience.
  if (env.DEV_AUTH_SECRET && env.MIRA_ENV !== 'local' && env.NODE_ENV !== 'test') {
    throw new Error('DEV_AUTH_SECRET must never be set outside the local environment');
  }
  if (env.MIRA_ENV !== 'local' && env.NODE_ENV !== 'test' && !env.SUPABASE_JWKS_URL) {
    throw new Error(`SUPABASE_JWKS_URL is required when MIRA_ENV=${env.MIRA_ENV}`);
  }
  return env;
}

let cached: Env | null = null;
export function env(): Env {
  cached ??= loadEnv();
  return cached;
}
/** Test helper: clear the memoized environment. */
export function resetEnv(): void {
  cached = null;
}
