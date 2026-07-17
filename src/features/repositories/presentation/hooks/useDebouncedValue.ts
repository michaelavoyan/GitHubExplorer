import { useEffect, useState } from 'react';

/**
 * Generic debounce hook — the mechanism behind assignment §3.4's "avoid
 * unnecessary API calls while typing" (docs/features/repository-list.md
 * "Search/Filter": 300-400ms, a Presentation/UI-timing concern).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
