import { ListOrganizationRepositoriesUseCase } from './ListOrganizationRepositoriesUseCase';
import { RepositoryRepository } from '../../domain/repositories/RepositoryRepository';
import { NotFoundError, RateLimitError, NetworkError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

function makeMockRepository(): jest.Mocked<RepositoryRepository> {
  return {
    listOrganizationRepositories: jest.fn(),
    searchOrganizationRepositories: jest.fn(),
    getRepository: jest.fn(),
  };
}

describe('ListOrganizationRepositoriesUseCase (docs/api-contracts.md #1, docs/features/repository-list.md)', () => {
  it('returns the paged result unchanged on success', async () => {
    const mockRepo = makeMockRepository();
    const paged = { items: [buildRepository()], nextPage: 2 };
    mockRepo.listOrganizationRepositories.mockResolvedValue(paged);
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    const result = await useCase.execute({ org: 'facebook', page: 1, perPage: 50 });

    expect(result).toEqual(paged);
    expect(mockRepo.listOrganizationRepositories).toHaveBeenCalledWith({ org: 'facebook', page: 1, perPage: 50 });
  });

  it('treats an org with zero public repos as a valid empty result, not an error', async () => {
    const mockRepo = makeMockRepository();
    mockRepo.listOrganizationRepositories.mockResolvedValue({ items: [], nextPage: null });
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    const result = await useCase.execute({ org: 'an-empty-org', page: 1, perPage: 50 });

    expect(result).toEqual({ items: [], nextPage: null });
  });

  it('propagates NotFoundError unchanged when the org does not exist', async () => {
    const mockRepo = makeMockRepository();
    const notFound = new NotFoundError("No organization named 'does-not-exist'");
    mockRepo.listOrganizationRepositories.mockRejectedValue(notFound);
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    await expect(useCase.execute({ org: 'does-not-exist', page: 1, perPage: 50 })).rejects.toBe(notFound);
  });

  it('propagates RateLimitError unchanged (Application does not re-map Domain errors)', async () => {
    const mockRepo = makeMockRepository();
    const rateLimited = new RateLimitError({ resetAt: new Date('2026-07-10T22:00:00Z'), remaining: 0 });
    mockRepo.listOrganizationRepositories.mockRejectedValue(rateLimited);
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    await expect(useCase.execute({ org: 'facebook', page: 1, perPage: 50 })).rejects.toBe(rateLimited);
  });

  it('propagates NetworkError unchanged', async () => {
    const mockRepo = makeMockRepository();
    const networkError = new NetworkError();
    mockRepo.listOrganizationRepositories.mockRejectedValue(networkError);
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    await expect(useCase.execute({ org: 'facebook', page: 1, perPage: 50 })).rejects.toBe(networkError);
  });

  it('threads the AbortSignal through to the repository and does not wrap AbortError into a Domain error', async () => {
    const mockRepo = makeMockRepository();
    const controller = new AbortController();
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockRepo.listOrganizationRepositories.mockRejectedValue(abortError);
    const useCase = new ListOrganizationRepositoriesUseCase(mockRepo);

    await expect(
      useCase.execute({ org: 'facebook', page: 1, perPage: 50, signal: controller.signal }),
    ).rejects.toBe(abortError);

    expect(mockRepo.listOrganizationRepositories).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
