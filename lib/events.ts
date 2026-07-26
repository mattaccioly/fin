export const DATA_CHANGED_EVENT = "fin:data-changed";

/** Notify open views that financial data changed (e.g. expense saved from the global modal). */
export function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function onDataChanged(handler: () => void): () => void {
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}
