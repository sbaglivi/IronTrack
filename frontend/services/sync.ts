
import { localDb, type OutboxEntry, type LocalTemplate, type LocalInstance } from './localDb';
import { setSyncState, getSyncState } from './syncStore';

interface SyncPullResponse {
  exercises: Array<{ id: string; name: string; aliases: string[]; createdAt: number; updatedAt: number }>;
  templates: Array<{ id: string; userId: string; name: string; exercises: unknown[]; isPublic: boolean; createdAt: number; updatedAt: number; deletedAt: number | null }>;
  instances: Array<{ id: string; userId: string; templateId: string | null; name: string; date: number; exercises: unknown[]; notes: string; isDraft: boolean; updatedAt: number; deletedAt: number | null }>;
  serverTime: number;
}

interface SyncPushResponse {
  applied: Array<{ clientId: string; serverId: string; updatedAt: number }>;
  remappedIds: Record<string, string>;
  conflicts: Array<{ entity: string; id: string; serverVersion: unknown }>;
  serverTime: number;
}

interface Mutation {
  op: 'upsert' | 'delete';
  entity: 'exercise' | 'template' | 'instance';
  payload: Record<string, unknown>;
}

const getToken = (): string | null => localStorage.getItem('irontrack_token');

// In-flight counter so concurrent pull+flush both show "syncing"
let syncInFlight = 0;
let authRequired = false;

function beginSync() {
  syncInFlight++;
  if (!authRequired) setSyncState({ status: 'syncing' });
}

function endSync(result: 'synced' | 'offline' | 'auth-required') {
  syncInFlight = Math.max(0, syncInFlight - 1);
  if (result === 'auth-required') {
    authRequired = true;
    setSyncState({ status: 'auth-required' });
    return;
  }
  if (authRequired) return; // sticky until page reload
  if (syncInFlight === 0) {
    setSyncState({ status: result });
    if (result === 'synced') {
      const v = localStorage.getItem('irontrack_last_sync');
      if (v) setSyncState({ lastSyncAt: Number(v) });
    }
  }
}

async function updatePendingCount() {
  const count = await localDb.outbox.count();
  setSyncState({ pendingCount: count });
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flushOutbox(); }, 1000);
}

export async function enqueue(
  op: 'upsert' | 'delete',
  entity: 'exercise' | 'template' | 'instance',
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await localDb.outbox.add({
    op, entity, entityId, payload,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  });
  void updatePendingCount();
  if (navigator.onLine) scheduleFlush();
}

export async function pullSync(): Promise<void> {
  if (authRequired) return;
  const token = getToken();
  if (!token) return;

  beginSync();

  const lastSyncRaw = localStorage.getItem('irontrack_last_sync');
  const since = lastSyncRaw ? Number(lastSyncRaw) : 0;

  let res: Response;
  try {
    res = await fetch(`/sync?since=${since}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    endSync('offline');
    return;
  }

  if (res.status === 401 || res.status === 403) { endSync('auth-required'); return; }
  if (!res.ok) { endSync('offline'); return; }

  const data = await res.json() as SyncPullResponse;

  if (data.exercises.length) {
    await localDb.exercises.bulkPut(data.exercises as Parameters<typeof localDb.exercises.bulkPut>[0]);
  }

  for (const t of data.templates) {
    if (t.deletedAt !== null) {
      await localDb.templates.delete(t.id);
    } else {
      await localDb.templates.put(t as LocalTemplate);
    }
  }

  for (const i of data.instances) {
    if (i.deletedAt !== null) {
      await localDb.instances.delete(i.id);
    } else {
      await localDb.instances.put(i as LocalInstance);
    }
  }

  localStorage.setItem('irontrack_last_sync', String(data.serverTime));
  window.dispatchEvent(new CustomEvent('irontrack:synced'));
  endSync('synced');
}

export async function flushOutbox(): Promise<void> {
  if (authRequired) return;
  const token = getToken();
  if (!token || !navigator.onLine) return;

  const entries = await localDb.outbox.orderBy('id').toArray();
  if (!entries.length) return;

  beginSync();

  // Coalesce per (entity, entityId) — keep latest entry by outbox id
  const latestByKey = new Map<string, OutboxEntry>();
  for (const entry of entries) {
    latestByKey.set(`${entry.entity}:${entry.entityId}`, entry);
  }

  const mutations: Mutation[] = [];
  const allIdsToDelete: number[] = [];

  for (const [key, latest] of latestByKey) {
    allIdsToDelete.push(
      ...entries.filter(e => `${e.entity}:${e.entityId}` === key).map(e => e.id!),
    );
    mutations.push({ op: latest.op, entity: latest.entity, payload: latest.payload });
  }

  let res: Response;
  try {
    res = await fetch('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mutations }),
    });
  } catch {
    endSync('offline');
    return;
  }

  if (res.status === 401 || res.status === 403) { endSync('auth-required'); return; }
  if (!res.ok) { endSync('offline'); return; }

  const result = await res.json() as SyncPushResponse;
  await localDb.outbox.bulkDelete(allIdsToDelete);
  void updatePendingCount();

  if (Object.keys(result.remappedIds).length) await applyRemappedIds(result.remappedIds);

  localStorage.setItem('irontrack_last_sync', String(result.serverTime));
  endSync('synced');
}

async function applyRemappedIds(remappedIds: Record<string, string>): Promise<void> {
  for (const [oldId, newId] of Object.entries(remappedIds)) {
    const ex = await localDb.exercises.get(oldId);
    if (ex) {
      await localDb.exercises.delete(oldId);
      await localDb.exercises.put({ ...ex, id: newId });
    }

    const templates = await localDb.templates.toArray();
    for (const t of templates) {
      if (!t.exercises.some(e => e.exerciseId === oldId)) continue;
      const updated: LocalTemplate = {
        ...t,
        exercises: t.exercises.map(e => e.exerciseId === oldId ? { ...e, exerciseId: newId } : e),
        updatedAt: Date.now(),
      };
      await localDb.templates.put(updated);
      await enqueue('upsert', 'template', t.id, localTemplateToPayload(updated));
    }

    const instances = await localDb.instances.toArray();
    for (const i of instances) {
      if (!i.exercises.some(e => e.exerciseId === oldId)) continue;
      const updated: LocalInstance = {
        ...i,
        exercises: i.exercises.map(e => e.exerciseId === oldId ? { ...e, exerciseId: newId } : e),
        updatedAt: Date.now(),
      };
      await localDb.instances.put(updated);
      await enqueue('upsert', 'instance', i.id, localInstanceToPayload(updated));
    }

    const exOutbox = await localDb.outbox
      .filter(e => e.entity === 'exercise' && e.entityId === oldId)
      .toArray();
    for (const e of exOutbox) {
      await localDb.outbox.update(e.id!, { entityId: newId, payload: { ...e.payload, id: newId } });
    }

    const tplOutbox = await localDb.outbox.where('entity').equals('template').toArray();
    for (const e of tplOutbox) {
      const exs = e.payload.exercises as Array<{ exerciseId: string }> | undefined;
      if (!exs?.some(ex => ex.exerciseId === oldId)) continue;
      await localDb.outbox.update(e.id!, {
        payload: { ...e.payload, exercises: exs.map(ex => ex.exerciseId === oldId ? { ...ex, exerciseId: newId } : ex) },
      });
    }

    const instOutbox = await localDb.outbox.where('entity').equals('instance').toArray();
    for (const e of instOutbox) {
      const exs = e.payload.exercises as Array<{ exerciseId: string }> | undefined;
      if (!exs?.some(ex => ex.exerciseId === oldId)) continue;
      await localDb.outbox.update(e.id!, {
        payload: { ...e.payload, exercises: exs.map(ex => ex.exerciseId === oldId ? { ...ex, exerciseId: newId } : ex) },
      });
    }
  }
}

export function localTemplateToPayload(t: LocalTemplate): Record<string, unknown> {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    exercises: t.exercises,
    isPublic: t.isPublic,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function localInstanceToPayload(i: LocalInstance): Record<string, unknown> {
  return {
    id: i.id,
    userId: i.userId,
    templateId: i.templateId ?? null,
    name: i.name,
    date: i.date,
    exercises: i.exercises,
    notes: i.notes,
    isDraft: i.isDraft,
    updatedAt: i.updatedAt,
  };
}

export function resetAuthState(): void {
  authRequired = false;
  // Only reset status if it was auth-required (don't disturb update-available)
  if (getSyncState().status === 'auth-required') setSyncState({ status: 'synced' });
}

export async function initialSync(): Promise<void> {
  const lastSync = localStorage.getItem('irontrack_last_sync');
  if (!lastSync) {
    await pullSync();
  } else {
    void pullSync();
    void flushOutbox();
  }
}
