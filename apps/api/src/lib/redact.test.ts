import { describe, expect, it } from 'vitest';
import { REDACTED, isSensitiveKey, redact } from './redact.js';

/**
 * The redaction fixture suite.
 *
 * Referenced by task 0.10 in tasks/current.md and by the security test list in
 * docs/08-engineering/testing-strategy.md. It contains every shape Mira handles.
 */
describe('credentials are never logged (SEC-2)', () => {
  it.each([
    'access_token',
    'accessToken',
    'refresh_token',
    'id_token',
    'authorization',
    'Authorization',
    'password',
    'client_secret',
    'apiKey',
    'api_key',
    'ANTHROPIC_API_KEY',
    'cookie',
    'code',
    'jwt',
    'email_token_encryption_key',
    'access_token_enc',
    'sessionId',
  ])('redacts the key %s', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
    expect(redact({ [key]: 'sensitive-value' })).toEqual({ [key]: REDACTED });
  });

  it('redacts a bearer token found under an innocuous key', () => {
    expect(redact({ header: 'Bearer abc.def.ghi' })).toEqual({ header: REDACTED });
  });

  it('redacts a raw JWT found under an innocuous key', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig';
    expect(redact({ value: jwt })).toEqual({ value: REDACTED });
  });

  it('redacts a provider API key found under an innocuous key', () => {
    expect(redact({ value: 'sk-ant-0123456789abcdef0123' })).toEqual({ value: REDACTED });
  });

  it('redacts a private key block', () => {
    expect(redact({ value: '-----BEGIN RSA PRIVATE KEY-----\nabc' })).toEqual({ value: REDACTED });
  });
});

describe('user content is never logged (SEC-9, privacy)', () => {
  it.each([
    'image_url',
    'imageData',
    'image_base64',
    'storage_key',
    'uploadKey',
    'blurhash',
    'body_image',
    'bodyMeasurement',
    'email_body',
    'email_subject',
    'message_body',
    'prompt',
    'raw_ocr',
    'ocr_text',
    'photo',
  ])('redacts the key %s', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it('redacts image bytes', () => {
    expect(redact({ buf: Buffer.from([1, 2, 3]) })).toEqual({ buf: REDACTED });
    expect(redact({ arr: new Uint8Array([1, 2, 3]) })).toEqual({ arr: REDACTED });
  });

  it('redacts a data: image URI found under an innocuous key', () => {
    expect(redact({ src: 'data:image/png;base64,iVBORw0KGgo=' })).toEqual({ src: REDACTED });
  });

  it('redacts email addresses wherever they appear', () => {
    expect(redact({ note: 'contact maya@example.com about it' })).toEqual({
      note: `contact ${REDACTED} about it`,
    });
  });
});

describe('what SHOULD survive redaction', () => {
  it('keeps the fields observability actually needs', () => {
    const line = {
      request_id: 'req_01J',
      user_id: '11111111-1111-1111-1111-111111111111',
      route: 'GET /garments',
      status: 200,
      latency_ms: 42,
      category: 'dresses',
      retailer: 'Zara',
      capability: 'vision',
      model: 'claude-opus-5',
    };
    expect(redact(line)).toEqual(line);
  });

  it('keeps garment ids and counts', () => {
    expect(redact({ garment_id: 'abc', count: 3 })).toEqual({ garment_id: 'abc', count: 3 });
  });
});

describe('robustness — a redactor that throws is a redactor that gets bypassed', () => {
  it('redacts nested structures', () => {
    expect(redact({ user: { profile: { access_token: 'x', display_name: 'Maya' } } })).toEqual({
      user: { profile: { access_token: REDACTED, display_name: 'Maya' } },
    });
  });

  it('redacts inside arrays', () => {
    expect(redact([{ token: 'a' }, { token: 'b' }])).toEqual([
      { token: REDACTED },
      { token: REDACTED },
    ]);
  });

  it('handles cycles without hanging', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a['self'] = a;
    expect(redact(a)).toEqual({ name: 'a', self: '[circular]' });
  });

  it('truncates beyond the depth limit rather than recursing forever', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });

  it('redacts Errors while keeping name and message', () => {
    const result = redact(new Error('failed for maya@example.com')) as Record<string, unknown>;
    expect(result['name']).toBe('Error');
    expect(result['message']).toBe(`failed for ${REDACTED}`);
  });

  it('redacts Maps and Sets wholesale rather than guessing at their contents', () => {
    expect(redact({ m: new Map([['token', 'x']]) })).toEqual({ m: REDACTED });
    expect(redact({ s: new Set(['x']) })).toEqual({ s: REDACTED });
  });

  it('handles null, undefined and primitives', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });

  it('redacts functions and symbols rather than serializing them', () => {
    expect(redact({ fn: () => undefined })).toEqual({ fn: REDACTED });
  });
});
