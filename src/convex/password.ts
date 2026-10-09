"use node";

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Password and session-token primitives for the Postgres-backed accounts
 * (see src/convex/auth.ts). Only this module touches the raw bytes, so the
 * storage format has exactly one home.
 *
 * Everything here runs inside Convex Node actions — never in the browser.
 */

// scrypt cost: N=2^14, r=8, p=1 → ~16 MB and ~50 ms per hash on a laptop,
// which is a sensible default for an internal tool and stays well under
// Node's 32 MB maxmem default (128 · N · r = 16 MB).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Hashes a password into `scrypt$N$r$p$salt$hash` (base64 salt and digest).
 *
 * The parameters travel with the hash so they can be raised later without
 * invalidating existing accounts — verifyPassword reads them back out.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const digest = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    digest.toString("base64"),
  ].join("$");
}

/**
 * Constant-time check of a password against a stored hash. Returns false
 * (never throws) for anything that is not one of our own hashes, so a
 * corrupted or legacy row simply fails to sign in.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, rawN, rawR, rawP, rawSalt, rawDigest] = stored.split("$");
  if (scheme !== "scrypt" || !rawN || !rawR || !rawP || !rawSalt || !rawDigest)
    return false;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p))
    return false;
  // Refuse absurd parameters: they would either hang the action or mean the
  // stored value was tampered with.
  if (N < 1024 || N > 1 << 22 || r < 1 || r > 32 || p < 1 || p > 16)
    return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(rawDigest, "base64");
  } catch {
    return false;
  }
  // A zero-length digest would make scrypt derive a 0-byte key, which throws
  // ("keylen" must be positive) — a corrupted row must fail, not crash.
  if (expected.length === 0) return false;

  try {
    const actual = scryptSync(
      password,
      Buffer.from(rawSalt, "base64"),
      expected.length,
      {
        N,
        r,
        p,
      },
    );
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    // Parameter bounds above still allow 128·N·r past Node's 32 MB maxmem
    // (e.g. N = 2²², r = 32); scryptSync rejects those with a RangeError.
    // A hash we cannot compute is a hash that simply does not match.
    return false;
  }
}

/** A 256-bit bearer token handed to the browser after a successful sign-in. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Sessions are stored keyed by this, so the raw token never hits the DB. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
