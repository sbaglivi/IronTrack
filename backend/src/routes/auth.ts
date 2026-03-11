import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { createAuthMiddleware, createToken, hashPassword, verifyPassword } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import type { SignupBody } from "../types";

export function createAuthRoutes(db: Db) {
  const auth = new Hono<AppEnv>();
  const authMiddleware = createAuthMiddleware(db);

  auth.post("/signup", async (c) => {
    const body = await c.req.json<SignupBody>();
    if (!body.username || !body.password) {
      return c.json({ detail: "Username and password required" }, 400);
    }

    const [existing] = await db.select().from(users).where(eq(users.username, body.username));
    if (existing) {
      return c.json({ detail: "Username already registered" }, 400);
    }

    const user = {
      id: crypto.randomUUID(),
      username: body.username,
      passwordHash: await hashPassword(body.password),
    };
    await db.insert(users).values(user);

    const token = await createToken(user.id);
    return c.json({
      access_token: token,
      token_type: "bearer",
      user: { id: user.id, username: user.username },
    });
  });

  auth.post("/login", async (c) => {
    const body = await c.req.json<SignupBody>();

    const [user] = await db.select().from(users).where(eq(users.username, body.username));
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return c.json({ detail: "Incorrect username or password" }, 401);
    }

    const token = await createToken(user.id);
    return c.json({
      access_token: token,
      token_type: "bearer",
      user: { id: user.id, username: user.username },
    });
  });

  auth.get("/me", authMiddleware, (c) => {
    const user = c.get("user");
    return c.json({ id: user.id, username: user.username });
  });

  return auth;
}
