
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSyncState, subscribeSyncState, applyUpdate, requestAuth, type SyncState, type SyncStatus } from '../services/syncStore';
import { pullSync, flushOutbox } from '../services/sync';

function formatRelative(ms: number | null): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const STATUS_DOT: Record<SyncStatus, string> = {
  synced: 'bg-emerald-500',
  syncing: 'bg-indigo-400 animate-pulse',
  offline: 'bg-amber-400',
  'auth-required': 'bg-red-400',
  'update-available': 'bg-indigo-500 animate-pulse',
};

const STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  'auth-required': 'Sign in to sync',
  'update-available': 'Update available',
};

interface Props {
  compact?: boolean; // true = dot only (mobile)
}

const SyncIndicator: React.FC<Props> = ({ compact = false }) => {
  const [state, setState] = useState<SyncState>(getSyncState);
  const [, forceUpdate] = useState(0);

  // Subscribe to store updates
  useEffect(() => subscribeSyncState(setState), []);

  // Refresh relative time every minute
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleSyncNow = () => {
    void pullSync();
    void flushOutbox();
  };

  const dot = (
    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[state.status]}`} />
  );

  if (compact) {
    return (
      <div className="relative">
        {dot}
        {state.pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center leading-none">
            {state.pendingCount > 9 ? '9+' : state.pendingCount}
          </span>
        )}
      </div>
    );
  }

  const timeStr = formatRelative(state.lastSyncAt);

  return (
    <div className="px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {dot}
          <span className="text-zinc-400 truncate">
            {STATUS_TEXT[state.status]}
            {state.status === 'synced' && timeStr ? ` · ${timeStr}` : ''}
          </span>
        </div>
        {state.pendingCount > 0 && (
          <span className="flex-shrink-0 bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full">
            {state.pendingCount} pending
          </span>
        )}
      </div>

      {state.status === 'update-available' && (
        <button
          onClick={applyUpdate}
          className="w-full text-left text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={11} />
          Reload to update
        </button>
      )}

      {(state.status === 'synced' || state.status === 'offline') && (
        <button
          onClick={handleSyncNow}
          className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={11} />
          Sync now
        </button>
      )}

      {state.status === 'auth-required' && (
        <button
          onClick={requestAuth}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Tap to sign in
        </button>
      )}
    </div>
  );
};

export default SyncIndicator;
