import { Hono } from "hono";
import { and, eq, gte } from "drizzle-orm";
import { exercises, workoutInstances, workoutTemplates } from "../db/schema";
import { createAuthMiddleware } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import { normalizeExerciseName } from "./exercises";
import type {
  AppliedMutation,
  ConflictEntry,
  InstanceExercise,
  Mutation,
  SyncPushRequest,
  TemplateExercise,
} from "../types";

function syncExerciseRow(ex: typeof exercises.$inferSelect) {
  return {
    id: ex.id,
    name: ex.name,
    aliases: JSON.parse(ex.aliases) as string[],
    createdAt: ex.createdAt,
    updatedAt: ex.updatedAt,
  };
}

function syncTemplateRow(t: typeof workoutTemplates.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    exercises: JSON.parse(t.exercises) as TemplateExercise[],
    isPublic: t.isPublic,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: t.deletedAt,
  };
}

function syncInstanceRow(i: typeof workoutInstances.$inferSelect) {
  return {
    id: i.id,
    userId: i.userId,
    templateId: i.templateId,
    name: i.name,
    date: i.date,
    exercises: JSON.parse(i.exercises) as InstanceExercise[],
    notes: i.notes ?? "",
    isDraft: i.isDraft,
    updatedAt: i.updatedAt,
    deletedAt: i.deletedAt,
  };
}

export function createSyncRoutes(db: Db) {
  const syncRoutes = new Hono<AppEnv>();
  const authMiddleware = createAuthMiddleware(db);

  syncRoutes.use("*", authMiddleware);

  syncRoutes.get("/", async (c) => {
    const since = Number(c.req.query("since") ?? "0");
    if (!Number.isFinite(since)) return c.json({ detail: "Invalid since parameter" }, 400);

    const serverTime = Date.now();
    const user = c.get("user");

    const [exs, templates, instances] = await Promise.all([
      db.select().from(exercises).where(gte(exercises.updatedAt, since)),
      db.select().from(workoutTemplates).where(
        and(eq(workoutTemplates.userId, user.id), gte(workoutTemplates.updatedAt, since))
      ),
      db.select().from(workoutInstances).where(
        and(eq(workoutInstances.userId, user.id), gte(workoutInstances.updatedAt, since))
      ),
    ]);

    return c.json({
      exercises: exs.map(syncExerciseRow),
      templates: templates.map(syncTemplateRow),
      instances: instances.map(syncInstanceRow),
      serverTime,
    });
  });

  syncRoutes.post("/", async (c) => {
    const user = c.get("user");
    let body: SyncPushRequest;
    try {
      body = await c.req.json<SyncPushRequest>();
    } catch {
      return c.json({ detail: "Invalid JSON" }, 400);
    }

    const { mutations } = body;
    if (!Array.isArray(mutations) || mutations.length > 1000) {
      return c.json({ detail: "mutations must be an array of at most 1000 items" }, 400);
    }

    const serverTime = Date.now();
    const applied: AppliedMutation[] = [];
    const remappedIds: Record<string, string> = {};
    const conflicts: ConflictEntry[] = [];

    // Mutations are idempotent by design (LWW), so sequential application without
    // a wrapping transaction is safe — a partial apply is fully recoverable on retry.
    for (const mutation of mutations) {
      await applyMutation(db, user.id, mutation, serverTime, applied, remappedIds, conflicts);
    }

    return c.json({ applied, remappedIds, conflicts, serverTime });
  });

  return syncRoutes;
}

async function applyMutation(
  db: Db,
  userId: string,
  mutation: Mutation,
  serverTime: number,
  applied: AppliedMutation[],
  remappedIds: Record<string, string>,
  conflicts: ConflictEntry[],
) {
  const { op, entity, payload } = mutation;
  const clientId = String(payload.id ?? "");
  const clientUpdatedAt = Number(payload.updatedAt ?? 0);

  if (!clientId) return;

  if (entity === "exercise") {
    await applyExerciseMutation(db, op, payload, clientId, clientUpdatedAt, serverTime, applied, remappedIds);
  } else if (entity === "template") {
    await applyTemplateMutation(db, userId, op, payload, clientId, clientUpdatedAt, serverTime, applied, conflicts);
  } else if (entity === "instance") {
    await applyInstanceMutation(db, userId, op, payload, clientId, clientUpdatedAt, serverTime, applied, conflicts);
  }
}

async function applyExerciseMutation(
  db: Db,
  op: string,
  payload: Record<string, unknown>,
  clientId: string,
  clientUpdatedAt: number,
  serverTime: number,
  applied: AppliedMutation[],
  remappedIds: Record<string, string>,
) {
  if (op !== "upsert") return; // exercises are never deleted via sync

  const normalized = normalizeExerciseName(String(payload.name ?? ""));
  if (!normalized) return;

  const [existing] = await db.select().from(exercises).where(eq(exercises.name, normalized));
  if (existing) {
    // Name collision — return the server's id; client must remap local references
    if (existing.id !== clientId) remappedIds[clientId] = existing.id;
    applied.push({ clientId, serverId: existing.id, updatedAt: existing.updatedAt });
    return;
  }

  const updatedAt = Math.max(clientUpdatedAt, serverTime);
  const aliases = Array.isArray(payload.aliases) ? payload.aliases as string[] : [];
  await db.insert(exercises).values({
    id: clientId,
    name: normalized,
    aliases: JSON.stringify(aliases),
    createdAt: Number(payload.createdAt ?? serverTime),
    updatedAt,
  });
  applied.push({ clientId, serverId: clientId, updatedAt });
}

async function applyTemplateMutation(
  db: Db,
  userId: string,
  op: string,
  payload: Record<string, unknown>,
  clientId: string,
  clientUpdatedAt: number,
  serverTime: number,
  applied: AppliedMutation[],
  conflicts: ConflictEntry[],
) {
  const [existing] = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, clientId));

  if (op === "delete") {
    if (!existing) {
      applied.push({ clientId, serverId: clientId, updatedAt: serverTime });
      return;
    }
    if (existing.userId !== userId) return; // silently ignore — not owner
    if (clientUpdatedAt < existing.updatedAt) {
      conflicts.push({ entity: "template", id: clientId, serverVersion: syncTemplateRow(existing) });
      return;
    }
    const updatedAt = Math.max(clientUpdatedAt, serverTime);
    await db.update(workoutTemplates).set({ deletedAt: updatedAt, updatedAt }).where(eq(workoutTemplates.id, clientId));
    applied.push({ clientId, serverId: clientId, updatedAt });
    return;
  }

  // upsert
  const updatedAt = Math.max(clientUpdatedAt, serverTime);
  const exercisesJson = JSON.stringify(Array.isArray(payload.exercises) ? payload.exercises : []);

  if (!existing) {
    await db.insert(workoutTemplates).values({
      id: clientId,
      userId,
      name: String(payload.name ?? ""),
      exercises: exercisesJson,
      isPublic: Boolean(payload.isPublic ?? false),
      createdAt: Number(payload.createdAt ?? serverTime),
      updatedAt,
      deletedAt: null,
    });
    applied.push({ clientId, serverId: clientId, updatedAt });
    return;
  }

  if (existing.userId !== userId) return; // silently ignore — not owner

  if (clientUpdatedAt < existing.updatedAt) {
    conflicts.push({ entity: "template", id: clientId, serverVersion: syncTemplateRow(existing) });
    return;
  }

  if (clientUpdatedAt === existing.updatedAt) {
    // idempotent no-op (retry of a successfully applied mutation)
    applied.push({ clientId, serverId: clientId, updatedAt: existing.updatedAt });
    return;
  }

  await db.update(workoutTemplates).set({
    name: String(payload.name ?? existing.name),
    exercises: exercisesJson,
    isPublic: Boolean(payload.isPublic ?? existing.isPublic),
    updatedAt,
    deletedAt: (payload.deletedAt as number | null) ?? existing.deletedAt,
  }).where(eq(workoutTemplates.id, clientId));
  applied.push({ clientId, serverId: clientId, updatedAt });
}

async function applyInstanceMutation(
  db: Db,
  userId: string,
  op: string,
  payload: Record<string, unknown>,
  clientId: string,
  clientUpdatedAt: number,
  serverTime: number,
  applied: AppliedMutation[],
  conflicts: ConflictEntry[],
) {
  const [existing] = await db.select().from(workoutInstances).where(eq(workoutInstances.id, clientId));

  if (op === "delete") {
    if (!existing) {
      applied.push({ clientId, serverId: clientId, updatedAt: serverTime });
      return;
    }
    if (existing.userId !== userId) return;
    if (clientUpdatedAt < existing.updatedAt) {
      conflicts.push({ entity: "instance", id: clientId, serverVersion: syncInstanceRow(existing) });
      return;
    }
    const updatedAt = Math.max(clientUpdatedAt, serverTime);
    await db.update(workoutInstances).set({ deletedAt: updatedAt, updatedAt }).where(eq(workoutInstances.id, clientId));
    applied.push({ clientId, serverId: clientId, updatedAt });
    return;
  }

  // upsert
  const updatedAt = Math.max(clientUpdatedAt, serverTime);
  const exercisesJson = JSON.stringify(Array.isArray(payload.exercises) ? payload.exercises : []);

  if (!existing) {
    await db.insert(workoutInstances).values({
      id: clientId,
      userId,
      templateId: (payload.templateId as string | null) ?? null,
      name: String(payload.name ?? ""),
      date: Number(payload.date ?? serverTime),
      exercises: exercisesJson,
      notes: String(payload.notes ?? ""),
      isDraft: Boolean(payload.isDraft ?? false),
      updatedAt,
      deletedAt: null,
    });
    applied.push({ clientId, serverId: clientId, updatedAt });
    return;
  }

  if (existing.userId !== userId) return;

  if (clientUpdatedAt < existing.updatedAt) {
    conflicts.push({ entity: "instance", id: clientId, serverVersion: syncInstanceRow(existing) });
    return;
  }

  if (clientUpdatedAt === existing.updatedAt) {
    applied.push({ clientId, serverId: clientId, updatedAt: existing.updatedAt });
    return;
  }

  await db.update(workoutInstances).set({
    name: String(payload.name ?? existing.name),
    date: Number(payload.date ?? existing.date),
    exercises: exercisesJson,
    notes: String(payload.notes ?? existing.notes ?? ""),
    isDraft: Boolean(payload.isDraft ?? existing.isDraft),
    updatedAt,
    deletedAt: (payload.deletedAt as number | null) ?? existing.deletedAt,
  }).where(eq(workoutInstances.id, clientId));
  applied.push({ clientId, serverId: clientId, updatedAt });
}

function syncTemplateRow(t: typeof workoutTemplates.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    exercises: JSON.parse(t.exercises) as TemplateExercise[],
    isPublic: t.isPublic,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: t.deletedAt,
  };
}

function syncInstanceRow(i: typeof workoutInstances.$inferSelect) {
  return {
    id: i.id,
    userId: i.userId,
    templateId: i.templateId,
    name: i.name,
    date: i.date,
    exercises: JSON.parse(i.exercises) as InstanceExercise[],
    notes: i.notes ?? "",
    isDraft: i.isDraft,
    updatedAt: i.updatedAt,
    deletedAt: i.deletedAt,
  };
}
