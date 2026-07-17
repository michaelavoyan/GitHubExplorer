/**
 * Presentation hook wrapping `useInfiniteQuery` over
 * `ListOrganizationRepositoriesUseCase`, per
 * docs/features/repository-list.md "Data source" section.
 *
 * DI note (BUG-004 fix, docs/BUGS.md): this hook previously imported
 * `GitHubRepositoryRepository` (Data layer) directly and constructed it
 * itself at module scope — a real layering violation (Presentation
 * reaching into Data), flagged by QA and fixed here. The use case instance
 * now comes from the composition root (`src/app/dependencies.ts`), which is
 * the only place in the app that imports `data/`/`infrastructure/` to wire
 * the concrete chain together. This hook only ever sees the Application-layer
 * use case. `jest.mock('../../application/useCases/ListOrganizationRepositoriesUseCase')`
 * in useOrganizationRepositories.test.tsx still intercepts construction
 * correctly, since the mock applies at module-resolution level regardless
 * of which file (this hook, or the composition root) triggers the import.
 */

import { useCallback } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { listOrganizationRepositoriesUseCase } from '../../../../app/dependencies';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';

export const ORG_REPOS_PAGE_SIZE = 50;
const MAX_RETAINED_PAGES = 20;

export function orgReposQueryKey(org: string) {
  return ['org-repos', org] as const;
}

export function useOrganizationRepositories(org: string) {
  const queryClient = useQueryClient();
  const queryKey = orgReposQueryKey(org);

  const query = useInfiniteQuery<PagedResult<Repository>>({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      listOrganizationRepositoriesUseCase.execute({
        org,
        page: pageParam as number,
        perPage: ORG_REPOS_PAGE_SIZE,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    maxPages: MAX_RETAINED_PAGES,
    enabled: org.trim().length > 0,
  });

  /**
   * Pull-to-refresh: reset to page 1 instead of TanStack's default
   * behavior of refetching every currently-loaded page, per
   * docs/features/repository-list.md's "Pull-to-refresh flag" trade-off
   * (also called out in DECISIONS.md).
   */
  const refreshFirstPage = useCallback(() => {
    queryClient.setQueryData<InfiniteData<PagedResult<Repository>>>(
      queryKey,
      (data: InfiniteData<PagedResult<Repository>> | undefined) =>
        data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    return query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, org]);

  return { ...query, refreshFirstPage };
}
