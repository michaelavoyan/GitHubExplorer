/**
 * BUG-020 (docs/BUGS.md) / docs/features/favorites.md: "Presentation shows
 * a transient 'couldn't save favorite' toast rather than propagating it
 * into an unrelated screen's query error state."
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { FavoriteErrorToast, FAVORITE_ERROR_TOAST_DURATION_MS } from './FavoriteErrorToast';
import { StorageError } from '../../domain/errors/DomainErrors';

describe('FavoriteErrorToast (docs/features/favorites.md, BUG-020)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when there is no error', () => {
    render(<FavoriteErrorToast error={undefined} />);
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });

  it('shows the "couldn\'t save favorite" message when an error is present', () => {
    render(<FavoriteErrorToast error={new StorageError()} />);
    expect(screen.getByTestId('favorite-error-toast')).toBeTruthy();
    expect(screen.getByText(/couldn.t save favorite/i)).toBeTruthy();
  });

  it('auto-dismisses after the configured duration', () => {
    jest.useFakeTimers();
    render(<FavoriteErrorToast error={new StorageError()} />);
    expect(screen.getByTestId('favorite-error-toast')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(FAVORITE_ERROR_TOAST_DURATION_MS);
    });

    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });

  it('does not crash or block anything when re-rendered without an error after dismissing (StorageError stays non-fatal)', () => {
    jest.useFakeTimers();
    const { rerender } = render(<FavoriteErrorToast error={new StorageError()} />);

    act(() => {
      jest.advanceTimersByTime(FAVORITE_ERROR_TOAST_DURATION_MS);
    });
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();

    rerender(<FavoriteErrorToast error={undefined} />);
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });

  it('re-shows and restarts the timer for a new, distinct failure', () => {
    jest.useFakeTimers();
    const firstError = new StorageError();
    const { rerender } = render(<FavoriteErrorToast error={firstError} />);

    act(() => {
      jest.advanceTimersByTime(FAVORITE_ERROR_TOAST_DURATION_MS);
    });
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();

    const secondError = new StorageError();
    rerender(<FavoriteErrorToast error={secondError} />);
    expect(screen.getByTestId('favorite-error-toast')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(FAVORITE_ERROR_TOAST_DURATION_MS);
    });
    expect(screen.queryByTestId('favorite-error-toast')).toBeNull();
  });
});
