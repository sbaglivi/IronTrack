import { describe, it, expect, beforeEach } from "bun:test";
import { makeApp, signup, createTemplate, createInstance } from "./helpers";
import { exercises, workoutInstances, workoutTemplates } from "../src/db/schema";

function makeApp2() {
  return makeApp();
}

const SAMPLE_EXERCISES = [{ exerciseId: "ex-1", name: "BB Bench Press", defaultSets: 3, defaultWeight: 60, defaultReps: 8 }];
const SAMPLE_SETS = [{ id: "s1", weight: 60, reps: 8 }];
const SAMPLE_INSTANCE_EXERCISES = [{ exerciseId: "ex-1", name: "BB Bench Press", sets: SAMPLE_SETS }];

async function pull(app: ReturnType<typeof makeApp>["app"], headers: Record<string, string>, since = 0) {
  const res = await app.request(`/sync?since=${since}`, { headers });
  return res.json() as Promise<{
    exercises: unknown[];
    templates: unknown[];
    instances: unknown[];
    serverTime: number;
  }>;
}

async function push(app: ReturnType<typeof makeApp>["app"], headers: Record<string, string>, mutations: unknown[]) {
  const res = await app.request("/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ mutations }),
  });
  return res.json() as Promise<{
    applied: { clientId: string; serverId: string; updatedAt: number }[];
    remappedIds: Record<string, string>;
    conflicts: { entity: string; id: string; serverVersion: unknown }[];
    serverTime: number;
  }>;
}

describe("GET /sync", () => {
  it("returns all rows when since=0", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    await createTemplate(app, headers);
    await createInstance(app, headers);

    const data = await pull(app, headers, 0);
    expect(data.templates).toHaveLength(1);
    expect(data.instances).toHaveLength(1);
  });

  it("returns only rows updated after since", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);

    // create a template with a known old updatedAt
    await db.insert(workoutTemplates).values({
      id: crypto.randomUUID(),
      userId: (await signup(app, "other", "pass123")).user.id,
      name: "Old",
      exercises: "[]",
      isPublic: false,
      createdAt: 100,
      updatedAt: 100,
      deletedAt: null,
    });

    const t = await createTemplate(app, headers) as Record<string, unknown>;
    const since = (t.createdAt as number) - 1;

    // seed a stale template for the same user with updatedAt=1
    const { user } = await signup(app, "u2", "pass123");
    const staleId = crypto.randomUUID();
    const { app: app2, db: db2 } = makeApp2();
    const u2 = await signup(app2, "u3", "pass456");
    // Simpler: just use db directly
    const [firstUser] = (await db.select().from(workoutTemplates).limit(1));
    const userId = firstUser?.userId;
    if (userId) {
      await db.insert(workoutTemplates).values({
        id: staleId,
        userId,
        name: "Stale",
        exercises: "[]",
        isPublic: false,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      });
    }

    const data = await pull(app, headers, since);
    const ids = (data.templates as { id: string }[]).map((t) => t.id);
    expect(ids).toContain(t.id as string);
    expect(ids).not.toContain(staleId);
  });

  it("includes soft-deleted templates in pull (client must mirror the delete)", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string };

    await app.request(`/templates/${t.id}`, { method: "DELETE", headers });

    const data = await pull(app, headers, 0);
    const deleted = (data.templates as { id: string; deletedAt: unknown }[]).find((r) => r.id === t.id);
    expect(deleted).toBeDefined();
    expect(deleted!.deletedAt).not.toBeNull();
  });

  it("does not return other users' templates or instances", async () => {
    const { app } = makeApp2();
    const { headers: h1 } = await signup(app, "user1", "pass");
    const { headers: h2 } = await signup(app, "user2", "pass");

    await createTemplate(app, h1, { name: "User1 Template" });
    await createInstance(app, h1, { name: "User1 Instance" });

    const data = await pull(app, h2, 0);
    expect(data.templates).toHaveLength(0);
    expect(data.instances).toHaveLength(0);
  });

  it("returns all exercises regardless of user (global catalog)", async () => {
    const { app, db } = makeApp2();
    const { headers: h1 } = await signup(app, "user1", "pass");
    const { headers: h2 } = await signup(app, "user2", "pass");

    await db.insert(exercises).values({
      id: crypto.randomUUID(),
      name: "Squat",
      aliases: "[]",
      createdAt: 1,
      updatedAt: 1,
    });

    const data1 = await pull(app, h1, 0);
    const data2 = await pull(app, h2, 0);
    expect(data1.exercises).toHaveLength(1);
    expect(data2.exercises).toHaveLength(1);
  });

  it("requires authentication", async () => {
    const { app } = makeApp2();
    const res = await app.request("/sync?since=0");
    expect(res.status).toBe(403);
  });
});

describe("POST /sync — exercises", () => {
  it("creates a new exercise with the client UUID when name is new", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const clientId = crypto.randomUUID();

    const result = await push(app, headers, [
      { op: "upsert", entity: "exercise", payload: { id: clientId, name: "Incline Press", aliases: [], createdAt: 1, updatedAt: 1 } },
    ]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].serverId).toBe(clientId);
    expect(Object.keys(result.remappedIds)).toHaveLength(0);
  });

  it("normalizes exercise names on creation", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);

    await push(app, headers, [
      { op: "upsert", entity: "exercise", payload: { id: crypto.randomUUID(), name: "bb bench press", aliases: [], createdAt: 1, updatedAt: 1 } },
    ]);

    const [ex] = await db.select().from(exercises).where(exercises.name ? undefined : undefined);
    const all = await db.select().from(exercises);
    expect(all[0].name).toBe("BB Bench Press");
  });

  it("remaps client UUID to existing server UUID when name collides", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);
    const serverId = crypto.randomUUID();
    await db.insert(exercises).values({ id: serverId, name: "Bench Press", aliases: "[]", createdAt: 1, updatedAt: 1 });

    const clientId = crypto.randomUUID();
    const result = await push(app, headers, [
      { op: "upsert", entity: "exercise", payload: { id: clientId, name: "bench press", aliases: [], createdAt: 2, updatedAt: 2 } },
    ]);

    expect(result.applied[0].serverId).toBe(serverId);
    expect(result.remappedIds[clientId]).toBe(serverId);
  });

  it("no-ops when pushing an exercise with its own existing server UUID (idempotent retry)", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);
    const serverId = crypto.randomUUID();
    await db.insert(exercises).values({ id: serverId, name: "Deadlift", aliases: "[]", createdAt: 1, updatedAt: 1 });

    const result = await push(app, headers, [
      { op: "upsert", entity: "exercise", payload: { id: serverId, name: "Deadlift", aliases: [], createdAt: 1, updatedAt: 1 } },
    ]);

    expect(result.applied[0].serverId).toBe(serverId);
    expect(Object.keys(result.remappedIds)).toHaveLength(0);
  });
});

describe("POST /sync — templates", () => {
  it("creates a new template when id does not exist on server", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);
    const clientId = crypto.randomUUID();
    const now = Date.now();

    const result = await push(app, headers, [
      { op: "upsert", entity: "template", payload: { id: clientId, name: "Push Day", exercises: SAMPLE_EXERCISES, isPublic: false, createdAt: now, updatedAt: now } },
    ]);

    expect(result.applied[0].serverId).toBe(clientId);
    const [row] = await db.select().from(workoutTemplates).where(workoutTemplates.id ? undefined : undefined);
    const all = await db.select().from(workoutTemplates);
    expect(all.find((t) => t.id === clientId)).toBeDefined();
  });

  it("updates template when client updatedAt is newer", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "upsert", entity: "template", payload: { id: t.id, name: "New Name", exercises: [], isPublic: false, createdAt: 0, updatedAt: (t.updatedAt ?? 0) + 1000 } },
    ]);

    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);

    const res = await app.request(`/templates/${t.id}`, { headers });
    const updated = await res.json() as { name: string };
    expect(updated.name).toBe("New Name");
  });

  it("returns conflict when client updatedAt is older than server", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "upsert", entity: "template", payload: { id: t.id, name: "Stale", exercises: [], isPublic: false, createdAt: 0, updatedAt: 1 } },
    ]);

    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe(t.id);
  });

  it("no-ops when client updatedAt equals server (idempotent retry)", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "upsert", entity: "template", payload: { id: t.id, name: "Same", exercises: [], isPublic: false, createdAt: 0, updatedAt: t.updatedAt } },
    ]);

    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    // name should NOT have changed
    const res = await app.request(`/templates/${t.id}`, { headers });
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Push Day");
  });

  it("soft-deletes template via delete mutation", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "delete", entity: "template", payload: { id: t.id, updatedAt: (t.updatedAt ?? 0) + 1000 } },
    ]);

    expect(result.applied).toHaveLength(1);
    const res = await app.request(`/templates/${t.id}`, { headers });
    expect(res.status).toBe(404);
  });

  it("returns conflict on delete when client updatedAt is stale", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const t = await createTemplate(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "delete", entity: "template", payload: { id: t.id, updatedAt: 1 } },
    ]);

    expect(result.conflicts).toHaveLength(1);
  });

  it("silently ignores mutations on another user's template", async () => {
    const { app } = makeApp2();
    const { headers: h1 } = await signup(app, "user1", "pass");
    const { headers: h2 } = await signup(app, "user2", "pass");
    const t = await createTemplate(app, h1) as { id: string; updatedAt: number };

    // user2 tries to update user1's template
    const result = await push(app, h2, [
      { op: "upsert", entity: "template", payload: { id: t.id, name: "Hijacked", exercises: [], isPublic: false, createdAt: 0, updatedAt: Date.now() + 99999 } },
    ]);

    // Not in applied or conflicts — silently ignored
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    // Original still intact
    const res = await app.request(`/templates/${t.id}`, { headers: h1 });
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Push Day");
  });
});

describe("POST /sync — instances", () => {
  it("creates a new instance with client UUID", async () => {
    const { app, db } = makeApp2();
    const { headers } = await signup(app);
    const clientId = crypto.randomUUID();
    const now = Date.now();

    const result = await push(app, headers, [
      { op: "upsert", entity: "instance", payload: { id: clientId, name: "Morning Lift", date: now, exercises: SAMPLE_INSTANCE_EXERCISES, notes: "", isDraft: false, createdAt: now, updatedAt: now } },
    ]);

    expect(result.applied[0].serverId).toBe(clientId);
    const all = await db.select().from(workoutInstances);
    expect(all.find((i) => i.id === clientId)).toBeDefined();
  });

  it("updates instance when client updatedAt is newer", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const inst = await createInstance(app, headers) as { id: string; updatedAt: number };

    const result = await push(app, headers, [
      { op: "upsert", entity: "instance", payload: { id: inst.id, name: "Renamed", date: Date.now(), exercises: [], notes: "", isDraft: false, createdAt: 0, updatedAt: (inst.updatedAt ?? 0) + 1000 } },
    ]);

    expect(result.applied).toHaveLength(1);
    const res = await app.request(`/instances/${inst.id}`, { headers });
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Renamed");
  });

  it("soft-deletes instance via delete mutation", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const inst = await createInstance(app, headers) as { id: string; updatedAt: number };

    await push(app, headers, [
      { op: "delete", entity: "instance", payload: { id: inst.id, updatedAt: (inst.updatedAt ?? 0) + 1000 } },
    ]);

    const res = await app.request(`/instances/${inst.id}`, { headers });
    expect(res.status).toBe(404);
  });
});

describe("POST /sync — validation", () => {
  it("rejects more than 1000 mutations", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const mutations = Array.from({ length: 1001 }, () => ({ op: "upsert", entity: "exercise", payload: { id: crypto.randomUUID(), name: "x", updatedAt: 1 } }));

    const res = await app.request("/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ mutations }),
    });
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const { app } = makeApp2();
    const res = await app.request("/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutations: [] }) });
    expect(res.status).toBe(403);
  });

  it("applies multiple mutations in a single request", async () => {
    const { app } = makeApp2();
    const { headers } = await signup(app);
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const now = Date.now();

    const result = await push(app, headers, [
      { op: "upsert", entity: "exercise", payload: { id: id1, name: "Squat", aliases: [], createdAt: now, updatedAt: now } },
      { op: "upsert", entity: "template", payload: { id: id2, name: "Leg Day", exercises: [], isPublic: false, createdAt: now, updatedAt: now } },
    ]);

    expect(result.applied).toHaveLength(2);
  });
});
