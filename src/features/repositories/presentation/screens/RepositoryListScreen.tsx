import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useOrganizationRepositories } from '../hooks/useOrganizationRepositories';
import { useRepositorySearch } from '../hooks/useRepositorySearch';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { useRepositoryListViewModel, RepositoryListItemViewModel } from '../hooks/useRepositoryListViewModel';
import { RepositoryListItem, REPOSITORY_LIST_ITEM_HEIGHT } from '../components/RepositoryListItem';
import { LoadingView, ErrorView, EmptyView } from '../components/ListStateViews';
import { FavoriteErrorToast } from '../components/FavoriteErrorToast';
import { describeRepositoryListError } from '../errorMessages';
import { NetworkError, NotFoundError, RateLimitError } from '../../domain/errors/DomainErrors';
import { Repository } from '../../domain/models/Repository';

interface RepositoryListScreenProps {
  route: { params: { org: string } };
  navigation?: { navigate: (screen: string, params: Record<string, unknown>) => void };
}

/**
 * Assignment §3.2 + docs/features/repository-list.md "State -> UI mapping".
 * Reached from OrganizationSearchScreen with `org` as a route param.
 */
export function RepositoryListScreen({ route, navigation }: RepositoryListScreenProps) {
  const { org } = route.params;
  const [rawQuery, setRawQuery] = useState('');
  const isSearching = rawQuery.trim().length > 0;

  const baseList = useOrganizationRepositories(org);
  const searchResult = useRepositorySearch(org, rawQuery);
  const active = isSearching ? searchResult : baseList;

  const { favorites } = useFavorites();
  // BUG-020 fix (docs/BUGS.md): `error` was previously discarded here,
  // silently dropping a failed favorite write. Surfaced via
  // FavoriteErrorToast below instead of this screen's own query error
  // state (docs/features/favorites.md).
  const { toggle, error: favoriteError } = useToggleFavorite();

  const repositories: Repository[] = useMemo(
    () => active.data?.pages.flatMap((page) => page.items) ?? [],
    [active.data],
  );
  const items = useRepositoryListViewModel(repositories, favorites);

  const handlePressItem = useCallback(
    (item: RepositoryListItemViewModel) => {
      navigation?.navigate('RepositoryDetails', { owner: item.ownerLogin, repo: item.name });
    },
    [navigation],
  );

  const handleToggleFavorite = useCallback(
    (fullName: string) => {
      toggle(fullName);
    },
    [toggle],
  );

  /**
   * BUG-001 fix: `resetAt` was captured/displayed but nothing ever read it
   * to re-enable Retry/pull-to-refresh/infinite-scroll, per
   * docs/features/repository-list.md line 35 ("...disable ... until
   * resetAt" — implies re-enabling once it passes). `isRateLimited` now
   * tracks real elapsed time against `resetAt`: a timer scheduled for the
   * remaining ms flips it back to `false` and fires an automatic
   * background refetch of whichever query (`active`) is currently in
   * view, satisfying either half of the spec's "automatic refetch fires
   * at resetAt, or the disabled flag lifts" resolution.
   */
  /**
   * The organization itself doesn't exist (baseList's own NotFoundError,
   * not a filtered-search error) — there is nothing to filter, so the
   * filter box is disabled rather than left editable and misleading, per
   * user feedback. Deliberately checks `baseList`, not `active`: whether
   * the org resolves shouldn't depend on whether the user happens to be
   * mid-filter right now. Distinct from BUG-019's fix (docs/BUGS.md),
   * which keeps the filter editable through *filtered* zero-match/error
   * states within a real org — this only disables it when the org-level
   * lookup itself failed.
   */
  const orgNotFound = baseList.isError && baseList.error instanceof NotFoundError && !baseList.data;

  const rateLimitError = active.error instanceof RateLimitError ? active.error : undefined;
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    if (!rateLimitError) {
      setIsRateLimited(false);
      return;
    }
    const msUntilReset = rateLimitError.resetAt.getTime() - Date.now();
    if (msUntilReset <= 0) {
      // resetAt has already passed by the time this error was observed —
      // nothing to disable.
      setIsRateLimited(false);
      return;
    }
    setIsRateLimited(true);
    const timer = setTimeout(() => {
      setIsRateLimited(false);
      active.refetch();
    }, msUntilReset);
    return () => clearTimeout(timer);
    // `active` is intentionally not a dependency: only resetAt-carrying
    // error identity should re-schedule the timer, mirroring the
    // `refreshFirstPage` callback's exhaustive-deps opt-out in
    // useOrganizationRepositories.ts for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateLimitError]);

  const renderItem = useCallback(
    ({ item }: { item: RepositoryListItemViewModel }) => (
      <RepositoryListItem item={item} onPress={handlePressItem} onToggleFavorite={handleToggleFavorite} />
    ),
    [handlePressItem, handleToggleFavorite],
  );

  /**
   * BUG-019 fix (docs/BUGS.md): the filter `TextInput` used to only be
   * rendered as part of the success-with-items branch, because loading /
   * error / empty were each a full-screen early `return` that replaced the
   * entire screen body. That meant a filter query that produced zero
   * matches (or an error while a query was active) unmounted the very
   * input the user needed to edit or clear it, trapping them with no way
   * out short of navigating back and losing screen state.
   *
   * Fixed by inverting the structure: the `TextInput` now renders
   * unconditionally at the top of the screen, and only the content *below*
   * it (loading indicator / error view / empty view / the list itself)
   * swaps per state. This also means the base (non-filtered) loading,
   * error, and empty states now render with the filter box present too —
   * intentional per the fix direction, and harmless: nothing about the
   * filter's own behavior changes, it's simply always available.
   */
  let content: React.ReactNode;
  if (active.isLoading) {
    content = <LoadingView testID="repository-list-loading" />;
  } else if (active.isError && active.error instanceof NetworkError && !active.data) {
    // docs/bonus-and-optional.md §9.1 scope flag: an org never browsed this
    // session has no persisted cache to fall back to. Distinct from both
    // the generic offline banner (which is about connectivity, not this
    // specific org) and the generic ErrorView below (which offers a Retry
    // that can't succeed without a network — reconnecting is the only path
    // forward here).
    content = (
      <EmptyView
        testID="repository-list-offline-empty"
        message="No saved data — reconnect to search"
      />
    );
  } else if (active.isError && !active.data) {
    content = (
      <ErrorView
        testID="repository-list-error"
        message={describeRepositoryListError(active.error, org)}
        onRetry={() => active.refetch()}
        retryDisabled={isRateLimited}
      />
    );
  } else if (active.isSuccess && items.length === 0) {
    content = (
      <EmptyView
        testID="repository-list-empty"
        message={
          isSearching ? `No repositories match "${rawQuery}"` : `${org} has no public repositories`
        }
      />
    );
  } else {
    content = (
      <FlatList
        testID="repository-list"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: REPOSITORY_LIST_ITEM_HEIGHT,
          offset: REPOSITORY_LIST_ITEM_HEIGHT * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={Boolean('isRefetching' in baseList && baseList.isRefetching) && !isSearching}
            onRefresh={() => {
              if (!isRateLimited && !isSearching) {
                baseList.refreshFirstPage();
              }
            }}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!isRateLimited && active.hasNextPage && !active.isFetchingNextPage) {
            active.fetchNextPage();
          }
        }}
        ListFooterComponent={
          active.isFetchingNextPage ? (
            <LoadingView testID="repository-list-footer-loading" />
          ) : active.isError && active.data ? (
            <ErrorView
              testID="repository-list-footer-error"
              message="Couldn't load more repositories"
              onRetry={() => active.fetchNextPage()}
              retryDisabled={isRateLimited}
            />
          ) : null
        }
        windowSize={10}
        maxToRenderPerBatch={20}
        removeClippedSubviews
      />
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        testID="repository-search-input"
        style={[styles.searchInput, orgNotFound && styles.searchInputDisabled]}
        placeholder="Filter repositories by name"
        placeholderTextColor="#8E8E93"
        value={rawQuery}
        onChangeText={setRawQuery}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!orgNotFound}
      />
      {content}
      <FavoriteErrorToast error={favoriteError} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchInput: {
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
    color: '#1C1C1E',
  },
  searchInputDisabled: {
    backgroundColor: '#F2F2F7',
    color: '#8E8E93',
  },
});
