import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Every field is validated again on the server — the browser form is only the
 * first line of defence. Returns messages the UI can show verbatim.
 */
function requireText(value: string, label: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${label} is required.`);
  if (trimmed.length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

const NAMESPACE_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

function requireHttpUrl(value: string) {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Health check URL must be a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Health check URL must start with http:// or https://.");
  return trimmed;
}

/**
 * Saved applications from the onboarding form, newest first.
 * Only signed-in users can read them.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("serviceCatalog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    return rows.map((row) => ({
      _id: row._id,
      applicationName: row.applicationName,
      namespace: row.namespace,
      totalRequestedWorkerNodes: row.totalRequestedWorkerNodes,
      portNetwork: row.portNetwork,
      repositoryName: row.repositoryName,
      healthcheckUrl: row.healthcheckUrl,
      submittedByName: row.submittedByName,
      createdAt: row.createdAt,
    }));
  },
});

/**
 * Save a new onboarding entry. Requires a signed-in user.
 */
export const create = mutation({
  args: {
    applicationName: v.string(),
    namespace: v.string(),
    totalRequestedWorkerNodes: v.number(),
    portNetwork: v.number(),
    repositoryName: v.string(),
    healthcheckUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      throw new Error("You must be signed in to save an application.");

    const applicationName = requireText(
      args.applicationName,
      "Application name",
      80,
    );
    const namespace = requireText(args.namespace, "Namespace", 63);
    if (!NAMESPACE_PATTERN.test(namespace))
      throw new Error(
        "Namespace must be lowercase letters, numbers, or hyphens.",
      );
    const repositoryName = requireText(
      args.repositoryName,
      "Repository name",
      200,
    );
    const healthcheckUrl = requireHttpUrl(args.healthcheckUrl);

    const workerNodes = args.totalRequestedWorkerNodes;
    if (!Number.isInteger(workerNodes) || workerNodes < 1 || workerNodes > 1000)
      throw new Error("Total requested worker nodes must be 1–1000.");

    const port = args.portNetwork;
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Port network must be between 1 and 65535.");

    const user = await ctx.db.get(userId);
    const submittedByName =
      user?.name?.trim() || user?.email?.trim() || "Platform team";

    return await ctx.db.insert("serviceCatalog", {
      applicationName,
      namespace,
      totalRequestedWorkerNodes: workerNodes,
      portNetwork: port,
      repositoryName,
      healthcheckUrl,
      submittedBy: userId,
      submittedByName,
      createdAt: Date.now(),
    });
  },
});
