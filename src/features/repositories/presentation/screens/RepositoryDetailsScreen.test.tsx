/**
 * BUG-020 (docs/BUGS.md) coverage for RepositoryDetailsScreen: this file
 * previously did not exist. Scoped to this screen's core render plus the
 * new favorite-error-toast wiring, not a full re-derivation of every
 * assignment §3.3 field (already covered structurally by the shared
 * `Detail`/`Stat` helpers and RepositoryListScreen's field-rendering test).
 *
 * Mocking approach mirrors RepositoryListScreen.test.tsx: each hook the
 * screen depends on (`useRepositoryDetails`, `useFavorites`,
 * `useToggleFavorite`) is replaced with a jest.fn() configured per test.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { RepositoryDetailsScreen } from './RepositoryDetailsScreen';
import { useRepositoryDetails } from '../hooks/useRepositoryDetails';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { NetworkError, NotFoundError, StorageError } from '../../domain/errors/DomainErrors';
import { buildRepository } from '../../__fixtures__/repositoryFixtures';

jest.mock('../hooks/useRepositoryDetails');
jest.mock('../hooks/useFavorites');
jest.mock('../hooks/useToggleFavorite');

const mockUseRepositoryDetails = useRepositoryDetails as jest.Mock;
const mockUseFavorites = useFavorites as jest.Mock;
const mockUseToggleFavorite = useToggleFavorite as jest.Mock;

function renderScreen() {
  return render(<RepositoryDetailsScreen route={{ params: { owner: 'facebook', repo: 'react' } }} />);
}

describe('RepositoryDetailsScreen (assignment §3.3, docs/features/favorites.md)', () => {
  beforeEach(() => {
    mockUseRepositoryDetails.mockReset();
    mockUseFavorites.mockReset();
    mockUseToggleFavorite.mockReset();

    mockUseRepositoryDetails.mockReturnValue({
      data: buildRepository(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseFavorites.mockReturnValue({ favorites: new Set<string>() });
    mockUseToggleFavorite.mockReturnValue({ toggle: jest.fn(), error: undefined });
  });

  it('renders the repository details once loaded', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details')).toBeTruthy());
    expect(screen.getByText('facebook/react')).toBeTruthy();
  });

  it('BUG-020: shows a transient "couldn\'t save favorite" toast when useToggleFavorite() reports an error, without switching into the details error view', async () => {
    mockUseToggleFavorite.mockReturnValue({ toggle: jest.fn(), error: new StorageError() });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details')).toBeTruthy());

    expect(screen.getByTestId('favorite-error-toast')).toBeTruthy();
    expect(screen.getByText(/couldn.t save favorite/i)).toBeTruthy();
    expect(screen.queryByTestId('repository-details-error')).toBeNull();
  });

  it('BUG-020: renders no toast when useToggleFavorite() reports no error', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details')).toBeTruthy());
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });

  it('docs/bonus-and-optional.md §9.1: shows a distinct "no saved data" empty state for a repo never viewed this session while offline', async () => {
    mockUseRepositoryDetails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new NetworkError(),
      refetch: jest.fn(),
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details-offline-empty')).toBeTruthy());
    expect(screen.getByText('No saved data — reconnect to view')).toBeTruthy();
    expect(screen.queryByTestId('repository-details-error')).toBeNull();
  });

  it('docs/bonus-and-optional.md §9.1: a NetworkError with persisted cache data falls through to the details view, not a full-screen error', async () => {
    mockUseRepositoryDetails.mockReturnValue({
      data: buildRepository(),
      isLoading: false,
      isError: true,
      error: new NetworkError(),
      refetch: jest.fn(),
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details')).toBeTruthy());
    expect(screen.queryByTestId('repository-details-error')).toBeNull();
    expect(screen.queryByTestId('repository-details-offline-empty')).toBeNull();
  });

  it('a non-network error with no data still shows the generic error view with Retry', async () => {
    mockUseRepositoryDetails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new NotFoundError(),
      refetch: jest.fn(),
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('repository-details-error')).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
