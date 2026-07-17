import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RepositoryListItemViewModel } from '../hooks/useRepositoryListViewModel';
import { FavoriteButton } from './FavoriteButton';
import { formatDate } from '../../../../shared/formatDate';

export const REPOSITORY_LIST_ITEM_HEIGHT = 108;

interface RepositoryListItemProps {
  item: RepositoryListItemViewModel;
  onPress: (item: RepositoryListItemViewModel) => void;
  onToggleFavorite: (fullName: string) => void;
}

function formatUpdatedAt(date: Date): string {
  return formatDate(date);
}

/**
 * Fixed-height row (REPOSITORY_LIST_ITEM_HEIGHT) so RepositoryListScreen's
 * FlatList can use getItemLayout, and memoized so favorites-store updates
 * only re-render the affected row — see
 * docs/features/repository-list.md "Performance".
 */
function RepositoryListItemComponent({ item, onPress, onToggleFavorite }: RepositoryListItemProps) {
  return (
    <View style={styles.row} testID={`repository-row-${item.fullName}`}>
      <Pressable style={styles.content} accessibilityRole="button" onPress={() => onPress(item)}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description ?? 'No description provided'}
        </Text>
        <View style={styles.metaRow}>
          {item.primaryLanguage ? <Text style={styles.meta}>{item.primaryLanguage}</Text> : null}
          <Text style={styles.meta}>★ {item.stars}</Text>
          <Text style={styles.meta}>⑂ {item.forks}</Text>
          <Text style={styles.meta}>{item.openIssues} issues</Text>
          <Text style={styles.meta}>Updated {formatUpdatedAt(item.updatedAt)}</Text>
        </View>
      </Pressable>
      <FavoriteButton fullName={item.fullName} isFavorite={item.isFavorite} onToggle={onToggleFavorite} />
    </View>
  );
}

export const RepositoryListItem = React.memo(RepositoryListItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: REPOSITORY_LIST_ITEM_HEIGHT,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    columnGap: 12,
  },
  meta: {
    fontSize: 12,
    color: '#888',
  },
});
