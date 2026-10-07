import { describe, expect, it } from "bun:test";
import { queryRows } from "../src/convex/pg";

/**
 * The database itself cannot be reached in tests (no credentials here), but
 * the configuration contract can: without DATABASE_URL every query must fail
 * fast with the actionable message the UI shows, and the module must import
 * cleanly (proving the pg dependency chain resolves).
 */
describe("postgres access", () => {
  it("imports cleanly and fails fast when DATABASE_URL is missing", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(queryRows("SELECT 1")).rejects.toThrow(
        "DATABASE_URL is not set",
      );
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });
});
