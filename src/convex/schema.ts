import { defineSchema } from "convex/server";

// Convex no longer stores anything. Accounts live in Postgres next to the
// onboarding data — `users` and `sessions` in src/convex/pg.ts, addressed by
// the actions in src/convex/auth.ts — so the Convex Auth tables (and their
// users table) are gone along with the auth provider itself.
const schema = defineSchema(
  {},
  {
    schemaValidation: false,
  },
);

export default schema;
