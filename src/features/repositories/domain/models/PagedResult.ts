/**
 * Domain model. Pure TypeScript.
 * Shape per docs/api-contracts.md endpoint #1:
 * `{ items: Repository[], nextPage: number | null }`.
 */

export interface PagedResult<T> {
  items: T[];
  nextPage: number | null;
}
