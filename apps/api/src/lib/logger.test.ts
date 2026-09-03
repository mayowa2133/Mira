import { describe, expect, it } from 'vitest';
import { REDACTED } from './redact.js';
import { createLogger, type LogLevel } from './logger.js';

function capture(level: LogLevel = 'debug') {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({ level, sink: (l) => lines.push(l) });
  return { logger, lines };
}

describe('logger', () => {
  it('emits structured JSON with level, time and message', () => {
    const { logger, lines } = capture();
    logger.info('request completed', { route: 'GET /health', status: 200 });
    expect(lines[0]).toMatchObject({
      level: 'info',
      msg: 'request completed',
      route: 'GET /health',
      status: 200,
    });
    expect(lines[0]?.['time']).toBeTypeOf('string');
  });

  it('respects the level threshold', () => {
    const { logger, lines } = capture('warn');
    logger.debug('noise');
    logger.info('noise');
    logger.warn('signal');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.['msg']).toBe('signal');
  });

  it('carries child correlation fields on every line', () => {
    const { logger, lines } = capture();
    const child = logger.child({ request_id: 'req_1', user_id: 'u_1' });
    child.info('a');
    child.info('b');
    expect(lines.every((l) => l['request_id'] === 'req_1' && l['user_id'] === 'u_1')).toBe(true);
  });

  // The point of routing every line through redact(): a caller CANNOT log a
  // token, even by accident, even in a child logger (SEC-2).
  it('redacts credentials that a caller passes in', () => {
    const { logger, lines } = capture();
    logger.info('oauth callback', { access_token: 'abc123', provider: 'gmail' });
    expect(lines[0]?.['access_token']).toBe(REDACTED);
    expect(lines[0]?.['provider']).toBe('gmail');
  });

  it('redacts credentials bound into a child logger', () => {
    const { logger, lines } = capture();
    logger.child({ authorization: 'Bearer xyz' }).info('hi');
    expect(lines[0]?.['authorization']).toBe(REDACTED);
  });

  it('redacts user content (SEC-9)', () => {
    const { logger, lines } = capture();
    logger.info('analysis done', {
      garment_id: 'g1',
      storage_key: 'garments/u1/g1/original.jpg',
      prompt: 'a photo of a dress',
    });
    expect(lines[0]?.['garment_id']).toBe('g1');
    expect(lines[0]?.['storage_key']).toBe(REDACTED);
    expect(lines[0]?.['prompt']).toBe(REDACTED);
  });

  it('redacts an Error without losing its message', () => {
    const { logger, lines } = capture();
    logger.error('failed', { err: new Error('boom') });
    expect(lines[0]?.['err']).toMatchObject({ name: 'Error', message: 'boom' });
  });
});
