/**
 * Presentation-only merge of Domain `Repository` + local favorite status,
 * per docs/features/favorites.md's explicit decision: `isFavorite` must
 * never be added to the Domain model. `RepositoryListItemViewModel` lives
 * only here.
 */

import { useMemo } from 'react';
import { Repository } from '../../domain/models/Repository';

export type RepositoryListItemViewModel = Repository & { isFavorite: boolean };

export function useRepositoryListViewModel(
  repositories: Repository[],
  favoriteFullNames: Set<string>,
): RepositoryListItemViewModel[] {
  return useMemo(
    () =>
      repositories.map((repository) => ({
        ...repository,
        isFavorite: favoriteFullNames.has(repository.fullName),
      })),
    [repositories, favoriteFullNames],
  );
}
