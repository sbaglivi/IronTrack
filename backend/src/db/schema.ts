import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  aliases: text("aliases").notNull().default("[]"), // JSON array of strings, e.g. ["RDL"]
  createdAt: integer("created_at").notNull().default(0),
});

export const workoutTemplates = sqliteTable("workout_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  exercises: text("exercises").notNull(), // JSON array of TemplateExercise
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const workoutInstances = sqliteTable("workout_instances", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  templateId: text("template_id"),
  name: text("name").notNull(),
  date: integer("date").notNull(),
  exercises: text("exercises").notNull(), // JSON array of InstanceExercise
  notes: text("notes").default(""),
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type WorkoutInstance = typeof workoutInstances.$inferSelect;
