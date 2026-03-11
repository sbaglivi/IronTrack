// ---- Nested types stored as JSON in DB ----

export interface TemplateExercise {
  exerciseId: string;
  name: string;
  defaultSets: number;
  defaultWeight: number;
  defaultReps: number;
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
}
