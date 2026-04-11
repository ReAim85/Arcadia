/**
 * Editorial badge service (t-4.1)
 *
 * Handles assignment of editorial badges to agents:
 * - Staff Pick: Chosen by the AgentHub team for exceptional quality
 * - First Edition: Given to agents that were among the first deployed
 * - Verified: Given to agents that have passed reliability checks
 */

import { getPool } from "@/db/client";

/**
 * Editorial badge types
 */
export const EDITORIAL_BADGES = ["Staff Pick", "First Edition", "Verified"] as const;
export type EditorialBadge = typeof EDITORIAL_BADGES[number];

interface AssignBadgeResult {
  success: boolean;
  agentId?: string;
  badge?: string;
  error?: string;
}

/**
 * Assign an editorial badge to an agent
 */
export async function assignEditorialBadge(
  agentId: string,
  badge: EditorialBadge
): Promise<AssignBadgeResult> {
  // Validate badge type
  if (!EDITORIAL_BADGES.includes(badge)) {
    return {
      success: false,
      error: `Invalid badge type. Must be one of: ${EDITORIAL_BADGES.join(", ")}`
    };
  }

  const { getPool } = await import("@/db/client");
  const pool = getPool();

  try {
    // Check if agent exists
    const agentCheck = await pool.query(
      `SELECT id FROM agents WHERE id = $1`,
      [agentId]
    );

    if (!agentCheck.rows.length) {
      return {
        success: false,
        error: "Agent not found"
      };
    }

    // Update the agent's badge
    const result = await pool.query(
      `UPDATE agents SET badge = $1 WHERE id = $2 RETURNING id`,
      [badge, agentId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: "Failed to update agent badge"
      };
    }

    return {
      success: true,
      agentId,
      badge
    };
  } catch (error) {
    console.error("Error assigning editorial badge:", error);
    return {
      success: false,
      error: "Failed to assign badge due to internal error"
    };
  }
}

/**
 * Remove an editorial badge from an agent (set to null/empty)
 */
export async function removeEditorialBadge(
  agentId: string
): Promise<AssignBadgeResult> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  try {
    // Check if agent exists
    const agentCheck = await pool.query(
      `SELECT id FROM agents WHERE id = $1`,
      [agentId]
    );

    if (!agentCheck.rows.length) {
      return {
        success: false,
        error: "Agent not found"
      };
    }

    // Remove the badge (set to NULL)
    const result = await pool.query(
      `UPDATE agents SET badge = NULL WHERE id = $1 RETURNING id`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: "Failed to remove agent badge"
      };
    }

    return {
      success: true,
      agentId,
      badge: undefined as string | undefined
    };
  } catch (error) {
    console.error("Error removing editorial badge:", error);
    return {
      success: false,
      error: "Failed to remove badge due to internal error"
    };
  }
}

/**
 * Get all agents with a specific editorial badge
 */
export async function getAgentsByBadge(
  badge: EditorialBadge
): Promise<Array<{ id: string; name: string; slug: string }>> {
  // Validate badge type
  if (!EDITORIAL_BADGES.includes(badge)) {
    throw new Error(
      `Invalid badge type. Must be one of: ${EDITORIAL_BADGES.join(", ")}`
    );
  }

  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, name, slug FROM agents WHERE badge = $1 ORDER BY name`,
    [badge]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug
  }));
}

/**
 * Get all editorial badges assigned to a specific agent
 */
export async function getAgentBadges(
  agentId: string
): Promise<{ agentId: string; badge: string | null | undefined }> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, badge FROM agents WHERE id = $1`,
    [agentId]
  );

  if (result.rows.length === 0) {
    throw new Error("Agent not found");
  }

  return {
    agentId: result.rows[0].id,
    badge: result.rows[0].badge ?? null
  };
}

/**
 * Assign First Edition badge to agents that were deployed early
 * This would typically be called during deployment or as a maintenance task
 */
export async function assignFirstEditionBadges(
  limit: number = 10
): Promise<number> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  // Get the earliest deployed agents (by deployment date)
  const result = await pool.query(`
    SELECT a.id
    FROM agents a
    JOIN deployments d ON d.agent_id = a.id
    WHERE a.badge IS NULL
    ORDER BY d.deployed_at ASC
    LIMIT $1
  `, [limit]);

  let assignedCount = 0;

  for (const row of result.rows) {
    const badgeResult = await assignEditorialBadge(row.id, "First Edition");
    if (badgeResult.success) {
      assignedCount++;
    }
  }

  return assignedCount;
}