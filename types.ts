
export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export interface Exercise {
  id: string;
  name: string;
}

export interface TemplateExercise {
  exerciseId: string;
  name: string;
  defaultSets: number;
  defaultWeight: number;
  defaultReps: number;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: TemplateExercise[];
  isPublic: boolean;
  createdAt: number;
}

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface InstanceExercise {
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutInstance {
  id: string;
  userId: string;
  templateId?: string;
  name: string;
  date: number;
  exercises: InstanceExercise[];
  notes: string;
}
