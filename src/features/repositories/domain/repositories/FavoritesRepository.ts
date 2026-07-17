/**
 * Domain repository contract (interface only — implemented in Data by
 * MmkvFavoritesRepository). Pure TypeScript. Per docs/features/favorites.md
 * "Domain contract: FavoritesRepository".
 *
 * Ids are `fullName` strings ("owner/repo"), per the explicit id-format
 * decision in docs/features/favorites.md — not GitHub's numeric id.
 */

export interface FavoritesRepository {
  getAll(): Promise<string[]>;
  add(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  isFavorite(id: string): Promise<boolean>;
}
