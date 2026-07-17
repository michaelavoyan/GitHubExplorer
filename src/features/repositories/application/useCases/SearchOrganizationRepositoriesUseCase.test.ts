import { SearchOrganizationRepositoriesUseCase } from './SearchOrganizationRepositoriesUseCase';
import { RepositoryRepository } from '../../domain/repositories/RepositoryRepository';
import { RateLimitError, NetworkError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

function makeMockRepository(): jest.Mocked<RepositoryRepository> {
  return {
    listOrganizationRepositories: jest.fn(),
    searchOrganizationRepositories: jest.fn(),
    getRepository: jest.fn(),
  };
}

describe('SearchOrganizationRepositoriesUseCase (docs/api-contracts.md #3, docs/features/repository-list.md "Search/Filter")', () => {
  it('returns matches unchanged on success', async () => {
    const mockRepo = makeMockRepository();
    const paged = { items: [buildRepository({ name: 'react-native' })], nextPage: null };
    mockRepo.searchOrganizationRepositories.mockResolvedValue(paged);
    const useCase = new SearchOrganizationRepositoriesUseCase(mockRepo);

    const result = await useCase.execute({ org: 'facebook', query: 'native', page: 1, perPage: 50 });

    expect(result).toEqual(paged);
    expect(mockRepo.searchOrganizationRepositories).toHaveBeenCalledWith({
      org: 'facebook',
      query: 'native',
      page: 1,
      perPage: 50,
    });
  });

  /**
   * SPEC NOTE: unlike the plain list endpoint, GitHub's Search API does not
   * 404 for a nonexistent org — `q={query}+org:{org}` for a typo'd org
   * simply yields `total_count: 0`. So "org not found" is not a distinct
   * error case for search; a bad org name surfaces as this same empty-match
   * case docs/api-contracts.md doesn't call this out explicitly — flagged
   * as a spec nuance in docs/testing-strategy.md.
   */
  it('treats zero matches as a valid empty result, not an error', async () => {
    const mockRepo = makeMockRepository();
    mockRepo.searchOrganizationRepositories.mockResolvedValue({ items: [], nextPage: null });
    const useCase = new SearchOrganizationRepositoriesUseCase(mockRepo);

    const result = await useCase.execute({ org: 'facebook', query: 'xyz-no-match', page: 1, perPage: 50 });

    expect(result).toEqual({ items: [], nextPage: null });
  });

  it('propagates RateLimitError unchanged (Search API has its own stricter unauthenticated limit)', async () => {
    const mockRepo = makeMockRepository();
    const rateLimited = new RateLimitError({ resetAt: new Date('2026-07-10T22:00:00Z'), remaining: 0 });
    mockRepo.searchOrganizationRepositories.mockRejectedValue(rateLimited);
    const useCase = new SearchOrganizationRepositoriesUseCase(mockRepo);

    await expect(
      useCase.execute({ org: 'facebook', query: 'react', page: 1, perPage: 50 }),
    ).rejects.toBe(rateLimited);
  });

  it('propagates NetworkError unchanged', async () => {
    const mockRepo = makeMockRepository();
    const networkError = new NetworkError();
    mockRepo.searchOrganizationRepositories.mockRejectedValue(networkError);
    const useCase = new SearchOrganizationRepositoriesUseCase(mockRepo);

    await expect(
      useCase.execute({ org: 'facebook', query: 'react', page: 1, perPage: 50 }),
    ).rejects.toBe(networkError);
  });

  it('threads the AbortSignal through and does not wrap AbortError (query-change cancellation)', async () => {
    const mockRepo = makeMockRepository();
    const controller = new AbortController();
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockRepo.searchOrganizationRepositories.mockRejectedValue(abortError);
    const useCase = new SearchOrganizationRepositoriesUseCase(mockRepo);

    await expect(
      useCase.execute({ org: 'facebook', query: 'rea', page: 1, perPage: 50, signal: controller.signal }),
    ).rejects.toBe(abortError);

    expect(mockRepo.searchOrganizationRepositories).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
