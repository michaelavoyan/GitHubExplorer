/**
 * Data-layer DTO for the Search API wrapper shape. Per docs/api-contracts.md
 * endpoint #3: `{ total_count, incomplete_results, items: [...] }`.
 */

import { GitHubRepositoryDto } from './GitHubRepositoryDto';

export interface GitHubSearchResponseDto {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepositoryDto[];
}
