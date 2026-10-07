import { describe, expect, it } from "bun:test";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { renderToString } from "react-dom/server";
import { StageThreeForm } from "../src/components/onboarding/StageThreeForm";
import { StageTwoForm } from "../src/components/onboarding/StageTwoForm";
import type {
  ApplicationRow,
  ServiceRow,
  WorkerNodeRow,
} from "../src/components/onboarding/types";

const client = new ConvexReactClient("https://example.convex.cloud");

const application: ApplicationRow = {
  _id: "k57abc" as ApplicationRow["_id"],
  applicationName: "billing-api",
  repositoryName: "platform/billing-api",
  tenant: "fund",
  totalWorkerNodes: 2,
  submittedByName: "Ada",
  createdAt: 0,
  nodeCount: 2,
  serviceCount: 0,
};

const savedNodes: WorkerNodeRow[] = [
  {
    _id: "n1" as WorkerNodeRow["_id"],
    ipAddress: "10.0.0.1",
    hostname: "worker-01",
    joinedCluster: true,
  },
  {
    _id: "n2" as WorkerNodeRow["_id"],
    ipAddress: "10.0.0.2",
    hostname: "worker-02",
    joinedCluster: false,
  },
];

const savedService: ServiceRow = {
  _id: "s1" as ServiceRow["_id"],
  namespace: "billing-api-fund-core",
  serviceName: "billing-api",
  port: 8080,
  healthcheckUrl: "https://billing.internal/healthz",
  nodeSelectors: ["worker-01"],
  description: "Public API for billing.",
  createdAt: 0,
};

describe("stage 2 — worker nodes form", () => {
  const html = renderToString(
    <ConvexAuthProvider client={client}>
      <StageTwoForm
        application={application}
        initialNodes={savedNodes}
        onBack={() => {}}
        onSaved={() => {}}
      />
    </ConvexAuthProvider>,
  );

  it("shows the stage heading and the row counter", () => {
    expect(html).toContain("Worker nodes");
    expect(html).toContain("2 of 2 worker nodes");
    expect(html).toContain("Save and continue");
    expect(html).toContain("Add node");
    expect(html).toContain("Back to application details");
  });

  it("renders one row per saved node with IP, hostname, and the join check", () => {
    expect(html).toContain("Node 1");
    expect(html).toContain("Node 2");
    expect(html).toContain('value="10.0.0.1"');
    expect(html).toContain('value="10.0.0.2"');
    expect(html).toContain('value="worker-01"');
    expect(html).toContain('value="worker-02"');
    expect(html).toContain("IP address");
    expect(html).toContain("Hostname");
    expect(html).toContain("Joined cluster");
  });

  it("pre-checks the joined-cluster box only for nodes already in the cluster", () => {
    // Radix exposes the state once per checkbox via aria-checked on its button.
    const checkedCount = (html.match(/aria-checked="true"/g) ?? []).length;
    const uncheckedCount = (html.match(/aria-checked="false"/g) ?? []).length;
    expect(checkedCount).toBe(1);
    expect(uncheckedCount).toBe(1);
  });
});

describe("stage 3 — services form", () => {
  it("renders every service field and the namespace preview", () => {
    const html = renderToString(
      <ConvexAuthProvider client={client}>
        <StageThreeForm
          application={application}
          nodes={savedNodes}
          savedServices={[]}
          onSaved={() => {}}
        />
      </ConvexAuthProvider>,
    );

    expect(html).toContain("Services");
    expect(html).toContain("Namespace suffix");
    expect(html).toContain("Service name");
    expect(html).toContain("Port");
    expect(html).toContain("Health check URL");
    expect(html).toContain("Node selector");
    expect(html).toContain("Description");
    expect(html).toContain("Add to list");
    expect(html).toContain("Save services");
    expect(html).toContain("billing-api-fund-");
    expect(html).toContain("No services yet");
  });

  it("offers the stage 2 nodes as node selector options", () => {
    const html = renderToString(
      <ConvexAuthProvider client={client}>
        <StageThreeForm
          application={application}
          nodes={savedNodes}
          savedServices={[]}
          onSaved={() => {}}
        />
      </ConvexAuthProvider>,
    );
    expect(html).toContain("worker-01");
    expect(html).toContain("worker-02");
    expect(html).toContain("10.0.0.1");
    expect(html).toContain("10.0.0.2");
  });

  it("lists saved services and hides the back link once they lock the nodes", () => {
    const html = renderToString(
      <ConvexAuthProvider client={client}>
        <StageThreeForm
          application={{ ...application, serviceCount: 1 }}
          nodes={savedNodes}
          savedServices={[savedService]}
          onSaved={() => {}}
        />
      </ConvexAuthProvider>,
    );
    expect(html).toContain("1 service already saved");
    expect(html).toContain("1 in the list");
    expect(html).toContain("billing-api-fund-core");
    expect(html).toContain("https://billing.internal/healthz");
    expect(html).toContain("Saved · stage 3");
    expect(html).not.toContain("Back to worker nodes");
  });
});
