import { MmkvFavoritesRepository } from './MmkvFavoritesRepository';
import { KeyValueStorage } from '../../../../infrastructure/persistence/KeyValueStorage';
import { StorageError } from '../../domain/errors/DomainErrors';
import { FAVORITES_STORAGE_KEY } from '../../storage/FavoritesStorageKeys';

function makeInMemoryStorage(initial: Record<string, string> = {}): jest.Mocked<KeyValueStorage> {
  const backing = new Map<string, string>(Object.entries(initial));
  return {
    getString: jest.fn((key: string) => backing.get(key)),
    set: jest.fn((key: string, value: string) => {
      backing.set(key, value);
    }),
    delete: jest.fn((key: string) => {
      backing.delete(key);
    }),
  } as unknown as jest.Mocked<KeyValueStorage>;
}

describe('MmkvFavoritesRepository (docs/features/favorites.md "Persistence")', () => {
  it('getAll() returns an empty array when the key has never been written', async () => {
    const storage = makeInMemoryStorage();
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.getAll()).resolves.toEqual([]);
  });

  it('getAll() parses the JSON-serialized string[] under the single favorites key', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(['facebook/react', 'microsoft/vscode']) });
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.getAll()).resolves.toEqual(['facebook/react', 'microsoft/vscode']);
  });

  it('getAll() surfaces malformed stored JSON as StorageError, not a raw parse exception', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: 'not-json{{' });
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.getAll()).rejects.toBeInstanceOf(StorageError);
  });

  it('add() persists only the identifier — no repository data payload — under the single key', async () => {
    const storage = makeInMemoryStorage();
    const repository = new MmkvFavoritesRepository(storage);

    await repository.add('facebook/react');

    expect(storage.set).toHaveBeenCalledWith(FAVORITES_STORAGE_KEY, JSON.stringify(['facebook/react']));
  });

  it('[assumption, flagged] add() is idempotent — adding an already-favorited id does not duplicate it', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(['facebook/react']) });
    const repository = new MmkvFavoritesRepository(storage);

    await repository.add('facebook/react');

    await expect(repository.getAll()).resolves.toEqual(['facebook/react']);
  });

  it('remove() drops the identifier from the persisted array', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(['facebook/react', 'microsoft/vscode']) });
    const repository = new MmkvFavoritesRepository(storage);

    await repository.remove('facebook/react');

    await expect(repository.getAll()).resolves.toEqual(['microsoft/vscode']);
  });

  it('remove() on an id that is not favorited is a no-op, not an error', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(['facebook/react']) });
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.remove('never/favorited')).resolves.toBeUndefined();
    await expect(repository.getAll()).resolves.toEqual(['facebook/react']);
  });

  it('isFavorite() reflects current membership', async () => {
    const storage = makeInMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(['facebook/react']) });
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.isFavorite('facebook/react')).resolves.toBe(true);
    await expect(repository.isFavorite('microsoft/vscode')).resolves.toBe(false);
  });

  it('add() surfaces a storage write failure as StorageError (non-fatal, caught by ToggleFavoriteUseCase)', async () => {
    const storage = makeInMemoryStorage();
    storage.set.mockImplementation(() => {
      throw new Error('MMKV quota exceeded');
    });
    const repository = new MmkvFavoritesRepository(storage);

    await expect(repository.add('facebook/react')).rejects.toBeInstanceOf(StorageError);
  });

  it('persists favorites across a simulated app restart (new repository instance, same underlying storage)', async () => {
    const storage = makeInMemoryStorage();
    const beforeRestart = new MmkvFavoritesRepository(storage);
    await beforeRestart.add('facebook/react');

    // "Restart": a brand-new repository instance, same backing storage.
    const afterRestart = new MmkvFavoritesRepository(storage);

    await expect(afterRestart.getAll()).resolves.toEqual(['facebook/react']);
  });
});
