import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { Check, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StageOneForm } from "./StageOneForm";
import { StageThreeForm } from "./StageThreeForm";
import { StageTwoForm } from "./StageTwoForm";
import type {
  ApplicationRow,
  ServiceRow,
  Stage,
  WorkerNodeRow,
} from "./types";

const STEPS: Array<{ stage: Stage; label: string }> = [
  { stage: 1, label: "Application details" },
  { stage: 2, label: "Worker nodes" },
  { stage: 3, label: "Services" },
];

type Props = {
  application: ApplicationRow | null;
  onApplicationChange: (application: ApplicationRow | null) => void;
};

/**
 * The stage a resumed application should open at: stage 1 for a new
 * application, stage 2 until the node list matches stage 1, then stage 3.
 */
function initialStageFor(application: ApplicationRow | null): Stage {
  if (!application) return 1;
  if (application.nodeCount !== application.totalWorkerNodes) return 2;
  return 3;
}

function StageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/**
 * Onboarding runs in three stages — application details, worker nodes, then
 * services. The component is keyed by application id (or "new") so switching
 * applications resets the flow to the right stage. Node and service rows are
 * fetched from Postgres on mount (and re-fetched whenever the application
 * changes) instead of streaming through Convex subscriptions.
 */
export function OnboardingWizard({ application, onApplicationChange }: Props) {
  const [stage, setStage] = useState<Stage>(() =>
    initialStageFor(application),
  );
  const [maxStage, setMaxStage] = useState<Stage>(() =>
    initialStageFor(application),
  );

  const fetchNodes = useAction(api.onboarding.getWorkerNodes);
  const fetchServices = useAction(api.onboarding.getServices);
  const [nodes, setNodes] = useState<WorkerNodeRow[] | undefined>(undefined);
  const [services, setServices] = useState<ServiceRow[] | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!application) return;
    let cancelled = false;
    fetchNodes({ applicationId: application._id })
      .then((rows) => {
        if (!cancelled) setNodes(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNodes([]);
        toast.error("Could not load the worker nodes", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      });
    fetchServices({ applicationId: application._id })
      .then((rows) => {
        if (!cancelled) setServices(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setServices([]);
        toast.error("Could not load the services", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [application, fetchNodes, fetchServices]);

  const serviceCount = application?.serviceCount ?? 0;
  const servicesLocked = serviceCount > 0;
  const nodesOk =
    application !== null &&
    application.nodeCount === application.totalWorkerNodes &&
    application.nodeCount > 0;
  const done: Record<Stage, boolean> = {
    1: application !== null,
    2: nodesOk,
    3: servicesLocked,
  };

  const canVisit = (target: Stage) =>
    target <= maxStage && !(target === 2 && servicesLocked);

  const handleStageOneSaved = (row: ApplicationRow) => {
    onApplicationChange(row);
    setStage(2);
    setMaxStage((current) => (current < 2 ? 2 : current));
  };

  const handleStageTwoSaved = (savedNodes: WorkerNodeRow[]) => {
    setNodes(savedNodes);
    if (application)
      onApplicationChange({
        ...application,
        nodeCount: savedNodes.length,
      });
    setStage(3);
    setMaxStage((current) => (current < 3 ? 3 : current));
  };

  const handleStageThreeSaved = (savedServices: ServiceRow[]) => {
    setServices(savedServices);
    if (application)
      onApplicationChange({
        ...application,
        serviceCount: savedServices.length,
      });
  };

  return (
    <div>
      <ol className="border-border/70 grid grid-cols-3 overflow-hidden rounded-md border">
        {STEPS.map((step) => {
          const active = step.stage === stage;
          const complete = done[step.stage];
          const locked = !canVisit(step.stage);
          return (
            <li
              key={step.stage}
              className="border-border/70 border-l first:border-l-0"
            >
              <button
                type="button"
                disabled={locked}
                onClick={() => setStage(step.stage)}
                aria-current={active ? "step" : undefined}
                title={
                  locked && step.stage === 2
                    ? "Worker nodes are locked once services are saved."
                    : undefined
                }
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                  active ? "bg-muted/60" : "hover:bg-muted/40",
                  locked &&
                    "cursor-not-allowed opacity-60 hover:bg-transparent",
                )}
              >
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] uppercase">
                  {`Stage ${step.stage}`}
                  {complete && <Check className="size-3 text-foreground" />}
                  {locked && !complete && <Lock className="size-3" />}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        {stage === 1 && (
          <StageOneForm
            application={application}
            onSaved={handleStageOneSaved}
          />
        )}

        {stage === 2 &&
          (application === null ? null : nodes === undefined ? (
            <StageSkeleton />
          ) : (
            <StageTwoForm
              application={application}
              initialNodes={nodes}
              onBack={() => setStage(1)}
              onSaved={handleStageTwoSaved}
            />
          ))}

        {stage === 3 &&
          (application === null ||
          nodes === undefined ||
          services === undefined ? (
            <StageSkeleton />
          ) : (
            <StageThreeForm
              application={application}
              nodes={nodes}
              savedServices={services}
              onBack={servicesLocked ? undefined : () => setStage(2)}
              onSaved={handleStageThreeSaved}
            />
          ))}
      </div>
    </div>
  );
}
