import { SignJWT, jwtVerify } from "jose";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { users } from "./db/schema";
import type { Db } from "./db";
import type { User } from "./db/schema";

const SECRET_KEY = process.env.SECRET_KEY ?? "your-secret-key-here-change-in-production";
const EXPIRE_MS = 43200 * 60 * 1000; // 30 days
const ITERATIONS = 100_000;

export type AppEnv = {
  Variables: { user: User };
};

// ---- Password hashing (PBKDF2-SHA256, compatible with existing Python hashes) ----

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256
  );
  const saltHex = Buffer.from(salt).toString("hex");
  const hashHex = Buffer.from(hashBuffer).toString("hex");
  return `${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = stored.split("$");
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      key,
      256
    );
    const newHash = new Uint8Array(hashBuffer);

    // Constant-time comparison to prevent timing attacks
    if (newHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < newHash.length; i++) {
      diff |= newHash[i] ^ storedHash[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ---- JWT ----

export async function createToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(SECRET_KEY);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor((Date.now() + EXPIRE_MS) / 1000))
    .sign(secret);
}

async function verifyToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---- Auth middleware factory ----

export function createAuthMiddleware(db: Db) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ detail: "Not authenticated" }, 403);
    }

    const token = header.slice(7);
    const userId = await verifyToken(token);
    if (!userId) {
      return c.json({ detail: "Could not validate credentials" }, 401);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return c.json({ detail: "Could not validate credentials" }, 401);
    }

    c.set("user", user);
    await next();
  });
}
