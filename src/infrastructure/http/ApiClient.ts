/**
 * Infrastructure-layer HTTP client contract. Deliberately abstracted away
 * from a concrete `fetch` implementation so Data-layer repository tests can
 * mock this interface directly instead of mocking global fetch, per the
 * qa agent's "test repository implementations against a mocked HTTP
 * boundary" mandate.
 *
 * A concrete `FetchApiClient` (using RN's built-in `fetch`, threading the
 * base URL / default headers from docs/api-contracts.md "Base
 * configuration") is developer-agent implementation work, not scaffolded
 * here.
 */

export interface ApiResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export interface ApiRequestOptions {
  query?: Record<string, string | number>;
  signal?: AbortSignal;
}

export interface ApiClient {
  get<T>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
}
