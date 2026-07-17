/**
 * Concrete Infrastructure-layer `ApiClient` implementation, using React
 * Native's built-in `fetch`. Per docs/api-contracts.md "Base configuration":
 * base URL, required headers, and no Authorization header (unauthenticated
 * app). Threads `signal`/`query` from `ApiRequestOptions` straight into the
 * request.
 *
 * Rejection convention on non-2xx responses: rejects with a plain object
 * carrying `{ status, headers, message }` — matching the convention
 * GitHubRepositoryRepository.test.ts's `httpError()` helper asserts against
 * (docs/testing-strategy.md gap #5). This is the one place in the app that
 * convention is authored; GitHubRepositoryRepository.translateError() is
 * written to consume exactly this shape.
 */

import { ApiClient, ApiRequestOptions, ApiResponse } from './ApiClient';

const BASE_URL = 'https://api.github.com';

/**
 * Deliberately avoids `URL`/`URLSearchParams` — Hermes's built-in
 * `URLSearchParams` polyfill does not implement `.set()` (`Error:
 * URLSearchParams.set is not implemented`), even though Node (where Jest
 * runs) has a full implementation. This crashed every single request that
 * carried query params — i.e. effectively all of them — on a real
 * device/simulator, while every unit test passed, since Jest never
 * exercises the Hermes polyfill gap. Only caught by running the actual app.
 * See docs/BUGS.md. Plain string concatenation with manual encoding sidesteps
 * the polyfill entirely rather than swapping to another partially-implemented
 * URLSearchParams method that might have the same problem.
 */
function buildUrl(path: string, query?: Record<string, string | number>): string {
  const base = `${BASE_URL}${path}`;
  if (!query || Object.keys(query).length === 0) {
    return base;
  }
  const queryString = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${base}?${queryString}`;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value: string, key: string) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

export class FetchApiClient implements ApiClient {
  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const url = buildUrl(path, options.query);

    const response = await fetch(url, {
      method: 'GET',
      signal: options.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const headers = headersToRecord(response.headers);
    const data = await response.json().catch(() => undefined);

    if (!response.ok) {
      // Deliberate {status,headers} rejection convention (not an Error
      // instance) — see file header and GitHubRepositoryRepository's
      // translateError(), which is written to consume exactly this shape.
      throw { status: response.status, headers, message: `HTTP ${response.status}`, body: data };
    }

    return { status: response.status, data: data as T, headers };
  }
}

export const apiClient = new FetchApiClient();
