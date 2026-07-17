import { ToggleFavoriteUseCase } from './ToggleFavoriteUseCase';
import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { StorageError } from '../../domain/errors/DomainErrors';

function makeMockFavoritesRepository(): jest.Mocked<FavoritesRepository> {
  return {
    getAll: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    isFavorite: jest.fn(),
  };
}

/**
 * SPEC GAP: see the header comment in ToggleFavoriteUseCase.ts — the
 * `ToggleFavoriteResult` return contract asserted below is the qa agent's
 * interpretation of docs/features/favorites.md's "catches it at that
 * boundary" instruction, not a literal spec contract. Flagged in
 * docs/testing-strategy.md.
 */
describe('ToggleFavoriteUseCase (docs/features/favorites.md "Toggling a favorite")', () => {
  it('adds the repository when it is not currently a favorite', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    mockFavorites.isFavorite.mockResolvedValue(false);
    mockFavorites.add.mockResolvedValue(undefined);
    const useCase = new ToggleFavoriteUseCase(mockFavorites);

    const result = await useCase.execute({ fullName: 'facebook/react' });

    expect(mockFavorites.add).toHaveBeenCalledWith('facebook/react');
    expect(mockFavorites.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, isFavorite: true });
  });

  it('removes the repository when it is currently a favorite', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    mockFavorites.isFavorite.mockResolvedValue(true);
    mockFavorites.remove.mockResolvedValue(undefined);
    const useCase = new ToggleFavoriteUseCase(mockFavorites);

    const result = await useCase.execute({ fullName: 'facebook/react' });

    expect(mockFavorites.remove).toHaveBeenCalledWith('facebook/react');
    expect(mockFavorites.add).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, isFavorite: false });
  });

  it('catches a StorageError from add() and resolves with a non-throwing failure result', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    mockFavorites.isFavorite.mockResolvedValue(false);
    const storageError = new StorageError('MMKV write failed');
    mockFavorites.add.mockRejectedValue(storageError);
    const useCase = new ToggleFavoriteUseCase(mockFavorites);

    // Must resolve, not reject — StorageError is "non-fatal everywhere"
    // and must not propagate into an unrelated screen's query error state.
    await expect(useCase.execute({ fullName: 'facebook/react' })).resolves.toEqual({
      success: false,
      error: storageError,
    });
  });

  it('catches a StorageError from remove() the same way', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    mockFavorites.isFavorite.mockResolvedValue(true);
    const storageError = new StorageError('MMKV write failed');
    mockFavorites.remove.mockRejectedValue(storageError);
    const useCase = new ToggleFavoriteUseCase(mockFavorites);

    await expect(useCase.execute({ fullName: 'facebook/react' })).resolves.toEqual({
      success: false,
      error: storageError,
    });
  });

  it('[assumption, flagged] catches a StorageError from the isFavorite() read itself', async () => {
    const mockFavorites = makeMockFavoritesRepository();
    const storageError = new StorageError('MMKV read failed');
    mockFavorites.isFavorite.mockRejectedValue(storageError);
    const useCase = new ToggleFavoriteUseCase(mockFavorites);

    await expect(useCase.execute({ fullName: 'facebook/react' })).resolves.toEqual({
      success: false,
      error: storageError,
    });
  });
});
