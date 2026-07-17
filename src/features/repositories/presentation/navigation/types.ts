/**
 * Feature-level stack param types, per Architecture.md's
 * `presentation/navigation/` folder convention.
 */

export type RepositoriesStackParamList = {
  OrganizationSearch: undefined;
  RepositoryList: { org: string };
  RepositoryDetails: { owner: string; repo: string };
};
