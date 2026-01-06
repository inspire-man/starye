import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export * from "./schema";

/**
 * Creates a Drizzle client instance for Cloudflare D1
 * @param d1 The D1 Database binding from Cloudflare Worker env
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// Type helper for the DB instance
export type Database = ReturnType<typeof createDb>;
