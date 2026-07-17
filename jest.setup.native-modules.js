/* eslint-env jest */
// BUG-005 fix (docs/BUGS.md): this file runs as a jest `setupFiles` entry
// and uses the global `jest` object, but isn't itself a `*.test.*` file, so
// it doesn't automatically pick up the jest env from the shared
// `@react-native` ESLint config's test-file glob. The explicit env comment
// above scopes `no-undef`'s `jest` allowance to just this file.
// Runs as `setupFiles` (before the test framework is installed, earlier
// than `setupFilesAfterEnv`) — early enough to be in place before Jest's
// automocking machinery (triggered by a bare `jest.mock('./someHookModule')`
// with no factory, which still requires the *real* module once to infer its
// shape) transitively imports the `connectivityService` singleton and
// constructs `new NativeEventEmitter(NativeModules.ConnectivityModule)`.
// See jest.setup.rn.js for the rationale; split into its own earlier-phase
// file because setupFilesAfterEnv alone was too late for automocked
// Presentation test files (e.g. RepositoryListScreen.test.tsx).
const { NativeModules } = require('react-native');

if (!NativeModules.ConnectivityModule) {
  NativeModules.ConnectivityModule = {
    getCurrentState: jest.fn(() =>
      Promise.resolve({ isConnected: true, type: 'unknown', isInternetReachable: true }),
    ),
    checkInternetReachability: jest.fn(() => Promise.resolve(true)),
    startMonitoring: jest.fn(() => Promise.resolve()),
    stopMonitoring: jest.fn(() => Promise.resolve()),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
}
