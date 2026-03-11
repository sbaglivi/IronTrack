import { describe, it, expect, beforeEach } from "bun:test";
import { makeApp, seedExercises, signup } from "./helpers";
import { normalizeExerciseName } from "../src/routes/exercises";

let app: ReturnType<typeof makeApp>["app"];
let db: ReturnType<typeof makeApp>["db"];
let headers: Record<string, string>;

beforeEach(async () => {
  ({ app, db } = makeApp());
  await seedExercises(db);
  ({ headers } = await signup(app));
});

describe("GET /exercises", () => {
  it("lists seeded exercises", async () => {
    const res = await app.request("/exercises", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { name: string }[];
    expect(data.length).toBeGreaterThanOrEqual(8);
    const names = data.map((e) => e.name);
    expect(names).toContain("BB Bench Press");
    expect(names).toContain("Squat");
    expect(names).toContain("Deadlift");
  });

  it("returns 403 without auth", async () => {
    const res = await app.request("/exercises");
    expect(res.status).toBe(403);
  });
});

describe("GET /exercises?q=", () => {
  it("filters by substring match", async () => {
    const res = await app.request("/exercises?q=squat", { headers });
    const data = await res.json() as { name: string }[];
    expect(data.some((e) => e.name === "Squat")).toBeTrue();
  });

  it("searches aliases (RDL → Romanian Deadlift)", async () => {
    // Add an exercise with alias
    await app.request("/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "Romanian Deadlift", aliases: ["RDL"] }),
    });
    const res = await app.request("/exercises?q=rdl", { headers });
    const data = await res.json() as { name: string }[];
    expect(data.some((e) => e.name === "Romanian Deadlift")).toBeTrue();
  });
});

describe("POST /exercises", () => {
  it("creates a new exercise", async () => {
    const res = await app.request("/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "Lunge" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.name).toBe("Lunge");
    expect(data.id).toBeString();
    expect(data.aliases).toEqual([]);
    expect(data.createdAt).toBeNumber();
  });

  it("returns existing exercise on duplicate (idempotent)", async () => {
    await app.request("/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "BB Bench Press" }),
    });
    const allRes = await app.request("/exercises", { headers });
    const all = await allRes.json() as { name: string }[];
    const count = all.filter((e) => e.name === "BB Bench Press").length;
    expect(count).toBe(1);
  });

  it("creates exercise with aliases", async () => {
    const res = await app.request("/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "Romanian Deadlift", aliases: ["RDL"] }),
    });
    const data = await res.json() as { aliases: string[] };
    expect(data.aliases).toEqual(["RDL"]);
  });
});

describe("normalizeExerciseName", () => {
  it("title-cases regular words", () => {
    expect(normalizeExerciseName("bench press")).toBe("Bench Press");
    expect(normalizeExerciseName("ROMANIAN DEADLIFT")).toBe("Romanian Deadlift");
  });

  it("preserves uppercase equipment tokens", () => {
    expect(normalizeExerciseName("bb bench press")).toBe("BB Bench Press");
    expect(normalizeExerciseName("db row")).toBe("DB Row");
    expect(normalizeExerciseName("kb swing")).toBe("KB Swing");
    expect(normalizeExerciseName("bw pull up")).toBe("BW Pull Up");
    expect(normalizeExerciseName("ez curl")).toBe("EZ Curl");
  });

  it("trims whitespace", () => {
    expect(normalizeExerciseName("  bench press  ")).toBe("Bench Press");
  });
});

describe("GET /exercises/:id/history", () => {
  it("returns sets from instances containing the exercise", async () => {
    const exRes = await app.request("/exercises", { headers });
    const exList = await exRes.json() as { id: string; name: string }[];
    const ex = exList[0];

    await app.request("/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        name: "Workout A",
        date: 1000,
        exercises: [{ exerciseId: ex.id, name: ex.name, sets: [{ id: "s1", weight: 80, reps: 5, completed: true }] }],
        notes: "",
      }),
    });

    const res = await app.request(`/exercises/${ex.id}/history`, { headers });
    expect(res.status).toBe(200);
    const history = await res.json() as { instanceName: string; sets: unknown[] }[];
    expect(history.length).toBe(1);
    expect(history[0].instanceName).toBe("Workout A");
    expect(history[0].sets.length).toBe(1);
  });
});
