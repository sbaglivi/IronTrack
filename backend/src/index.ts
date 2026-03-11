import { serveStatic } from "hono/bun";
import { db } from "./db";
import { exercises } from "./db/schema";
import { createApp } from "./app";

const DEFAULT_EXERCISES: { name: string; aliases?: string[] }[] = [
  // Chest
  { name: "BB Bench Press" },
  { name: "DB Bench Press" },
  { name: "Incline BB Bench Press" },
  { name: "Incline DB Bench Press" },
  { name: "Decline BB Bench Press" },
  { name: "DB Fly" },
  { name: "Cable Fly" },
  { name: "Chest Dip" },
  { name: "Push Up" },
  // Back
  { name: "Deadlift" },
  { name: "BB Row", aliases: ["Barbell Row"] },
  { name: "DB Row" },
  { name: "Pull Up" },
  { name: "Chin Up" },
  { name: "Lat Pulldown" },
  { name: "Cable Row" },
  { name: "Face Pull" },
  { name: "Romanian Deadlift", aliases: ["RDL"] },
  { name: "Good Morning" },
  // Shoulders
  { name: "BB Overhead Press", aliases: ["OHP"] },
  { name: "DB Overhead Press" },
  { name: "DB Lateral Raise" },
  { name: "Cable Lateral Raise" },
  { name: "DB Front Raise" },
  { name: "Reverse Fly" },
  { name: "Shrug" },
  // Legs
  { name: "Squat" },
  { name: "Front Squat" },
  { name: "Leg Press" },
  { name: "Leg Extension" },
  { name: "Leg Curl" },
  { name: "Bulgarian Split Squat" },
  { name: "Lunge" },
  { name: "Calf Raise" },
  { name: "Hip Thrust" },
  { name: "Glute Kickback" },
  // Arms
  { name: "BB Curl" },
  { name: "DB Curl" },
  { name: "Hammer Curl" },
  { name: "Preacher Curl" },
  { name: "Cable Curl" },
  { name: "Tricep Pushdown" },
  { name: "Overhead Tricep Extension" },
  { name: "Skull Crusher" },
  { name: "Dip" },
  { name: "Close Grip Bench Press" },
  // Core
  { name: "Plank" },
  { name: "Crunch" },
  { name: "Sit Up" },
  { name: "Leg Raise" },
  { name: "Cable Crunch" },
  { name: "Ab Wheel Rollout" },
];

async function seedExercises() {
  const existing = await db.select().from(exercises);
  if (existing.length === 0) {
    await db.insert(exercises).values(
      DEFAULT_EXERCISES.map(({ name, aliases }) => ({
        id: crypto.randomUUID(),
        name,
        aliases: JSON.stringify(aliases ?? []),
        createdAt: Date.now(),
      }))
    );
    console.log(`Seeded ${DEFAULT_EXERCISES.length} default exercises`);
  }
}

const app = createApp(db);

// Serve frontend static files in production
app.use("/assets/*", serveStatic({ root: "../frontend/dist" }));
app.get("*", serveStatic({ path: "../frontend/dist/index.html" }));

const port = Number(process.env.PORT ?? 8000);

seedExercises().catch(console.error);

export default {
  port,
  fetch: app.fetch,
};

console.log(`IronTrack backend running on port ${port}`);
