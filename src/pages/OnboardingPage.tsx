import { ApplicationList } from "@/components/onboarding/ApplicationList";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import type {
  ApplicationRow,
  Stage,
} from "@/components/onboarding/types";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "convex/react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

function parseStage(value: string | null): Stage | undefined {
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return undefined;
}

/**
 * Request Onboarding — the three-stage form on the left, the saved list on
 * the right. `?application=<id>&stage=<1|2|3>` opens a specific application
 * straight at the stage the Application page’s Edit action picked.
 */
export default function OnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const applicationId = searchParams.get("application");
  const requestedStage = parseStage(searchParams.get("stage"));

  const applications = useActionList(
    useAction(api.onboarding.listApplications),
  );
  // The freshest copy of the selected application (straight from a save);
  // the URL plus the loaded list resolve the selection otherwise.
  const [override, setOverride] = useState<ApplicationRow | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const selected = useMemo<ApplicationRow | null>(() => {
    if (override && override._id === applicationId) return override;
    if (!applicationId) return null;
    return applications.rows.find((row) => row._id === applicationId) ?? null;
  }, [override, applicationId, applications.rows]);

  const applySelection = (application: ApplicationRow | null) => {
    setOverride(application);
    setSearchParams(
      application ? { application: application._id } : {},
      { replace: true },
    );
  };

  // Every stage save refreshes the list — the Postgres-backed actions are
  // one-shot, so the page bumps a token instead of streaming updates.
  const handleApplicationChange = (application: ApplicationRow | null) => {
    applySelection(application);
    setRefreshToken((token) => token + 1);
  };

  const waitingForApplication =
    applicationId !== null &&
    selected === null &&
    applications.isLoading;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Request Onboarding
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-6">
          Three stages — application details, worker nodes, then services.
          Every stage is saved as you go and listed here for the whole
          platform team.
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <section className="border-border/70 border-b pb-8 lg:border-r lg:border-b-0 lg:pb-0 lg:pr-10">
          {waitingForApplication ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <OnboardingWizard
              key={selected?._id ?? "new"}
              application={selected}
              requestedStage={requestedStage}
              onApplicationChange={handleApplicationChange}
            />
          )}
        </section>

        <section className="pt-8 lg:pl-10 lg:pt-0">
          <ApplicationList
            selectedId={selected?._id ?? null}
            onSelect={applySelection}
            refreshToken={refreshToken}
          />
        </section>
      </div>
    </div>
  );
}
