/**
 * Data-layer implementation of the Domain `RepositoryRepository` contract.
 * Talks to the GitHub REST API via the injected `ApiClient` abstraction
 * (see src/infrastructure/http/ApiClient.ts) — this keeps the class
 * pure-TypeScript-testable with a mocked HTTP boundary, no real `fetch` or
 * React Native dependency required.
 *
 * Error translation happens ONCE here (the only place that sees raw HTTP
 * status/headers), per docs/api-contracts.md "Error Taxonomy" and
 * Architecture.md's "API Integration" section.
 *
 * `ConnectivityChecker` is a minimal local interface (not the real
 * Infrastructure `ConnectivityService`, which requires React Native's
 * NativeModules/NativeEventEmitter) — this keeps the connectivity-aware
 * "skip a doomed fetch" behavior from docs/native-module-spec.md
 * ("Consumers" §1) testable here without pulling in an RN dependency.
 * `ConnectivityService` is expected to satisfy this interface structurally
 * once it exists.
 *
 * STUB: method bodies intentionally throw so the QA suite is red for the
 * right reason until the developer agent implements them.
 */

import {
  RepositoryRepository,
  ListOrganizationRepositoriesParams,
  SearchOrganizationRepositoriesParams,
  GetRepositoryParams,
} from '../../domain/repositories/RepositoryRepository';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';
import { ApiClient, ApiRequestOptions, ApiResponse } from '../../../../infrastructure/http/ApiClient';
import { NotFoundError, RateLimitError, ApiError, NetworkError } from '../../domain/errors/DomainErrors';
import { parseRateLimitHeaders } from '../../../../infrastructure/http/RateLimitHeaders';
import { GitHubRepositoryDto } from '../dto/GitHubRepositoryDto';
import { GitHubSearchResponseDto } from '../dto/GitHubSearchResponseDto';
import { mapGitHubRepositoryDtoToRepository } from '../mappers/RepositoryMapper';

export interface ConnectivityChecker {
  isReachable(timeoutMs?: number): Promise<boolean>;
}

/** Shape a non-2xx ApiClient.get() rejection is expected to carry.
 * SPEC INTERPRETATION (docs/testing-strategy.md gap #5): docs/api-contracts.md
 * describes error outcomes, not the ApiClient boundary's reject/resolve
 * convention. This matches GitHubRepositoryRepository.test.ts's httpError()
 * helper and this repository's own FetchApiClient implementation.
 */
interface HttpErrorLike {
  status: number;
  headers?: Record<string, string>;
}

/**
 * Duck-types on `.name === 'AbortError'` instead of `instanceof DOMException`.
 * `DOMException` exists as a global in Node (where Jest runs — every prior
 * test run passed against a real `DOMException`), but does NOT exist as a
 * global in Hermes, React Native's actual JS engine. Referencing an
 * undefined global via `instanceof` throws `ReferenceError: Property
 * 'DOMException' doesn't exist` immediately — on a real device/simulator
 * this crashed `translateError()` on every single API error (not just
 * aborts), silently destroying the entire NotFoundError/RateLimitError/
 * NetworkError classification and surfacing as a generic "Something went
 * wrong" for everything. Only caught by running the actual app on a real
 * simulator; no unit test could have caught this, since Jest's Node
 * environment never exercises the missing Hermes global. See docs/BUGS.md.
 */
function isAbortError(error: unknown): error is Error {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === 'object' && error !== null && 'status' in error && typeof (error as HttpErrorLike).status === 'number';
}

export class GitHubRepositoryRepository implements RepositoryRepository {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly connectivityChecker?: ConnectivityChecker,
  ) {}

  async listOrganizationRepositories(params: ListOrganizationRepositoriesParams): Promise<PagedResult<Repository>> {
    await this.ensureReachable();
    const { org, page, perPage, signal } = params;
    const response = await this.request<GitHubRepositoryDto[]>(`/orgs/${org}/repos`, {
      query: { per_page: perPage, page, sort: 'full_name', direction: 'asc' },
      signal,
    });
    const items = response.data.map(mapGitHubRepositoryDtoToRepository);
    return { items, nextPage: response.data.length === perPage ? page + 1 : null };
  }

  async searchOrganizationRepositories(params: SearchOrganizationRepositoriesParams): Promise<PagedResult<Repository>> {
    await this.ensureReachable();
    const { org, query, page, perPage, signal } = params;
    const response = await this.request<GitHubSearchResponseDto>('/search/repositories', {
      query: { q: `${query} org:${org}`, per_page: perPage, page },
      signal,
    });
    const items = response.data.items.map(mapGitHubRepositoryDtoToRepository);
    return { items, nextPage: items.length === perPage ? page + 1 : null };
  }

  async getRepository(params: GetRepositoryParams): Promise<Repository> {
    await this.ensureReachable();
    const { owner, repo, signal } = params;
    const response = await this.request<GitHubRepositoryDto>(`/repos/${owner}/${repo}`, { signal });
    return mapGitHubRepositoryDtoToRepository(response.data);
  }

  /**
   * SPEC INTERPRETATION (docs/testing-strategy.md gap #4): the "suspected
   * offline" trigger condition is not mechanically specified. This
   * implements the simplest reading tests assert: always consult the
   * injected checker (when present) before issuing the request.
   */
  private async ensureReachable(): Promise<void> {
    if (!this.connectivityChecker) {
      return;
    }
    const reachable = await this.connectivityChecker.isReachable();
    if (!reachable) {
      throw new NetworkError();
    }
  }

  private async request<T>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    try {
      return await this.apiClient.get<T>(path, options);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  private translateError(error: unknown): unknown {
    if (isAbortError(error)) {
      return error;
    }

    if (isHttpErrorLike(error)) {
      const { status, headers = {} } = error;
      const rateLimitInfo = parseRateLimitHeaders(headers);
      const hasRateLimitSignal = rateLimitInfo.remaining === 0 || rateLimitInfo.retryAfterSeconds !== null;

      if (status === 404) {
        return new NotFoundError();
      }
      if ((status === 403 || status === 429) && hasRateLimitSignal) {
        return new RateLimitError({
          resetAt: rateLimitInfo.resetAt ?? new Date(),
          remaining: rateLimitInfo.remaining ?? 0,
        });
      }
      return new ApiError({ statusCode: status, message: `GitHub API request failed with status ${status}` });
    }

    // No response at all (fetch threw before a status existed): offline, DNS, timeout, TLS.
    return new NetworkError();
  }
}
