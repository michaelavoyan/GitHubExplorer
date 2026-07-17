/**
 * Raw native module JS spec. Per docs/native-module-spec.md "Interface" —
 * async methods table + `connectivityChanged` event.
 *
 * NOT part of the pure suite: requires the `react-native` package
 * (NativeModules) which does not exist until the RN CLI scaffold is
 * created. Not included in tsconfig.json's `include` list for that reason.
 * Only `src/infrastructure/services/ConnectivityService.ts` is allowed to
 * import this module directly, per docs/native-module-spec.md's "Native
 * Service abstraction" section.
 */

import { NativeModules } from 'react-native';
import { ConnectivityState, ConnectivityNativeError } from './types';

export interface NativeConnectivityModuleSpec {
  getCurrentState(): Promise<ConnectivityState>;
  checkInternetReachability(timeoutMs?: number): Promise<boolean>;
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ErrorShapesDocumentedForReference = ConnectivityNativeError;

export const NativeConnectivityModule = NativeModules.ConnectivityModule as NativeConnectivityModuleSpec;
