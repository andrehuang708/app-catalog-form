import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";

function Detail({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-5 break-words">{children}</p>
    </div>
  );
}

/**
 * Saved submissions for the service catalog — the second half of version 1.
 * Rows use hairline dividers instead of a table so long values (repository,
 * health check URL) stay readable in the narrow column.
 */
export function SubmissionList() {
  const submissions = useQuery(api.catalog.list);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Saved submissions</h2>
        <p className="text-xs text-muted-foreground">
          {submissions === undefined
            ? "Loading…"
            : `${submissions.length} in the catalog`}
        </p>
      </div>

      {submissions === undefined ? (
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-full max-w-sm" />
              <Skeleton className="h-3 w-full max-w-xs" />
            </div>
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="mt-6 rounded-md border border-border/70 px-6 py-10 text-center">
          <p className="text-sm font-medium">No submissions yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
            Every intake filed from the form appears here, newest first, with
            the details exactly as they were submitted.
          </p>
        </div>
      ) : (
        <ul className="mt-6 border-t border-border/70">
          {submissions.map((submission) => (
            <li
              key={submission._id}
              className="border-b border-border/70 py-6 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium tracking-tight">
                  {submission.applicationName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {submission.submittedByName} ·{" "}
                  {format(submission.createdAt, "d MMM yyyy, HH:mm")}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Detail label="Namespace">{submission.namespace}</Detail>
                <Detail label="Worker nodes">
                  {submission.totalRequestedWorkerNodes}
                </Detail>
                <Detail label="Port network">{submission.portNetwork}</Detail>

                <Detail label="Repository" className="col-span-2 sm:col-span-3">
                  <span className="font-mono text-[13px]">
                    {submission.repositoryName}
                  </span>
                </Detail>

                <Detail
                  label="Health check"
                  className="col-span-2 sm:col-span-3"
                >
                  <a
                    href={submission.healthcheckUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground inline-flex items-start gap-1 underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    <span className="break-all">
                      {submission.healthcheckUrl}
                    </span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
                  </a>
                </Detail>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
