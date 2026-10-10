import { useSyncExternalStore } from 'react';

/** Tiny observable store for app-wide state that isn't in SQLite. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    use<S>(selector: (s: T) => S): S {
      return useSyncExternalStore(this.subscribe, () => selector(state), () => selector(state));
    },
  };
}
