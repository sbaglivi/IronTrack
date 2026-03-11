import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { exercises, workoutInstances } from "../db/schema";
import { createAuthMiddleware } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import type { CreateExerciseBody, InstanceExercise } from "../types";

const UPPERCASE_TOKENS = new Set(["BB", "DB", "KB", "BW", "EZ"]);

export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (UPPERCASE_TOKENS.has(word.toUpperCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function exerciseToResponse(ex: typeof exercises.$inferSelect) {
  return {
    id: ex.id,
    name: ex.name,
    aliases: JSON.parse(ex.aliases) as string[],
    createdAt: ex.createdAt,
  };
}

// Simple fuzzy match: checks substring first, then ordered character match
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function createExerciseRoutes(db: Db) {
  const exerciseRoutes = new Hono<AppEnv>();
  const authMiddleware = createAuthMiddleware(db);

  exerciseRoutes.use("*", authMiddleware);

  exerciseRoutes.get("/", async (c) => {
    const q = c.req.query("q");
    const all = await db.select().from(exercises);

    if (!q) {
      return c.json(all.map(exerciseToResponse));
    }

    const filtered = all.filter((ex) => {
      if (fuzzyMatch(q, ex.name)) return true;
      const aliases = JSON.parse(ex.aliases) as string[];
      return aliases.some((alias) => fuzzyMatch(q, alias));
    });

    return c.json(filtered.map(exerciseToResponse));
  });

  exerciseRoutes.post("/", async (c) => {
    const body = await c.req.json<CreateExerciseBody>();
    if (!body.name) return c.json({ detail: "Name required" }, 400);

    const normalized = normalizeExerciseName(body.name);
    const aliases = body.aliases?.map((a) => a.trim()).filter(Boolean) ?? [];

    const [existing] = await db.select().from(exercises).where(eq(exercises.name, normalized));
    if (existing) return c.json(exerciseToResponse(existing));

    const exercise = {
      id: crypto.randomUUID(),
      name: normalized,
      aliases: JSON.stringify(aliases),
      createdAt: Date.now(),
    };
    await db.insert(exercises).values(exercise);

    return c.json(exerciseToResponse({ ...exercise }));
  });

  exerciseRoutes.get("/:id/history", async (c) => {
    const user = c.get("user");
    const exerciseId = c.req.param("id");

    const allInstances = await db
      .select()
      .from(workoutInstances)
      .where(eq(workoutInstances.userId, user.id));

    const history = allInstances
      .flatMap((inst) => {
        const exs = JSON.parse(inst.exercises) as InstanceExercise[];
        const match = exs.find((e) => e.exerciseId === exerciseId);
        if (!match) return [];
        return [{
          instanceId: inst.id,
          instanceName: inst.name,
          date: inst.date,
          sets: match.sets,
        }];
      })
      .sort((a, b) => b.date - a.date);

    return c.json(history);
  });

  return exerciseRoutes;
}
