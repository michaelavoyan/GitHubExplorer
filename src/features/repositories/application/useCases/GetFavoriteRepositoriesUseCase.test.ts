import { GetFavoriteRepositoriesUseCase } from './GetFavoriteRepositoriesUseCase';
import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { RepositoryRepository } from '../../domain/repositories/RepositoryRepository';
import { NotFoundError, NetworkError, StorageError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

function makeMockFavoritesRepository(): jest.Mocked<FavoritesRepository> {
  return {
    getAll: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    isFavorite: jest.fn(),
  };
}

function makeMockRepositoryRepository(): jest.Mocked<RepositoryRepository> {
  return {
    listOrganizationRepositories: jest.fn(),
    searchOrganizationRepositories: jest.fn(),
    getRepository: jest.fn(),
  };
}

/**
 * SPEC GAP: see the header comment in GetFavoriteRepositoriesUseCase.ts.
 * "Load favorites on startup" is tested here as equivalent to populating
 * the optional Favorites screen (docs/features/favorites.md), and the
 * getAll()-throws-StorageError case is this suite's own assumption, not a
 * literal spec contract. Flagged in docs/testing-strategy.md.
 */
describe('GetFavoriteRepositoriesUseCase ("load favorites on startup", docs/features/favorites.md "Favorites screen")', () => {
  it('resolves an empty list when there are no favorites', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    mockFavorites.getAll.mockResolvedValue([]);
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    const result = await useCase.execute();

    expect(result).toEqual([]);
    expect(mockRepos.getRepository).not.toHaveBeenCalled();
  });

  it('fetches and marks each favorite as loaded on success', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    mockFavorites.getAll.mockResolvedValue(['facebook/react', 'microsoft/vscode']);
    mockRepos.getRepository.mockImplementation(async ({ owner, repo }) =>
      buildRepository({ fullName: `${owner}/${repo}` }),
    );
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    const result = await useCase.execute();

    expect(result).toEqual([
      { fullName: 'facebook/react', status: 'loaded', repository: expect.objectContaining({ fullName: 'facebook/react' }) },
      { fullName: 'microsoft/vscode', status: 'loaded', repository: expect.objectContaining({ fullName: 'microsoft/vscode' }) },
    ]);
  });

  it('marks a single renamed/deleted favorite (404) as unavailable without blanking the rest', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    mockFavorites.getAll.mockResolvedValue(['facebook/react', 'someone/deleted-repo']);
    mockRepos.getRepository.mockImplementation(async ({ owner, repo }) => {
      if (repo === 'deleted-repo') {
        throw new NotFoundError();
      }
      return buildRepository({ fullName: `${owner}/${repo}` });
    });
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    const result = await useCase.execute();

    expect(result).toEqual([
      { fullName: 'facebook/react', status: 'loaded', repository: expect.objectContaining({ fullName: 'facebook/react' }) },
      { fullName: 'someone/deleted-repo', status: 'unavailable' },
    ]);
  });

  it('[assumption, flagged] marks a favorite as unavailable on NetworkError too, per the same non-blanking principle', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    mockFavorites.getAll.mockResolvedValue(['facebook/react', 'offline/repo']);
    mockRepos.getRepository.mockImplementation(async ({ owner, repo }) => {
      if (repo === 'repo') {
        throw new NetworkError();
      }
      return buildRepository({ fullName: `${owner}/${repo}` });
    });
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    const result = await useCase.execute();

    expect(result).toContainEqual({ fullName: 'offline/repo', status: 'unavailable' });
    expect(result).toHaveLength(2);
  });

  it('[assumption, flagged] resolves an empty list (does not throw) when getAll() fails with StorageError', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    mockFavorites.getAll.mockRejectedValue(new StorageError('MMKV read failed'));
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    await expect(useCase.execute()).resolves.toEqual([]);
  });

  it('threads an AbortSignal through to each per-favorite fetch', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const mockRepos = makeMockRepositoryRepository();
    const controller = new AbortController();
    mockFavorites.getAll.mockResolvedValue(['facebook/react']);
    mockRepos.getRepository.mockResolvedValue(buildRepository());
    const useCase = new GetFavoriteRepositoriesUseCase(mockFavorites, mockRepos);

    await useCase.execute(controller.signal);

    expect(mockRepos.getRepository).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
