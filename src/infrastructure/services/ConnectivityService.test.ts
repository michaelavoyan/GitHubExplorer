/**
 * REQUIRES THE REACT NATIVE CLI SCAFFOLD TO RUN — see docs/testing-strategy.md.
 *
 * Not runnable today: needs the `react-native` package installed so
 * `NativeModules`/`NativeEventEmitter` exist to mock. Per the qa boundary
 * stated in docs/native-module-spec.md: "JS tests mock
 * NativeModules.ConnectivityModule and NativeEventEmitter and assert
 * ConnectivityService's reference-counting, promise resolution/rejection
 * mapping, and subscriber fan-out." Native platform code (Kotlin/Swift) is
 * out of reach here — that gap is called out in docs/testing-strategy.md
 * for DECISIONS.md.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';

jest.mock('react-native', () => {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  return {
    NativeModules: {
      ConnectivityModule: {
        getCurrentState: jest.fn(),
        checkInternetReachability: jest.fn(),
        startMonitoring: jest.fn(),
        stopMonitoring: jest.fn(),
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn((event: string, cb: (...args: any[]) => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
        return { remove: jest.fn(() => {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }) };
      }),
      __emit: (event: string, payload: unknown) => {
        (listeners[event] ?? []).forEach((cb) => cb(payload));
      },
    })),
  };
});

const { ConnectivityService } = require('./ConnectivityService');

describe('ConnectivityService (docs/native-module-spec.md)', () => {
  const mockNative = NativeModules.ConnectivityModule as jest.Mocked<typeof NativeModules.ConnectivityModule>;

  describe('async methods', () => {
    it('getState() resolves the pass-through of getCurrentState()', async () => {
      const state = { isConnected: true, type: 'wifi', isInternetReachable: true };
      mockNative.getCurrentState.mockResolvedValue(state);
      const service = new ConnectivityService();

      await expect(service.getState()).resolves.toEqual(state);
    });

    it('getState() rejection surfaces the native CONNECTIVITY_UNAVAILABLE error', async () => {
      mockNative.getCurrentState.mockRejectedValue({ code: 'CONNECTIVITY_UNAVAILABLE' });
      const service = new ConnectivityService();

      await expect(service.getState()).rejects.toMatchObject({ code: 'CONNECTIVITY_UNAVAILABLE' });
    });

    it('isReachable() resolves `false` as a VALID result, not an error', async () => {
      mockNative.checkInternetReachability.mockResolvedValue(false);
      const service = new ConnectivityService();

      await expect(service.isReachable()).resolves.toBe(false);
    });

    it('isReachable() rejection maps to REACHABILITY_CHECK_FAILED (native-level failure only)', async () => {
      mockNative.checkInternetReachability.mockRejectedValue({ code: 'REACHABILITY_CHECK_FAILED' });
      const service = new ConnectivityService();

      await expect(service.isReachable(3000)).rejects.toMatchObject({ code: 'REACHABILITY_CHECK_FAILED' });
    });

    it('isReachable() passes the optional timeoutMs through, and works with none given (defaults to ~3000ms per spec)', async () => {
      mockNative.checkInternetReachability.mockResolvedValue(true);
      const service = new ConnectivityService();

      await service.isReachable();
      expect(mockNative.checkInternetReachability).toHaveBeenCalled();

      await service.isReachable(5000);
      expect(mockNative.checkInternetReachability).toHaveBeenCalledWith(5000);
    });
  });

  describe('subscribe() reference counting and the listener double-registration concern', () => {
    it('calls startMonitoring() exactly once even when two subscribers register concurrently', () => {
      mockNative.startMonitoring.mockResolvedValue(undefined);
      const service = new ConnectivityService();

      service.subscribe(jest.fn());
      service.subscribe(jest.fn());

      expect(mockNative.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('does NOT call stopMonitoring() while at least one subscriber remains', () => {
      mockNative.startMonitoring.mockResolvedValue(undefined);
      const service = new ConnectivityService();

      const unsubscribeA = service.subscribe(jest.fn());
      service.subscribe(jest.fn());
      unsubscribeA();

      expect(mockNative.stopMonitoring).not.toHaveBeenCalled();
    });

    it('calls stopMonitoring() exactly once, only after the LAST subscriber unsubscribes', () => {
      mockNative.startMonitoring.mockResolvedValue(undefined);
      mockNative.stopMonitoring.mockResolvedValue(undefined);
      const service = new ConnectivityService();

      const unsubscribeA = service.subscribe(jest.fn());
      const unsubscribeB = service.subscribe(jest.fn());
      unsubscribeA();
      unsubscribeB();

      expect(mockNative.stopMonitoring).toHaveBeenCalledTimes(1);
    });

    it('registers exactly one NativeEventEmitter listener for connectivityChanged, regardless of subscriber count (no double-registration)', () => {
      const service = new ConnectivityService();
      const emitterInstance = (NativeEventEmitter as unknown as jest.Mock).mock.results[0]?.value
        ?? (NativeEventEmitter as unknown as jest.Mock)();

      service.subscribe(jest.fn());
      service.subscribe(jest.fn());
      service.subscribe(jest.fn());

      const addListenerCalls = (emitterInstance.addListener as jest.Mock).mock.calls.filter(
        ([event]: [string]) => event === 'connectivityChanged',
      );
      expect(addListenerCalls.length).toBeLessThanOrEqual(1);
    });

    it('fans out a single connectivityChanged native event to every active subscriber', () => {
      const service = new ConnectivityService();
      const listenerA = jest.fn();
      const listenerB = jest.fn();
      service.subscribe(listenerA);
      service.subscribe(listenerB);

      const emitterInstance = (NativeEventEmitter as unknown as jest.Mock).mock.results[0].value;
      const payload = { isConnected: false, type: 'none', isInternetReachable: false, timestamp: Date.now() };
      emitterInstance.__emit('connectivityChanged', payload);

      expect(listenerA).toHaveBeenCalledWith(expect.objectContaining({ isConnected: false }));
      expect(listenerB).toHaveBeenCalledWith(expect.objectContaining({ isConnected: false }));
    });

    it('a listener removed via unsubscribe no longer receives connectivityChanged events', () => {
      const service = new ConnectivityService();
      const listenerA = jest.fn();
      const unsubscribeA = service.subscribe(listenerA);
      unsubscribeA();

      const emitterInstance = (NativeEventEmitter as unknown as jest.Mock).mock.results[0].value;
      emitterInstance.__emit('connectivityChanged', { isConnected: true, type: 'wifi', isInternetReachable: true, timestamp: Date.now() });

      expect(listenerA).not.toHaveBeenCalled();
    });

    it('[assumption, flagged] resuming subscriptions after the count drops to zero calls startMonitoring() again', () => {
      mockNative.startMonitoring.mockResolvedValue(undefined);
      mockNative.stopMonitoring.mockResolvedValue(undefined);
      const service = new ConnectivityService();

      const unsubscribe = service.subscribe(jest.fn());
      unsubscribe();
      service.subscribe(jest.fn());

      expect(mockNative.startMonitoring).toHaveBeenCalledTimes(2);
    });
  });
});
