/**
 * Presentation hook backing RepositoryDetailsScreen (assignment §3.3).
 *
 * DI note (BUG-004 fix, docs/BUGS.md): use case instance now comes from the
 * composition root (`src/app/dependencies.ts`) instead of this file
 * importing `GitHubRepositoryRepository` (Data layer) and constructing it
 * itself — see useOrganizationRepositories.ts for the fuller rationale.
 */

import { useQuery } from '@tanstack/react-query';
import { getRepositoryDetailsUseCase } from '../../../../app/dependencies';

export function useRepositoryDetails(owner: string, repo: string) {
  return useQuery({
    queryKey: ['repo-details', owner, repo],
    queryFn: ({ signal }) => getRepositoryDetailsUseCase.execute({ owner, repo, signal }),
    enabled: Boolean(owner) && Boolean(repo),
  });
}
