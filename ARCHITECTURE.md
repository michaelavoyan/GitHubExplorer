# Architecture

## Overview

Feature-First Clean Architecture: `Presentation → Application → Domain → Data → Infrastructure`, dependencies always pointing inward. Higher layers depend on abstractions; lower layers provide implementations.

## Application scope: Public GitHub Explorer

An unauthenticated GitHub repository explorer with three screens/flows:

1. **Organization Search**: user enters a GitHub org name (e.g. `facebook`).
2. **Repository List**: paginated repositories for that org, with loading/error/empty states, pull-to-refresh, infinite scroll, retry-after-failure, and a debounced name search/filter.
3. **Repository Details**: full metadata for a selected repository.

Plus a cross-cutting **Favorites** capability (mark/unmark, persisted across restarts).

Endpoint-and-interface-level detail lives in supporting specs under `docs/`:

- [`docs/api-contracts.md`](./docs/api-contracts.md): GitHub REST endpoints, DTOs, error taxonomy, rate limiting, cancellation.
- [`docs/native-module-spec.md`](./docs/native-module-spec.md): the required native module's full interface.
- [`docs/features/repository-list.md`](./docs/features/repository-list.md): list/pagination/search state machine and performance strategy.
- [`docs/features/favorites.md`](./docs/features/favorites.md): favorites contract and merge strategy.
- [`docs/bonus-and-optional.md`](./docs/bonus-and-optional.md): offline strategy, 50k-repo scenario, production monitoring (optional, per the assignment).
- [`USE_CASE_DIAGRAM.md`](./USE_CASE_DIAGRAM.md): whole-app use case diagram.
- [`USER_GUIDE.md`](./USER_GUIDE.md): plain end-user walkthrough of the same app.

## Folder structure

```text
src/
├── app/                          # app entry, navigation root, providers (QueryClient, stores)
├── features/
│   └── repositories/
│       ├── presentation/
│       │   ├── screens/          # OrganizationSearchScreen, RepositoryListScreen, RepositoryDetailsScreen
│       │   ├── components/       # RepositoryListItem, FavoriteButton, Loading/Error/Empty views
│       │   ├── hooks/            # useOrganizationRepositories, useRepositorySearch, useRepositoryDetails, useFavorites
│       │   └── navigation/       # feature stack param types
│       ├── application/
│       │   └── useCases/         # ListOrganizationRepositoriesUseCase, SearchOrganizationRepositoriesUseCase,
│       │                         # GetRepositoryDetailsUseCase, ToggleFavoriteUseCase, GetFavoriteRepositoriesUseCase
│       ├── domain/
│       │   ├── models/           # Repository, PagedResult
│       │   ├── repositories/     # RepositoryRepository, FavoritesRepository (interfaces)
│       │   └── errors/           # NetworkError, ApiError, RateLimitError, NotFoundError, StorageError
│       ├── data/
│       │   ├── dto/              # GitHubRepositoryDto, GitHubSearchResponseDto
│       │   ├── mappers/          # RepositoryMapper
│       │   └── repositories/     # GitHubRepositoryRepository, MmkvFavoritesRepository
│       └── storage/               # MMKV key definitions for this feature
├── shared/
├── infrastructure/
│   ├── http/                     # ApiClient, rate-limit header parsing, cancellation plumbing
│   ├── services/                 # ConnectivityService, MonitoringService (wrap src/native + SDKs)
│   └── persistence/               # MMKV instance factory, TanStack Query MMKV persister
└── native/
    └── connectivity/              # raw native module JS spec + NativeEventEmitter typing
```

Organized by feature, not technical type, so each feature can evolve independently. `docs/` (repo root, sibling to `src/`) holds the supporting specs linked above.

## Layer responsibilities

| Layer | Owns | Depends on |
|---|---|---|
| **Presentation** | Screens, UI components, navigation, hooks/view-models, UI state. No business logic or networking. | Application |
| **Application** | One use case per user action; coordinates Domain repository interfaces. No RN dependency. | Domain |
| **Domain** | Business models, repository *interfaces*, domain error taxonomy. Pure TypeScript, no framework/networking dependency. | none |
| **Data** | Repository *implementations*, API communication, DTOs, mapping, local persistence. Implements Domain's contracts. | Domain, Infrastructure |
| **Infrastructure** | HTTP client, local storage, native modules, monitoring. Platform-specific implementations. | none |

## Data flow

```
Screen → Hook → Use Case → Repository Interface → Repository Implementation → GitHub API / Local Storage
```

API responses are mapped into Domain models (via a Data-layer Mapper) before ever reaching Presentation. The UI never consumes a raw API response directly. Repository interfaces (Domain) versus implementations (Data) is the concrete form of the Repository pattern here: it lets the data source be mocked in tests and swapped without touching Application/Presentation.

## State management

| State | Solution |
|---|---|
| Server state (API data) | TanStack Query |
| UI/app-wide state (favorites, connectivity) | Zustand |
| Local component state | React hooks |

Kept separate on purpose. Server state and client state have different lifecycles and cache-invalidation needs, and one library doing both would blur that distinction.

## Theming

One hardcoded, light-only color scheme across the app; nothing reads `useColorScheme()`. Every `Text`/`TextInput` style needs an explicit `color` (and `TextInput` needs `placeholderTextColor`), since Android's platform-default text color follows the system dark/light setting even though this app's backgrounds never do. An unset color renders invisible text the instant a real device is in system dark mode, a real defect only caught by live testing on a physical device (`docs/BUGS.md` BUG-021). A deliberate scope cut, not an oversight; real dark mode support (a second palette wired to `useColorScheme()`) is a named improvement item in `DECISIONS.md` §8.

## API integration

Three unauthenticated GitHub REST endpoints: `GET /orgs/{org}/repos` (list), `GET /repos/{owner}/{repo}` (details), `GET /search/repositories` (debounced name search, scoped to the org). Full shapes/DTOs/mapping: [`docs/api-contracts.md`](./docs/api-contracts.md).

Errors are translated exactly once, at the Data-layer repository (the only place that sees raw HTTP status/headers), into a fixed Domain error taxonomy (`NetworkError`, `RateLimitError`, `NotFoundError`, `ApiError`) that Application passes through unchanged and Presentation maps to UI copy via one function per hook. Rate-limit header handling: `docs/api-contracts.md`.

Request cancellation (org change, search-query change, screen unmount) is threaded as an `AbortSignal` from TanStack Query's `queryFn` down through the Use Case and Repository Interface to the HTTP client. There's no manual cancellation bookkeeping in Presentation.

## Persistence

Favorites persist locally via MMKV, storing only the `"owner/repo"` identifier string, not GitHub's numeric id and not duplicated repository data. That lets a favorited repo be re-fetched via `GET /repos/{owner}/{repo}` after restart with no separate id-lookup table. Full contract, and why `isFavorite` stays out of the Domain `Repository` model: [`docs/features/favorites.md`](./docs/features/favorites.md).

For the offline bonus scenario, the same MMKV instance also backs a `Persister` for the TanStack Query cache (server state, not favorites): [`docs/bonus-and-optional.md`](./docs/bonus-and-optional.md).

## Native module

Presentation talks only to a Native Service (Infrastructure); the native module itself stays behind that abstraction. Concretely: **`ConnectivityModule`** (Android `ConnectivityManager`/`NetworkCallback`, iOS `NWPathMonitor`), wrapped by `ConnectivityService`. It's load-bearing, not added only to satisfy the assignment. It drives the offline banner and cache-fallback behavior, and distinguishes a real network outage from an API/rate-limit error. Full interface: [`docs/native-module-spec.md`](./docs/native-module-spec.md).

**Constraint**: no `react-native-netinfo` or equivalent. That would replace the required native module work (assignment §7), which is explicitly disallowed.

## Performance strategy

The Repository List must stay usable at the bonus scenario's 50,000-repository scale: `FlatList` virtualization with `getItemLayout` (fixed-height rows), tuned `windowSize`/`maxToRenderPerBatch`, `removeClippedSubviews` on Android, memoized rows, a page size of 50, and a capped retained-page count (`maxPages`) so memory doesn't grow unbounded across a long scroll. Name search is server-side (GitHub Search API, debounced) rather than a client-side filter over loaded pages, since the latter is silently incorrect once the org exceeds what's currently loaded. Full detail: [`docs/features/repository-list.md`](./docs/features/repository-list.md).

## Testing strategy

Mirrors the layer boundaries:

| Layer | What's tested | How |
|---|---|---|
| Domain | Models, error types, `RepositoryMapper` as a pure DTO→Domain transform | Plain unit tests, no RN/network mocking |
| Application | Use cases | Unit tests against mocked Domain repository interfaces |
| Data | `GitHubRepositoryRepository`, `MmkvFavoritesRepository` | Tests against a mocked HTTP/storage boundary; asserts DTO→Domain mapping and error translation |
| Presentation | Screens, hooks/view-models | Component/hook tests mocking use cases below; asserts no business logic leaks up |
| Infrastructure (native boundary) | `ConnectivityService` | Boundary tests mocking `NativeModules`/`NativeEventEmitter`. Native platform code itself is outside JS-test reach by construction (documented gap, `DECISIONS.md`). |

## Constraints compliance

- **No Expo**. Native module work requires React Native CLI's native project folders, which this design relies on directly.
- **No library replacing the native module work**. Connectivity monitoring is hand-written against platform APIs, not `react-native-netinfo` or equivalent. Navigation, state management, persistence (MMKV), testing, HTTP, and UI-helper libraries remain permitted per the assignment.
