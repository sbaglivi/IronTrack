import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { workoutInstances } from "../db/schema";
import { createAuthMiddleware } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import type { CreateInstanceBody, InstanceExercise, UpdateInstanceBody } from "../types";

function instanceToResponse(i: typeof workoutInstances.$inferSelect) {
  return {
    id: i.id,
    userId: i.userId,
    templateId: i.templateId,
    name: i.name,
    date: i.date,
    exercises: JSON.parse(i.exercises) as InstanceExercise[],
    notes: i.notes ?? "",
    isDraft: i.isDraft,
  };
}

export function createInstanceRoutes(db: Db) {
  const instanceRoutes = new Hono<AppEnv>();
  const authMiddleware = createAuthMiddleware(db);

  instanceRoutes.use("*", authMiddleware);

  instanceRoutes.get("/", async (c) => {
    const user = c.get("user");
    const includeDrafts = c.req.query("include_drafts") === "true";

    const all = await db
      .select()
      .from(workoutInstances)
      .where(eq(workoutInstances.userId, user.id))
      .orderBy(desc(workoutInstances.date));

    const filtered = includeDrafts ? all : all.filter((i) => !i.isDraft);
    return c.json(filtered.map(instanceToResponse));
  });

  instanceRoutes.get("/draft", async (c) => {
    const user = c.get("user");
    const [draft] = await db
      .select()
      .from(workoutInstances)
      .where(and(eq(workoutInstances.userId, user.id), eq(workoutInstances.isDraft, true)))
      .orderBy(desc(workoutInstances.date))
      .limit(1);

    return c.json(draft ? instanceToResponse(draft) : null);
  });

  instanceRoutes.get("/:id", async (c) => {
    const user = c.get("user");
    const [instance] = await db
      .select()
      .from(workoutInstances)
      .where(eq(workoutInstances.id, c.req.param("id")));

    if (!instance) return c.json({ detail: "Instance not found" }, 404);
    if (instance.userId !== user.id) return c.json({ detail: "Access denied" }, 403);
    return c.json(instanceToResponse(instance));
  });

  instanceRoutes.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<CreateInstanceBody>();

    const instance = {
      id: crypto.randomUUID(),
      userId: user.id,
      templateId: body.templateId ?? null,
      name: body.name,
      date: body.date,
      exercises: JSON.stringify(body.exercises),
      notes: body.notes ?? "",
      isDraft: body.isDraft ?? false,
    };
    await db.insert(workoutInstances).values(instance);

    return c.json(instanceToResponse(instance));
  });

  instanceRoutes.put("/:id", async (c) => {
    const user = c.get("user");
    const [instance] = await db
      .select()
      .from(workoutInstances)
      .where(eq(workoutInstances.id, c.req.param("id")));

    if (!instance) return c.json({ detail: "Instance not found" }, 404);
    if (instance.userId !== user.id) return c.json({ detail: "Access denied" }, 403);

    const body = await c.req.json<UpdateInstanceBody>();
    const updates: Partial<typeof workoutInstances.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.date !== undefined) updates.date = body.date;
    if (body.exercises !== undefined) updates.exercises = JSON.stringify(body.exercises);
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.isDraft !== undefined) updates.isDraft = body.isDraft;

    const [updated] = await db
      .update(workoutInstances)
      .set(updates)
      .where(eq(workoutInstances.id, instance.id))
      .returning();

    return c.json(instanceToResponse(updated));
  });

  instanceRoutes.delete("/:id", async (c) => {
    const user = c.get("user");
    const [instance] = await db
      .select()
      .from(workoutInstances)
      .where(eq(workoutInstances.id, c.req.param("id")));

    if (!instance) return c.json({ detail: "Instance not found" }, 404);
    if (instance.userId !== user.id) return c.json({ detail: "Access denied" }, 403);

    await db.delete(workoutInstances).where(eq(workoutInstances.id, instance.id));
    return c.json({ message: "Instance deleted successfully" });
  });

  return instanceRoutes;
}
