/**
 * Infrastructure-layer storage boundary. Deliberately abstracted away from
 * the concrete `react-native-mmkv` (or whichever MMKV binding the developer
 * agent picks) so Data-layer persistence tests (MmkvFavoritesRepository)
 * can run against a plain in-memory fake, with zero native dependency, per
 * the qa agent's "test repository implementations against a mocked
 * HTTP/storage boundary" mandate.
 *
 * The real MMKV instance factory (src/infrastructure/persistence/ in
 * Architecture.md's folder structure) is developer-agent implementation
 * work, not scaffolded here — it requires the RN CLI scaffold to link the
 * native MMKV binding.
 */

export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}
