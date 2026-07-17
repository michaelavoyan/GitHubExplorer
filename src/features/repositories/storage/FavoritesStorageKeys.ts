/**
 * MMKV key definitions for this feature, per Architecture.md's `storage/`
 * folder convention. Single key, JSON-serialized string[] of `fullName`
 * ids — no repository data duplicated, per docs/features/favorites.md
 * "Persistence" section.
 *
 * SPEC NOTE: docs/features/favorites.md gives this key name as an example
 * ("e.g. `favorites.repoFullNames`"), not a mandated literal — treat this
 * constant as the qa/developer-agreed default, not a locked contract.
 */

export const FAVORITES_STORAGE_KEY = 'favorites.repoFullNames';
