"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import {
  buildNamespace,
  servicesSchema,
  stageOneSchema,
  workerNodesSchema,
  type Tenant,
} from "../lib/onboarding-schema";
import { queryRows, withTransaction } from "./pg";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

const tenantValidator = v.union(
  v.literal("fund"),
  v.literal("lend"),
  v.literal("cs"),
  v.literal("ds"),
);

/**
 * Application data lives in Postgres; these Node actions are the API over it.
 * Every value is validated again with the same zod schemas the browser form
 * uses — the form is only the first line of defence. Returns messages the UI
 * can show verbatim.
 */
function firstIssue(issues: Array<{ message: string }>) {
  return issues[0]?.message ?? "Check the form values and try again.";
}

async function requireSignedIn(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null)
    throw new Error("You must be signed in to save an application.");
  return userId;
}

function parseStageOne(args: {
  applicationName: string;
  repositoryName: string;
  tenant: Tenant;
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

/* ------------------------------------------------------------------ rows */

type ApplicationDbRow = {
  id: string;
  application_name: string;
  repository_name: string;
  tenant: Tenant;
  total_worker_nodes: number;
  submitted_by: string;
  submitted_by_name: string;
  created_at: number;
};

type NodeDbRow = {
  id: string;
  application_id: string;
  ip_address: string;
  hostname: string;
  joined_cluster: boolean;
  created_at: number;
};

type ServiceDbRow = {
  id: string;
  application_id: string;
  namespace: string;
  service_name: string;
  port: number;
  healthcheck_url: string;
  node_selectors: string[];
  description: string;
  created_at: number;
};

/** The shape the dashboard list and the wizard share. */
type ApplicationRow = {
  _id: string;
  applicationName: string;
  repositoryName: string;
  tenant: Tenant;
  totalWorkerNodes: number;
  submittedByName: string;
  createdAt: number;
  nodeCount: number;
  serviceCount: number;
};

function toApplication(
  row: ApplicationDbRow,
  nodeCount: number,
  serviceCount: number,
): ApplicationRow {
  return {
    _id: row.id,
    applicationName: row.application_name,
    repositoryName: row.repository_name,
    tenant: row.tenant,
    totalWorkerNodes: row.total_worker_nodes,
    submittedByName: row.submitted_by_name,
    createdAt: Number(row.created_at),
    nodeCount,
    serviceCount,
  };
}

function toNode(row: NodeDbRow) {
  return {
    _id: row.id,
    ipAddress: row.ip_address,
    hostname: row.hostname,
    joinedCluster: row.joined_cluster,
  };
}

function toService(row: ServiceDbRow) {
  return {
    _id: row.id,
    namespace: row.namespace,
    serviceName: row.service_name,
    port: row.port,
    healthcheckUrl: row.healthcheck_url,
    nodeSelectors: row.node_selectors,
    description: row.description,
    createdAt: Number(row.created_at),
  };
}

async function requireApplication(
  applicationId: string,
): Promise<ApplicationDbRow> {
  const rows = await queryRows<ApplicationDbRow>(
    "SELECT * FROM applications WHERE id = $1",
    [applicationId],
  );
  if (rows.length === 0)
    throw new Error("This application no longer exists.");
  return rows[0];
}

async function countsFor(applicationId: string) {
  const [nodes, services] = await Promise.all([
    queryRows<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM worker_nodes WHERE application_id = $1",
      [applicationId],
    ),
    queryRows<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM services WHERE application_id = $1",
      [applicationId],
    ),
  ]);
  return { nodeCount: nodes[0].count, serviceCount: services[0].count };
}

/* ------------------------------------------------------------------ api */

/** Saved applications, newest first. Only signed-in users can read them. */
export const listApplications = action({
  args: {},
  handler: async (ctx) => {
    await requireSignedIn(ctx);

    const applications = await queryRows<ApplicationDbRow>(
      "SELECT * FROM applications ORDER BY created_at DESC LIMIT 100",
    );
    if (applications.length === 0) return [];

    const ids = applications.map((row) => row.id);
    const [nodeCounts, serviceCounts] = await Promise.all([
      queryRows<{ application_id: string; count: number }>(
        "SELECT application_id, COUNT(*)::int AS count FROM worker_nodes WHERE application_id = ANY($1::text[]) GROUP BY application_id",
        [ids],
      ),
      queryRows<{ application_id: string; count: number }>(
        "SELECT application_id, COUNT(*)::int AS count FROM services WHERE application_id = ANY($1::text[]) GROUP BY application_id",
        [ids],
      ),
    ]);
    const nodes = new Map(nodeCounts.map((row) => [row.application_id, row.count]));
    const services = new Map(
      serviceCounts.map((row) => [row.application_id, row.count]),
    );

    return applications.map((row) =>
      toApplication(
        row,
        nodes.get(row.id) ?? 0,
        services.get(row.id) ?? 0,
      ),
    );
  },
});

/** Stage 1 — create the application and move on to worker nodes. */
export const createApplication = action({
  args: {
    applicationName: v.string(),
    repositoryName: v.string(),
    tenant: tenantValidator,
    totalWorkerNodes: v.number(),
  },
  handler: async (ctx, args): Promise<ApplicationRow> => {
    const userId = await requireSignedIn(ctx);
    const values = parseStageOne(args);

    // Annotated (and the handler's return type is explicit) so this module's
    // export types never depend circularly on api, which references them.
    const user: { name?: string | null; email?: string | null } | null =
      await ctx.runQuery(api.users.currentUser);
    const submittedByName =
      user?.name?.trim() || user?.email?.trim() || "Platform team";

    const rows = await queryRows<ApplicationDbRow>(
      `INSERT INTO applications
         (id, application_name, repository_name, tenant, total_worker_nodes,
          submitted_by, submitted_by_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        randomUUID(),
        values.applicationName,
        values.repositoryName,
        values.tenant,
        Number(values.totalWorkerNodes),
        userId,
        submittedByName,
        Date.now(),
      ],
    );

    return toApplication(rows[0], 0, 0);
  },
});

/** Stage 1 — correct the details of an application already in progress. */
export const updateApplication = action({
  args: {
    applicationId: v.string(),
    applicationName: v.string(),
    repositoryName: v.string(),
    tenant: tenantValidator,
    totalWorkerNodes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const application = await requireApplication(args.applicationId);
    const values = parseStageOne(args);

    const serviceCounts = await queryRows<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM services WHERE application_id = $1",
      [args.applicationId],
    );
    if (serviceCounts[0].count > 0) {
      const fixed =
        values.applicationName !== application.application_name ||
        values.tenant !== application.tenant ||
        Number(values.totalWorkerNodes) !== application.total_worker_nodes;
      if (fixed)
        throw new Error(
          "The application name, tenant, and total worker nodes are fixed once services are saved.",
        );
    }

    const rows = await queryRows<ApplicationDbRow>(
      `UPDATE applications
         SET application_name = $1, repository_name = $2, tenant = $3,
             total_worker_nodes = $4
       WHERE id = $5
       RETURNING *`,
      [
        values.applicationName,
        values.repositoryName,
        values.tenant,
        Number(values.totalWorkerNodes),
        args.applicationId,
      ],
    );
    const counts = await countsFor(args.applicationId);
    return toApplication(rows[0], counts.nodeCount, counts.serviceCount);
  },
});

/** Stage 2 — save the worker node list, exactly as many as stage 1 reserved. */
export const saveWorkerNodes = action({
  args: {
    applicationId: v.string(),
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
    const application = await requireApplication(args.applicationId);

    const parsed = workerNodesSchema(application.total_worker_nodes).safeParse({
      nodes: args.nodes,
    });
    if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));

    const hostnames = new Set(parsed.data.nodes.map((node) => node.hostname));
    const baseTimestamp = Date.now();

    return await withTransaction(async (client) => {
      // Saved services keep pointing at real nodes — refuse a change that
      // would leave one without any selector.
      const services = await client.query(
        "SELECT id, node_selectors FROM services WHERE application_id = $1",
        [args.applicationId],
      );
      for (const service of services.rows as Array<{
        id: string;
        node_selectors: string[];
      }>) {
        const kept = service.node_selectors.filter((name) =>
          hostnames.has(name),
        );
        if (service.node_selectors.length > 0 && kept.length === 0)
          throw new Error(
            "A saved service relies on the current worker nodes. Keep at least one of its nodes in the list.",
          );
        if (kept.length !== service.node_selectors.length) {
          await client.query("UPDATE services SET node_selectors = $1 WHERE id = $2", [
            kept,
            service.id,
          ]);
        }
      }

      await client.query("DELETE FROM worker_nodes WHERE application_id = $1", [
        args.applicationId,
      ]);

      const saved = [];
      for (const [index, node] of parsed.data.nodes.entries()) {
        const result = await client.query(
          `INSERT INTO worker_nodes
             (id, application_id, ip_address, hostname, joined_cluster, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            randomUUID(),
            args.applicationId,
            node.ipAddress,
            node.hostname,
            node.joinedCluster,
            baseTimestamp + index,
          ],
        );
        saved.push(toNode(result.rows[0] as NodeDbRow));
      }
      return saved;
    });
  },
});

/** Stage 3 — save the whole service list for an application in one go. */
export const saveServices = action({
  args: {
    applicationId: v.string(),
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
    const application = await requireApplication(args.applicationId);

    const nodes = await queryRows<NodeDbRow>(
      "SELECT * FROM worker_nodes WHERE application_id = $1 ORDER BY created_at ASC, id ASC",
      [args.applicationId],
    );
    if (nodes.length !== application.total_worker_nodes)
      throw new Error(
        `Save exactly ${application.total_worker_nodes} worker nodes in stage 2 first.`,
      );

    const parsed = servicesSchema({
      applicationName: application.application_name,
      tenant: application.tenant,
      nodeHostnames: nodes.map((node) => node.hostname),
    }).safeParse({
      services: args.services.map((service) => ({
        ...service,
        port: String(service.port),
      })),
    });
    if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));

    const baseTimestamp = Date.now();

    return await withTransaction(async (client) => {
      await client.query("DELETE FROM services WHERE application_id = $1", [
        args.applicationId,
      ]);

      const saved = [];
      for (const [index, service] of parsed.data.services.entries()) {
        const result = await client.query(
          `INSERT INTO services
             (id, application_id, namespace, service_name, port,
              healthcheck_url, node_selectors, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            randomUUID(),
            args.applicationId,
            buildNamespace(
              application.application_name,
              application.tenant,
              service.namespaceSuffix,
            ),
            service.serviceName,
            Number(service.port),
            service.healthcheckUrl,
            service.nodeSelectors,
            service.description,
            baseTimestamp + index,
          ],
        );
        saved.push(toService(result.rows[0] as ServiceDbRow));
      }
      return saved;
    });
  },
});

/** The worker nodes saved for one application (stage 2 and 3 both read this). */
export const getWorkerNodes = action({
  args: { applicationId: v.string() },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const rows = await queryRows<NodeDbRow>(
      "SELECT * FROM worker_nodes WHERE application_id = $1 ORDER BY created_at ASC, id ASC",
      [args.applicationId],
    );
    return rows.map(toNode);
  },
});

/** The services saved for one application (stage 3 shows and extends these). */
export const getServices = action({
  args: { applicationId: v.string() },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const rows = await queryRows<ServiceDbRow>(
      "SELECT * FROM services WHERE application_id = $1 ORDER BY created_at ASC, id ASC",
      [args.applicationId],
    );
    return rows.map(toService);
  },
});
