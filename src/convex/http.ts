import { httpRouter } from "convex/server";

// No HTTP actions: authentication is a pair of Postgres-backed Convex actions
// (see src/convex/auth.ts), so the OIDC discovery routes that Convex Auth used
// to publish here are gone with it.
const http = httpRouter();

export default http;
