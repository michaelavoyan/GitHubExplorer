/**
 * Presentation-layer connectivity store (Zustand, UI state only), per
 * docs/native-module-spec.md "Consumers" §2 and
 * docs/bonus-and-optional.md §9.1: subscribes to `ConnectivityService`
 * once at app root, drives the offline banner, and never imports
 * `src/native/connectivity` directly (Presentation -> Native Service ->
 * Native Module only).
 */

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import { connectivityService } from '../../infrastructure/services/ConnectivityService';
import { ConnectivityState } from '../../native/connectivity/types';

interface ConnectivityStore {
  isConnected: boolean;
  type: ConnectivityState['type'];
  hasHydrated: boolean;
  setState: (state: ConnectivityState) => void;
}

export const useConnectivityStore = create<ConnectivityStore>((set) => ({
  isConnected: true,
  type: 'unknown',
  hasHydrated: false,
  setState: (state) => set({ isConnected: state.isConnected, type: state.type, hasHydrated: true }),
}));

/**
 * Call once at app root (see src/app/AppProviders.tsx). Returns the
 * unsubscribe function for symmetry, though the app root never tears it
 * down in practice.
 *
 * BUG-015 fix (docs/BUGS.md): in addition to the native `connectivityChanged`
 * event subscription below, this also registers an `AppState` listener that
 * re-polls `connectivityService.getState()` and reconciles the store
 * whenever the app returns to the foreground. This is a self-healing
 * fallback independent of the native-side fix in ConnectivityModule.swift/
 * .kt — it also covers any future platform-level event-delivery gap, not
 * just the specific one that caused BUG-015. Prior to this fix there was no
 * JS-side fallback of any kind: the store was set once at app start and
 * otherwise depended entirely on the native event stream never missing a
 * beat.
 */
export function initConnectivityMonitoring(): () => void {
  const reconcileFromNativeSnapshot = () => {
    connectivityService
      .getState()
      .then((state) => useConnectivityStore.getState().setState(state))
      .catch(() => {
        // CONNECTIVITY_UNAVAILABLE — leave the current store state in place.
      });
  };

  reconcileFromNativeSnapshot();

  const unsubscribeNative = connectivityService.subscribe((state) => {
    useConnectivityStore.getState().setState(state);
  });

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState !== 'active') {
      return;
    }
    reconcileFromNativeSnapshot();
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    unsubscribeNative();
    appStateSubscription.remove();
  };
}

/**
 * docs/bonus-and-optional.md §9.1: "triggers a one-time background refetch
 * of mounted queries when connectivity returns". Fires `callback` on each
 * false -> true transition of `isConnected` (never on the initial value,
 * and never again for a transition that isn't a genuine reconnect, e.g.
 * true -> true or false -> false). Kept in this module rather than
 * composed inline in `AppProviders` so the transition-edge logic has its
 * own unit coverage, independent of a TanStack Query import here.
 */
export function onReconnect(callback: () => void): () => void {
  let wasConnected = useConnectivityStore.getState().isConnected;
  return useConnectivityStore.subscribe((state) => {
    if (!wasConnected && state.isConnected) {
      callback();
    }
    wasConnected = state.isConnected;
  });
}
