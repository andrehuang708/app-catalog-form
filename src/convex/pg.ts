"use node";

import { Pool, types, type PoolClient } from "pg";

/**
 * PostgreSQL access for the onboarding data. All application data
 * (applications / worker_nodes / services) lives in Postgres; Convex keeps
 * authentication and hosts the Node actions in `onboarding.ts` that talk to
 * this database. Every access goes through the helpers below so each action
 * gets idempotent schema setup and real SQL transactions.
 *
 * The connection string comes from the DATABASE_URL environment variable
 * (set it in the project's Keys/API keys tab).
 */

// Postgres bigint (OID 20) otherwise arrives as a string; our columns are
// epoch-millisecond timestamps, safe to parse as numbers.
types.setTypeParser(20, (value) => Number(value));

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it under the project's Keys/API keys tab so the app can reach Postgres.",
    );
  }
  return url;
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    pool = new Pool({
      connectionString: url,
      max: 5,
      // Managed Postgres (Neon, Tiger Cloud, …) requires TLS; local
      // development instances usually do not.
      ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
    });
  }
  return pool;
}

const DDL = `
-- Tenants used to be a fixed enum; they are rows now so the Tenant page can
-- add one and stage 1 can offer it (see listTenants/addTenant).
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);

INSERT INTO tenants (id, name, created_at)
SELECT md5(t.name), t.name, (extract(epoch from now()) * 1000)::bigint
FROM (VALUES ('fund'), ('lend'), ('cs'), ('ds')) AS t(name)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  application_name TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  tenant TEXT NOT NULL,
  total_worker_nodes INTEGER NOT NULL CHECK (total_worker_nodes >= 1 AND total_worker_nodes <= 1000),
  submitted_by TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_nodes (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  hostname TEXT NOT NULL,
  joined_cluster BOOLEAN NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS worker_nodes_application_id_idx
  ON worker_nodes (application_id);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  service_name TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port >= 1 AND port <= 65535),
  healthcheck_url TEXT NOT NULL,
  node_selectors TEXT[] NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS services_application_id_idx
  ON services (application_id);

CREATE INDEX IF NOT EXISTS applications_created_at_idx
  ON applications (created_at DESC);

-- Existing databases still carry the old four-tenant CHECK constraint.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_tenant_check;

-- Accounts live here, not in Convex: the sign-in form accepts either the
-- user id or the email address and checks the scrypt hash in password_hash
-- (see src/convex/password.ts and the actions in src/convex/auth.ts).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  revoked_at BIGINT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

-- Databases created before the admin Users page existed predate these columns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS revoked_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- One-time-style backfill: on a database created before roles existed, the
-- oldest account is the one bootstrap created, so it becomes the first
-- admin. Guarded so it never re-promotes anyone once an active admin exists
-- (running on every process start is therefore safe).
UPDATE users SET is_admin = TRUE
 WHERE id = (SELECT id FROM users
              WHERE revoked_at IS NULL
              ORDER BY created_at ASC, id ASC LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM users
                    WHERE is_admin = TRUE AND revoked_at IS NULL);

-- One row per signed-in browser. The id column is the sha256 of the bearer
-- token, so a leaked database still cannot be replayed as a live session.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
`;

let ready: Promise<void> | undefined;

/** Creates the tables once per process; retried automatically on failure. */
async function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(DDL);
      } finally {
        client.release();
      }
    })();
    ready.catch(() => {
      ready = undefined;
    });
  }
  await ready;
}

/** Runs a parameterized statement and returns all rows. */
export async function queryRows<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

/**
 * Runs `fn` inside a single SQL transaction — COMMIT on success, ROLLBACK on
 * any error, so multi-statement saves are all-or-nothing.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
