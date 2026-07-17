/**
 * Application use case. STUB: method body intentionally throws so the QA
 * suite is red for the right reason until the developer agent implements it.
 */

import { RepositoryRepository, GetRepositoryParams } from '../../domain/repositories/RepositoryRepository';
import { Repository } from '../../domain/models/Repository';

export class GetRepositoryDetailsUseCase {
  constructor(private readonly repositoryRepository: RepositoryRepository) {}

  async execute(params: GetRepositoryParams): Promise<Repository> {
    return this.repositoryRepository.getRepository(params);
  }
}
