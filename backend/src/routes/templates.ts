import { Hono } from "hono";
import { eq, or } from "drizzle-orm";
import { workoutTemplates } from "../db/schema";
import { createAuthMiddleware } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import type { CreateTemplateBody, TemplateExercise, UpdateTemplateBody } from "../types";

function templateToResponse(t: typeof workoutTemplates.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    exercises: JSON.parse(t.exercises) as TemplateExercise[],
    isPublic: t.isPublic,
    createdAt: t.createdAt,
  };
}

export function createTemplateRoutes(db: Db) {
  const templateRoutes = new Hono<AppEnv>();
  const authMiddleware = createAuthMiddleware(db);

  templateRoutes.use("*", authMiddleware);

  templateRoutes.get("/", async (c) => {
    const user = c.get("user");
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(or(eq(workoutTemplates.userId, user.id), eq(workoutTemplates.isPublic, true)));
    return c.json(templates.map(templateToResponse));
  });

  templateRoutes.get("/:id", async (c) => {
    const user = c.get("user");
    const [template] = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, c.req.param("id")));

    if (!template) return c.json({ detail: "Template not found" }, 404);
    if (template.userId !== user.id && !template.isPublic) {
      return c.json({ detail: "Access denied" }, 403);
    }

    return c.json(templateToResponse(template));
  });

  templateRoutes.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<CreateTemplateBody>();

    const template = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: body.name,
      exercises: JSON.stringify(body.exercises),
      isPublic: body.isPublic ?? false,
      createdAt: Date.now(),
    };
    await db.insert(workoutTemplates).values(template);

    return c.json(templateToResponse(template));
  });

  templateRoutes.put("/:id", async (c) => {
    const user = c.get("user");
    const [template] = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, c.req.param("id")));

    if (!template) return c.json({ detail: "Template not found" }, 404);
    if (template.userId !== user.id) return c.json({ detail: "Access denied" }, 403);

    const body = await c.req.json<UpdateTemplateBody>();
    const updates: Partial<typeof workoutTemplates.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.exercises !== undefined) updates.exercises = JSON.stringify(body.exercises);
    if (body.isPublic !== undefined) updates.isPublic = body.isPublic;

    const [updated] = await db
      .update(workoutTemplates)
      .set(updates)
      .where(eq(workoutTemplates.id, template.id))
      .returning();

    return c.json(templateToResponse(updated));
  });

  templateRoutes.delete("/:id", async (c) => {
    const user = c.get("user");
    const [template] = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, c.req.param("id")));

    if (!template) return c.json({ detail: "Template not found" }, 404);
    if (template.userId !== user.id) return c.json({ detail: "Access denied" }, 403);

    await db.delete(workoutTemplates).where(eq(workoutTemplates.id, template.id));
    return c.json({ message: "Template deleted successfully" });
  });

  return templateRoutes;
}
