import { NetworkError, RateLimitError, NotFoundError, ApiError, StorageError } from './DomainErrors';

describe('Domain error taxonomy (docs/api-contracts.md, docs/features/favorites.md)', () => {
  describe('NetworkError', () => {
    it('is an Error with a default message and correct name', () => {
      const error = new NetworkError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.name).toBe('NetworkError');
      expect(error.message.length).toBeGreaterThan(0);
    });

    it('accepts a custom message', () => {
      const error = new NetworkError('DNS lookup failed');
      expect(error.message).toBe('DNS lookup failed');
    });
  });

  describe('RateLimitError', () => {
    const resetAt = new Date('2026-07-10T21:00:00Z');

    it('carries resetAt and remaining fields', () => {
      const error = new RateLimitError({ resetAt, remaining: 0 });
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RateLimitError');
      expect(error.resetAt).toBe(resetAt);
      expect(error.remaining).toBe(0);
    });

    it('builds a default message mentioning the reset time when none is given', () => {
      const error = new RateLimitError({ resetAt, remaining: 0 });
      expect(error.message).toContain(resetAt.toISOString());
    });

    it('accepts a custom message while still exposing resetAt/remaining', () => {
      const error = new RateLimitError({ resetAt, remaining: 3, message: 'custom copy' });
      expect(error.message).toBe('custom copy');
      expect(error.remaining).toBe(3);
    });
  });

  describe('NotFoundError', () => {
    it('is an Error with a default message and correct name', () => {
      const error = new NotFoundError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('ApiError', () => {
    it('carries statusCode and message', () => {
      const error = new ApiError({ statusCode: 500, message: 'Internal Server Error' });
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
    });
  });

  describe('StorageError', () => {
    it('is an Error with a default message and correct name (non-fatal per docs/features/favorites.md)', () => {
      const error = new StorageError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('StorageError');
    });
  });

  describe('taxonomy is mutually distinguishable via instanceof', () => {
    it('does not conflate error types', () => {
      const network = new NetworkError();
      const rateLimit = new RateLimitError({ resetAt: new Date(), remaining: 0 });
      const notFound = new NotFoundError();
      const api = new ApiError({ statusCode: 400, message: 'bad request' });
      const storage = new StorageError();

      expect(network).not.toBeInstanceOf(RateLimitError);
      expect(network).not.toBeInstanceOf(NotFoundError);
      expect(rateLimit).not.toBeInstanceOf(ApiError);
      expect(notFound).not.toBeInstanceOf(NetworkError);
      expect(api).not.toBeInstanceOf(StorageError);
      expect(storage).not.toBeInstanceOf(NetworkError);
    });
  });
});
