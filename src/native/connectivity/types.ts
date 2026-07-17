/**
 * Shared connectivity types. Pure TypeScript, no react-native import, so it
 * is safe to reference from either the pure suite or the RN-dependent
 * suite. Shapes per docs/native-module-spec.md "Interface".
 */

export type ConnectivityType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface ConnectivityState {
  isConnected: boolean;
  type: ConnectivityType;
  isInternetReachable: boolean;
}

export interface ConnectivityChangedEvent extends ConnectivityState {
  timestamp: number;
}

export type ConnectivityErrorCode =
  | 'CONNECTIVITY_UNAVAILABLE'
  | 'REACHABILITY_CHECK_FAILED'
  | 'MONITOR_START_FAILED'
  | 'MONITOR_STOP_FAILED';

export interface ConnectivityNativeError {
  code: ConnectivityErrorCode;
}
