/**
 * TanStack Query MMKV-backed persister, per docs/bonus-and-optional.md §9.1
 * ("Offline strategy"): persist the Query cache (already-mapped Domain
 * models, not raw API responses, since persistence happens after the
 * queryFn returns) to the same MMKV instance used for favorites, under a
 * distinct key so the two never collide.
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { mmkv } from './MmkvInstance';

const QUERY_CACHE_STORAGE_KEY = 'query-cache.persisted';

/** Adapts the synchronous MMKV instance to the `Storage`-like interface
 * `createSyncStoragePersister` expects (getItem/setItem/removeItem). */
const mmkvSyncStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * The default `deserialize` is bare `JSON.parse`, which does not revive
 * `Date` instances — `JSON.stringify` turns every `Date` field on cached
 * `Repository` domain models (`createdAt`/`updatedAt`) into a plain ISO
 * string, and plain `JSON.parse` leaves it a string. Every consumer of
 * persisted/rehydrated cache data (e.g. `formatDate`) expects a real `Date`
 * per the Domain model's type contract, so a real device/simulator crashed
 * with `TypeError: date.getMonth is not a function` the moment a cold
 * launch restored a previously-persisted cache — only reproducible by
 * actually persisting real data and relaunching, not by any unit test
 * (Jest never exercises a real hydrate-from-MMKV round trip end to end).
 * See docs/BUGS.md.
 */
function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    return new Date(value);
  }
  return value;
}

export const queryPersister = createSyncStoragePersister({
  storage: mmkvSyncStorage,
  key: QUERY_CACHE_STORAGE_KEY,
  serialize: JSON.stringify,
  deserialize: (cachedString: string) => JSON.parse(cachedString, reviveDates),
});
