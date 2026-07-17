import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function LoadingView({ testID }: { testID: string }) {
  return (
    <View testID={testID} style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

interface ErrorViewProps {
  testID: string;
  message: string;
  onRetry: () => void;
  retryDisabled?: boolean;
}

export function ErrorView({ testID, message, onRetry, retryDisabled }: ErrorViewProps) {
  return (
    <View testID={testID} style={styles.center}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        accessibilityState={{ disabled: Boolean(retryDisabled) }}
        disabled={retryDisabled}
        onPress={onRetry}
        style={[styles.retryButton, retryDisabled && styles.retryButtonDisabled]}
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptyView({ testID, message }: { testID: string; message: string }) {
  return (
    <View testID={testID} style={styles.center}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    color: '#1C1C1E',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0969DA',
  },
  retryButtonDisabled: {
    backgroundColor: '#8C8C8C',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
