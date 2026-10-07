import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  buildNamespace,
  servicesSchema,
  stageOneSchema,
  workerNodesSchema,
} from "../lib/onboarding-schema";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const tenantValidator = v.union(
  v.literal("fund"),
  v.literal("lend"),
  v.literal("cs"),
  v.literal("ds"),
);

/**
 * Every field is validated again on the server with the same zod schemas the
 * browser form uses — the form is only the first line of defence. Returns
 * messages the UI can show verbatim.
 */
function firstIssue(issues: Array<{ message: string }>) {
  return issues[0]?.message ?? "Check the form values and try again.";
}

async function requireSignedIn(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null)
    throw new Error("You must be signed in to save an application.");
  return userId;
}

async function getApplicationOrThrow(
  ctx: QueryCtx | MutationCtx,
  applicationId: Id<"applications">,
) {
  const application = await ctx.db.get(applicationId);
  if (application === null)
    throw new Error("This application no longer exists.");
  return application;
}

async function nodesFor(ctx: QueryCtx | MutationCtx, applicationId: Id<"applications">) {
  return await ctx.db
    .query("workerNodes")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .collect();
}

async function servicesFor(ctx: QueryCtx | MutationCtx, applicationId: Id<"applications">) {
  return await ctx.db
    .query("services")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .collect();
}

/** The shape the dashboard list and the wizard share. */
async function applicationRow(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"applications"> | null,
) {
  if (row === null) throw new Error("This application no longer exists.");
  return {
    _id: row._id,
    applicationName: row.applicationName,
    repositoryName: row.repositoryName,
    tenant: row.tenant,
    totalWorkerNodes: row.totalWorkerNodes,
    submittedByName: row.submittedByName,
    createdAt: row.createdAt,
    nodeCount: (await nodesFor(ctx, row._id)).length,
    serviceCount: (await servicesFor(ctx, row._id)).length,
  };
}

function parseStageOne(args: {
  applicationName: string;
  repositoryName: string;
  tenant: "fund" | "lend" | "cs" | "ds";
  totalWorkerNodes: number;
}) {
  const parsed = stageOneSchema.safeParse({
    applicationName: args.applicationName,
    repositoryName: args.repositoryName,
    tenant: args.tenant,
    totalWorkerNodes: String(args.totalWorkerNodes),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));
  return parsed.data;
}

/** Saved applications, newest first. Only signed-in users can read them. */
export const listApplications = query({
  args: {},
  handler: async (ctx) => {
    if ((await getAuthUserId(ctx)) === null) return [];

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    return await Promise.all(rows.map((row) => applicationRow(ctx, row)));
  },
});

/** Stage 1 — create the application and move on to worker nodes. */
export const createApplication = mutation({
  args: {
    applicationName: v.string(),
    repositoryName: v.string(),
    tenant: tenantValidator,
    totalWorkerNodes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    const values = parseStageOne(args);

    const user = await ctx.db.get(userId);
    const submittedByName =
      user?.name?.trim() || user?.email?.trim() || "Platform team";

    const applicationId = await ctx.db.insert("applications", {
      applicationName: values.applicationName,
      repositoryName: values.repositoryName,
      tenant: values.tenant,
      totalWorkerNodes: Number(values.totalWorkerNodes),
      submittedBy: userId,
      submittedByName,
      createdAt: Date.now(),
    });

    return await applicationRow(ctx, await ctx.db.get(applicationId));
  },
});

/** Stage 1 — correct the details of an application already in progress. */
export const updateApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    applicationName: v.string(),
    repositoryName: v.string(),
    tenant: tenantValidator,
    totalWorkerNodes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const application = await getApplicationOrThrow(ctx, args.applicationId);
    const values = parseStageOne(args);

    const services = await servicesFor(ctx, application._id);
    if (services.length > 0) {
      const fixed =
        values.applicationName !== application.applicationName ||
        values.tenant !== application.tenant ||
        Number(values.totalWorkerNodes) !== application.totalWorkerNodes;
      if (fixed)
        throw new Error(
          "The application name, tenant, and total worker nodes are fixed once services are saved.",
        );
    }

    await ctx.db.patch(application._id, {
      applicationName: values.applicationName,
      repositoryName: values.repositoryName,
      tenant: values.tenant,
      totalWorkerNodes: Number(values.totalWorkerNodes),
    });

    return await applicationRow(ctx, await ctx.db.get(application._id));
  },
});

/** Stage 2 — save the worker node list, exactly as many as stage 1 reserved. */
export const saveWorkerNodes = mutation({
  args: {
    applicationId: v.id("applications"),
    nodes: v.array(
      v.object({
        ipAddress: v.string(),
        hostname: v.string(),
        joinedCluster: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const application = await getApplicationOrThrow(ctx, args.applicationId);

    const parsed = workerNodesSchema(application.totalWorkerNodes).safeParse({
      nodes: args.nodes,
    });
    if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));

    const hostnames = new Set(parsed.data.nodes.map((node) => node.hostname));

    // Saved services keep pointing at real nodes — refuse a change that would
    // leave one without any selector.
    const services = await servicesFor(ctx, application._id);
    for (const service of services) {
      const kept = service.nodeSelectors.filter((name) => hostnames.has(name));
      if (service.nodeSelectors.length > 0 && kept.length === 0)
        throw new Error(
          "A saved service relies on the current worker nodes. Keep at least one of its nodes in the list.",
        );
    }

    for (const row of await nodesFor(ctx, application._id)) {
      await ctx.db.delete(row._id);
    }
    for (const node of parsed.data.nodes) {
      await ctx.db.insert("workerNodes", {
        applicationId: application._id,
        ipAddress: node.ipAddress,
        hostname: node.hostname,
        joinedCluster: node.joinedCluster,
      });
    }

    for (const service of services) {
      const kept = service.nodeSelectors.filter((name) => hostnames.has(name));
      if (kept.length !== service.nodeSelectors.length) {
        await ctx.db.patch(service._id, { nodeSelectors: kept });
      }
    }

    return parsed.data.nodes.length;
  },
});

/** Stage 3 — save the whole service list for an application in one go. */
export const saveServices = mutation({
  args: {
    applicationId: v.id("applications"),
    services: v.array(
      v.object({
        namespaceSuffix: v.string(),
        serviceName: v.string(),
        port: v.number(),
        healthcheckUrl: v.string(),
        nodeSelectors: v.array(v.string()),
        description: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const application = await getApplicationOrThrow(ctx, args.applicationId);

    const nodes = await nodesFor(ctx, application._id);
    if (nodes.length !== application.totalWorkerNodes)
      throw new Error(
        `Save exactly ${application.totalWorkerNodes} worker nodes in stage 2 first.`,
      );

    const parsed = servicesSchema({
      applicationName: application.applicationName,
      tenant: application.tenant,
      nodeHostnames: nodes.map((node) => node.hostname),
    }).safeParse({
      services: args.services.map((service) => ({
        ...service,
        port: String(service.port),
      })),
    });
    if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));

    for (const row of await servicesFor(ctx, application._id)) {
      await ctx.db.delete(row._id);
    }
    for (const service of parsed.data.services) {
      await ctx.db.insert("services", {
        applicationId: application._id,
        namespace: buildNamespace(
          application.applicationName,
          application.tenant,
          service.namespaceSuffix,
        ),
        serviceName: service.serviceName,
        port: Number(service.port),
        healthcheckUrl: service.healthcheckUrl,
        nodeSelectors: service.nodeSelectors,
        description: service.description,
        createdAt: Date.now(),
      });
    }

    return parsed.data.services.length;
  },
});

/** The worker nodes saved for one application (stage 2 and 3 both read this). */
export const getWorkerNodes = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    if ((await getAuthUserId(ctx)) === null) return [];
    const rows = await nodesFor(ctx, args.applicationId);
    return rows.map((row) => ({
      _id: row._id,
      ipAddress: row.ipAddress,
      hostname: row.hostname,
      joinedCluster: row.joinedCluster,
    }));
  },
});

/** The services saved for one application (stage 3 shows and extends these). */
export const getServices = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    if ((await getAuthUserId(ctx)) === null) return [];
    const rows = await servicesFor(ctx, args.applicationId);
    return rows.map((row) => ({
      _id: row._id,
      namespace: row.namespace,
      serviceName: row.serviceName,
      port: row.port,
      healthcheckUrl: row.healthcheckUrl,
      nodeSelectors: row.nodeSelectors,
      description: row.description,
      createdAt: row.createdAt,
    }));
  },
});
