
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'auth-required' | 'update-available';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingCount: number;
}

const state: SyncState = {
  status: 'synced',
  lastSyncAt: (() => {
    const v = localStorage.getItem('irontrack_last_sync');
    return v ? Number(v) : null;
  })(),
  pendingCount: 0,
};

type Listener = (s: SyncState) => void;
const listeners = new Set<Listener>();

export function getSyncState(): SyncState {
  return { ...state };
}

export function setSyncState(updates: Partial<SyncState>): void {
  Object.assign(state, updates);
  for (const fn of listeners) fn({ ...state });
}

export function subscribeSyncState(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Auth-request channel: SyncIndicator fires → App shows modal
let authRequestCb: (() => void) | null = null;

export function onAuthRequest(fn: () => void): () => void {
  authRequestCb = fn;
  return () => { authRequestCb = null; };
}

export function requestAuth(): void {
  authRequestCb?.();
}

export function applyUpdate(): void {
  navigator.serviceWorker?.ready.then(reg => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }).catch(() => window.location.reload());
}

// Detect SW update-available on module load
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    const check = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setSyncState({ status: 'update-available' });
      }
    };
    check();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', check);
    });
  }).catch(() => {});
}
