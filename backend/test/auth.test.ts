import { describe, it, expect, beforeEach } from "bun:test";
import { makeApp, signup } from "./helpers";

let app: ReturnType<typeof makeApp>["app"];

beforeEach(() => {
  ({ app } = makeApp());
});

describe("POST /auth/signup", () => {
  it("returns token and user on success", async () => {
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "newuser", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.access_token).toBeString();
    expect(data.token_type).toBe("bearer");
    expect((data.user as Record<string, unknown>).username).toBe("newuser");
    expect((data.user as Record<string, unknown>).id).toBeString();
  });

  it("rejects duplicate username with 400", async () => {
    await signup(app, "dupuser", "pass123");
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "dupuser", password: "otherpass" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.detail as string).toInclude("already registered");
  });
});

describe("POST /auth/login", () => {
  it("returns token on correct credentials", async () => {
    await signup(app, "loginuser", "mypassword");
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "loginuser", password: "mypassword" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.access_token).toBeString();
    expect((data.user as Record<string, unknown>).username).toBe("loginuser");
  });

  it("rejects wrong password with 401", async () => {
    await signup(app, "loginuser", "mypassword");
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "loginuser", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects nonexistent user with 401", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "irrelevant" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns current user when authenticated", async () => {
    const { headers } = await signup(app);
    const res = await app.request("/auth/me", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.username).toBe("testuser");
    expect(data.id).toBeString();
  });

  it("returns 403 with no token", async () => {
    const res = await app.request("/auth/me");
    expect(res.status).toBe(403);
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request("/auth/me", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(res.status).toBe(401);
  });
});
