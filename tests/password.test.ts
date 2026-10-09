import { describe, expect, it } from "bun:test";
import { hashPassword, verifyPassword } from "../src/server/password";

/**
 * `verifyPassword` promises to return false rather than throw for anything
 * that is not one of our own hashes — a corrupted row must fail the sign-in
 * check, never crash the action into an opaque "Server Error".
 */
describe("password hashing", () => {
  it("round-trips a password through hash and verify", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("returns false (never throws) for a corrupted digest", () => {
    // Empty/garbage base64 digest → zero-length key, which scrypt rejects.
    expect(verifyPassword("anything", "scrypt$16384$8$1$c2FsdA==$!!!")).toBe(
      false,
    );
    expect(verifyPassword("anything", "scrypt$16384$8$1$c2FsdA==$")).toBe(
      false,
    );
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("returns false instead of throwing on absurd KDF parameters", () => {
    // Within the accepted bounds (N ≤ 2²², r ≤ 32) but 128·N·r is far past
    // Node's 32 MB maxmem, so scryptSync raises a RangeError. A tampered row
    // must fail verification, not crash it.
    const runaway = "scrypt$4194304$32$1$c2FsdA==$aGFzaA==";
    expect(verifyPassword("anything", runaway)).toBe(false);
  });

  it("rejects parameters outside the accepted bounds without computing", () => {
    expect(verifyPassword("x", "scrypt$512$8$1$c2FsdA==$aGFzaA==")).toBe(
      false,
    );
    expect(verifyPassword("x", "scrypt$16384$64$1$c2FsdA==$aGFzaA==")).toBe(
      false,
    );
    expect(verifyPassword("x", "bcrypt$16384$8$1$c2FsdA==$aGFzaA==")).toBe(
      false,
    );
  });
});
