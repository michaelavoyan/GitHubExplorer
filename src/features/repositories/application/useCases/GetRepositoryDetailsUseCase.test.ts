import { GetRepositoryDetailsUseCase } from './GetRepositoryDetailsUseCase';
import { RepositoryRepository } from '../../domain/repositories/RepositoryRepository';
import { NotFoundError, NetworkError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

function makeMockRepository(): jest.Mocked<RepositoryRepository> {
  return {
    listOrganizationRepositories: jest.fn(),
    searchOrganizationRepositories: jest.fn(),
    getRepository: jest.fn(),
  };
}

describe('GetRepositoryDetailsUseCase (docs/api-contracts.md #2)', () => {
  it('returns full repository detail fields on success', async () => {
    const mockRepo = makeMockRepository();
    const repo = buildRepository();
    mockRepo.getRepository.mockResolvedValue(repo);
    const useCase = new GetRepositoryDetailsUseCase(mockRepo);

    const result = await useCase.execute({ owner: 'facebook', repo: 'react' });

    expect(result).toBe(repo);
    expect(mockRepo.getRepository).toHaveBeenCalledWith({ owner: 'facebook', repo: 'react' });
  });

  it('propagates NotFoundError unchanged when a repo was renamed/deleted since listed/favorited', async () => {
    const mockRepo = makeMockRepository();
    const notFound = new NotFoundError();
    mockRepo.getRepository.mockRejectedValue(notFound);
    const useCase = new GetRepositoryDetailsUseCase(mockRepo);

    await expect(useCase.execute({ owner: 'facebook', repo: 'deleted-repo' })).rejects.toBe(notFound);
  });

  it('propagates NetworkError unchanged', async () => {
    const mockRepo = makeMockRepository();
    const networkError = new NetworkError();
    mockRepo.getRepository.mockRejectedValue(networkError);
    const useCase = new GetRepositoryDetailsUseCase(mockRepo);

    await expect(useCase.execute({ owner: 'facebook', repo: 'react' })).rejects.toBe(networkError);
  });

  it('threads the AbortSignal through and does not wrap AbortError (screen-unmount cancellation)', async () => {
    const mockRepo = makeMockRepository();
    const controller = new AbortController();
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockRepo.getRepository.mockRejectedValue(abortError);
    const useCase = new GetRepositoryDetailsUseCase(mockRepo);

    await expect(
      useCase.execute({ owner: 'facebook', repo: 'react', signal: controller.signal }),
    ).rejects.toBe(abortError);
  });
});
