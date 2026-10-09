import { readSessionToken } from "@/lib/session";
import type * as authHandlers from "@/server/auth";
import type * as onboardingHandlers from "@/server/onboarding";

/**
 * The browser's API client — the fetch-based replacement for the `api`
 * object the pages used to import from `@/convex/_generated/api`.
 *
 * Same call shape as before: `api.auth.signIn({ identifier, password })`,
 * `api.onboarding.listTenants()`. Each function POSTs JSON to
 * /api/<module>/<function> on the same origin, where src/server/http.ts
 * looks the name up in its whitelist and runs the Postgres-backed handler.
 *
 * The bearer token is read from localStorage and sent as an Authorization
 * header by the transport — pages and hooks never thread it through (the
 * hook `useAuthedAction` is now only a stable-reference passthrough).
 *
 * Argument and return types are derived from the real handlers in
 * src/server/* via type-only imports, so none of that Node code ships to
 * the browser and a handler signature change breaks the build here first.
 */

/** Any handler signature — the constraint `Parameters`/`ReturnType` need. */
type AnyHandler = (...args: never) => unknown;

/** A handler's documented arguments, minus the transport's session token. */
type PublicArgs<F extends AnyHandler> = Omit<Parameters<F>[0], "sessionToken">;

/** The value a handler resolves to, without the Promise wrapper. */
type Result<F extends AnyHandler> = Awaited<ReturnType<F>>;

/**
 * POSTs one whitelisted call. A failure the server marked user-facing
 * (ApiError) arrives as {"error": "<sentence>"} and is re-thrown as an
 * Error carrying exactly that sentence — the pages show `error.message`
 * verbatim, the same contract ConvexError used to provide.
 */
async function call<T>(
  module: string,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const token = readSessionToken();
  const response = await fetch(`/api/${module}/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(args),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `The server could not complete that request (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

export const api = {
  auth: {
    setupState: () => call<{ needsSetup: boolean }>("auth", "setupState"),
    bootstrap: (args: PublicArgs<typeof authHandlers.bootstrap>) =>
      call<Result<typeof authHandlers.bootstrap>>("auth", "bootstrap", args),
    signIn: (args: PublicArgs<typeof authHandlers.signIn>) =>
      call<Result<typeof authHandlers.signIn>>("auth", "signIn", args),
    currentUser: () =>
      call<Result<typeof authHandlers.currentUser>>("auth", "currentUser"),
    signOut: () => call<void>("auth", "signOut"),
    listUsers: () =>
      call<Result<typeof authHandlers.listUsers>>("auth", "listUsers"),
    createUser: (args: PublicArgs<typeof authHandlers.createUser>) =>
      call<Result<typeof authHandlers.createUser>>("auth", "createUser", args),
    revokeUser: (args: PublicArgs<typeof authHandlers.revokeUser>) =>
      call<Result<typeof authHandlers.revokeUser>>("auth", "revokeUser", args),
    restoreUser: (args: PublicArgs<typeof authHandlers.restoreUser>) =>
      call<Result<typeof authHandlers.restoreUser>>("auth", "restoreUser", args),
  },
  onboarding: {
    listApplications: () =>
      call<Result<typeof onboardingHandlers.listApplications>>(
        "onboarding",
        "listApplications",
      ),
    createApplication: (
      args: PublicArgs<typeof onboardingHandlers.createApplication>,
    ) =>
      call<Result<typeof onboardingHandlers.createApplication>>(
        "onboarding",
        "createApplication",
        args,
      ),
    updateApplication: (
      args: PublicArgs<typeof onboardingHandlers.updateApplication>,
    ) =>
      call<Result<typeof onboardingHandlers.updateApplication>>(
        "onboarding",
        "updateApplication",
        args,
      ),
    saveWorkerNodes: (
      args: PublicArgs<typeof onboardingHandlers.saveWorkerNodes>,
    ) =>
      call<Result<typeof onboardingHandlers.saveWorkerNodes>>(
        "onboarding",
        "saveWorkerNodes",
        args,
      ),
    saveServices: (args: PublicArgs<typeof onboardingHandlers.saveServices>) =>
      call<Result<typeof onboardingHandlers.saveServices>>(
        "onboarding",
        "saveServices",
        args,
      ),
    getWorkerNodes: (args: PublicArgs<typeof onboardingHandlers.getWorkerNodes>) =>
      call<Result<typeof onboardingHandlers.getWorkerNodes>>(
        "onboarding",
        "getWorkerNodes",
        args,
      ),
    getServices: (args: PublicArgs<typeof onboardingHandlers.getServices>) =>
      call<Result<typeof onboardingHandlers.getServices>>(
        "onboarding",
        "getServices",
        args,
      ),
    listTenants: () =>
      call<Result<typeof onboardingHandlers.listTenants>>(
        "onboarding",
        "listTenants",
      ),
    addTenant: (args: PublicArgs<typeof onboardingHandlers.addTenant>) =>
      call<Result<typeof onboardingHandlers.addTenant>>(
        "onboarding",
        "addTenant",
        args,
      ),
    listNamespaces: () =>
      call<Result<typeof onboardingHandlers.listNamespaces>>(
        "onboarding",
        "listNamespaces",
      ),
    listAllServices: () =>
      call<Result<typeof onboardingHandlers.listAllServices>>(
        "onboarding",
        "listAllServices",
      ),
    listAllWorkerNodes: () =>
      call<Result<typeof onboardingHandlers.listAllWorkerNodes>>(
        "onboarding",
        "listAllWorkerNodes",
      ),
    dashboardStats: () =>
      call<Result<typeof onboardingHandlers.dashboardStats>>(
        "onboarding",
        "dashboardStats",
      ),
  },
};
