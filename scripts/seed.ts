/**
 * Seeds the Postgres database with demo data:
 *
 *   - two accounts (an admin and a member) with scrypt hashes from the
 *     project's own password module,
 *   - four applications that together cover every status the Applications
 *     list can render: "Complete", "Services needed", "Worker nodes needed",
 *     and "Worker nodes out of sync",
 *   - their stage 2 worker nodes and stage 3 services, built with the same
 *     namespace rules the forms use (`buildNamespace`).
 *
 * Every row uses a fixed `seed-…` id, and an application (or account) that
 * already exists is skipped entirely — so re-running never duplicates data,
 * never rewrites an existing account's password, and never resurrects rows
 * you deleted from a previous seed. Use `--reset` to drop only the seed rows
 * and start over:
 *
 *   bun run seed          insert whatever is missing
 *   bun run seed:reset    delete prior seed rows, then insert again
 *
 * The fixtures below are also imported by tests/seed.test.ts, which validates
 * them against the very zod schemas the onboarding forms use.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { buildNamespace } from "../src/lib/onboarding-schema";
import { hashPassword, verifyPassword } from "../src/server/password";
import { queryRows, withTransaction } from "../src/server/pg";

/* ------------------------------------------------------------------ types */

export type SeedTenant = string;

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  /** Plaintext only so the hash is derived here; printed only when created. */
  password: string;
  isAdmin: boolean;
};

export type SeedNode = {
  id: string;
  ipAddress: string;
  hostname: string;
  joinedCluster: boolean;
};

export type SeedService = {
  id: string;
  namespaceSuffix: string;
  serviceName: string;
  port: number;
  healthcheckUrl: string;
  nodeSelectors: string[];
  description: string;
};

export type SeedApplication = {
  id: string;
  applicationName: string;
  repositoryName: string;
  tenant: string;
  totalWorkerNodes: number;
  /** How far in the past the row is dated, so the list has stable ordering. */
  ageDays: number;
  nodes: SeedNode[];
  services: SeedService[];
};

/* --------------------------------------------------------------- fixtures */

const DAY_MS = 86_400_000;

/** The four tenants `ensureSchema` already plants; referenced for validation. */
export const SEED_TENANTS: SeedTenant[] = ["fund", "lend", "cs", "ds"];

export const SEED_USERS: SeedUser[] = [
  {
    id: "seed-admin",
    email: "admin@example.com",
    name: "Seed Admin",
    password: "Password123!",
    isAdmin: true,
  },
  {
    id: "seed-demo",
    email: "demo@example.com",
    name: "Demo User",
    password: "Password123!",
    isAdmin: false,
  },
];

/**
 * One application per status `statusOf` can produce, so the Applications,
 * Dashboard, and onboarding pages have something realistic to render.
 * Node/service ids stay in the `seed-…` namespace for `--reset`.
 */
export const SEED_APPLICATIONS: SeedApplication[] = [
  {
    // statusOf → "Complete" (nodes in sync + services saved)
    id: "seed-app-complete",
    applicationName: "payments-api",
    repositoryName: "acme/payments-api",
    tenant: "fund",
    totalWorkerNodes: 3,
    ageDays: 4,
    nodes: [
      { id: "seed-node-complete-1", ipAddress: "10.10.1.11", hostname: "payments-api-01", joinedCluster: true },
      { id: "seed-node-complete-2", ipAddress: "10.10.1.12", hostname: "payments-api-02", joinedCluster: true },
      { id: "seed-node-complete-3", ipAddress: "10.10.1.13", hostname: "payments-api-03", joinedCluster: false },
    ],
    services: [
      {
        id: "seed-svc-complete-1",
        namespaceSuffix: "api",
        serviceName: "api",
        port: 8080,
        healthcheckUrl: "https://payments-api-fund-api.acme.dev/healthz",
        nodeSelectors: ["payments-api-01", "payments-api-02"],
        description: "Public REST entrypoint for payment authorization.",
      },
      {
        id: "seed-svc-complete-2",
        namespaceSuffix: "worker",
        serviceName: "job-worker",
        port: 9090,
        healthcheckUrl: "https://payments-api-fund-worker.acme.dev/health",
        nodeSelectors: ["payments-api-03"],
        description: "Drains the settlement queue every minute.",
      },
    ],
  },
  {
    // statusOf → "Services needed" (nodes saved, no services yet)
    id: "seed-app-services",
    applicationName: "ledger-sync",
    repositoryName: "acme/ledger-sync",
    tenant: "cs",
    totalWorkerNodes: 2,
    ageDays: 3,
    nodes: [
      { id: "seed-node-services-1", ipAddress: "10.10.2.11", hostname: "ledger-sync-01", joinedCluster: true },
      { id: "seed-node-services-2", ipAddress: "10.10.2.12", hostname: "ledger-sync-02", joinedCluster: true },
    ],
    services: [],
  },
  {
    // statusOf → "Worker nodes needed" (stage 1 only)
    id: "seed-app-nodes",
    applicationName: "risk-engine",
    repositoryName: "acme/risk-engine",
    tenant: "lend",
    totalWorkerNodes: 3,
    ageDays: 2,
    nodes: [],
    services: [],
  },
  {
    // statusOf → "Worker nodes out of sync" (fewer nodes than reserved)
    id: "seed-app-sync",
    applicationName: "notify-worker",
    repositoryName: "acme/notify-worker",
    tenant: "ds",
    totalWorkerNodes: 3,
    ageDays: 1,
    nodes: [
      { id: "seed-node-sync-1", ipAddress: "10.10.4.11", hostname: "notify-worker-01", joinedCluster: true },
    ],
    services: [],
  },
];

/** Stored namespaces for the seed services — same builder the forms call. */
export function seedNamespaces(
  app: SeedApplication,
): Array<{ id: string; namespace: string }> {
  return app.services.map((service) => ({
    id: service.id,
    namespace: buildNamespace(app.applicationName, app.tenant, service.namespaceSuffix),
  }));
}

/* ------------------------------------------------------------------- env */

/**
 * Bun loads `.env` on start, but `.env` here carries an empty `DATABASE_URL`
 * while the real one lives in `.env.local` — fall back file by file so the
 * script works from any invocation that has not resolved it already.
 */
function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  const here = dirname(fileURLToPath(import.meta.url));
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(here, "..", file), "utf8");
      const match = text.match(/^DATABASE_URL=(.+)$/m);
      const value = match?.[1].trim().replace(/^["']|["']$/g, "");
      if (value) {
        process.env.DATABASE_URL = value;
        return;
      }
    } catch {
      // Missing file — try the next one.
    }
  }
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
  );
}

/* ------------------------------------------------------------------ seed */

type Counts = Record<string, { created: number; existing: number }>;

function bump(counts: Counts, table: string, created: number, rows: number) {
  counts[table] ??= { created: 0, existing: 0 };
  counts[table].created += created;
  counts[table].existing += rows - created;
}

async function seedAll(): Promise<Counts> {
  const counts: Counts = {};
  const now = Date.now();

  await withTransaction(async (client) => {
    /* accounts — an existing id or email is left completely untouched */
    for (const user of SEED_USERS) {
      const clash = await client.query(
        "SELECT 1 FROM users WHERE id = $1 OR lower(email) = lower($2)",
        [user.id, user.email],
      );
      if (clash.rows.length > 0) {
        bump(counts, "users", 0, 1);
        continue;
      }
      const res = await client.query(
        `INSERT INTO users (id, email, name, password_hash, created_at, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          user.email,
          user.name,
          hashPassword(user.password),
          now,
          user.isAdmin,
        ],
      );
      bump(counts, "users", Number(res.rowCount ?? 0), 1);
    }

    /* applications + their nodes and services, all-or-nothing per app */
    for (const app of SEED_APPLICATIONS) {
      const exists = await client.query("SELECT 1 FROM applications WHERE id = $1", [
        app.id,
      ]);
      if (exists.rows.length > 0) {
        bump(counts, "applications", 0, 1);
        bump(counts, "worker_nodes", 0, app.nodes.length);
        bump(counts, "services", 0, app.services.length);
        continue;
      }

      const createdAt = now - app.ageDays * DAY_MS;
      const appRes = await client.query(
        `INSERT INTO applications
           (id, application_name, repository_name, tenant, total_worker_nodes,
            submitted_by, submitted_by_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          app.id,
          app.applicationName,
          app.repositoryName,
          app.tenant,
          app.totalWorkerNodes,
          SEED_USERS[0].id,
          SEED_USERS[0].name,
          createdAt,
        ],
      );
      bump(counts, "applications", Number(appRes.rowCount ?? 0), 1);

      // Timestamps get +index so rows keep their insertion order, exactly
      // like the stage 2 save path does.
      for (const [index, node] of app.nodes.entries()) {
        const res = await client.query(
          `INSERT INTO worker_nodes
             (id, application_id, ip_address, hostname, joined_cluster, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [node.id, app.id, node.ipAddress, node.hostname, node.joinedCluster, createdAt + index],
        );
        bump(counts, "worker_nodes", Number(res.rowCount ?? 0), 1);
      }

      for (const [index, service] of app.services.entries()) {
        const res = await client.query(
          `INSERT INTO services
             (id, application_id, namespace, service_name, port,
              healthcheck_url, node_selectors, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            service.id,
            app.id,
            buildNamespace(app.applicationName, app.tenant, service.namespaceSuffix),
            service.serviceName,
            service.port,
            service.healthcheckUrl,
            service.nodeSelectors,
            service.description,
            createdAt + index,
          ],
        );
        bump(counts, "services", Number(res.rowCount ?? 0), 1);
      }
    }
  });

  return counts;
}

async function resetSeedRows(): Promise<void> {
  await withTransaction(async (client) => {
    // Cascades to worker_nodes and services (ON DELETE CASCADE).
    const apps = await client.query(
      "DELETE FROM applications WHERE id LIKE 'seed-app-%'",
    );
    // Cascades to sessions.
    const users = await client.query("DELETE FROM users WHERE id LIKE 'seed-%'");
    console.log(
      `Reset: removed ${apps.rowCount} application(s) (with their nodes and ` +
        `services) and ${users.rowCount} account(s).`,
    );
  });
}

/**
 * Reports whether each seeded account actually verifies with the documented
 * password — an account that pre-existed keeps its old password, and the
 * message says so instead of promising credentials that will not work.
 */
async function reportAccounts(): Promise<void> {
  for (const user of SEED_USERS) {
    const rows = await queryRows<{ email: string | null; password_hash: string }>(
      "SELECT email, password_hash FROM users WHERE id = $1",
      [user.id],
    );
    if (rows.length === 0) {
      console.log(
        `  ! ${user.id} was not created — ${user.email} already belongs to ` +
          `another account.`,
      );
    } else if (verifyPassword(user.password, rows[0].password_hash)) {
      console.log(
        `  • sign in: ${user.email} / ${user.password}` +
          (user.isAdmin ? "  (Administrator)" : "  (Member)"),
      );
    } else {
      console.log(
        `  • ${user.email} already existed with a different password — ` +
          `left untouched (use the Users page to reset it).`,
      );
    }
  }
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<void> {
  ensureDatabaseUrl();

  // First query runs ensureSchema: tables + the four default tenants.
  await queryRows("SELECT 1");

  if (process.argv.includes("--reset")) await resetSeedRows();

  const counts = await seedAll();

  console.log("Seed complete:");
  for (const [table, { created, existing }] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(14)} created ${created}, already present ${existing}`);
  }
  console.log("Accounts:");
  await reportAccounts();
}

// Only when executed directly — tests import the fixtures without touching
// the database (import.meta.main is Bun's "am I the entry point?" check).
if ((import.meta as { main?: boolean }).main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
