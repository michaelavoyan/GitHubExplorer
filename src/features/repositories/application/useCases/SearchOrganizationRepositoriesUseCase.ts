/**
 * Application use case. STUB: method body intentionally throws so the QA
 * suite is red for the right reason until the developer agent implements it.
 */

import {
  RepositoryRepository,
  SearchOrganizationRepositoriesParams,
} from '../../domain/repositories/RepositoryRepository';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';

export class SearchOrganizationRepositoriesUseCase {
  constructor(private readonly repositoryRepository: RepositoryRepository) {}

  async execute(params: SearchOrganizationRepositoriesParams): Promise<PagedResult<Repository>> {
    return this.repositoryRepository.searchOrganizationRepositories(params);
  }
}
