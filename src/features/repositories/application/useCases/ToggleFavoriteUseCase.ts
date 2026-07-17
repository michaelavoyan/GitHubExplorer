/**
 * Application use case. STUB: method body intentionally throws so the QA
 * suite is red for the right reason until the developer agent implements it.
 *
 * SPEC GAP (flagged in docs/testing-strategy.md): docs/features/favorites.md
 * states that StorageError "is non-fatal everywhere" and that
 * ToggleFavoriteUseCase "catches it at that boundary" so Presentation can
 * show a transient toast instead of propagating into an unrelated screen's
 * query error state — but it does not define the use case's return
 * contract for success vs. caught-failure. The `ToggleFavoriteResult`
 * discriminated union below is the qa agent's own interpretation of that
 * contract (needed to write a runnable, non-throwing-on-StorageError test),
 * not something specified in docs/. The architect/developer agent should
 * confirm or replace this shape.
 */

import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { StorageError } from '../../domain/errors/DomainErrors';

export interface ToggleFavoriteParams {
  fullName: string;
}

export type ToggleFavoriteResult =
  | { success: true; isFavorite: boolean }
  | { success: false; error: StorageError };

export class ToggleFavoriteUseCase {
  constructor(private readonly favoritesRepository: FavoritesRepository) {}

  async execute(params: ToggleFavoriteParams): Promise<ToggleFavoriteResult> {
    const { fullName } = params;
    try {
      const isCurrentlyFavorite = await this.favoritesRepository.isFavorite(fullName);
      if (isCurrentlyFavorite) {
        await this.favoritesRepository.remove(fullName);
        return { success: true, isFavorite: false };
      }
      await this.favoritesRepository.add(fullName);
      return { success: true, isFavorite: true };
    } catch (error) {
      if (error instanceof StorageError) {
        return { success: false, error };
      }
      throw error;
    }
  }
}
