# GitHubExplorer

An unauthenticated, React Native CLI app for exploring GitHub organizations and their public repositories: search an org, browse and filter its repos, view full repository details, and favorite repos for offline access.

Built with Feature-First Clean Architecture (`Presentation → Application → Domain → Data → Infrastructure`), TanStack Query + Zustand for server/client state, offline favorites via MMKV, and a custom native connectivity module (no `react-native-netinfo`).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the technical design and [`USER_GUIDE.md`](./USER_GUIDE.md) for a plain walkthrough of the app's behavior.

## Requirements

- Node >= 18
- Yarn 1.x (Classic)
- Ruby + Bundler (for CocoaPods, iOS only)
- A configured React Native environment — see the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment) for Xcode/Android Studio prerequisites

## Getting started

```bash
yarn install

# iOS only: install CocoaPods dependencies
yarn pods
```

### Run the app

```bash
yarn start        # Metro bundler
yarn android       # Run on Android
yarn ios           # Run on iOS
```

## Scripts

| Command | Description |
|---|---|
| `yarn start` | Start the Metro bundler |
| `yarn android` | Build and run on Android |
| `yarn ios` | Build and run on iOS |
| `yarn test` | Run the Jest test suite |
| `yarn test:watch` | Run tests in watch mode |
| `yarn lint` | Lint with ESLint |
| `yarn typecheck` | Type-check with `tsc --noEmit` |
| `yarn pods` | Install CocoaPods dependencies (`ios/`) |

## Project structure

```text
src/
├── app/              # Entry point, navigation root, providers (QueryClient, stores)
├── features/
│   └── repositories/ # Presentation → Application → Domain → Data, per feature
├── infrastructure/    # HTTP client, MMKV persistence, connectivity/monitoring services
└── native/            # Native module JS spec (connectivity)
```

Full layer responsibilities, data flow, state management, and performance strategy are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Testing

```bash
yarn test
```

Tests are split by dependency: pure Domain/Application/Data logic runs under `ts-jest` + Node, while Presentation and the native-module boundary run under the React Native Jest preset. See `jest.config.js` for the project split.

## License

MIT — see [`LICENSE`](./LICENSE).
