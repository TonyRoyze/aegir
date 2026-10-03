const SESSION_KEY = "aegir_session";
const listeners = new Set<() => void>();
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  const storageListener = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", storageListener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storageListener);
  };
}
export function readSession(): string | null {
  return window.localStorage.getItem(SESSION_KEY);
}
export function serverSession(): undefined {
  return undefined;
}
export function writeSession(token: string | null) {
  if (token) window.localStorage.setItem(SESSION_KEY, token);
  else window.localStorage.removeItem(SESSION_KEY);
  for (const listener of listeners) listener();
}
