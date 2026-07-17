/**
 * Infrastructure-layer, pure function. Parses GitHub's rate-limit response
 * headers per docs/api-contracts.md "Rate limiting detail":
 * `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`,
 * `retry-after`. Inspected on EVERY response, not just on a 403, so quota
 * can be logged proactively (docs/bonus-and-optional.md §Monitoring).
 *
 * STUB: body intentionally throws so the QA suite is red for the right
 * reason until the developer agent implements it.
 */

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetAt: Date | null;
  retryAfterSeconds: number | null;
}

function parseNumericHeader(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRateLimitHeaders(headers: Record<string, string | undefined>): RateLimitInfo {
  const limit = parseNumericHeader(headers['x-ratelimit-limit']);
  const remaining = parseNumericHeader(headers['x-ratelimit-remaining']);
  const resetEpochSeconds = parseNumericHeader(headers['x-ratelimit-reset']);
  const retryAfterSeconds = parseNumericHeader(headers['retry-after']);

  return {
    limit,
    remaining,
    resetAt: resetEpochSeconds !== null ? new Date(resetEpochSeconds * 1000) : null,
    retryAfterSeconds,
  };
}
