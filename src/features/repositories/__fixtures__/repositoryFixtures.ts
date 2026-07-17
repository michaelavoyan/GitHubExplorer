/**
 * Shared test fixtures for the pure-logic suite. Not a test file itself
 * (no *.test.ts suffix), so jest's testMatch never picks it up directly —
 * it's imported by the actual test files.
 */

import { GitHubRepositoryDto } from '../data/dto/GitHubRepositoryDto';
import { Repository } from '../domain/models/Repository';

export function buildGitHubRepositoryDto(overrides: Partial<GitHubRepositoryDto> = {}): GitHubRepositoryDto {
  return {
    id: 10270250,
    name: 'react',
    full_name: 'facebook/react',
    description: 'The library for web and native user interfaces.',
    language: 'JavaScript',
    stargazers_count: 220000,
    forks_count: 45000,
    open_issues_count: 1200,
    watchers_count: 220000,
    updated_at: '2026-06-01T12:00:00Z',
    created_at: '2013-05-24T16:15:54Z',
    default_branch: 'main',
    license: { name: 'MIT License', spdx_id: 'MIT' },
    html_url: 'https://github.com/facebook/react',
    owner: { login: 'facebook', avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4' },
    ...overrides,
  };
}

/** DTO variant exercising every documented nullable/optional field. */
export function buildMinimalGitHubRepositoryDto(overrides: Partial<GitHubRepositoryDto> = {}): GitHubRepositoryDto {
  return buildGitHubRepositoryDto({
    description: null,
    language: null,
    license: null,
    ...overrides,
  });
}

export function buildRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: '10270250',
    name: 'react',
    fullName: 'facebook/react',
    ownerLogin: 'facebook',
    description: 'The library for web and native user interfaces.',
    primaryLanguage: 'JavaScript',
    stars: 220000,
    forks: 45000,
    openIssues: 1200,
    watchers: 220000,
    defaultBranch: 'main',
    license: { name: 'MIT License', spdxId: 'MIT' },
    htmlUrl: 'https://github.com/facebook/react',
    createdAt: new Date('2013-05-24T16:15:54Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    ...overrides,
  };
}
