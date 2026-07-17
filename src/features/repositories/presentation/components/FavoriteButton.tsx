import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface FavoriteButtonProps {
  fullName: string;
  isFavorite: boolean;
  onToggle: (fullName: string) => void;
}

/**
 * Favorite-toggle callback passed by id, not by closing over the whole
 * repository object, to avoid defeating memoization on every
 * favorites-store update (docs/features/repository-list.md "Performance").
 */
function FavoriteButtonComponent({ fullName, isFavorite, onToggle }: FavoriteButtonProps) {
  return (
    <Pressable
      testID={`favorite-toggle-${fullName}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isFavorite }}
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onPress={() => onToggle(fullName)}
      style={styles.button}
    >
      <Text style={[styles.star, isFavorite && styles.starFilled]}>{isFavorite ? '★' : '☆'}</Text>
    </Pressable>
  );
}

export const FavoriteButton = React.memo(FavoriteButtonComponent);

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
  star: {
    fontSize: 20,
    color: '#8E8E93',
  },
  starFilled: {
    color: '#F1A208',
  },
});
