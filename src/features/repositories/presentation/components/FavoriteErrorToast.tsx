import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

/** How long the toast stays visible before auto-dismissing. */
export const FAVORITE_ERROR_TOAST_DURATION_MS = 2500;

interface FavoriteErrorToastProps {
  /**
   * `useToggleFavorite()`'s `error` return value. Any truthy value shows
   * the toast; `undefined` (the success/idle case) renders nothing.
   */
  error: unknown;
}

/**
 * BUG-020 fix (docs/BUGS.md): a transient, auto-dismissing notice for a
 * failed favorite write, per docs/features/favorites.md — "StorageError is
 * non-fatal everywhere ... Presentation shows a transient 'couldn't save
 * favorite' toast rather than propagating it into an unrelated screen's
 * query error state."
 *
 * Deliberately narrow: no toast library, no global toast host/queue — a
 * screen-local overlay driven directly by the hook's own `error` value,
 * proportionate to this being a P3, Presentation-only gap. Shared between
 * RepositoryListScreen and RepositoryDetailsScreen (both call
 * `useToggleFavorite()`) instead of duplicating this markup twice.
 *
 * Visibility is tracked locally rather than mirroring `error` directly, so
 * the toast auto-hides itself instead of staying pinned to the screen for
 * as long as the hook happens to retain the last error. A new failure
 * (a new `error` instance) re-shows it and restarts the dismiss timer.
 */
export function FavoriteErrorToast({ error }: FavoriteErrorToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!error) {
      return undefined;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), FAVORITE_ERROR_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [error]);

  if (!visible) {
    return null;
  }

  return (
    <Text testID="favorite-error-toast" style={styles.toast}>
      Couldn&apos;t save favorite
    </Text>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 14,
  },
});
