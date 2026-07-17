/**
 * Domain model. Pure TypeScript, no framework/network dependency.
 * Shape per docs/api-contracts.md "Domain model" section.
 *
 * STUB NOTE: this is a type-only scaffold written by the qa agent so test
 * files have something to import and compile against. It carries no
 * business logic to implement.
 */

export interface RepositoryLicense {
  name: string;
  spdxId: string;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  description: string | null;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  defaultBranch: string;
  license: RepositoryLicense | null;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
