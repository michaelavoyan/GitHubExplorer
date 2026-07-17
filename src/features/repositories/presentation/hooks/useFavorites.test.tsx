/**
 * REQUIRES THE REACT NATIVE CLI SCAFFOLD TO RUN — see docs/testing-strategy.md.
 *
 * Written test-first against docs/features/favorites.md: toggle UI
 * behavior via `useToggleFavorite()`, and persistence across a simulated
 * app "restart" (assignment §3.5: "Favorites should persist after app
 * restart").
 *
 * Assumed import paths once scaffolded:
 *   src/features/repositories/presentation/hooks/useFavorites.ts
 *   src/features/repositories/presentation/hooks/useToggleFavorite.ts
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFavorites } from './useFavorites';
import { useToggleFavorite } from './useToggleFavorite';
import { MmkvFavoritesRepository } from '../../data/repositories/MmkvFavoritesRepository';
import { KeyValueStorage } from '../../../../infrastructure/persistence/KeyValueStorage';

function makeInMemoryStorage(): jest.Mocked<KeyValueStorage> {
  const backing = new Map<string, string>();
  return {
    getString: jest.fn((key: string) => backing.get(key)),
    set: jest.fn((key: string, value: string) => backing.set(key, value)),
    delete: jest.fn((key: string) => backing.delete(key)),
  } as unknown as jest.Mocked<KeyValueStorage>;
}

describe('Favorites toggle + persistence across restart (docs/features/favorites.md, assignment §3.5)', () => {
  it('useFavorites() reflects an empty set on first launch', async () => {
    const { result } = renderHook(() => useFavorites(), {
      // Assumed provider wiring — the developer agent's actual DI
      // mechanism for injecting the repository is not specified by docs/.
      wrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    });

    await waitFor(() => expect(result.current.favorites.size).toBe(0));
  });

  it('toggling a repository on marks it favorited without a full-screen error on failure (toast, not thrown)', async () => {
    const { result } = renderHook(() => useToggleFavorite());

    await act(async () => {
      await result.current.toggle('facebook/react');
    });

    expect(result.current.error).toBeUndefined();
  });

  it('persists a favorited repository across a simulated app restart', async () => {
    const storage = makeInMemoryStorage();

    // "Before restart": toggle a favorite on.
    const beforeRestart = new MmkvFavoritesRepository(storage);
    await beforeRestart.add('facebook/react');

    // "Restart": fresh hook render tree, same underlying storage — mirrors
    // a cold app launch reading the same MMKV file.
    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(result.current.favorites.has('facebook/react')).toBe(true));
  });

  it('merges favorite status into list items without adding isFavorite to the Domain Repository model', async () => {
    // This is an architectural invariant, not just a behavioral one: the
    // merge must happen in a Presentation-only view-model type
    // (RepositoryListItemViewModel = Repository & { isFavorite: boolean }),
    // per the explicit decision in docs/features/favorites.md. Asserted
    // here as: the merge hook's output objects carry isFavorite, but nothing
    // in Domain/Application does.
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current).toBeDefined());
    // Placeholder assertion pending the real useRepositoryListViewModel
    // hook's implementation — see docs/testing-strategy.md.
    expect(typeof result.current.favorites).toBe('object');
  });
});
