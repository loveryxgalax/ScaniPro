type Listener = () => void;
const listeners = new Set<Listener>();

/** Signals that stored data changed so mounted queries can refresh. */
export function notifyDataChanged() {
  for (const l of listeners) l();
}

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
