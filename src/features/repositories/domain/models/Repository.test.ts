import { Repository } from './Repository';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

/**
 * The Domain `Repository` model is a plain interface (no runtime logic to
 * stub as "not implemented"), so this is a shape/edge-case smoke test
 * rather than a red/green behavioral test — it documents, at the type
 * level, the nullable/optional fields called out in
 * docs/api-contracts.md and asserts they're representable and that Date
 * fields really are Date instances (not left as raw ISO strings), which
 * downstream Presentation formatting will depend on.
 */
describe('Domain model: Repository (docs/api-contracts.md "Domain model")', () => {
  it('accepts a fully-populated repository', () => {
    const repo: Repository = buildRepository();
    expect(repo.license).toEqual({ name: 'MIT License', spdxId: 'MIT' });
    expect(repo.createdAt).toBeInstanceOf(Date);
    expect(repo.updatedAt).toBeInstanceOf(Date);
  });

  it('represents every documented nullable field as null, not undefined or empty string', () => {
    const repo: Repository = buildRepository({
      description: null,
      primaryLanguage: null,
      license: null,
    });

    expect(repo.description).toBeNull();
    expect(repo.primaryLanguage).toBeNull();
    expect(repo.license).toBeNull();
  });

  it('keeps id as a string (GitHub numeric id coerced), distinct from fullName', () => {
    const repo: Repository = buildRepository({ id: '123', fullName: 'octocat/hello-world' });
    expect(typeof repo.id).toBe('string');
    expect(repo.fullName).toBe('octocat/hello-world');
  });

  it('keeps numeric metrics as non-negative numbers, including the zero edge case', () => {
    const repo: Repository = buildRepository({ stars: 0, forks: 0, openIssues: 0, watchers: 0 });
    expect(repo.stars).toBe(0);
    expect(repo.forks).toBe(0);
    expect(repo.openIssues).toBe(0);
    expect(repo.watchers).toBe(0);
  });
});
