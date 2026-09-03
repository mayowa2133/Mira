/**
 * Job contracts.
 *
 * The job classes from `docs/03-architecture/backend-architecture.md` §3.
 * Every job is idempotent, retried with backoff, and dead-lettered on final
 * failure with a user-visible retryable state (REL-3).
 *
 * Phase 0 defines the contracts and the queue abstraction. The processors
 * arrive with the pipelines they serve — image.process and garment.analyze in
 * Phases 2–3 (`docs/08-engineering/implementation-plan.md`).
 */

export const JOB_TYPES = [
  'image.process',
  'garment.analyze',
  'product.match',
  'duplicate.check',
  'receipt.parse',
  'email.scan',
  'purchase.match',
  'embedding.generate',
  'tryon.generate',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

/**
 * Every job carries the owning user and a correlation id.
 *
 * `userId` is not optional: a job that cannot say whose data it touches cannot
 * be authorized when it runs (SEC-5).
 */
export type JobEnvelope<TPayload> = {
  type: JobType;
  userId: string;
  correlationId: string;
  /**
   * Idempotency key. A retried job must not double-create
   * (`docs/03-architecture/backend-architecture.md` §3).
   */
  idempotencyKey: string;
  payload: TPayload;
  attempt: number;
};

export type JobPayloads = {
  'image.process': { garmentImageId: string; uploadKey: string };
  'garment.analyze': { garmentId: string };
  'product.match': { garmentId: string };
  'duplicate.check': { garmentId: string };
  'receipt.parse': { receiptImportId: string };
  'email.scan': { emailConnectionId: string; cursor: string | null };
  'purchase.match': { purchaseCandidateId: string };
  'embedding.generate': { garmentId: string };
  'tryon.generate': { tryOnGenerationId: string };
};

export type JobPayload<T extends JobType> = JobPayloads[T];

export type JobResult = { ok: true } | { ok: false; errorCode: string; retryable: boolean };

export type JobHandler<T extends JobType> = (
  envelope: JobEnvelope<JobPayload<T>>,
) => Promise<JobResult>;
