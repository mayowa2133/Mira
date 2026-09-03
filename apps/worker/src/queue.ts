/**
 * Queue abstraction.
 *
 * The application depends on this interface, not on a queue library, for the
 * same reason services depend on AI capabilities rather than provider SDKs
 * (ADR 0002).
 *
 * Phase 0 ships the in-memory implementation, which is what local development
 * and tests use. A Redis-backed implementation lands in Phase 2, when there are
 * real jobs to run — introducing the dependency earlier would be an unused
 * dependency (`docs/08-engineering/coding-standards.md` — Dependencies).
 */
import type { JobEnvelope, JobHandler, JobPayload, JobResult, JobType } from './jobs.js';

export interface Queue {
  enqueue<T extends JobType>(
    type: T,
    envelope: Omit<JobEnvelope<JobPayload<T>>, 'type' | 'attempt'>,
  ): Promise<void>;
  register<T extends JobType>(type: T, handler: JobHandler<T>): void;
  /** Drain the queue. In-memory only; the Redis implementation runs continuously. */
  drain(): Promise<void>;
  deadLetters(): readonly JobEnvelope<unknown>[];
}

export type RetryPolicy = {
  maxAttempts: number;
  backoffMs: (attempt: number) => number;
};

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: (attempt) => Math.min(30_000, 2 ** attempt * 1000),
};

export function createInMemoryQueue(policy: RetryPolicy = defaultRetryPolicy): Queue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = new Map<JobType, JobHandler<any>>();
  const pending: JobEnvelope<unknown>[] = [];
  const dead: JobEnvelope<unknown>[] = [];
  /** Idempotency: a key that has already succeeded is never processed again. */
  const completed = new Set<string>();

  return {
    async enqueue(type, envelope) {
      pending.push({ ...envelope, type, attempt: 0 } as JobEnvelope<unknown>);
    },

    register(type, handler) {
      handlers.set(type, handler);
    },

    async drain() {
      while (pending.length > 0) {
        const job = pending.shift();
        if (!job) break;

        const dedupeKey = `${job.type}:${job.idempotencyKey}`;
        if (completed.has(dedupeKey)) continue;

        const handler = handlers.get(job.type);
        if (!handler) {
          dead.push(job);
          continue;
        }

        let result: JobResult;
        try {
          result = await handler(job as never);
        } catch (error) {
          result = {
            ok: false,
            errorCode: error instanceof Error ? error.name : 'unknown',
            retryable: true,
          };
        }

        if (result.ok) {
          completed.add(dedupeKey);
          continue;
        }

        const nextAttempt = job.attempt + 1;
        if (result.retryable && nextAttempt < policy.maxAttempts) {
          pending.push({ ...job, attempt: nextAttempt });
        } else {
          dead.push(job);
        }
      }
    },

    deadLetters() {
      return dead;
    },
  };
}
