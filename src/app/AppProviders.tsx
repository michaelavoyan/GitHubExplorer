/**
 * App entry providers: TanStack Query (server state) + MMKV-backed offline
 * persister (docs/bonus-and-optional.md §9.1) + SafeAreaProvider, and
 * connectivity monitoring init (docs/native-module-spec.md).
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './queryClient';
import { queryPersister } from '../infrastructure/persistence/queryPersister';
import { initConnectivityMonitoring, onReconnect } from './store/connectivityStore';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribeMonitoring = initConnectivityMonitoring();
    // docs/bonus-and-optional.md §9.1: one-time background refetch of
    // mounted queries on reconnect, instead of leaving them to sit on
    // whatever stale/errored state they were in while offline.
    const unsubscribeReconnect = onReconnect(() => {
      queryClient.refetchQueries({ type: 'active' });
    });
    return () => {
      unsubscribeMonitoring();
      unsubscribeReconnect();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        {children}
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
