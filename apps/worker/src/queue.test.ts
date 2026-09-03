import { describe, expect, it, vi } from 'vitest';
import { createInMemoryQueue, defaultRetryPolicy } from './queue.js';

const envelope = (idempotencyKey: string) => ({
  userId: 'u1',
  correlationId: 'c1',
  idempotencyKey,
  payload: { garmentId: 'g1' },
});

describe('queue', () => {
  it('runs a registered handler', async () => {
    const queue = createInMemoryQueue();
    const handler = vi.fn().mockResolvedValue({ ok: true });
    queue.register('garment.analyze', handler);
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('carries the owning user on every job (SEC-5)', async () => {
    const queue = createInMemoryQueue();
    const handler = vi.fn().mockResolvedValue({ ok: true });
    queue.register('garment.analyze', handler);
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ userId: 'u1' });
  });

  it('is idempotent — a repeated key is not processed twice', async () => {
    const queue = createInMemoryQueue();
    const handler = vi.fn().mockResolvedValue({ ok: true });
    queue.register('garment.analyze', handler);
    await queue.enqueue('garment.analyze', envelope('same'));
    await queue.drain();
    await queue.enqueue('garment.analyze', envelope('same'));
    await queue.drain();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('retries a retryable failure up to the policy limit', async () => {
    const queue = createInMemoryQueue({ maxAttempts: 3, backoffMs: () => 0 });
    const handler = vi
      .fn()
      .mockResolvedValue({ ok: false, errorCode: 'ai_timeout', retryable: true });
    queue.register('garment.analyze', handler);
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('dead-letters after the final attempt (REL-3)', async () => {
    const queue = createInMemoryQueue({ maxAttempts: 2, backoffMs: () => 0 });
    queue.register('garment.analyze', async () => ({
      ok: false,
      errorCode: 'ai_timeout',
      retryable: true,
    }));
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(queue.deadLetters()).toHaveLength(1);
  });

  it('does not retry a non-retryable failure', async () => {
    const queue = createInMemoryQueue({ maxAttempts: 5, backoffMs: () => 0 });
    const handler = vi
      .fn()
      .mockResolvedValue({ ok: false, errorCode: 'unsupported_image_format', retryable: false });
    queue.register('image.process', handler);
    await queue.enqueue('image.process', {
      userId: 'u1',
      correlationId: 'c1',
      idempotencyKey: 'k1',
      payload: { garmentImageId: 'i1', uploadKey: 'k' },
    });
    await queue.drain();
    expect(handler).toHaveBeenCalledOnce();
    expect(queue.deadLetters()).toHaveLength(1);
  });

  it('treats a thrown error as a retryable failure rather than losing the job', async () => {
    const queue = createInMemoryQueue({ maxAttempts: 2, backoffMs: () => 0 });
    queue.register('garment.analyze', async () => {
      throw new Error('boom');
    });
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(queue.deadLetters()).toHaveLength(1);
  });

  it('dead-letters a job with no registered handler rather than dropping it', async () => {
    const queue = createInMemoryQueue();
    await queue.enqueue('garment.analyze', envelope('k1'));
    await queue.drain();
    expect(queue.deadLetters()).toHaveLength(1);
  });

  it('uses exponential backoff capped at 30s', () => {
    expect(defaultRetryPolicy.backoffMs(1)).toBe(2000);
    expect(defaultRetryPolicy.backoffMs(2)).toBe(4000);
    expect(defaultRetryPolicy.backoffMs(20)).toBe(30_000);
  });
});
