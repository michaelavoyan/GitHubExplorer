import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRepositoryDetails } from '../hooks/useRepositoryDetails';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { FavoriteButton } from '../components/FavoriteButton';
import { FavoriteErrorToast } from '../components/FavoriteErrorToast';
import { LoadingView, ErrorView, EmptyView } from '../components/ListStateViews';
import { describeRepositoryListError } from '../errorMessages';
import { NetworkError } from '../../domain/errors/DomainErrors';
import { formatDate } from '../../../../shared/formatDate';

interface RepositoryDetailsScreenProps {
  route: { params: { owner: string; repo: string } };
}

/** Assignment §3.3. */
export function RepositoryDetailsScreen({ route }: RepositoryDetailsScreenProps) {
  const { owner, repo } = route.params;
  const { data, isLoading, isError, error, refetch } = useRepositoryDetails(owner, repo);
  const { favorites } = useFavorites();
  // BUG-020 fix (docs/BUGS.md): `error` was previously discarded here,
  // silently dropping a failed favorite write. Surfaced via
  // FavoriteErrorToast below instead of this screen's own query error
  // state (docs/features/favorites.md).
  const { toggle, error: favoriteError } = useToggleFavorite();

  if (isLoading) {
    return <LoadingView testID="repository-details-loading" />;
  }

  // docs/bonus-and-optional.md §9.1: prefer already-persisted data over a
  // full-screen error, same as RepositoryListScreen — a query that errors
  // (e.g. the reconnect-triggered background refetch in AppProviders.tsx
  // failing again) should fall through to rendering the last-known-good
  // details below, with the offline banner as the only extra feedback,
  // rather than discarding a perfectly good cached view.
  if (!data) {
    if (isError && error instanceof NetworkError) {
      // Scope flag: a repo never viewed this session has no persisted
      // cache to fall back to.
      return (
        <EmptyView testID="repository-details-offline-empty" message="No saved data — reconnect to view" />
      );
    }
    return (
      <ErrorView
        testID="repository-details-error"
        message={describeRepositoryListError(error, `${owner}/${repo}`)}
        onRetry={() => refetch()}
      />
    );
  }

  const isFavorite = favorites.has(data.fullName);

  return (
    <View style={styles.screen}>
      <ScrollView testID="repository-details" style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{data.fullName}</Text>
          <FavoriteButton fullName={data.fullName} isFavorite={isFavorite} onToggle={toggle} />
        </View>

        <Text style={styles.description}>{data.description ?? 'No description provided'}</Text>

        <View style={styles.statsRow}>
          <Stat label="Stars" value={data.stars} />
          <Stat label="Forks" value={data.forks} />
          <Stat label="Watchers" value={data.watchers} />
          <Stat label="Open issues" value={data.openIssues} />
        </View>

        <Detail label="Default branch" value={data.defaultBranch} />
        <Detail label="License" value={data.license ? data.license.name : 'None'} />
        <Detail label="Created" value={formatDate(data.createdAt)} />
        <Detail label="Updated" value={formatDate(data.updatedAt)} />
        <Text
          testID="repository-details-url"
          style={styles.link}
          onPress={() => Linking.openURL(data.htmlUrl)}
        >
          {data.htmlUrl}
        </Text>
      </ScrollView>
      <FavoriteErrorToast error={favoriteError} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', flexShrink: 1, color: '#1C1C1E' },
  description: { marginTop: 8, fontSize: 14, color: '#444' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  statLabel: { fontSize: 12, color: '#888' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: '#888' },
  detailValue: { fontWeight: '500', color: '#1C1C1E' },
  link: { marginTop: 16, color: '#0969DA' },
});
