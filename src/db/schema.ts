import {
  pgTable,
  text,
  integer,
  decimal,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Users — Vercel-connected
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  vercel_id: text("vercel_id").unique(),
  username: text("username"),
  vercel_team_id: text("vercel_team_id"),
  vercel_token_encrypted: text("vercel_token_encrypted"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Agents — marketplace listings
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  github_url: text("github_url"),
  vercel_project_id: text("vercel_project_id"),
  vercel_url: text("vercel_url"),
  owner_id: uuid("owner_id").references(() => users.id),
  badge: text("badge"), // Staff Pick, First Edition, Verified
  status: text("status").notNull().default("pending"), // pending, deploying, live, failed
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Deployments — individual deployment instances
export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  vercel_deployment_id: text("vercel_deployment_id"),
  url: text("url"),
  status: text("status").notNull().default("pending"), // pending, building, live, failed
  error_message: text("error_message"),
  deployed_at: timestamp("deployed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Usage metrics — per-agent metrics
export const usageMetrics = pgTable("usage_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  metric_type: text("metric_type").notNull(), // api_calls, response_time, errors
  value: decimal("value").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Deployment tests — demo test results (t-2.9)
export const deploymentTests = pgTable("deployment_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  deployment_id: uuid("deployment_id")
    .references(() => deployments.id)
    .notNull(),
  success: integer("success").notNull(), // 1 = pass, 0 = fail
  status_code: integer("status_code"),
  response_time_ms: integer("response_time_ms").notNull(),
  error_message: text("error_message"),
  tested_at: timestamp("tested_at").defaultNow().notNull(),
});

// Health check history — all health probe results (t-4.2)
export const healthCheckHistory = pgTable("health_check_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  deployment_id: uuid("deployment_id")
    .references(() => deployments.id),
  healthy: integer("healthy").notNull(), // 1 = healthy, 0 = unhealthy
  status_code: integer("status_code"),
  response_time_ms: integer("response_time_ms").notNull(),
  error_message: text("error_message"),
  checked_at: timestamp("checked_at").defaultNow().notNull(),
});
