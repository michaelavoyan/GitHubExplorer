/**
 * Presentation hook: debounced org-scoped search, per
 * docs/features/repository-list.md "Search/Filter" and assignment §3.4
 * ("avoid unnecessary API calls while typing").
 *
 * DI note (BUG-004 fix, docs/BUGS.md): use case instance now comes from the
 * composition root (`src/app/dependencies.ts`) instead of this file
 * importing `GitHubRepositoryRepository` (Data layer) and constructing it
 * itself — see useOrganizationRepositories.ts for the fuller rationale.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { searchOrganizationRepositoriesUseCase } from '../../../../app/dependencies';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';
import { useDebouncedValue } from './useDebouncedValue';

export const SEARCH_RESULTS_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

export function orgRepoSearchQueryKey(org: string, query: string) {
  return ['org-repo-search', org, query] as const;
}

export function useRepositorySearch(org: string, rawQuery: string) {
  const debouncedQuery = useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS).trim();

  return useInfiniteQuery<PagedResult<Repository>>({
    queryKey: orgRepoSearchQueryKey(org, debouncedQuery),
    queryFn: ({ pageParam, signal }) =>
      searchOrganizationRepositoriesUseCase.execute({
        org,
        query: debouncedQuery,
        page: pageParam as number,
        perPage: SEARCH_RESULTS_PAGE_SIZE,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: debouncedQuery.length > 0,
  });
}
