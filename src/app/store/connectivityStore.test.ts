/**
 * connectivityStore tests. Focused on the BUG-015 fix (docs/BUGS.md): the
 * `AppState` foreground-reconciliation fallback added alongside the
 * pre-existing native `connectivityChanged` subscription, and that both are
 * torn down by the single returned unsubscribe function.
 *
 * Mocks `connectivityService` directly rather than `NativeModules`/
 * `NativeEventEmitter` — that lower boundary (reference-counting, promise
 * resolution/rejection mapping, subscriber fan-out) is already
 * ConnectivityService.test.ts's job; this file's unit under test is the
 * store's own wiring/reconciliation logic. `AppState` is mocked directly
 * from `react-native` so a 'change' event can be simulated deterministically.
 */

jest.mock('../../infrastructure/services/ConnectivityService', () => ({
  connectivityService: {
    getState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const listeners: Array<(state: string) => void> = [];
  return {
    AppState: {
      addEventListener: jest.fn((_event: string, cb: (state: string) => void) => {
        listeners.push(cb);
        return {
          remove: jest.fn(() => {
            const index = listeners.indexOf(cb);
            if (index >= 0) {
              listeners.splice(index, 1);
            }
          }),
        };
      }),
      __emit: (state: string) => {
        listeners.slice().forEach((cb) => cb(state));
      },
    },
  };
});

import { AppState } from 'react-native';
import { connectivityService } from '../../infrastructure/services/ConnectivityService';
import { initConnectivityMonitoring, onReconnect, useConnectivityStore } from './connectivityStore';

const mockGetState = connectivityService.getState as jest.Mock;
const mockSubscribe = connectivityService.subscribe as jest.Mock;
const emitAppStateChange = (AppState as unknown as { __emit: (state: string) => void }).__emit;

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('connectivityStore / initConnectivityMonitoring (BUG-015)', () => {
  beforeEach(() => {
    useConnectivityStore.setState({ isConnected: true, type: 'unknown', hasHydrated: false });
    mockSubscribe.mockReturnValue(jest.fn());
  });

  it('re-polls getState() and reconciles the store when AppState transitions to active', async () => {
    mockGetState
      .mockResolvedValueOnce({ isConnected: false, type: 'none', isInternetReachable: false }) // initial mount snapshot
      .mockResolvedValueOnce({ isConnected: true, type: 'wifi', isInternetReachable: true }); // foreground reconciliation

    const unsubscribe = initConnectivityMonitoring();
    await flush();

    expect(useConnectivityStore.getState().isConnected).toBe(false);

    emitAppStateChange('active');
    await flush();

    expect(mockGetState).toHaveBeenCalledTimes(2);
    expect(useConnectivityStore.getState().isConnected).toBe(true);
    expect(useConnectivityStore.getState().type).toBe('wifi');

    unsubscribe();
  });

  it('does not re-poll on a transition to background/inactive', async () => {
    mockGetState.mockResolvedValue({ isConnected: true, type: 'wifi', isInternetReachable: true });
    const unsubscribe = initConnectivityMonitoring();
    await flush();
    mockGetState.mockClear();

    emitAppStateChange('background');
    await flush();

    expect(mockGetState).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('a getState() rejection during foreground reconciliation is swallowed and leaves the prior store state intact', async () => {
    mockGetState
      .mockResolvedValueOnce({ isConnected: true, type: 'wifi', isInternetReachable: true })
      .mockRejectedValueOnce({ code: 'CONNECTIVITY_UNAVAILABLE' });

    const unsubscribe = initConnectivityMonitoring();
    await flush();

    emitAppStateChange('active');
    await flush();

    expect(useConnectivityStore.getState().isConnected).toBe(true);
    unsubscribe();
  });

  it('the returned unsubscribe function tears down both the native subscription and the AppState listener', () => {
    const unsubscribeNative = jest.fn();
    mockSubscribe.mockReturnValue(unsubscribeNative);
    mockGetState.mockResolvedValue({ isConnected: true, type: 'wifi', isInternetReachable: true });

    const removeAppStateListener = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValueOnce({ remove: removeAppStateListener });

    const unsubscribe = initConnectivityMonitoring();
    unsubscribe();

    expect(unsubscribeNative).toHaveBeenCalledTimes(1);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
  });

  it('after unsubscribe, a later AppState transition to active no longer re-polls', async () => {
    mockGetState.mockResolvedValue({ isConnected: true, type: 'wifi', isInternetReachable: true });
    const unsubscribe = initConnectivityMonitoring();
    await flush();
    unsubscribe();
    mockGetState.mockClear();

    emitAppStateChange('active');
    await flush();

    expect(mockGetState).not.toHaveBeenCalled();
  });
});

describe('onReconnect (docs/bonus-and-optional.md §9.1)', () => {
  it('fires the callback on a false -> true transition', () => {
    useConnectivityStore.setState({ isConnected: false, type: 'none', hasHydrated: true });
    const callback = jest.fn();
    const unsubscribe = onReconnect(callback);

    useConnectivityStore.setState({ isConnected: true, type: 'wifi', hasHydrated: true });

    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not fire on the initial value, or on a true -> true / false -> false update', () => {
    useConnectivityStore.setState({ isConnected: true, type: 'wifi', hasHydrated: true });
    const callback = jest.fn();
    const unsubscribe = onReconnect(callback);

    // true -> true (e.g. a type change with no connectivity change)
    useConnectivityStore.setState({ isConnected: true, type: 'cellular', hasHydrated: true });
    expect(callback).not.toHaveBeenCalled();

    useConnectivityStore.setState({ isConnected: false, type: 'none', hasHydrated: true });
    // false -> false
    useConnectivityStore.setState({ isConnected: false, type: 'none', hasHydrated: true });
    expect(callback).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('does not fire again after unsubscribe', () => {
    useConnectivityStore.setState({ isConnected: false, type: 'none', hasHydrated: true });
    const callback = jest.fn();
    const unsubscribe = onReconnect(callback);
    unsubscribe();

    useConnectivityStore.setState({ isConnected: true, type: 'wifi', hasHydrated: true });
    expect(callback).not.toHaveBeenCalled();
  });
});
