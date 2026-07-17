import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useConnectivityStore } from '../store/connectivityStore';

/**
 * docs/bonus-and-optional.md §9.1: persistent "You're offline — showing
 * saved results" banner when !isConnected, driven by ConnectivityService.
 */
export function OfflineBanner() {
  const isConnected = useConnectivityStore((state) => state.isConnected);
  const hasHydrated = useConnectivityStore((state) => state.hasHydrated);

  if (!hasHydrated || isConnected) {
    return null;
  }

  return (
    <View testID="offline-banner" style={styles.banner}>
      <Text style={styles.text}>You're offline — showing saved results</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#B45309',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
  },
});
