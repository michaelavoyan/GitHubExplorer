/**
 * Domain repository contract (interface only — implemented in Data by
 * GitHubRepositoryRepository). Pure TypeScript, no framework/network
 * dependency. Per docs/api-contracts.md endpoints #1-#3.
 */

import { Repository } from '../models/Repository';
import { PagedResult } from '../models/PagedResult';

export interface ListOrganizationRepositoriesParams {
  org: string;
  page: number;
  perPage: number;
  signal?: AbortSignal;
}

export interface SearchOrganizationRepositoriesParams {
  org: string;
  query: string;
  page: number;
  perPage: number;
  signal?: AbortSignal;
}

export interface GetRepositoryParams {
  owner: string;
  repo: string;
  signal?: AbortSignal;
}

export interface RepositoryRepository {
  listOrganizationRepositories(params: ListOrganizationRepositoriesParams): Promise<PagedResult<Repository>>;
  searchOrganizationRepositories(params: SearchOrganizationRepositoriesParams): Promise<PagedResult<Repository>>;
  getRepository(params: GetRepositoryParams): Promise<Repository>;
}
