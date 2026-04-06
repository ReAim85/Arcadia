import type { neon } from "@neondatabase/serverless";
import { neon as neonFn } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `vercel env pull` or set it in Vercel dashboard.");
}

export const sql = neonFn(process.env.DATABASE_URL);
