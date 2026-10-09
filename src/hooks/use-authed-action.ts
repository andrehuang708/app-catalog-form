/**
 * A passthrough that keeps the pages' call shape unchanged.
 *
 * When the backend ran on Convex, this hook wrapped `useAction` and injected
 * the bearer token into every call. The token now travels on the
 * Authorization header, added by the fetch client in src/api — so there is
 * nothing left to inject. Pages keep writing
 * `useAuthedAction(api.onboarding.saveServices)` and pass only the
 * arguments the handler documents.
 */
export function useAuthedAction<F>(fn: F): F {
  return fn;
}
