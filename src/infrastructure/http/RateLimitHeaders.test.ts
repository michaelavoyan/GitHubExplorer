import { parseRateLimitHeaders } from './RateLimitHeaders';

describe('parseRateLimitHeaders (docs/api-contracts.md "Rate limiting detail")', () => {
  it('parses limit/remaining/reset from a typical successful response', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '59',
      'x-ratelimit-reset': '1783000000',
    });

    expect(result.limit).toBe(60);
    expect(result.remaining).toBe(59);
    expect(result.resetAt).toEqual(new Date(1783000000 * 1000));
    expect(result.retryAfterSeconds).toBeNull();
  });

  it('parses retry-after when present (403/429 with Retry-After)', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1783000000',
      'retry-after': '120',
    });

    expect(result.retryAfterSeconds).toBe(120);
  });

  it('returns all-null fields when no rate-limit headers are present at all', () => {
    const result = parseRateLimitHeaders({});

    expect(result.limit).toBeNull();
    expect(result.remaining).toBeNull();
    expect(result.resetAt).toBeNull();
    expect(result.retryAfterSeconds).toBeNull();
  });

  it('treats x-ratelimit-remaining: 0 as a real zero, not falsy/absent', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1783000000',
    });

    expect(result.remaining).toBe(0);
  });

  it('does not throw on malformed numeric header values', () => {
    expect(() =>
      parseRateLimitHeaders({
        'x-ratelimit-limit': 'not-a-number',
        'x-ratelimit-remaining': 'also-not-a-number',
      }),
    ).not.toThrow();
  });
});
