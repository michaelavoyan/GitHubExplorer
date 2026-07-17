/**
 * Infrastructure-layer service abstraction over the native ConnectivityModule.
 * Per docs/native-module-spec.md "Native Service abstraction": wraps
 * NativeModules.ConnectivityModule + a NativeEventEmitter over it, and is
 * the only thing outside src/native/ allowed to import it.
 *
 * Reference-counts subscribers so `stopMonitoring()` only fires natively
 * once the last subscriber unsubscribes — both the Data-layer repository
 * and the Presentation `connectivityStore` share ONE native listener
 * (the "listener double-registration concern" the spec calls out).
 *
 * NOT part of the pure suite: requires the `react-native` package
 * (NativeModules, NativeEventEmitter), which now exists via the RN CLI
 * scaffold. Exercised by the "react-native" jest project, not the "pure"
 * one (see jest.config.js).
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { ConnectivityChangedEvent, ConnectivityState } from '../../native/connectivity/types';

const { ConnectivityModule } = NativeModules;

/**
 * `NativeEventEmitter` requires a non-null constructor argument. On a real
 * device/simulator `ConnectivityModule` is always present (native module
 * linked at build time). This inert fallback only matters in a JS-only
 * environment where the native module was never registered (e.g. a stray
 * import path in a test file that never mocks `NativeModules` at all) —
 * it keeps module import itself from crashing; every real method call
 * still goes through the real `ConnectivityModule` whenever it exists.
 */
const FALLBACK_NATIVE_MODULE = {
  addListener: () => {},
  removeListeners: () => {},
};

// Matches the native default (`ConnectivityModule.swift`/`.kt` both fall
// back to 3000ms when no timeout is supplied) — kept in sync here since
// `isReachable()` below must always pass a concrete value across the
// bridge rather than relying on the native side's own default.
const DEFAULT_REACHABILITY_TIMEOUT_MS = 3000;

export type ConnectivityListener = (state: ConnectivityState) => void;

type EmitterSubscription = { remove: () => void };

export class ConnectivityService {
  /**
   * Deliberately instance-scoped (not module-level static) state: each
   * ConnectivityService instance owns its own NativeEventEmitter, subscriber
   * set, and reference count. The app uses exactly one instance in practice
   * (the `connectivityService` singleton below, per
   * docs/native-module-spec.md's "share one native listener" requirement) —
   * subscriber fan-out and the start/stop ref-count only need to be
   * consistent *within* one instance's lifetime, which is what
   * ConnectivityService.test.ts's per-test `new ConnectivityService()`
   * instances each verify in isolation. Constructing the emitter here
   * (rather than once at module scope) is harmless — wrapping the native
   * module stays inert until `addListener` is actually called in
   * `startNativeMonitoring()`.
   */
  private readonly eventEmitter = new NativeEventEmitter(ConnectivityModule ?? FALLBACK_NATIVE_MODULE);
  private subscribers = new Set<ConnectivityListener>();
  private eventSubscription: EmitterSubscription | null = null;

  async getState(): Promise<ConnectivityState> {
    return ConnectivityModule.getCurrentState();
  }

  async isReachable(timeoutMs?: number): Promise<boolean> {
    // Always pass a concrete number across the bridge, never `undefined`.
    // React Native's classic iOS bridge (RCTModuleMethod) rejects a method
    // whose Objective-C signature declares a `nullable NSNumber *` argument
    // — it requires all NSNumber arguments to be `nonnull` for Android
    // parity, so calling this with zero arguments crashed with
    // `RCTLogArgumentError` at runtime on iOS (Android's Kotlin bridge
    // allows a nullable boxed `Double?` natively, so this asymmetry only
    // ever surfaced on iOS). See docs/BUGS.md.
    return ConnectivityModule.checkInternetReachability(timeoutMs ?? DEFAULT_REACHABILITY_TIMEOUT_MS);
  }

  /**
   * Returns an unsubscribe function. Reference-counted: `startMonitoring()`
   * fires natively only when the subscriber count goes 0 -> 1;
   * `stopMonitoring()` only when it drops back to 0. The single
   * `connectivityChanged` NativeEventEmitter listener is registered/removed
   * in lockstep with that same transition, so the native module is never
   * double-registered regardless of how many Data/Presentation consumers
   * subscribe.
   */
  subscribe(listener: ConnectivityListener): () => void {
    this.subscribers.add(listener);
    if (this.subscribers.size === 1) {
      this.startNativeMonitoring();
    }

    let unsubscribed = false;
    return () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      this.subscribers.delete(listener);
      if (this.subscribers.size === 0) {
        this.stopNativeMonitoring();
      }
    };
  }

  private startNativeMonitoring(): void {
    ConnectivityModule.startMonitoring().catch(() => {
      // { code: 'MONITOR_START_FAILED' } — non-fatal per
      // docs/native-module-spec.md; the event listener stays registered so
      // a later manual retry (or platform callback) can still deliver state.
    });
    this.eventSubscription = this.eventEmitter.addListener(
      'connectivityChanged',
      (event: ConnectivityChangedEvent) => {
        this.subscribers.forEach((listener) => listener(event));
      },
    );
  }

  private stopNativeMonitoring(): void {
    this.eventSubscription?.remove();
    this.eventSubscription = null;
    ConnectivityModule.stopMonitoring().catch(() => {
      // { code: 'MONITOR_STOP_FAILED' } — non-fatal per
      // docs/native-module-spec.md; log and continue.
    });
  }
}

export const connectivityService = new ConnectivityService();
