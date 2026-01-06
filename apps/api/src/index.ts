import type { Database } from "@starye/db";
import type { Auth, Env } from "./lib/auth";
import { createDb } from "@starye/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./lib/auth";

interface Variables {
  db: Database;
  auth: Auth;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      // 允许我们在 trustedOrigins 中定义的源
      const allowed = [
        c.env.WEB_URL,
        c.env.ADMIN_URL,
        "http://localhost:3000",
        "http://localhost:5173",
      ].filter(Boolean);
      return allowed.includes(origin) ? origin : allowed[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Database & Auth Injection Middleware
app.use(async (c, next) => {
  const db = createDb(c.env.DB);
  const auth = createAuth(c);

  c.set("db", db);
  c.set("auth", auth);

  await next();
});

// Better Auth Routes
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
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
