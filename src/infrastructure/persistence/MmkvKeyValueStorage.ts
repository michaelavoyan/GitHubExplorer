/**
 * Concrete `KeyValueStorage` implementation over the shared MMKV instance.
 * `MmkvFavoritesRepository` (Data layer) depends on the `KeyValueStorage`
 * interface, not this file directly, so it stays testable against an
 * in-memory fake (see MmkvFavoritesRepository.test.ts).
 */

import { KeyValueStorage } from './KeyValueStorage';
import { mmkv } from './MmkvInstance';

export const mmkvKeyValueStorage: KeyValueStorage = {
  getString: (key: string) => mmkv.getString(key),
  set: (key: string, value: string) => {
    mmkv.set(key, value);
  },
  delete: (key: string) => {
    mmkv.delete(key);
  },
};
