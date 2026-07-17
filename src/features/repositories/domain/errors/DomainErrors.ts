/**
 * Domain error taxonomy. Pure TypeScript, no framework/network dependency.
 * Per docs/api-contracts.md "Error Taxonomy" and docs/features/favorites.md
 * (StorageError).
 *
 * These are plain value objects (constructor assigns fields, no branching
 * business logic), so unlike the use case / mapper / repository stubs in
 * this suite they are NOT left as `throw new Error('not implemented')` —
 * there is nothing for the developer agent to "implement" beyond this
 * shape. Translation INTO these types (deciding which one to raise for a
 * given HTTP status) is Data-layer logic and IS stubbed as not-implemented
 * in GitHubRepositoryRepository.ts.
 */

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export interface RateLimitErrorParams {
  resetAt: Date;
  remaining: number;
  message?: string;
}

export class RateLimitError extends Error {
  readonly resetAt: Date;
  readonly remaining: number;

  constructor(params: RateLimitErrorParams) {
    super(params.message ?? `Rate limit reached, try again at ${params.resetAt.toISOString()}`);
    this.name = 'RateLimitError';
    this.resetAt = params.resetAt;
    this.remaining = params.remaining;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export interface ApiErrorParams {
  statusCode: number;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class StorageError extends Error {
  constructor(message = 'Local storage operation failed') {
    super(message);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}
