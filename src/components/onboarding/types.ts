import type { Tenant } from "@/lib/onboarding-schema";

/** The three onboarding stages. */
export type Stage = 1 | 2 | 3;

/**
 * One saved application, as returned by the Postgres-backed actions — ids are
 * plain strings (uuid) now that the data no longer lives in Convex tables.
 */
export type ApplicationRow = {
  _id: string;
  applicationName: string;
  repositoryName: string;
  tenant: Tenant;
  totalWorkerNodes: number;
  submittedByName: string;
  createdAt: number;
  nodeCount: number;
  serviceCount: number;
};

/** One worker node saved in stage 2. */
export type WorkerNodeRow = {
  _id: string;
  ipAddress: string;
  hostname: string;
  joinedCluster: boolean;
};

/** One service saved in stage 3. */
export type ServiceRow = {
  _id: string;
  namespace: string;
  serviceName: string;
  port: number;
  healthcheckUrl: string;
  nodeSelectors: string[];
  description: string;
  createdAt: number;
};

export type ApplicationStatus = { label: string; complete: boolean };

/** Where an application stands in the three-stage flow. */
export function statusOf(application: ApplicationRow): ApplicationStatus {
  if (application.serviceCount > 0)
    return { label: "Complete", complete: true };
  if (application.nodeCount === 0)
    return { label: "Worker nodes needed", complete: false };
  if (application.nodeCount !== application.totalWorkerNodes)
    return { label: "Worker nodes out of sync", complete: false };
  return { label: "Services needed", complete: false };
}
