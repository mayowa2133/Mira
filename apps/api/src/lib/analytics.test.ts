import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, isAllowedProperty, sanitizeProperties } from './analytics.js';

describe('analytics never carries user content (AN-2, SEC-9)', () => {
  it.each([
    ['image_url', 'https://cdn/x.jpg'],
    ['storage_key', 'garments/u1/g1.jpg'],
    ['email_body', 'your order shipped'],
    ['prompt', 'dinner with my boyfriend'],
    ['access_token', 'abc'],
    ['body_measurement', 170],
  ])('drops the property %s', (key, value) => {
    expect(isAllowedProperty(key, value)).toBe(false);
    expect(sanitizeProperties({ [key]: value }).properties).toEqual({});
  });

  it('drops any URL, whatever the key is called', () => {
    expect(isAllowedProperty('thing', 'https://example.com/a.jpg')).toBe(false);
  });

  it('drops an email address, whatever the key is called', () => {
    expect(isAllowedProperty('who', 'maya@example.com')).toBe(false);
  });

  it('drops a long free-text blob, which is how a query would leak', () => {
    expect(isAllowedProperty('q', 'x'.repeat(200))).toBe(false);
  });

  it('drops an object, because its contents cannot be vetted', () => {
    expect(isAllowedProperty('meta', { a: 1 })).toBe(false);
  });

  it('reports what it dropped, so the caller bug is visible', () => {
    const onDroppedProperty = vi.fn();
    const analytics = createAnalytics({ enabled: true, sink: () => undefined, onDroppedProperty });
    analytics.track('closet_search', 'u1', { query: 'a'.repeat(100), result_count: 3 });
    expect(onDroppedProperty).toHaveBeenCalledWith('closet_search', ['query']);
  });
});

describe('analytics keeps what the metrics need', () => {
  it.each([
    ['result_count', 12],
    ['duration_ms', 240],
    ['category', 'dresses'],
    ['retailer', 'Zara'],
    ['method', 'camera'],
    ['is_natural_language', true],
    ['closet_size_bucket', '100-299'],
    ['vibe', ['classy', 'minimal']],
    ['confidence_band', 'high'],
  ])('keeps %s', (key, value) => {
    expect(isAllowedProperty(key, value)).toBe(true);
  });

  it('emits the documented event shape', () => {
    const sink = vi.fn();
    const analytics = createAnalytics({ enabled: true, sink });
    analytics.track('garment_added', 'u1', { method: 'camera', category: 'dresses' });
    expect(sink).toHaveBeenCalledWith({
      event: 'garment_added',
      userId: 'u1',
      properties: { method: 'camera', category: 'dresses' },
    });
  });

  it('still sanitizes when disabled, so a bug surfaces in development', () => {
    const onDroppedProperty = vi.fn();
    const analytics = createAnalytics({ enabled: false, onDroppedProperty });
    analytics.track('x', null, { image_url: 'https://x/y.jpg' });
    expect(onDroppedProperty).toHaveBeenCalled();
  });
});
