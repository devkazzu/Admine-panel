/**
 * Small data-fetching hooks used across pages.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Alias kept for readability at call sites. */
export const useDebounced = useDebounce;

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Fetches via the provided loader whenever deps change.
 * Keeps previous data while reloading (no layout flash).
 */
export function useApiQuery<T>(loader: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err : new ApiError(0, String(err?.message ?? err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [depKey, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}

/** Reload on window focus (keeps notifications/counts fresh). */
export function useRefetchOnFocus(refetch: () => void): void {
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [refetch]);
}
