
import Dexie, { type Table } from 'dexie';
import type { TemplateExercise, InstanceExercise } from '../types';

export interface LocalExercise {
  id: string;
  name: string;
  aliases: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LocalTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: TemplateExercise[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface LocalInstance {
  id: string;
  userId: string;
  templateId?: string | null;
  name: string;
  date: number;
  exercises: InstanceExercise[];
  notes: string;
  isDraft: boolean;
  updatedAt: number;
  deletedAt: number | null;
}

export interface OutboxEntry {
  id?: number;
  op: 'upsert' | 'delete';
  entity: 'exercise' | 'template' | 'instance';
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

class IronTrackDB extends Dexie {
  exercises!: Table<LocalExercise, string>;
  templates!: Table<LocalTemplate, string>;
  instances!: Table<LocalInstance, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('irontrack');
    this.version(1).stores({
      exercises: 'id, name, updatedAt',
      templates: 'id, userId, updatedAt',
      instances: 'id, userId, date, isDraft, updatedAt',
      outbox: '++id, entity, entityId, createdAt',
      meta: 'key',
    });
  }
}

export const localDb = new IronTrackDB();
