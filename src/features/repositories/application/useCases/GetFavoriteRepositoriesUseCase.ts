/**
 * Application use case backing "load favorites on startup" / the optional
 * Favorites screen (docs/features/favorites.md "Favorites screen" section).
 * STUB: method body intentionally throws so the QA suite is red for the
 * right reason until the developer agent implements it.
 *
 * SPEC GAP (flagged in docs/testing-strategy.md): docs/features/favorites.md
 * describes this per-favorite "unavailable on 404" behavior under the
 * *optional* Favorites screen section, not explicitly as an app-startup
 * flow, even though Architecture.md's folder listing names
 * `GetFavoriteRepositoriesUseCase` alongside the other core use cases. The
 * qa agent treats "load favorites on startup" and "populate the Favorites
 * screen" as the same use case per that folder listing. Also unspecified:
 * what happens if `FavoritesRepository.getAll()` itself fails with
 * StorageError (the spec only explicitly describes ToggleFavoriteUseCase
 * catching StorageError, not a read failure here). This stub's tests
 * assume "return an empty list, do not throw" — an assumption, not a
 * specified contract.
 */

import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { RepositoryRepository } from '../../domain/repositories/RepositoryRepository';
import { Repository } from '../../domain/models/Repository';

function splitFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/');
  return { owner: owner ?? '', repo: repo ?? '' };
}

export type FavoriteRepositoryResult =
  | { fullName: string; status: 'loaded'; repository: Repository }
  | { fullName: string; status: 'unavailable' };

export class GetFavoriteRepositoriesUseCase {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly repositoryRepository: RepositoryRepository,
  ) {}

  async execute(signal?: AbortSignal): Promise<FavoriteRepositoryResult[]> {
    let favoriteIds: string[];
    try {
      favoriteIds = await this.favoritesRepository.getAll();
    } catch {
      // [assumption, flagged] getAll() failing with StorageError resolves an
      // empty list rather than throwing — see docs/testing-strategy.md gap #2.
      return [];
    }

    return Promise.all(
      favoriteIds.map(async (fullName): Promise<FavoriteRepositoryResult> => {
        const { owner, repo } = splitFullName(fullName);
        try {
          const repository = await this.repositoryRepository.getRepository({ owner, repo, signal });
          return { fullName, status: 'loaded', repository };
        } catch {
          // Covers both NotFoundError (renamed/deleted repo) and, per the
          // same non-blanking principle, NetworkError — see
          // docs/testing-strategy.md gap #2 ([assumption, flagged]).
          return { fullName, status: 'unavailable' };
        }
      }),
    );
  }
}
