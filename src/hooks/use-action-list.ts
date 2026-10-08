import { useEffect, useState } from "react";

export type ListState<T> = {
  /** Always an array — empty while loading or after a failure. */
  rows: T[];
  isLoading: boolean;
  error: string | null;
  /** Re-runs the action (e.g. after Add New Tenant). */
  reload: () => void;
};

/**
 * Runs a no-argument Convex action once on mount and re-runs it on `reload`.
 * `useAction` returns a stable function, so listing pages can pass the action
 * directly: `const apps = useActionList(useAction(api.onboarding.listApplications))`.
 *
 * State updates live in the promise callbacks (and `reload`, an event
 * handler), never synchronously in the effect body.
 */
export function useActionList<T>(
  fetcher: () => Promise<T[]>,
): ListState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Could not load data.",
          );
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, version]);

  return {
    rows,
    isLoading,
    error,
    reload: () => {
      setIsLoading(true);
      setVersion((current) => current + 1);
    },
  };
}
