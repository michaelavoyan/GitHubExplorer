/**
 * Application use case. Coordinates via the Domain repository interface
 * only — no React Native import here. STUB: method body intentionally
 * throws so the QA suite is red for the right reason until the developer
 * agent implements it.
 */

import {
  RepositoryRepository,
  ListOrganizationRepositoriesParams,
} from '../../domain/repositories/RepositoryRepository';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';

export class ListOrganizationRepositoriesUseCase {
  constructor(private readonly repositoryRepository: RepositoryRepository) {}

  async execute(params: ListOrganizationRepositoriesParams): Promise<PagedResult<Repository>> {
    return this.repositoryRepository.listOrganizationRepositories(params);
  }
}
