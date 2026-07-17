/**
 * Data-layer mapper. Pure, one-directional: GitHubRepositoryDto -> Repository.
 * No network, no side effects, unit-testable in isolation.
 * Per docs/api-contracts.md "Mapper responsibility":
 *   - normalizes nullables (does NOT invent fallback copy like
 *     "No description provided" — that belongs in Presentation)
 *   - coerces numeric `id` to string
 *   - `fullName` is `full_name` passed through, not derived
 *
 * STUB: body intentionally throws so the QA suite is red for the right
 * reason until the developer agent implements it.
 */

import { GitHubRepositoryDto } from '../dto/GitHubRepositoryDto';
import { Repository } from '../../domain/models/Repository';

export function mapGitHubRepositoryDtoToRepository(dto: GitHubRepositoryDto): Repository {
  return {
    id: String(dto.id),
    name: dto.name,
    fullName: dto.full_name,
    ownerLogin: dto.owner.login,
    description: dto.description,
    primaryLanguage: dto.language,
    stars: dto.stargazers_count,
    forks: dto.forks_count,
    openIssues: dto.open_issues_count,
    watchers: dto.watchers_count,
    defaultBranch: dto.default_branch,
    license: dto.license ? { name: dto.license.name, spdxId: dto.license.spdx_id } : null,
    htmlUrl: dto.html_url,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}
