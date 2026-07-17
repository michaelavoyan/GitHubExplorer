import { useEffect } from 'react';
// BUG-004 fix (docs/BUGS.md): the store instance now comes from the
// composition root (`src/app/dependencies.ts`), which is the only place
// that constructs the concrete MmkvFavoritesRepository/ToggleFavoriteUseCase
// this store is built from. See favoritesStore.ts for the store's factory.
import { useFavoritesStore } from '../../../../app/dependencies';

/** Read-only view of the current favorites set; triggers the initial load. */
export function useFavorites() {
  const favorites = useFavoritesStore((state) => state.favorites);
  const load = useFavoritesStore((state) => state.load);

  useEffect(() => {
    load();
  }, [load]);

  return { favorites };
}
