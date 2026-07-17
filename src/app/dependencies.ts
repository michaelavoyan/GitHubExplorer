/**
 * Composition root (BUG-004 fix, docs/BUGS.md).
 *
 * The single place in the app that wires Infrastructure-layer singletons
 * (`apiClient`, `connectivityService`, `mmkvKeyValueStorage`) into
 * Data-layer repository implementations, and those repositories into
 * Application-layer use cases. Presentation hooks import
 * already-constructed use case instances (and the favorites store) from
 * this module instead of importing `data/`/`native/` directly and
 * constructing their own Data-layer classes at module scope, which is what
 * BUG-004 flagged as a real, mechanically-detectable violation of
 * Architecture.md's "Dependencies always point inward" rule.
 *
 * This intentionally stays a plain module of factory-constructed
 * singletons — no DI container/framework, per the smallest-change
 * resolution for BUG-004. `src/app/` already plays this role for the
 * connectivity store (see `src/app/store/connectivityStore.ts`), so this
 * follows an established pattern rather than inventing a new one.
 *
 * Superseded trade-off: DECISIONS.md §7 previously rejected a single shared
 * composition root here on the grounds that it would eagerly import MMKV
 * into every hook test. That concern is now moot — `__mocks__/react-native-mmkv.js`
 * is a manual mock Jest applies automatically to any module that imports
 * `react-native-mmkv`, with no per-test-file `jest.mock()` needed, so the
 * "blast radius" DECISIONS.md worried about doesn't apply.
 */

import { apiClient } from '../infrastructure/http/FetchApiClient';
import { connectivityService } from '../infrastructure/services/ConnectivityService';
import { mmkvKeyValueStorage } from '../infrastructure/persistence/MmkvKeyValueStorage';
import { GitHubRepositoryRepository } from '../features/repositories/data/repositories/GitHubRepositoryRepository';
import { MmkvFavoritesRepository } from '../features/repositories/data/repositories/MmkvFavoritesRepository';
import { ListOrganizationRepositoriesUseCase } from '../features/repositories/application/useCases/ListOrganizationRepositoriesUseCase';
import { SearchOrganizationRepositoriesUseCase } from '../features/repositories/application/useCases/SearchOrganizationRepositoriesUseCase';
import { GetRepositoryDetailsUseCase } from '../features/repositories/application/useCases/GetRepositoryDetailsUseCase';
import { ToggleFavoriteUseCase } from '../features/repositories/application/useCases/ToggleFavoriteUseCase';
import { GetFavoriteRepositoriesUseCase } from '../features/repositories/application/useCases/GetFavoriteRepositoriesUseCase';
import { createFavoritesStore } from '../features/repositories/presentation/hooks/favoritesStore';

const repositoryRepository = new GitHubRepositoryRepository(apiClient, connectivityService);
const favoritesRepository = new MmkvFavoritesRepository(mmkvKeyValueStorage);

export const listOrganizationRepositoriesUseCase = new ListOrganizationRepositoriesUseCase(repositoryRepository);
export const searchOrganizationRepositoriesUseCase = new SearchOrganizationRepositoriesUseCase(repositoryRepository);
export const getRepositoryDetailsUseCase = new GetRepositoryDetailsUseCase(repositoryRepository);
export const toggleFavoriteUseCase = new ToggleFavoriteUseCase(favoritesRepository);
export const getFavoriteRepositoriesUseCase = new GetFavoriteRepositoriesUseCase(
  favoritesRepository,
  repositoryRepository,
);

export const useFavoritesStore = createFavoritesStore({ toggleFavoriteUseCase, favoritesRepository });
