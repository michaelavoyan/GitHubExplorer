import Foundation
import Network
import React

/**
 * ConnectivityModule — the app's required native module (assignment §6),
 * hand-written against iOS's `NWPathMonitor` per docs/native-module-spec.md.
 * Classic (bridge) RCTEventEmitter subclass — the project has the New
 * Architecture disabled, so this intentionally does not use TurboModules/
 * Codegen. Exposed to the bridge via ConnectivityModule.m's
 * RCT_EXTERN_MODULE/RCT_EXTERN_METHOD declarations.
 *
 * 4 async methods (getCurrentState, checkInternetReachability,
 * startMonitoring, stopMonitoring) and the `connectivityChanged` event,
 * matching src/native/connectivity/NativeConnectivityModule.ts and
 * src/native/connectivity/types.ts.
 *
 * BUG-003 fix (docs/BUGS.md): all 4 methods previously accepted a
 * `reject`/`rejecter` block but never called it, so every native-level
 * failure silently resolved as success — a real platform asymmetry with
 * Android's ConnectivityModule.kt, which wraps every method body in
 * try/catch and rejects with the matching spec'd error code. Each method
 * below now has a genuine failure path, symmetric with Android's
 * try/catch-and-reject shape:
 *  - `getCurrentState`: `fetchCurrentPath` now has a timeout guard — if no
 *    path update ever arrives, that's treated as a native-level failure to
 *    determine connectivity and rejects `CONNECTIVITY_UNAVAILABLE`
 *    (mirrors Android's `connectivityManager ?: throw`-equivalent path).
 *  - `checkInternetReachability`: distinguishes an ordinary "not reachable"
 *    outcome (POSIX/DNS-level connection failure — e.g. timeout, refused,
 *    host unreachable — matches Android's `IOException` catch in
 *    `probeInternetReachability`, which also resolves `false`) from a
 *    genuine native-level failure (any other `NWError`), which rejects
 *    `REACHABILITY_CHECK_FAILED`. A timeout still resolves `false`, per the
 *    spec's "a `false` result is a valid resolution, not an error".
 *  - `startMonitoring`/`stopMonitoring`: reject `MONITOR_START_FAILED`/
 *    `MONITOR_STOP_FAILED` if called after the module has been invalidated
 *    by the bridge (`invalidate()`, the standard `RCTInvalidating` hook
 *    `RCTEventEmitter` conforms to) — a real failure mode (bridge
 *    reload/teardown racing a pending call), not a contrived one.
 */
@objc(ConnectivityModule)
class ConnectivityModule: RCTEventEmitter {

  private struct ConnectivityState: Equatable {
    let isConnected: Bool
    let type: String
    let isInternetReachable: Bool

    func toDictionary() -> [String: Any] {
      ["isConnected": isConnected, "type": type, "isInternetReachable": isInternetReachable]
    }
  }

  private var monitor: NWPathMonitor?
  private let monitorQueue = DispatchQueue(label: "com.githubexplorer.connectivity.monitor")
  private var hasListeners = false
  private var lastEmittedState: ConnectivityState?
  private var isInvalidated = false

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    ["connectivityChanged"]
  }

  // RCTEventEmitter ref-counting hooks — required even though JS only ever
  // talks to this module through NativeEventEmitter, never directly.
  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // RCTInvalidating (RCTEventEmitter conforms to it): called by the bridge
  // on reload/teardown. Used by startMonitoring/stopMonitoring below as a
  // genuine "the platform listener can't register/deregister" failure mode.
  override func invalidate() {
    isInvalidated = true
    monitor?.cancel()
    monitor = nil
    super.invalidate()
  }

  // MARK: - Async methods

  // BUG-016 fix (docs/BUGS.md): this used to short-circuit to
  // `monitor.currentPath` whenever a long-lived monitor was already running
  // (true for the app's entire lifetime after the first `startMonitoring()`
  // call). `currentPath` is a cached property fed only by the same
  // `NWPathMonitor.pathUpdateHandler` that `handlePathUpdate` above
  // consumes — QA live-reproduced a case where that handler silently failed
  // to deliver a reconnect callback for 3.5+ minutes after a real,
  // host-confirmed connectivity restoration (iOS Simulator), so the cached
  // read returned the same stale answer the broken event stream would have.
  // This defeated the BUG-015 `AppState` fallback (`connectivityStore.ts`'s
  // `reconcileFromNativeSnapshot`), whose entire purpose is to be an
  // *independent* re-check: it called `getState()` -> here -> the same
  // stale cache, so it was never actually independent.
  //
  // Fix: always take the fresh-probe path (`fetchCurrentPath`, the same
  // short-lived monitor BUG-003's `CONNECTIVITY_UNAVAILABLE` timeout guard
  // already uses for the "no monitor yet" case) regardless of whether a
  // long-lived monitor is already running. A fresh `NWPathMonitor`'s first
  // `pathUpdateHandler` callback reliably fires almost immediately with the
  // OS's current snapshot (confirmed empirically: a full app restart, which
  // is exactly "create a fresh NWPathMonitor", resolved correctly on its
  // very first call every time QA tried it) — `fetchCurrentPath`'s existing
  // 3s timeout only bounds the genuine-failure case, so this trades an
  // effectively-immediate cached read for an effectively-immediate fresh
  // one in the common case, with the same 3s worst-case ceiling BUG-003
  // already established as acceptable for this method.
  @objc(getCurrentState:rejecter:)
  func getCurrentState(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    fetchCurrentPath(
      completion: { [weak self] path in
        guard let self = self else { return }
        resolve(self.makeState(from: path).toDictionary())
      },
      onFailure: {
        reject("CONNECTIVITY_UNAVAILABLE", "Unable to determine the current network path", nil)
      }
    )
  }

  /// Active reachability probe (raw TCP connect), distinct from "radio is
  /// up" — catches e.g. a captive portal. A `false` resolution is a valid
  /// result (ordinary POSIX/DNS-level connection failure, e.g. timeout,
  /// refused, host unreachable — matches Android's `IOException` catch in
  /// `probeInternetReachability`, which also resolves `false`); `reject` is
  /// reserved for a genuine native-level failure to perform the check at
  /// all (any other `NWError`).
  @objc(checkInternetReachability:resolver:rejecter:)
  func checkInternetReachability(
    _ timeoutMs: NSNumber,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let timeoutSeconds = timeoutMs.doubleValue / 1000.0
    let connection = NWConnection(host: "8.8.8.8", port: 53, using: .tcp)

    var didComplete = false
    let completeOnce: (Result<Bool, NWError>) -> Void = { result in
      if didComplete { return }
      didComplete = true
      connection.cancel()
      switch result {
      case .success(let reachable):
        resolve(reachable)
      case .failure(let error):
        reject("REACHABILITY_CHECK_FAILED", error.debugDescription, error)
      }
    }

    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        completeOnce(.success(true))
      case .cancelled:
        completeOnce(.success(false))
      case .failed(let error):
        if Self.isOrdinaryConnectivityFailure(error) {
          completeOnce(.success(false))
        } else {
          completeOnce(.failure(error))
        }
      default:
        break
      }
    }

    connection.start(queue: monitorQueue)
    monitorQueue.asyncAfter(deadline: .now() + timeoutSeconds) {
      // A timeout means "not reachable within budget", not a native-level
      // failure to perform the probe — resolves `false`, per spec.
      completeOnce(.success(false))
    }
  }

  /// Distinguishes an ordinary "the network isn't reachable" outcome
  /// (POSIX-level connection failure, or DNS failure) from an unexpected
  /// framework-internal error that means the probe itself couldn't run.
  private static func isOrdinaryConnectivityFailure(_ error: NWError) -> Bool {
    switch error {
    case .posix, .dns:
      return true
    default:
      return false
    }
  }

  @objc(startMonitoring:rejecter:)
  func startMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !isInvalidated else {
      reject("MONITOR_START_FAILED", "ConnectivityModule has been invalidated", nil)
      return
    }
    if monitor == nil {
      let newMonitor = NWPathMonitor()
      newMonitor.pathUpdateHandler = { [weak self] path in
        self?.handlePathUpdate(path)
      }
      newMonitor.start(queue: monitorQueue)
      monitor = newMonitor
    }
    resolve(NSNull())
  }

  @objc(stopMonitoring:rejecter:)
  func stopMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !isInvalidated else {
      reject("MONITOR_STOP_FAILED", "ConnectivityModule has been invalidated", nil)
      return
    }
    monitor?.cancel()
    monitor = nil
    lastEmittedState = nil
    resolve(NSNull())
  }

  // MARK: - Internals

  private func fetchCurrentPath(completion: @escaping (NWPath) -> Void, onFailure: @escaping () -> Void) {
    let probeMonitor = NWPathMonitor()
    var didComplete = false
    let completeOnce: (NWPath?) -> Void = { path in
      if didComplete { return }
      didComplete = true
      probeMonitor.cancel()
      if let path = path {
        completion(path)
      } else {
        onFailure()
      }
    }
    probeMonitor.pathUpdateHandler = { path in
      completeOnce(path)
    }
    probeMonitor.start(queue: monitorQueue)
    // Genuine failure path (spec: `CONNECTIVITY_UNAVAILABLE` "on native
    // call failure"): NWPathMonitor's own initial callback is expected
    // almost immediately: if it never arrives, treat that as a native-level
    // failure to determine connectivity rather than hanging the promise
    // forever.
    monitorQueue.asyncAfter(deadline: .now() + 3.0) {
      completeOnce(nil)
    }
  }

  // BUG-015 fix (docs/BUGS.md): `lastEmittedState` used to be set
  // unconditionally, before the `hasListeners` guard below. If a path
  // update arrived while `hasListeners` was momentarily false (or
  // NWPathMonitor coalesced/delayed one edge of a blip), that state got
  // silently recorded as "already told JS" even though `sendEvent` was
  // never actually called — so the next genuine transition could be
  // suppressed by the `state == lastEmittedState` dedup above, permanently
  // desyncing JS's view of connectivity from reality until a full app
  // restart. `lastEmittedState` is now only updated after `sendEvent` is
  // actually reached (i.e. after the `hasListeners` guard passes), so a
  // missed emission is never recorded as delivered.
  private func handlePathUpdate(_ path: NWPath) {
    let state = makeState(from: path)
    if state == lastEmittedState { return }

    guard hasListeners else { return }
    var payload = state.toDictionary()
    payload["timestamp"] = Date().timeIntervalSince1970 * 1000
    sendEvent(withName: "connectivityChanged", body: payload)
    lastEmittedState = state
  }

  private func makeState(from path: NWPath) -> ConnectivityState {
    let isConnected = path.status == .satisfied
    let type: String
    if path.usesInterfaceType(.wifi) {
      type = "wifi"
    } else if path.usesInterfaceType(.cellular) {
      type = "cellular"
    } else if path.usesInterfaceType(.wiredEthernet) {
      type = "ethernet"
    } else if isConnected {
      type = "unknown"
    } else {
      type = "none"
    }
    return ConnectivityState(isConnected: isConnected, type: type, isInternetReachable: isConnected)
  }
}
