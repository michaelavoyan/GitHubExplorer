/**
 * Single shared MMKV instance for the app. Backs both the Favorites
 * repository (src/features/repositories/data/repositories/MmkvFavoritesRepository.ts)
 * and the TanStack Query offline persister (docs/bonus-and-optional.md §9.1),
 * per Architecture.md's "Persistence" section: one MMKV instance, multiple
 * logically-separated keys.
 */

import { MMKV } from 'react-native-mmkv';

export const mmkv = new MMKV({ id: 'github-explorer-storage' });
