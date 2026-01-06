import type { Database } from "@starye/db";
import { createDb } from "@starye/db";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Define the bindings environment
interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  BETTER_AUTH_SECRET: string;
  CRAWLER_SECRET: string;
}

interface Variables {
  db: Database;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use("*", cors());

// Database Injection Middleware
app.use(async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  await next();
});

// Health Check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "starye-api",
    timestamp: new Date().toISOString(),
  });
});

export default app;
