/**
 * Shared internal Zustand store backing both useFavorites.ts and
 * useToggleFavorite.ts (kept in separate public hook files per the assumed
 * import paths in docs/testing-strategy.md / useFavorites.test.tsx).
 *
 * Favorites are local, device-specific UI state (docs/features/favorites.md
 * "Merging favorite status..." — explicitly NOT server state), so this uses
 * Zustand per Architecture.md's State Management table rather than
 * TanStack Query. Reads/writes still go through Application
 * (ToggleFavoriteUseCase), never touching FavoritesRepository directly
 * from a component.
 *
 * BUG-004 fix: this file used to import `MmkvFavoritesRepository` (Data
 * layer) and `mmkvKeyValueStorage` (Infrastructure) and construct them
 * itself at module scope — a Presentation file reaching two layers down,
 * contradicting Architecture.md's "Dependencies always point inward" and
 * DECISIONS.md §1's own claim that "no networking or business logic lives
 * [in Presentation]". This module now only *defines the store's behavior*
 * as a factory over already-constructed dependencies; the actual
 * `MmkvFavoritesRepository`/`ToggleFavoriteUseCase` construction moved to
 * the composition root (`src/app/dependencies.ts`), which is the only
 * place that imports `data/`/`infrastructure/` for this feature now.
 */

import { create } from 'zustand';
import { ToggleFavoriteUseCase } from '../../application/useCases/ToggleFavoriteUseCase';
import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository';
import { StorageError } from '../../domain/errors/DomainErrors';

export interface FavoritesStoreState {
  favorites: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (fullName: string) => Promise<StorageError | undefined>;
}

export interface FavoritesStoreDependencies {
  toggleFavoriteUseCase: ToggleFavoriteUseCase;
  favoritesRepository: Pick<FavoritesRepository, 'getAll'>;
}

/** Factory, not a ready-made store — see the BUG-004 note above. */
export function createFavoritesStore({ toggleFavoriteUseCase, favoritesRepository }: FavoritesStoreDependencies) {
  return create<FavoritesStoreState>((set, get) => ({
    favorites: new Set<string>(),
    loaded: false,
    load: async () => {
      if (get().loaded) {
        return;
      }
      try {
        const ids = await favoritesRepository.getAll();
        set({ favorites: new Set(ids), loaded: true });
      } catch {
        // StorageError reading favorites is non-fatal — start from an empty
        // set rather than blocking the screen (docs/features/favorites.md).
        set({ favorites: new Set(), loaded: true });
      }
    },
    toggle: async (fullName: string) => {
      const result = await toggleFavoriteUseCase.execute({ fullName });
      if (!result.success) {
        return result.error;
      }
      set((state) => {
        const next = new Set(state.favorites);
        if (result.isFavorite) {
          next.add(fullName);
        } else {
          next.delete(fullName);
        }
        return { favorites: next };
      });
      return undefined;
    },
  }));
}
