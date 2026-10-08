import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { tenantLabel } from "@/lib/onboarding-schema";
import { cn } from "@/lib/utils";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { statusOf, type ApplicationRow } from "./types";

type Props = {
  selectedId: string | null;
  onSelect: (application: ApplicationRow | null) => void;
  /** Bumped by the dashboard after every save so the list refetches. */
  refreshToken: number;
};

/**
 * Saved applications from Postgres — click a row to resume its onboarding at
 * the first incomplete stage. Rows use hairline dividers instead of a table so
 * long repository names stay readable in the narrow column.
 */
export function ApplicationList({ selectedId, onSelect, refreshToken }: Props) {
  const listApplications = useAuthedAction(api.onboarding.listApplications);
  const [applications, setApplications] = useState<
    ApplicationRow[] | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    listApplications()
      .then((rows) => {
        if (!cancelled) setApplications(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setApplications([]);
        toast.error("Could not load applications", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [listApplications, refreshToken]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Saved applications</h2>
        <div className="flex items-center gap-3">
          {selectedId !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 px-2"
              onClick={() => onSelect(null)}
            >
              <Plus className="size-3.5" />
              New
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {applications === undefined
              ? "Loading…"
              : `${applications.length} saved`}
          </p>
        </div>
      </div>

      {applications === undefined ? (
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-full max-w-sm" />
              <Skeleton className="h-3 w-full max-w-xs" />
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="border-border/70 mt-6 rounded-md border px-6 py-10 text-center">
          <p className="text-sm font-medium">Nothing saved yet</p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-6">
            Applications appear here as soon as someone on the platform team
            saves stage 1, newest first.
          </p>
        </div>
      ) : (
        <ul className="border-border/70 mt-6 border-t">
          {applications.map((application) => {
            const status = statusOf(application);
            return (
              <li
                key={application._id}
                className="border-border/70 border-b last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => onSelect(application)}
                  className={cn(
                    "w-full px-1 py-5 text-left transition-colors hover:bg-muted/40",
                    selectedId === application._id && "bg-muted/50",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-medium tracking-tight">
                      {application.applicationName}
                    </p>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        status.complete
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="border-border/70 rounded border px-1.5 py-0.5">
                      {tenantLabel(application.tenant)}
                    </span>
                    <span>
                      {application.nodeCount}/{application.totalWorkerNodes}{" "}
                      nodes
                    </span>
                    <span>
                      {application.serviceCount} service
                      {application.serviceCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      {format(application.createdAt, "d MMM yyyy, HH:mm")}
                    </span>
                  </div>

                  <p className="text-muted-foreground mt-2 truncate font-mono text-[13px]">
                    {application.repositoryName}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    by {application.submittedByName}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
