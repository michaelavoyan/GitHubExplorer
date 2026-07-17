/**
 * Data-layer implementation of the Domain `FavoritesRepository` contract.
 * Takes a `KeyValueStorage` abstraction (see
 * src/infrastructure/persistence/KeyValueStorage.ts) instead of a concrete
 * MMKV instance, so it is pure-TypeScript-testable against an in-memory
 * fake with no native dependency.
 *
 * STUB: method bodies intentionally throw so the QA suite is red for the
 * right reason until the developer agent implements them.
 */

import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { KeyValueStorage } from '../../../../infrastructure/persistence/KeyValueStorage';
import { FAVORITES_STORAGE_KEY } from '../../storage/FavoritesStorageKeys';
import { StorageError } from '../../domain/errors/DomainErrors';

export class MmkvFavoritesRepository implements FavoritesRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly storageKey: string = FAVORITES_STORAGE_KEY,
  ) {}

  async getAll(): Promise<string[]> {
    const raw = this.storage.getString(this.storageKey);
    if (raw === undefined) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Favorites payload is not an array');
      }
      return parsed as string[];
    } catch {
      throw new StorageError('Favorites data is corrupted');
    }
  }

  async add(id: string): Promise<void> {
    const current = await this.getAll();
    const next = current.includes(id) ? current : [...current, id];
    this.persist(next);
  }

  async remove(id: string): Promise<void> {
    const current = await this.getAll();
    const next = current.filter((existingId) => existingId !== id);
    this.persist(next);
  }

  async isFavorite(id: string): Promise<boolean> {
    const current = await this.getAll();
    return current.includes(id);
  }

  private persist(ids: string[]): void {
    try {
      this.storage.set(this.storageKey, JSON.stringify(ids));
    } catch {
      throw new StorageError('Failed to persist favorites');
    }
  }
}
