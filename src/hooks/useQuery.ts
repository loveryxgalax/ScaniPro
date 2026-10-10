import { useCallback, useEffect, useRef, useState } from 'react';

import { onDataChanged } from '@/lib/events';

/** Runs an async loader and re-runs it whenever stored data changes. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  const seq = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const value = await loadRef.current();
      if (id === seq.current) {
        setData(value);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e as Error);
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
    void reload();
    return onDataChanged(() => void reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading: data === undefined && !error, reload };
}
