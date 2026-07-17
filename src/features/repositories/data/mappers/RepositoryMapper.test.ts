import { mapGitHubRepositoryDtoToRepository } from './RepositoryMapper';
import { buildGitHubRepositoryDto, buildMinimalGitHubRepositoryDto } from '../../__fixtures__/repositoryFixtures';

describe('RepositoryMapper: GitHubRepositoryDto -> Repository (docs/api-contracts.md "Mapper responsibility")', () => {
  it('maps every field on a fully-populated DTO', () => {
    const dto = buildGitHubRepositoryDto();

    const repository = mapGitHubRepositoryDtoToRepository(dto);

    expect(repository).toEqual({
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
    });
  });

  it('coerces the numeric GitHub id to a string', () => {
    const dto = buildGitHubRepositoryDto({ id: 42 });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.id).toBe('42');
    expect(typeof repository.id).toBe('string');
  });

  it('parses updated_at/created_at into real Date instances', () => {
    const dto = buildGitHubRepositoryDto();
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.createdAt).toBeInstanceOf(Date);
    expect(repository.updatedAt).toBeInstanceOf(Date);
  });

  it('maps a null license to null (not an empty object)', () => {
    const dto = buildGitHubRepositoryDto({ license: null });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.license).toBeNull();
  });

  it('maps a null description to null, WITHOUT inventing fallback copy (that is a Presentation concern)', () => {
    const dto = buildGitHubRepositoryDto({ description: null });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.description).toBeNull();
    expect(repository.description).not.toBe('No description provided');
  });

  it('maps a null language to null', () => {
    const dto = buildGitHubRepositoryDto({ language: null });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.primaryLanguage).toBeNull();
  });

  it('maps a DTO with every optional/nullable field absent at once', () => {
    const dto = buildMinimalGitHubRepositoryDto();
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.description).toBeNull();
    expect(repository.primaryLanguage).toBeNull();
    expect(repository.license).toBeNull();
    // Required fields must still be present and correctly typed.
    expect(repository.name).toBe('react');
    expect(repository.defaultBranch).toBe('main');
  });

  it('maps license.spdx_id to license.spdxId (casing/naming translation)', () => {
    const dto = buildGitHubRepositoryDto({ license: { name: 'Apache License 2.0', spdx_id: 'Apache-2.0' } });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.license).toEqual({ name: 'Apache License 2.0', spdxId: 'Apache-2.0' });
  });

  it('takes ownerLogin from owner.login, not from full_name splitting', () => {
    const dto = buildGitHubRepositoryDto({ owner: { login: 'octocat', avatar_url: 'https://example.com/a.png' } });
    const repository = mapGitHubRepositoryDtoToRepository(dto);
    expect(repository.ownerLogin).toBe('octocat');
  });

  it('is a pure function: never mutates the input DTO', () => {
    const dto = buildGitHubRepositoryDto();
    const snapshot = JSON.parse(JSON.stringify(dto));
    mapGitHubRepositoryDtoToRepository(dto);
    expect(dto).toEqual(snapshot);
  });
});
