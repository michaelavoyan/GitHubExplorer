/**
 * App-wide TanStack Query client. Server state only, per Architecture.md's
 * State Management table — UI state (connectivity) and local component
 * state are handled elsewhere (Zustand / React hooks).
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
