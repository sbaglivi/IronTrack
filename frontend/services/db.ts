
import { User, Exercise, WorkoutTemplate, WorkoutInstance } from '../types';
import { localDb, type LocalTemplate, type LocalInstance } from './localDb';
import { enqueue, localTemplateToPayload, localInstanceToPayload, resetAuthState, pullSync, flushOutbox } from './sync';

const API_URL = '';

const getToken = (): string | null => localStorage.getItem('irontrack_token');

const setToken = (token: string | null) => {
  if (token) localStorage.setItem('irontrack_token', token);
  else localStorage.removeItem('irontrack_token');
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
};

const UPPERCASE_TOKENS = new Set(['BB', 'DB', 'KB', 'BW', 'EZ']);

function normalizeExerciseName(name: string): string {
  return name.trim().split(/\s+/).map(word => {
    if (UPPERCASE_TOKENS.has(word.toUpperCase())) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

class DBService {
  getCurrentUser(): User | null {
    const data = localStorage.getItem('irontrack_current_user');
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem('irontrack_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('irontrack_current_user');
      localStorage.removeItem('irontrack_last_sync');
      setToken(null);
      void Promise.all([
        localDb.exercises.clear(),
        localDb.templates.clear(),
        localDb.instances.clear(),
        localDb.outbox.clear(),
        localDb.meta.clear(),
      ]);
    }
  }

  async login(username: string, password: string): Promise<User> {
    const response = await fetchWithAuth(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(response.access_token);
    this.setCurrentUser(response.user);
    resetAuthState();
    void pullSync();
    void flushOutbox();
    return response.user;
  }

  async signup(username: string, password: string): Promise<User> {
    const response = await fetchWithAuth(`${API_URL}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(response.access_token);
    this.setCurrentUser(response.user);
    resetAuthState();
    void pullSync();
    return response.user;
  }

  // Exercises
  async getExercises(): Promise<Exercise[]> {
    return localDb.exercises.orderBy('name').toArray() as Promise<Exercise[]>;
  }

  async searchExercises(query: string): Promise<Exercise[]> {
    const q = query.toLowerCase();
    return localDb.exercises.filter(ex =>
      ex.name.toLowerCase().includes(q) ||
      ex.aliases.some(a => a.toLowerCase().includes(q))
    ).toArray() as Promise<Exercise[]>;
  }

  async addExercise(name: string, aliases?: string[]): Promise<Exercise> {
    const normalized = normalizeExerciseName(name);
    const existing = await localDb.exercises.where('name').equals(normalized).first();
    if (existing) return existing as Exercise;

    const now = Date.now();
    const ex = {
      id: crypto.randomUUID(),
      name: normalized,
      aliases: aliases ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await localDb.exercises.put(ex);
    await enqueue('upsert', 'exercise', ex.id, { ...ex });
    return ex as Exercise;
  }

  // Templates
  async getTemplates(_userId: string): Promise<WorkoutTemplate[]> {
    const user = this.getCurrentUser();
    if (!user) return [];
    return localDb.templates
      .filter(t => t.userId === user.id && t.deletedAt === null)
      .toArray() as Promise<WorkoutTemplate[]>;
  }

  async getTemplate(id: string): Promise<WorkoutTemplate> {
    const t = await localDb.templates.get(id);
    if (!t || t.deletedAt !== null) throw new Error('Template not found');
    return t as WorkoutTemplate;
  }

  async saveTemplate(template: WorkoutTemplate): Promise<void> {
    const now = Date.now();
    const existing = await localDb.templates.get(template.id);
    const local: LocalTemplate = {
      id: template.id,
      userId: template.userId,
      name: template.name,
      exercises: template.exercises,
      isPublic: template.isPublic,
      createdAt: template.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    await localDb.templates.put(local);
    await enqueue('upsert', 'template', local.id, localTemplateToPayload(local));
  }

  async deleteTemplate(id: string): Promise<void> {
    const existing = await localDb.templates.get(id);
    if (!existing) return;
    const now = Date.now();
    await localDb.templates.put({ ...existing, deletedAt: now, updatedAt: now });
    await enqueue('delete', 'template', id, { id, updatedAt: now });
  }

  // Instances
  async getInstances(_userId: string): Promise<WorkoutInstance[]> {
    const user = this.getCurrentUser();
    if (!user) return [];
    return localDb.instances
      .filter(i => i.userId === user.id && !i.isDraft && i.deletedAt === null)
      .toArray() as Promise<WorkoutInstance[]>;
  }

  async getInstance(id: string): Promise<WorkoutInstance> {
    const i = await localDb.instances.get(id);
    if (!i || i.deletedAt !== null) throw new Error('Instance not found');
    return i as WorkoutInstance;
  }

  async saveInstance(instance: WorkoutInstance): Promise<WorkoutInstance> {
    const now = Date.now();
    const existing = await localDb.instances.get(instance.id);
    const local: LocalInstance = {
      id: instance.id,
      userId: instance.userId,
      templateId: instance.templateId ?? null,
      name: instance.name,
      date: instance.date,
      exercises: instance.exercises,
      notes: instance.notes,
      isDraft: instance.isDraft,
      updatedAt: now,
      deletedAt: existing?.deletedAt ?? null,
    };
    await localDb.instances.put(local);
    await enqueue('upsert', 'instance', local.id, localInstanceToPayload(local));
    return local as WorkoutInstance;
  }

  async getDraft(): Promise<WorkoutInstance | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    const draft = await localDb.instances
      .filter(i => i.isDraft && i.userId === user.id && i.deletedAt === null)
      .first();
    return draft ? (draft as WorkoutInstance) : null;
  }

  async createInstance(instance: Omit<WorkoutInstance, 'id'>): Promise<WorkoutInstance> {
    const now = Date.now();
    const local: LocalInstance = {
      id: crypto.randomUUID(),
      userId: instance.userId,
      templateId: instance.templateId ?? null,
      name: instance.name,
      date: instance.date,
      exercises: instance.exercises,
      notes: instance.notes,
      isDraft: instance.isDraft,
      updatedAt: now,
      deletedAt: null,
    };
    await localDb.instances.put(local);
    await enqueue('upsert', 'instance', local.id, localInstanceToPayload(local));
    return local as WorkoutInstance;
  }

  async deleteInstance(id: string): Promise<void> {
    const existing = await localDb.instances.get(id);
    if (!existing) return;
    const now = Date.now();
    await localDb.instances.put({ ...existing, deletedAt: now, updatedAt: now });
    await enqueue('delete', 'instance', id, { id, updatedAt: now });
  }

  getUsers(): User[] { return []; }
  addUser(_user: User) {}
}

export const db = new DBService();
