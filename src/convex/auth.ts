"use node";

// Accounts are rows in the `users` table of Postgres, and a signed-in browser
// holds a bearer token that maps to one row of `sessions`. This module is the
// whole of the project's authentication: there is no Convex Auth provider, no
// email OTP, and no third-party issuer behind it (see README → Authentication).

import { ConvexError, v } from "convex/values";
import type { PoolClient } from "pg";
import { action } from "./_generated/server";
import { queryRows, withTransaction } from "./pg";
import {
  hashPassword,
  hashSessionToken,
  newSessionToken,
  verifyPassword,
} from "./password";

/** How long a browser stays signed in without re-entering its password. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Sign-in problems are the visitor's to read, so they travel as a
 * ConvexError: a plain Error reaches a deployed client as an opaque
 * "Server Error", which would leave nobody able to sign in.
 */
function reject(message: string): never {
  throw new ConvexError(message);
}

/** The shape every client sees; never carries the password hash. */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  createdAt: number;
};

type UserDbRow = {
  id: string;
  email: string | null;
  name: string;
  password_hash: string;
  created_at: number;
};

function toUser(row: UserDbRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: Number(row.created_at),
  };
}

/* ------------------------------------------------------------- validation */

const USER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUserId(value: string): string {
  const id = value.trim().toLowerCase();
  if (!USER_ID_PATTERN.test(id))
    reject(
      "Use 1–32 characters: lowercase letters, numbers, dot, dash, or underscore.",
    );
  return id;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) reject("Enter a valid email address.");
  return email;
}

function checkPassword(password: string): string {
  if (password.length < 8) reject("Use a password of at least 8 characters.");
  if (password.length > 200)
    reject("That password is too long — 200 characters maximum.");
  return password;
}

/* ---------------------------------------------------------------- sessions */

/**
 * Resolves a bearer token to the signed-in user, or null when the session is
 * unknown or expired. Every gated action funnels through here, so the token is
 * validated in SQL rather than trusted from the request.
 */
export async function sessionUser(
  sessionToken: string,
): Promise<AuthUser | null> {
  if (!sessionToken) return null;
  const rows = await queryRows<UserDbRow>(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > $2`,
    [hashSessionToken(sessionToken), Date.now()],
  );
  return rows.length === 0 ? null : toUser(rows[0]);
}

/** Issues a fresh session for a user and returns the token for the browser. */
async function startSession(
  client: PoolClient,
  userId: string,
): Promise<string> {
  const token = newSessionToken();
  const now = Date.now();
  await client.query(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [hashSessionToken(token), userId, now, now + SESSION_TTL_MS],
  );
  return token;
}

/** Reads one account by user id or by email, whichever the visitor typed. */
async function findUser(identifier: string): Promise<UserDbRow | null> {
  const rows = await queryRows<UserDbRow>(
    "SELECT * FROM users WHERE id = $1 OR lower(email) = lower($2) LIMIT 1",
    [identifier.trim().toLowerCase(), identifier.trim()],
  );
  return rows.length === 0 ? null : rows[0];
}

/* ---------------------------------------------------------------- actions */

/**
 * Whether the very first account still has to be created. The sign-in page
 * uses this to offer a setup form instead of a form nobody can complete.
 */
export const setupState = action({
  args: {},
  handler: async () => {
    const rows = await queryRows<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM users",
    );
    return { needsSetup: rows[0].count === 0 };
  },
});

/**
 * Creates the first account on an empty install and signs it in. Refuses as
 * soon as one account exists, so this can never become an open signup form.
 */
export const bootstrap = action({
  args: {
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string(),
  },
  handler: async (_ctx, args) => {
    const existing = await queryRows<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM users",
    );
    if (existing[0].count > 0)
      reject("This install already has an account — sign in instead.");

    const id = normalizeUserId(args.userId);
    const email = normalizeEmail(args.email);
    const password = checkPassword(args.password);
    const name = args.name.trim();

    return await withTransaction(async (client) => {
      const clash = await client.query(
        "SELECT 1 FROM users WHERE id = $1 OR lower(email) = lower($2)",
        [id, email],
      );
      if (clash.rows.length > 0)
        reject("That user ID or email is already taken.");

      const created = await client.query(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, email, name, hashPassword(password), Date.now()],
      );
      const user = toUser(created.rows[0] as UserDbRow);
      const sessionToken = await startSession(client, user.id);
      return { sessionToken, user };
    });
  },
});

/**
 * Signs in with either the user id or the email address plus the password.
 * The same message covers "no such account" and "wrong password" so the form
 * cannot be used to discover which addresses exist.
 */
export const signIn = action({
  args: { identifier: v.string(), password: v.string() },
  handler: async (_ctx, args) => {
    const identifier = args.identifier.trim();
    if (!identifier) reject("Enter your user ID or email address.");

    const user = await findUser(identifier);
    const badPassword = "That user ID/email and password combination is wrong.";
    if (!user || !verifyPassword(args.password, user.password_hash))
      reject(badPassword);

    return await withTransaction(async (client) => {
      // Drop this account's expired rows so the table cannot grow forever.
      await client.query(
        "DELETE FROM sessions WHERE user_id = $1 AND expires_at <= $2",
        [user.id, Date.now()],
      );
      const sessionToken = await startSession(client, user.id);
      return { sessionToken, user: toUser(user) };
    });
  },
});

/** The signed-in user behind a token, or null. Keeps the page refresh-safe. */
export const currentUser = action({
  args: { sessionToken: v.string() },
  handler: async (_ctx, args) => await sessionUser(args.sessionToken),
});

/** Ends the session the browser holds. Unknown tokens are a no-op. */
export const signOut = action({
  args: { sessionToken: v.string() },
  handler: async (_ctx, args) => {
    if (!args.sessionToken) return;
    await queryRows("DELETE FROM sessions WHERE id = $1", [
      hashSessionToken(args.sessionToken),
    ]);
  },
});
