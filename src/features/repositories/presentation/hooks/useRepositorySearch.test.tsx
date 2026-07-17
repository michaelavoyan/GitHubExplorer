/**
 * Exercises the real `useRepositorySearch` hook against
 * docs/features/repository-list.md's "Search/Filter" section and
 * assignment §3.4 ("avoid unnecessary API calls while typing"), with a
 * scenario-specific mock of `SearchOrganizationRepositoriesUseCase.execute`
 * (previously a bare `jest.mock(...)` with no factory — fixed by the QA
 * pass as its own test-wiring debt; see docs/BUGS.md).
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRepositorySearch } from './useRepositorySearch';
import { PagedResult } from '../../domain/models/PagedResult';
import { Repository } from '../../domain/models/Repository';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

const mockExecute = jest.fn();

// See useOrganizationRepositories.test.tsx for why `execute` is a
// forwarding closure rather than `execute: mockExecute` directly: ES
// import hoisting means this factory's first invocation (triggered by the
// `useRepositorySearch` import below) can run before `const mockExecute =
// jest.fn()` above has executed, so capturing `mockExecute` by value here
// would bake in `undefined`.
jest.mock('../../application/useCases/SearchOrganizationRepositoriesUseCase', () => {
  return {
    SearchOrganizationRepositoriesUseCase: jest.fn().mockImplementation(() => ({
      execute: (...args: unknown[]) => mockExecute(...args),
    })),
  };
});

function page(items: Repository[], nextPage: number | null): PagedResult<Repository> {
  return { items, nextPage };
}

// Tracks every QueryClient created via renderWithClient() so afterEach can
// tear them down. Each test's `useQuery` registers a real query against a
// real QueryClient (only the use case's `execute` is mocked), so without
// this, every test leaves a live query in the cache with a pending
// non-`unref`'d 5-minute `gcTime` setTimeout — invisible under a default
// `npx jest` run (masked by Jest's `forceExit`), but a real leak that hangs
// `--detectOpenHandles` indefinitely. See docs/BUGS.md BUG-008.
const createdClients: QueryClient[] = [];
const mountedRenders: Array<{ unmount: () => void }> = [];

function renderWithClient(org: string, initialQuery: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createdClients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(({ query }: { query: string }) => useRepositorySearch(org, query), {
    wrapper,
    initialProps: { query: initialQuery },
  });
  mountedRenders.push(rendered);
  return { ...rendered, client };
}

describe('useRepositorySearch — debounced search (docs/features/repository-list.md "Search/Filter", assignment §3.4)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue(page([buildRepository()], null));
  });

  afterEach(() => {
    // Unmount every rendered hook tree first: `QueryClientProvider` only
    // detaches its focus-manager/online-manager listeners (via
    // `client.unmount()`) from its own effect cleanup, which React never
    // runs unless the tree is actually unmounted. Never doing this is the
    // real root cause of BUG-008's open-handle hang under
    // `--detectOpenHandles` — `client.clear()` alone (still done below, to
    // drop cached queries/gcTime timeouts) is not sufficient. Do this
    // before restoring real timers below: gcTime scheduling is computed
    // relative to the current timer implementation, so tearing down while
    // still under fake timers keeps this deterministic. See docs/BUGS.md
    // BUG-008.
    mountedRenders.forEach((rendered) => rendered.unmount());
    mountedRenders.length = 0;
    createdClients.forEach((client) => client.clear());
    createdClients.length = 0;
    jest.useRealTimers();
  });

  it('does NOT fire a search on every keystroke — only once after the debounce window settles', async () => {
    const { rerender } = renderWithClient('facebook', '');

    // Simulate a user typing "react" one character at a time, well within
    // the debounce window between keystrokes.
    for (const partial of ['r', 're', 'rea', 'reac', 'react']) {
      rerender({ query: partial });
      act(() => {
        jest.advanceTimersByTime(50); // faster than the 350ms debounce
      });
    }

    // Still within the debounce window — nothing should have fired yet.
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(400); // let the debounce settle
    });

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ query: 'react', org: 'facebook' }));
  });

  it('is disabled (enabled: false) when the debounced query is empty', () => {
    const { result } = renderWithClient('facebook', '');
    expect(result.current.isFetching).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('uses a distinct queryKey from the base org-repos list so caches do not corrupt each other', async () => {
    const { client } = renderWithClient('facebook', 'react');

    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(client.getQueryData(['org-repo-search', 'facebook', 'react'])).toBeDefined();
    });
    expect(client.getQueryData(['org-repos', 'facebook'])).toBeUndefined();
  });

  it('a query-key change cancels the superseded in-flight request via the threaded AbortSignal', async () => {
    let firstSignal: AbortSignal | undefined;
    mockExecute.mockImplementation(
      (params: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          if (!firstSignal) {
            firstSignal = params.signal;
          }
          // Never resolves within the test timeline — we only care whether
          // the signal for the superseded request gets aborted.
          params.signal?.addEventListener('abort', () => {
            // leave unresolved; TanStack Query treats an aborted queryFn as
            // cancelled rather than erroring the query.
          });
          setTimeout(() => resolve(page([buildRepository()], null)), 10_000);
        }),
    );

    const { rerender } = renderWithClient('facebook', 'reac');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    rerender({ query: 'react-native' });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));

    // The mock's setTimeout unconditionally resolves at 10s regardless of
    // the abort (only the `addEventListener('abort', ...)` no-op above
    // reacts to cancellation) — let it actually fire before the test ends
    // instead of leaving it pending. A still-pending fake timer at test end
    // is a real open handle surviving past the test boundary once real
    // timers are restored, not just a dangling JS promise. See
    // docs/BUGS.md BUG-008.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
  });

  it('resets to the empty/disabled state when the query is cleared back out after debouncing', async () => {
    const { rerender, result } = renderWithClient('facebook', 'react');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));

    rerender({ query: '' });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockExecute).toHaveBeenCalledTimes(1); // no new call fired for the empty query
  });
});
