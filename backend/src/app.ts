import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes } from "./routes/auth";
import { createExerciseRoutes } from "./routes/exercises";
import { createTemplateRoutes } from "./routes/templates";
import { createInstanceRoutes } from "./routes/instances";
import type { Db } from "./db";

export function createApp(db: Db) {
  const app = new Hono();

  app.use("*", cors({ origin: "*" }));

  app.get("/api", (c) => c.json({ message: "IronTrack API", version: "1.0.0" }));

  app.route("/auth", createAuthRoutes(db));
  app.route("/exercises", createExerciseRoutes(db));
  app.route("/templates", createTemplateRoutes(db));
  app.route("/instances", createInstanceRoutes(db));

  return app;
}
