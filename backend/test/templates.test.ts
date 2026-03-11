import { describe, it, expect, beforeEach } from "bun:test";
import { makeApp, signup, createTemplate } from "./helpers";

let app: ReturnType<typeof makeApp>["app"];
let headers: Record<string, string>;

beforeEach(async () => {
  ({ app } = makeApp());
  ({ headers } = await signup(app));
});

describe("POST /templates", () => {
  it("creates a template", async () => {
    const data = await createTemplate(app, headers) as Record<string, unknown>;
    expect(data.name).toBe("Push Day");
    expect(data.isPublic).toBe(false);
    expect((data.exercises as unknown[]).length).toBe(1);
    expect(data.id).toBeString();
    expect(data.createdAt).toBeNumber();
  });

  it("creates a public template", async () => {
    const data = await createTemplate(app, headers, { isPublic: true }) as Record<string, unknown>;
    expect(data.isPublic).toBe(true);
  });
});

describe("GET /templates", () => {
  it("lists own templates", async () => {
    await createTemplate(app, headers, { name: "Template A" });
    await createTemplate(app, headers, { name: "Template B" });
    const res = await app.request("/templates", { headers });
    const data = await res.json() as unknown[];
    expect(data.length).toBe(2);
  });

  it("includes public templates from other users", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    await createTemplate(app, headersA, { name: "Public Template", isPublic: true });

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request("/templates", { headers: headersB });
    const names = (await res.json() as { name: string }[]).map((t) => t.name);
    expect(names).toContain("Public Template");
  });

  it("hides private templates from other users", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    await createTemplate(app, headersA, { name: "Private Template", isPublic: false });

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request("/templates", { headers: headersB });
    const names = (await res.json() as { name: string }[]).map((t) => t.name);
    expect(names).not.toContain("Private Template");
  });
});

describe("GET /templates/:id", () => {
  it("returns own template", async () => {
    const created = await createTemplate(app, headers) as { id: string };
    const res = await app.request(`/templates/${created.id}`, { headers });
    expect(res.status).toBe(200);
    expect((await res.json() as Record<string, unknown>).name).toBe("Push Day");
  });

  it("allows reading another user's public template", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createTemplate(app, headersA, { isPublic: true }) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/templates/${created.id}`, { headers: headersB });
    expect(res.status).toBe(200);
  });

  it("returns 403 for another user's private template", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createTemplate(app, headersA, { isPublic: false }) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/templates/${created.id}`, { headers: headersB });
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent template", async () => {
    const res = await app.request("/templates/nonexistent-id", { headers });
    expect(res.status).toBe(404);
  });
});

describe("PUT /templates/:id", () => {
  it("updates own template", async () => {
    const created = await createTemplate(app, headers) as { id: string };
    const res = await app.request(`/templates/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as Record<string, unknown>).name).toBe("Updated Name");
  });

  it("returns 403 when updating another user's template", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createTemplate(app, headersA) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/templates/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headersB },
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /templates/:id", () => {
  it("deletes own template", async () => {
    const created = await createTemplate(app, headers) as { id: string };
    const res = await app.request(`/templates/${created.id}`, { method: "DELETE", headers });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/templates/${created.id}`, { headers });
    expect(getRes.status).toBe(404);
  });

  it("returns 403 when deleting another user's template", async () => {
    const { headers: headersA } = await signup(app, "userA", "passA");
    const created = await createTemplate(app, headersA) as { id: string };

    const { headers: headersB } = await signup(app, "userB", "passB");
    const res = await app.request(`/templates/${created.id}`, { method: "DELETE", headers: headersB });
    expect(res.status).toBe(403);
  });
});
