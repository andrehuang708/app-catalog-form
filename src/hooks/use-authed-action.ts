import { useAuth } from "@/hooks/use-auth";
import type { FunctionReference, OptionalRestArgs } from "convex/server";
import { useAction, type ReactAction } from "convex/react";
import { useCallback } from "react";

/**
 * A gated action's arguments with the transport detail stripped off:
 * `sessionToken` is supplied by the hook, never by the page that calls it.
 */
type WithoutSessionToken<A extends FunctionReference<"action">> = Omit<
  A,
  "_args"
> & {
  _args: Omit<A["_args"], "sessionToken">;
};

/**
 * `useAction` for the Postgres-backed API in src/convex/onboarding.ts.
 *
 * Every one of those actions resolves its caller against the `sessions`
 * table, so each request carries the bearer token. Pages should not have to
 * thread that through their own code, so this wrapper injects it: call
 * `useAuthedAction(api.onboarding.listTenants)` and pass only the arguments
 * the action actually documents.
 */
export function useAuthedAction<A extends FunctionReference<"action">>(
  reference: A,
): ReactAction<WithoutSessionToken<A>> {
  const run = useAction(reference);
  const { sessionToken } = useAuth();

  // `run` accepts its own argument tuple; through this generic the tuple is
  // unresolved, so call it through the one shape this wrapper always builds.
  const invoke = run as unknown as (
    payload: Record<string, unknown>,
  ) => Promise<unknown>;

  return useCallback(
    (...args: OptionalRestArgs<WithoutSessionToken<A>>) => {
      const [arg] = args;
      return invoke({
        ...(arg as Record<string, unknown> | undefined),
        // An empty token fails the SQL session lookup, so the action rejects
        // instead of running unauthenticated.
        sessionToken: sessionToken ?? "",
      });
    },
    [invoke, sessionToken],
  ) as unknown as ReactAction<WithoutSessionToken<A>>;
}
