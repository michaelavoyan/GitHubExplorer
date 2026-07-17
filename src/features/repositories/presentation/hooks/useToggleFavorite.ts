import { useCallback, useState } from 'react';
// BUG-004 fix (docs/BUGS.md): see useFavorites.ts for why this now imports
// the store instance from the composition root instead of `./favoritesStore`.
import { useFavoritesStore } from '../../../../app/dependencies';
import { StorageError } from '../../domain/errors/DomainErrors';

/**
 * Toggle action + a transient per-call error, per
 * docs/features/favorites.md: a failed write is "non-fatal everywhere" and
 * must surface as a toast, not a thrown error or a screen-level failure.
 */
export function useToggleFavorite() {
  const toggleInStore = useFavoritesStore((state) => state.toggle);
  const [error, setError] = useState<StorageError | undefined>(undefined);

  const toggle = useCallback(
    async (fullName: string) => {
      setError(undefined);
      const failure = await toggleInStore(fullName);
      setError(failure);
    },
    [toggleInStore],
  );

  return { toggle, error };
}
