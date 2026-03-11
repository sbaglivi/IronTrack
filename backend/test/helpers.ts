import { createDb } from "../src/db";
import { exercises } from "../src/db/schema";
import { createApp } from "../src/app";

const SEED_EXERCISES = [
  "BB Bench Press",
  "Squat",
  "Deadlift",
  "BB Overhead Press",
  "BB Row",
  "Pull Up",
  "Dip",
  "BB Curl",
];

export function makeApp() {
  const db = createDb(":memory:");
  const app = createApp(db);
  return { app, db };
}

export async function seedExercises(db: ReturnType<typeof createDb>) {
  await db.insert(exercises).values(
    SEED_EXERCISES.map((name) => ({
      id: crypto.randomUUID(),
      name,
      aliases: "[]",
      createdAt: Date.now(),
    }))
  );
}

export async function signup(
  app: ReturnType<typeof createApp>,
  username = "testuser",
  password = "testpass123"
) {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json() as { access_token: string; user: { id: string; username: string } };
  return {
    token: data.access_token,
    user: data.user,
    headers: { Authorization: `Bearer ${data.access_token}` },
  };
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const SAMPLE_TEMPLATE_EXERCISES = [
  {
    exerciseId: "ex-1",
    name: "BB Bench Press",
    defaultSets: 3,
    defaultWeight: 60,
    defaultReps: 8,
  },
];

export async function createTemplate(
  app: ReturnType<typeof createApp>,
  headers: Record<string, string>,
  overrides: { name?: string; isPublic?: boolean } = {}
) {
  const res = await app.request("/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      name: overrides.name ?? "Push Day",
      exercises: SAMPLE_TEMPLATE_EXERCISES,
      isPublic: overrides.isPublic ?? false,
    }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

const SAMPLE_INSTANCE_EXERCISES = [
  {
    exerciseId: "ex-1",
    name: "BB Bench Press",
    sets: [
      { id: "set-1", weight: 60, reps: 8, completed: true },
      { id: "set-2", weight: 60, reps: 8, completed: false },
    ],
  },
];

export async function createInstance(
  app: ReturnType<typeof createApp>,
  headers: Record<string, string>,
  overrides: { name?: string; isDraft?: boolean; date?: number; exercises?: unknown[] } = {}
) {
  const res = await app.request("/instances", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      name: overrides.name ?? "Morning Workout",
      date: overrides.date ?? Date.now(),
      exercises: overrides.exercises ?? SAMPLE_INSTANCE_EXERCISES,
      notes: "Felt good",
      isDraft: overrides.isDraft ?? false,
    }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}
