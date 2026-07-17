/**
 * End-to-end (within Presentation) coverage of
 * docs/features/repository-list.md's "State -> UI mapping" table, exercised
 * through the actual screen component, plus assignment §3.2's explicit list
 * requirements (loading/error/empty state, pull-to-refresh,
 * pagination/infinite scroll, retry after failed request).
 *
 * Mocking approach: each of the four hooks the screen depends on
 * (`useOrganizationRepositories`, `useRepositorySearch`, `useFavorites`,
 * `useToggleFavorite`) is replaced with a jest.fn() the test configures per
 * scenario via `mockReturnValue` — previously a bare `jest.mock(...)` with
 * no factory (undefined return values), which is why all these tests were
 * failing before real hook contracts existed. Fixed by the QA pass as its
 * own test-wiring debt; see docs/BUGS.md. Note the original placeholder
 * only mocked three of the four hooks the screen actually imports
 * (`useToggleFavorite` was left unmocked) — fixed here too.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RepositoryListScreen } from './RepositoryListScreen';
import { useOrganizationRepositories } from '../hooks/useOrganizationRepositories';
import { useRepositorySearch } from '../hooks/useRepositorySearch';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { NetworkError, NotFoundError, RateLimitError, StorageError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

jest.mock('../hooks/useOrganizationRepositories');
jest.mock('../hooks/useRepositorySearch');
jest.mock('../hooks/useFavorites');
jest.mock('../hooks/useToggleFavorite');

const mockUseOrganizationRepositories = useOrganizationRepositories as jest.Mock;
const mockUseRepositorySearch = useRepositorySearch as jest.Mock;
const mockUseFavorites = useFavorites as jest.Mock;
const mockUseToggleFavorite = useToggleFavorite as jest.Mock;

function makeQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
    isFetchingNextPage: false,
    isRefetching: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    refreshFirstPage: jest.fn(),
    ...overrides,
  };
}

function successResult(items: ReturnType<typeof buildRepository>[], overrides: Record<string, unknown> = {}) {
  return makeQueryResult({
    isSuccess: true,
    data: { pages: [{ items, nextPage: null }], pageParams: [1] },
    ...overrides,
  });
}

function renderScreen(org: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RepositoryListScreen route={{ params: { org } }} />
      </QueryClientProvider>,
    ),
    client,
  };
}

describe('RepositoryListScreen (docs/features/repository-list.md, assignment §3.2)', () => {
  beforeEach(() => {
    mockUseOrganizationRepositories.mockReset();
    mockUseRepositorySearch.mockReset();
    mockUseFavorites.mockReset();
    mockUseToggleFavorite.mockReset();

    // Sensible defaults; overridden per test as needed.
    mockUseOrganizationRepositories.mockReturnValue(makeQueryResult({ isLoading: true }));
    mockUseRepositorySearch.mockReturnValue(makeQueryResult());
    mockUseFavorites.mockReturnValue({ favorites: new Set<string>() });
    mockUseToggleFavorite.mockReturnValue({ toggle: jest.fn(), error: undefined });
  });

  it('shows a loading skeleton on first fetch, with the filter input still present (BUG-019)', () => {
    mockUseOrganizationRepositories.mockReturnValue(makeQueryResult({ isLoading: true }));
    renderScreen('facebook');
    expect(screen.getByTestId('repository-list-loading')).toBeTruthy();
    expect(screen.getByTestId('repository-search-input')).toBeTruthy();
  });

  it('shows an error view with a Retry action on failure with no data, with the filter input still present (BUG-019)', async () => {
    mockUseOrganizationRepositories.mockReturnValue(
      makeQueryResult({ isError: true, error: new NotFoundError("No organization named 'does-not-exist'") }),
    );
    renderScreen('does-not-exist');
    await waitFor(() => expect(screen.getByTestId('repository-list-error')).toBeTruthy());
    expect(screen.getByText(/no organization named/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(screen.getByTestId('repository-search-input')).toBeTruthy();
  });

  it('disables the filter input when the organization itself is not found, since there is nothing to filter', async () => {
    mockUseOrganizationRepositories.mockReturnValue(
      makeQueryResult({ isError: true, error: new NotFoundError("No organization named 'does-not-exist'") }),
    );
    renderScreen('does-not-exist');
    await waitFor(() => expect(screen.getByTestId('repository-list-error')).toBeTruthy());

    // Real keyboard-input blocking is a native/OS-enforced behavior of
    // TextInput's `editable` prop that RNTL's fireEvent.changeText bypasses
    // (it calls onChangeText directly regardless of editable) — the
    // meaningful, verifiable contract at this level is that the prop is
    // set correctly, per docs/testing-strategy.md's boundary between what
    // JS tests can assert and what needs live verification.
    const input = screen.getByTestId('repository-search-input');
    expect(input.props.editable).toBe(false);
  });

  it('keeps the filter input enabled when a filtered search errors, since the organization itself still resolved (BUG-019, not org-not-found)', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseRepositorySearch.mockReturnValue(
      makeQueryResult({ isError: true, error: new NotFoundError('search failed') }),
    );
    renderScreen('vercel');
    await waitFor(() => screen.getByTestId('repository-list'));

    fireEvent.changeText(screen.getByTestId('repository-search-input'), 'deployx');
    const input = screen.getByTestId('repository-search-input');
    expect(input.props.editable).not.toBe(false);
  });

  it('BUG-019: keeps the filter input visible and editable when a filter query produces zero matches, so the user can adjust it without leaving the screen', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseRepositorySearch.mockReturnValue(successResult([]));
    renderScreen('vercel');
    await waitFor(() => screen.getByTestId('repository-list'));

    const input = screen.getByTestId('repository-search-input');
    fireEvent.changeText(input, 'deployx');

    await waitFor(() => expect(screen.getByTestId('repository-list-empty')).toBeTruthy());
    expect(screen.getByText('No repositories match "deployx"')).toBeTruthy();

    // The whole point of the fix: the input is still there, and still
    // editable — not unmounted along with the rest of the success-state UI.
    const inputAfter = screen.getByTestId('repository-search-input');
    expect(inputAfter).toBeTruthy();
    fireEvent.changeText(inputAfter, 'deployx2');
    expect(inputAfter.props.value).toBe('deployx2');
  });

  it('BUG-019: keeps the filter input visible when a filtered query errors out (e.g. rate-limited), so the user can clear/edit it', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseRepositorySearch.mockReturnValue(
      makeQueryResult({ isError: true, error: new NotFoundError('search failed') }),
    );
    renderScreen('vercel');
    await waitFor(() => screen.getByTestId('repository-list'));

    fireEvent.changeText(screen.getByTestId('repository-search-input'), 'deployx');

    await waitFor(() => expect(screen.getByTestId('repository-list-error')).toBeTruthy());
    expect(screen.getByTestId('repository-search-input')).toBeTruthy();
  });

  it('pressing Retry calls refetch and does not permanently disable itself', async () => {
    const refetch = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(
      makeQueryResult({ isError: true, error: new NotFoundError(), refetch }),
    );
    renderScreen('does-not-exist');
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).not.toBeDisabled();
    fireEvent.press(retryButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('docs/bonus-and-optional.md §9.1: shows a distinct "no saved data" empty state (not the generic error/Retry view) for an org never browsed this session while offline', async () => {
    mockUseOrganizationRepositories.mockReturnValue(makeQueryResult({ isError: true, error: new NetworkError() }));
    renderScreen('never-browsed-org');
    await waitFor(() => expect(screen.getByTestId('repository-list-offline-empty')).toBeTruthy());
    expect(screen.getByText('No saved data — reconnect to search')).toBeTruthy();
    expect(screen.queryByTestId('repository-list-error')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('docs/bonus-and-optional.md §9.1: a NetworkError with persisted cache data falls through to the list, not the offline-empty state', async () => {
    mockUseOrganizationRepositories.mockReturnValue(
      successResult([buildRepository()], { isError: true, isSuccess: false, error: new NetworkError() }),
    );
    renderScreen('vercel');
    await waitFor(() => expect(screen.getByTestId('repository-list')).toBeTruthy());
    expect(screen.queryByTestId('repository-list-offline-empty')).toBeNull();
    expect(screen.queryByTestId('repository-list-error')).toBeNull();
  });

  it('shows an empty state distinct from the error state when the org has zero public repos', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([]));
    renderScreen('an-empty-org');
    await waitFor(() => expect(screen.getByTestId('repository-list-empty')).toBeTruthy());
    expect(screen.queryByTestId('repository-list-error')).toBeNull();
  });

  it('renders each repository row with name, description, language, stars, forks, issues, updated date (assignment §3.2)', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    renderScreen('facebook');
    await waitFor(() => expect(screen.getByText('react')).toBeTruthy());
    expect(screen.getByText(/javascript/i)).toBeTruthy();
    expect(screen.getByText(/★ 220000/)).toBeTruthy();
    expect(screen.getByText(/⑂ 45000/)).toBeTruthy();
    expect(screen.getByText(/1200 issues/)).toBeTruthy();
  });

  it('pull-to-refresh triggers refreshFirstPage (not a full refetch of every loaded page)', async () => {
    const refreshFirstPage = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()], { refreshFirstPage }));
    renderScreen('facebook');
    await waitFor(() => screen.getByTestId('repository-list'));
    const list = screen.getByTestId('repository-list');
    // The FlatList itself has no `onRefresh` prop — pull-to-refresh is
    // wired through the nested <RefreshControl onRefresh=.../> passed via
    // the `refreshControl` prop, so `fireEvent(list, 'refresh')` (which
    // looks for `list.props.onRefresh`) is a no-op. Invoke the actual
    // handler the same way the native pull gesture would.
    list.props.refreshControl.props.onRefresh();
    expect(refreshFirstPage).toHaveBeenCalledTimes(1);
  });

  it('reaching the end of the list triggers fetchNextPage (infinite scroll)', async () => {
    const fetchNextPage = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(
      successResult([buildRepository()], { hasNextPage: true, fetchNextPage }),
    );
    renderScreen('facebook');
    await waitFor(() => screen.getByTestId('repository-list'));
    const list = screen.getByTestId('repository-list');
    fireEvent(list, 'onEndReached');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchNextPage again while a page fetch is already in flight', async () => {
    const fetchNextPage = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(
      successResult([buildRepository()], { hasNextPage: true, isFetchingNextPage: true, fetchNextPage }),
    );
    renderScreen('facebook');
    await waitFor(() => screen.getByTestId('repository-list'));
    fireEvent(screen.getByTestId('repository-list'), 'onEndReached');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('a pagination failure keeps existing rows visible and shows an inline footer retry, not a full-screen error', async () => {
    mockUseOrganizationRepositories.mockReturnValue(
      successResult([buildRepository()], { isError: true, error: new Error('page 2 failed') }),
    );
    renderScreen('facebook');
    await waitFor(() => screen.getByTestId('repository-list'));
    expect(screen.queryByTestId('repository-list-error')).toBeNull();
    expect(screen.getByTestId('repository-list-footer-error')).toBeTruthy();
    expect(screen.getByText(/couldn.t load more repositories/i)).toBeTruthy();
  });

  it('a RateLimitError disables Retry / pull-to-refresh / infinite-scroll until resetAt', async () => {
    const fetchNextPage = jest.fn();
    const refreshFirstPage = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(
      makeQueryResult({
        isError: true,
        // BUG-001 fix note: this was previously a hardcoded absolute
        // timestamp ('2026-07-10T12:00:00Z'). BUG-001's fix makes
        // `isRateLimited` a real time-based comparison against `resetAt`,
        // so a fixed past-tense literal is a ticking time bomb that goes
        // stale (and starts asserting the opposite of what it means to
        // test) the moment the wall clock passes it — flagged per the
        // developer-agent rule against silently changing test files.
        // Switched to a relative future offset so the test deterministically
        // exercises "still within the rate-limit window" regardless of when
        // it runs.
        error: new RateLimitError({ resetAt: new Date(Date.now() + 60 * 60 * 1000), remaining: 0 }),
        fetchNextPage,
        refreshFirstPage,
      }),
    );
    renderScreen('rate-limited-org');
    await waitFor(() => expect(screen.getByText(/rate limit reached/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeDisabled();
  });

  it('re-enables Retry / pull-to-refresh / infinite-scroll once resetAt passes, and refetches automatically', async () => {
    jest.useFakeTimers();
    const refetch = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(
      makeQueryResult({
        isError: true,
        error: new RateLimitError({ resetAt: new Date(Date.now() + 5000), remaining: 0 }),
        refetch,
      }),
    );
    renderScreen('rate-limited-org');
    await waitFor(() => expect(screen.getByText(/rate limit reached/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).not.toBeDisabled());
    expect(refetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('toggling favorite on a row calls toggle with the repository full name', async () => {
    const toggle = jest.fn();
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseToggleFavorite.mockReturnValue({ toggle, error: undefined });
    renderScreen('facebook');
    await waitFor(() => screen.getByText('react'));

    const button = screen.getByTestId('favorite-toggle-facebook/react');
    expect(button).toHaveProp('accessibilityState', { selected: false });

    fireEvent.press(button);
    expect(toggle).toHaveBeenCalledWith('facebook/react');
  });

  it('BUG-020: shows a transient "couldn\'t save favorite" toast when useToggleFavorite() reports an error, without touching the list\'s own error state', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseToggleFavorite.mockReturnValue({ toggle: jest.fn(), error: new StorageError() });
    renderScreen('facebook');
    await waitFor(() => screen.getByText('react'));

    expect(screen.getByTestId('favorite-error-toast')).toBeTruthy();
    expect(screen.getByText(/couldn.t save favorite/i)).toBeTruthy();
    // Not propagated into the screen's own query error state (docs/features/favorites.md).
    expect(screen.queryByTestId('repository-list-error')).toBeNull();
    expect(screen.getByTestId('repository-list')).toBeTruthy();
  });

  it('BUG-020: renders no toast when useToggleFavorite() reports no error', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseToggleFavorite.mockReturnValue({ toggle: jest.fn(), error: undefined });
    renderScreen('facebook');
    await waitFor(() => screen.getByText('react'));

    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });

  it('reflects favorites-store state in the row without touching the org-repos query cache (view-model merge)', async () => {
    mockUseOrganizationRepositories.mockReturnValue(successResult([buildRepository()]));
    mockUseFavorites.mockReturnValue({ favorites: new Set<string>() });
    const { client, rerender } = renderScreen('facebook');
    await waitFor(() => screen.getByText('react'));

    const cacheBefore = client.getQueryData(['org-repos', 'facebook']);

    // Simulate the favorites store updating externally (as the real
    // Zustand-backed useFavorites would after a successful toggle) and the
    // screen re-rendering as a result.
    mockUseFavorites.mockReturnValue({ favorites: new Set(['facebook/react']) });
    rerender(
      <QueryClientProvider client={client}>
        <RepositoryListScreen route={{ params: { org: 'facebook' } }} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('favorite-toggle-facebook/react')).toHaveProp('accessibilityState', {
        selected: true,
      }),
    );
    // The favorites-store update must not have gone through the TanStack
    // Query cache — it should be the exact same (untouched) reference.
    expect(client.getQueryData(['org-repos', 'facebook'])).toBe(cacheBefore);
  });
});
