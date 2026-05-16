// ---- Nested types stored as JSON in DB ----

export interface TemplateExercise {
  exerciseId: string;
  name: string;
  defaultSets: number;
  defaultWeight: number;
  defaultReps: number;
  supersetId?: string;
}

export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
  duration?: number; // seconds, for isometric holds
}

export interface InstanceExercise {
  exerciseId: string;
  name: string;
  sets: SetEntry[];
  supersetId?: string;
}

// ---- API request bodies ----

export interface SignupBody {
  username: string;
  password: string;
}

export interface CreateExerciseBody {
  name: string;
  aliases?: string[];
}

export interface CreateTemplateBody {
  name: string;
  exercises: TemplateExercise[];
  isPublic?: boolean;
}

export interface UpdateTemplateBody {
  name?: string;
  exercises?: TemplateExercise[];
  isPublic?: boolean;
}

export interface CreateInstanceBody {
  templateId?: string;
  name: string;
  date: number;
  exercises: InstanceExercise[];
  notes?: string;
  isDraft?: boolean;
}

export interface UpdateInstanceBody {
  name?: string;
  date?: number;
  exercises?: InstanceExercise[];
  notes?: string;
  isDraft?: boolean;
}

// ---- Sync types ----

export interface SyncExerciseRow {
  id: string;
  name: string;
  aliases: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SyncTemplateRow {
  id: string;
  userId: string;
  name: string;
  exercises: TemplateExercise[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SyncInstanceRow {
  id: string;
  userId: string;
  templateId: string | null;
  name: string;
  date: number;
  exercises: InstanceExercise[];
  notes: string;
  isDraft: boolean;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SyncPullResponse {
  exercises: SyncExerciseRow[];
  templates: SyncTemplateRow[];
  instances: SyncInstanceRow[];
  serverTime: number;
}

export interface Mutation {
  op: "upsert" | "delete";
  entity: "exercise" | "template" | "instance";
  payload: Record<string, unknown>;
}

export interface SyncPushRequest {
  mutations: Mutation[];
}

export interface AppliedMutation {
  clientId: string;
  serverId: string;
  updatedAt: number;
}

export interface ConflictEntry {
  entity: string;
  id: string;
  serverVersion: unknown;
}

export interface SyncPushResponse {
  applied: AppliedMutation[];
  remappedIds: Record<string, string>;
  conflicts: ConflictEntry[];
  serverTime: number;
}

// ---- API response shapes ----

export interface UserResponse {
  id: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: UserResponse;
}

export interface ExerciseResponse {
  id: string;
  name: string;
  aliases: string[];
  createdAt: number;
}

export interface TemplateResponse {
  id: string;
  userId: string;
  name: string;
  exercises: TemplateExercise[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InstanceResponse {
  id: string;
  userId: string;
  templateId: string | null;
  name: string;
  date: number;
  exercises: InstanceExercise[];
  notes: string;
  isDraft: boolean;
  updatedAt: number;
}
