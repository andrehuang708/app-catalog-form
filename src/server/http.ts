import { serveStatic } from "hono/bun";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError } from "./errors";
import {
  bootstrap,
  currentUser,
  createUser,
  listUsers,
  revokeUser,
  restoreUser,
  setupState,
  signIn,
  signOut,
} from "./auth";
import {
  addTenant,
  createApplication,
  dashboardStats,
  getServices,
  getWorkerNodes,
  listAllServices,
  listAllWorkerNodes,
  listApplications,
  listNamespaces,
  listTenants,
  saveServices,
  saveWorkerNodes,
  updateApplication,
} from "./onboarding";

/**
 * The whole HTTP surface of the app — this used to be Convex actions.
 *
 * The browser posts JSON to /api/<module>/<function>; the route looks the
 * function up in the whitelist below, injects the bearer token from the
 * Authorization header as `sessionToken` (the handlers still resolve it
 * against the `sessions` table — the header itself proves nothing), and
 * returns the handler's value as JSON.
 *
 * Everything is same-origin: in production this server also serves the
 * built Vite bundle from dist/, and in development the Vite dev server
 * proxies /api here. No CORS, no second port for the browser to know.
 */

/** A handler as the route table stores it: args object in, value out. */
type Handler = (args: never) => Promise<unknown>;

/**
 * The only functions reachable over HTTP. An explicit whitelist — not a
 * reflection over the modules — so a new export is never accidentally
 * public.
 */
const endpoints: Record<string, Record<string, Handler>> = {
  auth: {
    setupState,
    bootstrap,
    signIn,
    currentUser,
    signOut,
    listUsers,
    createUser,
    revokeUser,
    restoreUser,
  },
  onboarding: {
    listApplications,
    createApplication,
    updateApplication,
    saveWorkerNodes,
    saveServices,
    getWorkerNodes,
    getServices,
    listTenants,
    addTenant,
    listNamespaces,
    listAllServices,
    listAllWorkerNodes,
    dashboardStats,
  },
};

export const app = new Hono();

/** Docker/compose healthcheck — proves the process answers, nothing more. */
app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/:module/:fn", async (c) => {
  const fn = endpoints[c.req.param("module")]?.[c.req.param("fn")];
  // Same 404 for an unknown module, function, or verb — no probing surface.
  if (typeof fn !== "function") return c.json({ error: "Not found." }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const header = c.req.header("authorization") ?? "";
  const sessionToken = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";

  try {
    const result = await (fn as (
      args: Record<string, unknown>,
    ) => Promise<unknown>)({ ...body, sessionToken });
    // `signOut` resolves void — JSON has no void, so an empty body it is.
    return c.json(result ?? null);
  } catch (error) {
    // ApiError carries a sentence the UI shows verbatim; anything else is a
    // bug or a SQL failure and must not leak details to the browser.
    if (error instanceof ApiError)
      return c.json(
        { error: error.message },
        // ApiError.status is a plain number at the throw site; narrow it to
        // the status codes Hono accepts on this boundary.
        error.status as ContentfulStatusCode,
      );
    console.error("[api]", c.req.path, error);
    return c.json({ error: "Something went wrong on the server." }, 500);
  }
});

/* ------------------------------------------------ static bundle + SPA */

// dist/ is the output of `vite build`; anything not under /api is a static
// asset or a client-side route, so misses fall back to index.html and the
// router takes over. (In development Vite serves the UI and proxies /api.)
app.use("*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));
