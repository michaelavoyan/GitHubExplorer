/**
 * Domain error -> UI copy mapping, one function colocated with the feature
 * (Architecture.md "API Integration": "Presentation maps [Domain errors] to
 * UI copy/state via one function colocated with each hook"). Table source:
 * docs/features/repository-list.md "Error surfacing".
 */

import { ApiError, NetworkError, NotFoundError, RateLimitError } from '../domain/errors/DomainErrors';
import { formatDateTime } from '../../../shared/formatDate';

export function describeRepositoryListError(error: unknown, org: string): string {
  if (error instanceof NotFoundError) {
    return `No organization named '${org}'`;
  }
  if (error instanceof RateLimitError) {
    return `GitHub API rate limit reached. Try again at ${formatDateTime(error.resetAt)}.`;
  }
  if (error instanceof NetworkError) {
    return "You're offline";
  }
  if (error instanceof ApiError) {
    return 'Something went wrong';
  }
  return 'Something went wrong';
}
