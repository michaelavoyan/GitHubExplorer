/**
 * Data-layer DTO. Never imported above Data. Shape per docs/api-contracts.md
 * "DTO shapes" section, matching GitHub's actual REST response field names.
 */

export interface GitHubRepositoryOwnerDto {
  login: string;
  avatar_url: string;
}

export interface GitHubRepositoryLicenseDto {
  name: string;
  spdx_id: string;
}

export interface GitHubRepositoryDto {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  updated_at: string;
  created_at: string;
  default_branch: string;
  license: GitHubRepositoryLicenseDto | null;
  html_url: string;
  owner: GitHubRepositoryOwnerDto;
}
