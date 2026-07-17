// Tier 2 (React Native) jest setup. @testing-library/react-native v12 bundles
// its own jest-native matchers (toHaveProp, toBeDisabled, etc.) via this
// entry point. The NativeModules.ConnectivityModule shim lives in
// jest.setup.native-modules.js (runs earlier, as `setupFiles`) — see that
// file for why.
import '@testing-library/react-native/extend-expect';
