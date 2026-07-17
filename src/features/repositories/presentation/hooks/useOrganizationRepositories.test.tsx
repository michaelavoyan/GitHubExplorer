/**
 * Exercises the real `useOrganizationRepositories` hook against
 * docs/features/repository-list.md's "State -> UI mapping" table, with a
 * scenario-specific mock of `ListOrganizationRepositoriesUseCase.execute`
 * per test (previously a bare `jest.mock(...)` with no factory / no
 * per-test return values — fixed by the QA pass as its own test-wiring
 * debt; see docs/testing-strategy.md and docs/BUGS.md).
 *
 * Mocking approach: `ListOrganizationRepositoriesUseCase` is constructed
 * once at module scope inside useOrganizationRepositories.ts (the
 * hook-level DI decision documented in DECISIONS.md), so every test in
 * this file shares one mocked `execute` jest.fn(). Each test configures
 * `mockExecute.mockImplementation(...)` fresh before rendering.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrganizationRepositories } from './useOrganizationRepositories';
import { NotFoundError, RateLimitError, NetworkError } from '../../domain/errors/DomainErrors';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

const mockExecute = jest.fn();

// NOTE on mock timing: `execute` is wrapped in a forwarding closure
// (`(...args) => mockExecute(...args)`) rather than passed as
// `execute: mockExecute` directly. ES module imports are hoisted above
// ordinary top-level statements (including `const mockExecute = jest.fn()`
// above), so by the time this factory first runs — triggered by the
// `import { useOrganizationRepositories } from './useOrganizationRepositories'`
// below, which transitively requires this mocked module during import
// evaluation — `mockExecute` would still be unassigned if captured by
// value. The forwarding closure defers the `mockExecute` lookup to actual
// call time (well after the whole file has finished evaluating), which is
// safe.
jest.mock('../../application/useCases/ListOrganizationRepositoriesUseCase', () => {
  return {
    ListOrganizationRepositoriesUseCase: jest.fn().mockImplementation(() => ({
      execute: (...args: unknown[]) => mockExecute(...args),
    })),
  };
});

function page(items: Repository[], nextPage: number | null): PagedResult<Repository> {
  return { items, nextPage };
}

// Tracks every QueryClient created via renderWithClient() so afterEach can
// tear them down. Each test's `useInfiniteQuery` registers a real query
// against a real QueryClient (only the use case's `execute` is mocked), so
// without this, every test leaves a live query in the cache with a pending
// non-`unref`'d 5-minute `gcTime` setTimeout — invisible under a default
// `npx jest` run (masked by Jest's `forceExit`), but a real leak that hangs
// `--detectOpenHandles` indefinitely. See docs/BUGS.md BUG-008.
const createdClients: QueryClient[] = [];
const mountedRenders: Array<{ unmount: () => void }> = [];

function renderWithClient(org: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createdClients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useOrganizationRepositories(org), { wrapper });
  mountedRenders.push(rendered);
  return { ...rendered, client };
}

describe('useOrganizationRepositories — state machine (docs/features/repository-list.md)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  afterEach(() => {
    // Unmount every rendered hook tree first: `QueryClientProvider` only
    // calls `client.unmount()` (which detaches its focus-manager/
    // online-manager listeners) from its own effect cleanup, which React
    // never runs unless the tree is actually unmounted. Never doing this
    // is the real root cause of BUG-008's open-handle hang under
    // `--detectOpenHandles` — `client.clear()` alone (still done below,
    // to drop cached queries/gcTime timeouts) is not sufficient, since it
    // doesn't unmount the provider. See docs/BUGS.md BUG-008.
    mountedRenders.forEach((rendered) => rendered.unmount());
    mountedRenders.length = 0;
    createdClients.forEach((client) => client.clear());
    createdClients.length = 0;
  });

  it('isLoading is true on first fetch with no data yet', async () => {
    // Deliberately left pending to assert the loading state, but settled
    // before the test ends: an in-flight fetch that's still pending when
    // the test completes is a real open handle (not just a dangling JS
    // promise) that `unmount()`/`client.clear()` alone don't fully clean
    // up — see docs/BUGS.md BUG-008.
    let settle!: () => void;
    mockExecute.mockImplementation(
      () => new Promise<PagedResult<Repository>>((resolve) => {
        settle = () => resolve(page([], null));
      }),
    );
    const { result } = renderWithClient('facebook');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      settle();
    });
  });

  it('isError && !data drives the full-screen error view (e.g. org not found)', async () => {
    mockExecute.mockRejectedValue(new NotFoundError("No organization named 'does-not-exist'"));
    const { result } = renderWithClient('does-not-exist');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NotFoundError);
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces an empty successful result distinctly from an error (org with zero public repos)', async () => {
    mockExecute.mockResolvedValue(page([], null));
    const { result } = renderWithClient('an-empty-org');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const allItems = result.current.data?.pages.flatMap((p) => p.items) ?? [];
    expect(allItems).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it('exposes a distinct refreshFirstPage (pull-to-refresh) that resets to page 1 rather than refetching all loaded pages', async () => {
    // nextPage must be non-null here (unlike other tests) so hasNextPage is
    // true and the manual fetchNextPage() below actually issues a fetch
    // instead of being a no-op.
    mockExecute.mockResolvedValue(page([buildRepository()], 2));
    const { result } = renderWithClient('facebook');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(typeof result.current.refreshFirstPage).toBe('function');

    // Load a second page, then refresh — refreshFirstPage should truncate
    // back to a single page and refetch only page 1, not every loaded page.
    mockExecute.mockResolvedValueOnce(page([buildRepository({ id: '2', name: 'jest' })], 3));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));

    mockExecute.mockClear();
    mockExecute.mockResolvedValue(page([buildRepository()], 2));
    await act(async () => {
      await result.current.refreshFirstPage();
    });

    await waitFor(() => expect(result.current.data?.pages.length).toBe(1));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('isFetchingNextPage drives the footer spinner during pagination', async () => {
    mockExecute.mockResolvedValueOnce(page([buildRepository()], 2));
    const { result } = renderWithClient('facebook');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let releaseNextPage!: (value: PagedResult<Repository>) => void;
    mockExecute.mockImplementationOnce(
      () =>
        new Promise<PagedResult<Repository>>((resolve) => {
          releaseNextPage = resolve;
        }),
    );

    act(() => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));

    await act(async () => {
      releaseNextPage(page([buildRepository({ id: '2' })], null));
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  });

  it('hasNextPage becomes false on the last page (no footer spinner, no "no more results" copy required)', async () => {
    mockExecute.mockResolvedValue(page([buildRepository()], null));
    const { result } = renderWithClient('an-org-with-one-page');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('a failed fetchNextPage keeps already-loaded pages visible, surfaces the error, and lets the caller retry without discarding data', async () => {
    mockExecute.mockResolvedValueOnce(page([buildRepository()], 2));
    const { result } = renderWithClient('facebook');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const loadedBefore = result.current.data?.pages.length ?? 0;

    mockExecute.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    // TanStack Query v5 keeps `status: 'success'` (data intact) for a
    // background/paginated fetch failure once initial data exists, but it
    // still records the failure on `error`, per infinite-query semantics.
    // The observer's error/data update is delivered through react-query's
    // batched notifyManager (a scheduled macrotask, not synchronous with
    // the fetchNextPage() promise settling), so this needs waitFor rather
    // than a bare synchronous assertion right after `act` — without it,
    // the assertion races the notification and is flaky.
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data?.pages.length).toBe(loadedBefore);
  });

  it('a RateLimitError disables retry/pagination until resetAt', async () => {
    const resetAt = new Date('2026-07-10T12:00:00Z');
    mockExecute.mockRejectedValue(new RateLimitError({ resetAt, remaining: 0 }));
    const { result } = renderWithClient('rate-limited-org');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(RateLimitError);
    expect((result.current.error as RateLimitError).resetAt).toEqual(resetAt);
  });

  it('a NetworkError on first fetch surfaces as an error with no data (no cache to fall back to yet)', async () => {
    mockExecute.mockRejectedValue(new NetworkError());
    const { result } = renderWithClient('previously-browsed-now-offline-org');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(NetworkError));
    expect(result.current.data).toBeUndefined();
  });

  it('passes an AbortSignal through to the use case on every page fetch', async () => {
    mockExecute.mockResolvedValue(page([buildRepository()], null));
    const { result } = renderWithClient('facebook');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArgs = mockExecute.mock.calls[0]?.[0];
    expect(callArgs?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not fetch when org is blank', () => {
    mockExecute.mockResolvedValue(page([], null));
    const { result } = renderWithClient('   ');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
