import { GitHubRepositoryRepository, ConnectivityChecker } from './GitHubRepositoryRepository';
import { ApiClient, ApiResponse } from '../../../../infrastructure/http/ApiClient';
import { NotFoundError, RateLimitError, ApiError, NetworkError } from '../../domain/errors/DomainErrors';
import { buildGitHubRepositoryDto } from '../../__fixtures__/repositoryFixtures';

function makeMockApiClient(): jest.Mocked<ApiClient> {
  return { get: jest.fn() };
}

function okResponse<T>(data: T, headers: Record<string, string> = {}): ApiResponse<T> {
  return { status: 200, data, headers };
}

function httpError(status: number, headers: Record<string, string> = {}) {
  // Convention asserted by these tests: a non-2xx ApiClient.get() call
  // rejects with an object carrying { status, headers } — a reasonable,
  // but qa-agent-authored, contract for how the HTTP boundary reports
  // non-2xx responses (docs/api-contracts.md does not literally specify
  // whether ApiClient throws on non-2xx or resolves with the status; this
  // is flagged in docs/testing-strategy.md).
  return { status, headers, message: `HTTP ${status}` };
}

describe('GitHubRepositoryRepository (docs/api-contracts.md #1-#3, Error Taxonomy)', () => {
  describe('listOrganizationRepositories', () => {
    it('maps a successful page of results and derives nextPage from the length heuristic', async () => {
      const apiClient = makeMockApiClient();
      const dtos = Array.from({ length: 50 }, (_, i) => buildGitHubRepositoryDto({ id: i + 1, name: `repo-${i}` }));
      apiClient.get.mockResolvedValue(okResponse(dtos));
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 });

      expect(result.items).toHaveLength(50);
      expect(result.nextPage).toBe(2);
    });

    it('sets nextPage to null when fewer results than perPage are returned (last page)', async () => {
      const apiClient = makeMockApiClient();
      const dtos = Array.from({ length: 3 }, (_, i) => buildGitHubRepositoryDto({ id: i + 1 }));
      apiClient.get.mockResolvedValue(okResponse(dtos));
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.listOrganizationRepositories({ org: 'facebook', page: 2, perPage: 50 });

      expect(result.items).toHaveLength(3);
      expect(result.nextPage).toBeNull();
    });

    it('treats a 200 with an empty array as a valid empty result, not an error', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockResolvedValue(okResponse([]));
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.listOrganizationRepositories({ org: 'an-empty-org', page: 1, perPage: 50 });

      expect(result).toEqual({ items: [], nextPage: null });
    });

    it('maps a 404 to NotFoundError', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(httpError(404));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'does-not-exist', page: 1, perPage: 50 }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps a 403 with x-ratelimit-remaining: 0 to RateLimitError with resetAt/remaining parsed from headers', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(
        httpError(403, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1783000000',
        }),
      );
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toMatchObject({
        name: 'RateLimitError',
        remaining: 0,
        resetAt: new Date(1783000000 * 1000),
      });
    });

    it('maps a 429 to RateLimitError', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(httpError(429, { 'retry-after': '30' }));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    /**
     * SPEC INTERPRETATION (flagged in docs/testing-strategy.md): a bare 403
     * with NEITHER `x-ratelimit-remaining: 0` NOR `retry-after` (e.g. GitHub
     * abuse-detection blocking, unrelated to quota) is not literally covered
     * by the "403/429 with rate-limit headers" RateLimitError condition, so
     * this suite asserts it falls through to the generic ApiError bucket.
     */
    it('maps a bare 403 without rate-limit headers to ApiError, not RateLimitError', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(httpError(403));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    it('maps other non-2xx statuses (e.g. 500) to ApiError with the status code preserved', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(httpError(500));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toMatchObject({ name: 'ApiError', statusCode: 500 });
    });

    it('maps a fetch-level failure (no response at all) to NetworkError', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(new TypeError('Failed to fetch'));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toBeInstanceOf(NetworkError);
    });

    it('does NOT wrap AbortError into NetworkError — cancellation must propagate unchanged', async () => {
      const apiClient = makeMockApiClient();
      const controller = new AbortController();
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      apiClient.get.mockRejectedValue(abortError);
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50, signal: controller.signal }),
      ).rejects.toBe(abortError);
    });

    it('threads the AbortSignal through to the ApiClient call', async () => {
      const apiClient = makeMockApiClient();
      const controller = new AbortController();
      apiClient.get.mockResolvedValue(okResponse([]));
      const repository = new GitHubRepositoryRepository(apiClient);

      await repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50, signal: controller.signal });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/orgs/facebook/repos',
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    /**
     * SPEC INTERPRETATION (flagged in docs/testing-strategy.md):
     * docs/native-module-spec.md says the repository "calls
     * ConnectivityService.isReachable() before a network request when the
     * app is suspected offline" — the exact trigger condition (always vs.
     * only after a prior NetworkError) isn't mechanically specified. This
     * test asserts the simplest reading: if a connectivity checker is
     * injected and reports unreachable, skip the network call entirely and
     * fail fast with NetworkError.
     */
    it('[assumption, flagged] skips the network call and fails fast with NetworkError when the injected connectivity checker reports unreachable', async () => {
      const apiClient = makeMockApiClient();
      const connectivityChecker: jest.Mocked<ConnectivityChecker> = { isReachable: jest.fn().mockResolvedValue(false) };
      const repository = new GitHubRepositoryRepository(apiClient, connectivityChecker);

      await expect(
        repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 }),
      ).rejects.toBeInstanceOf(NetworkError);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('[assumption, flagged] proceeds with the network call when the connectivity checker reports reachable', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockResolvedValue(okResponse([]));
      const connectivityChecker: jest.Mocked<ConnectivityChecker> = { isReachable: jest.fn().mockResolvedValue(true) };
      const repository = new GitHubRepositoryRepository(apiClient, connectivityChecker);

      await repository.listOrganizationRepositories({ org: 'facebook', page: 1, perPage: 50 });

      expect(apiClient.get).toHaveBeenCalled();
    });
  });

  describe('searchOrganizationRepositories', () => {
    it('unwraps the search response items before mapping, and scopes the query to the org', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockResolvedValue(
        okResponse({ total_count: 1, incomplete_results: false, items: [buildGitHubRepositoryDto({ name: 'react-native' })] }),
      );
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.searchOrganizationRepositories({
        org: 'facebook',
        query: 'native',
        page: 1,
        perPage: 50,
      });

      expect(result.items).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        '/search/repositories',
        expect.objectContaining({ query: expect.objectContaining({ q: 'native org:facebook' }) }),
      );
    });

    it('treats zero matches as a valid empty result', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockResolvedValue(okResponse({ total_count: 0, incomplete_results: false, items: [] }));
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.searchOrganizationRepositories({
        org: 'facebook',
        query: 'no-match',
        page: 1,
        perPage: 50,
      });

      expect(result).toEqual({ items: [], nextPage: null });
    });
  });

  describe('getRepository', () => {
    it('maps a successful detail response, including detail-only fields', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockResolvedValue(okResponse(buildGitHubRepositoryDto()));
      const repository = new GitHubRepositoryRepository(apiClient);

      const result = await repository.getRepository({ owner: 'facebook', repo: 'react' });

      expect(result.watchers).toBe(220000);
      expect(result.defaultBranch).toBe('main');
      expect(result.htmlUrl).toBe('https://github.com/facebook/react');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('maps a 404 (renamed/deleted repo) to NotFoundError', async () => {
      const apiClient = makeMockApiClient();
      apiClient.get.mockRejectedValue(httpError(404));
      const repository = new GitHubRepositoryRepository(apiClient);

      await expect(repository.getRepository({ owner: 'someone', repo: 'deleted-repo' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
