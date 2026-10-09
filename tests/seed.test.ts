import { describe, expect, it } from "bun:test";
import {
  SEED_APPLICATIONS,
  SEED_TENANTS,
  SEED_USERS,
  seedNamespaces,
  type SeedApplication,
} from "../scripts/seed";
import {
  serviceSchema,
  stageOneSchemaFor,
  workerNodeSchema,
  workerNodesSchema,
} from "../src/lib/onboarding-schema";
import { statusOf, type ApplicationRow } from "../src/components/onboarding/types";

/**
 * The seed script writes straight to SQL, so nothing else proves the rows it
 * produces would pass the same validation the forms enforce. These tests run
 * every fixture through the app's real zod schemas — if a fixture drifts from
 * what stage 1/2/3 accept, they fail before the seed does.
 */

/** Mirrors the ApplicationRow the list pages receive from listApplications. */
function toApplicationRow(app: SeedApplication): ApplicationRow {
  return {
    _id: app.id,
    applicationName: app.applicationName,
    repositoryName: app.repositoryName,
    tenant: app.tenant,
    totalWorkerNodes: app.totalWorkerNodes,
    submittedByName: "Seed Admin",
    createdAt: Date.now() - app.ageDays * 86_400_000,
    nodeCount: app.nodes.length,
    serviceCount: app.services.length,
  };
}

describe("seed fixtures", () => {
  it("stage 1 details validate against stageOneSchemaFor", () => {
    const schema = stageOneSchemaFor(SEED_TENANTS);
    for (const app of SEED_APPLICATIONS) {
      const result = schema.safeParse({
        applicationName: app.applicationName,
        repositoryName: app.repositoryName,
        tenant: app.tenant,
        totalWorkerNodes: String(app.totalWorkerNodes),
      });
      expect(result.success, `${app.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("stage 2 nodes validate individually and as an exact-size list when complete", () => {
    for (const app of SEED_APPLICATIONS) {
      for (const node of app.nodes) {
        const result = workerNodeSchema.safeParse({
          ipAddress: node.ipAddress,
          hostname: node.hostname,
          joinedCluster: node.joinedCluster,
        });
        expect(result.success, `${node.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }

      // Only applications that saved their full stage 2 list can satisfy the
      // exact-count rule; the "needed"/"out of sync" fixtures intentionally do not.
      if (app.nodes.length === app.totalWorkerNodes) {
        const result = workerNodesSchema(app.totalWorkerNodes).safeParse({
          nodes: app.nodes.map((node) => ({
            ipAddress: node.ipAddress,
            hostname: node.hostname,
            joinedCluster: node.joinedCluster,
          })),
        });
        expect(result.success, `${app.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      } else {
        expect(app.nodes.length).toBeLessThan(app.totalWorkerNodes);
      }
    }
  });

  it("stage 3 services validate against serviceSchema with real node hostnames", () => {
    for (const app of SEED_APPLICATIONS) {
      for (const service of app.services) {
        const result = serviceSchema({
          applicationName: app.applicationName,
          tenant: app.tenant,
          nodeHostnames: app.nodes.map((node) => node.hostname),
        }).safeParse({
          namespaceSuffix: service.namespaceSuffix,
          serviceName: service.serviceName,
          port: String(service.port),
          healthcheckUrl: service.healthcheckUrl,
          nodeSelectors: service.nodeSelectors,
          description: service.description,
        });
        expect(result.success, `${service.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
    }
  });

  it("stored namespaces follow applicationname-tenant-suffix and stay within 63 chars", () => {
    for (const app of SEED_APPLICATIONS) {
      for (const { namespace } of seedNamespaces(app)) {
        expect(namespace.length).toBeLessThanOrEqual(63);
        expect(namespace).toStartWith(
          `${app.applicationName.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-${app.tenant}-`,
        );
      }
    }
  });

  it("covers every status the Applications list can render", () => {
    const labels = SEED_APPLICATIONS.map((app) => statusOf(toApplicationRow(app)).label);
    expect(labels.sort()).toEqual(
      [
        "Complete",
        "Services needed",
        "Worker nodes needed",
        "Worker nodes out of sync",
      ].sort(),
    );
  });

  it("accounts satisfy the server's id/email/password rules", () => {
    // Mirrors normalizeUserId / normalizeEmail / checkPassword in src/server/auth.ts.
    const userId = /^[a-z0-9][a-z0-9._-]{0,31}$/;
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const user of SEED_USERS) {
      expect(user.id).toMatch(userId);
      expect(user.email).toMatch(email);
      expect(user.password.length).toBeGreaterThanOrEqual(8);
      expect(user.password.length).toBeLessThanOrEqual(200);
    }
  });

  it("uses seed-… ids so --reset can find every row it owns", () => {
    for (const app of SEED_APPLICATIONS) {
      expect(app.id).toStartWith("seed-app-");
      for (const node of app.nodes) expect(node.id).toStartWith("seed-");
      for (const service of app.services) expect(service.id).toStartWith("seed-");
    }
    for (const user of SEED_USERS) expect(user.id).toStartWith("seed-");
  });
});
