import { describe, it, expect, beforeEach } from "bun:test";
import { makeApp, signup, createInstance } from "./helpers";

let app: ReturnType<typeof makeApp>["app"];
let headers: Record<string, string>;

beforeEach(async () => {
  ({ app } = makeApp());
  ({ headers } = await signup(app));
});

describe("POST /instances", () => {
  it("creates an instance", async () => {
    const data = await createInstance(app, headers) as Record<string, unknown>;
    expect(data.name).toBe("Morning Workout");
    expect(data.isDraft).toBe(false);
    expect((data.exercises as unknown[]).length).toBe(1);
    expect(data.notes).toBe("Felt good");
  });

  it("creates a draft instance", async () => {
    const data = await createInstance(app, headers, { isDraft: true }) as Record<string, unknown>;
    expect(data.isDraft).toBe(true);
  });
});

describe("GET /instances", () => {
  it("excludes drafts by default", async () => {
    await createInstance(app, headers, { name: "Completed", isDraft: false });
    await createInstance(app, headers, { name: "In Progress", isDraft: true });

    const res = await app.request("/instances", { headers });
    const names = (await res.json() as { name: string }[]).map((i) => i.name);
    expect(names).toContain("Completed");
    expect(names).not.toContain("In Progress");
  });

  it("includes drafts when include_drafts=true", async () => {
    await createInstance(app, headers, { name: "Completed", isDraft: false });
    await createInstance(app, headers, { name: "In Progress", isDraft: true });

    const res = await app.request("/instances?include_drafts=true", { headers });
    const names = (await res.json() as { name: string }[]).map((i) => i.name);
    expect(names).toContain("Completed");
    expect(names).toContain("In Progress");
  });

  it("returns only own instances", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    await createInstance(app, headersA, { name: "A's Workout" });

    const { headers: headersB } = await signup(app, "userB", "passB");
    await createInstance(app, headersB, { name: "B's Workout" });

    const res = await app.request("/instances", { headers: headersA });
    const instances = await res.json() as { name: string }[];
    expect(instances.length).toBe(1);
    expect(instances[0].name).toBe("A's Workout");
  });

  it("returns instances ordered by date descending", async () => {
    await createInstance(app, headers, { name: "Older", date: 1000 });
    await createInstance(app, headers, { name: "Newer", date: 2000 });

    const res = await app.request("/instances", { headers });
    const instances = await res.json() as { name: string }[];
    expect(instances[0].name).toBe("Newer");
    expect(instances[1].name).toBe("Older");
  });
});

describe("GET /instances/draft", () => {
  it("returns the most recent draft", async () => {
    await createInstance(app, headers, { name: "Old Draft", isDraft: true, date: 1000 });
    await createInstance(app, headers, { name: "New Draft", isDraft: true, date: 2000 });

    const res = await app.request("/instances/draft", { headers });
    expect(res.status).toBe(200);
    expect((await res.json() as { name: string }).name).toBe("New Draft");
  });

  it("returns null when no draft exists", async () => {
    const res = await app.request("/instances/draft", { headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("GET /instances/:id", () => {
  it("returns own instance", async () => {
    const created = await createInstance(app, headers) as { id: string };
    const res = await app.request(`/instances/${created.id}`, { headers });
    expect(res.status).toBe(200);
    expect((await res.json() as { name: string }).name).toBe("Morning Workout");
  });

  it("returns 403 for another user's instance", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createInstance(app, headersA) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/instances/${created.id}`, { headers: headersB });
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent instance", async () => {
    const res = await app.request("/instances/nonexistent", { headers });
    expect(res.status).toBe(404);
  });
});

describe("PUT /instances/:id", () => {
  it("updates instance name", async () => {
    const created = await createInstance(app, headers) as { id: string };
    const res = await app.request(`/instances/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "Evening Workout" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { name: string }).name).toBe("Evening Workout");
  });

  it("completing a draft makes it appear in normal listing", async () => {
    const draft = await createInstance(app, headers, { isDraft: true }) as { id: string; isDraft: boolean };
    expect(draft.isDraft).toBe(true);

    const res = await app.request(`/instances/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ isDraft: false }),
    });
    expect((await res.json() as { isDraft: boolean }).isDraft).toBe(false);

    const listRes = await app.request("/instances", { headers });
    const ids = (await listRes.json() as { id: string }[]).map((i) => i.id);
    expect(ids).toContain(draft.id);
  });

  it("returns 403 when updating another user's instance", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createInstance(app, headersA) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/instances/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headersB },
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /instances/:id", () => {
  it("deletes own instance", async () => {
    const created = await createInstance(app, headers) as { id: string };
    const res = await app.request(`/instances/${created.id}`, { method: "DELETE", headers });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/instances/${created.id}`, { headers });
    expect(getRes.status).toBe(404);
  });

  it("returns 403 when deleting another user's instance", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createInstance(app, headersA) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/instances/${created.id}`, { method: "DELETE", headers: headersB });
    expect(res.status).toBe(403);
  });
});
