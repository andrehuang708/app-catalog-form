import { describe, expect, it } from "bun:test";
import {
  buildVisualGraph,
  buildVisualGraphRows,
  groupVisualGraphs,
} from "../src/lib/visual-graph";

const services = [
  {
    _id: "service-1",
    applicationId: "app-1",
    applicationName: "payments-api",
    tenant: "fund",
    namespace: "payments-fund-core",
    serviceName: "payments-api",
    port: 8080,
    nodeSelectors: ["worker-01", "worker-02"],
  },
];

const nodes = [
  {
    _id: "node-1",
    applicationId: "app-1",
    hostname: "worker-01",
    ipAddress: "10.0.0.1",
    joinedCluster: true,
  },
  {
    _id: "node-2",
    applicationId: "app-1",
    hostname: "worker-02",
    ipAddress: "10.0.0.2",
    joinedCluster: false,
  },
];

describe("visual graph mapping", () => {
  it("creates deduplicated graph nodes and direct relationship edges", () => {
    const rows = buildVisualGraphRows([
      ...services,
      { ...services[0], _id: "service-2", serviceName: "billing-worker" },
    ], nodes);
    const graph = buildVisualGraph(rows);
    const kindCount = (kind: string) => graph.nodes.filter((node) => node.kind === kind).length;
    expect(kindCount("tenant")).toBe(1);
    expect(kindCount("namespace")).toBe(1);
    expect(kindCount("application")).toBe(1);
    expect(kindCount("service")).toBe(2);
    expect(kindCount("worker")).toBe(2);
    expect(graph.edges).toHaveLength(8);
    expect(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it("makes separate visual graphs grouped by tenant, namespace, or application", () => {
    const rows = buildVisualGraphRows([
      ...services,
      { ...services[0], _id: "service-2", namespace: "payments-fund-admin" },
      { ...services[0], _id: "service-3", tenant: "cs", namespace: "billing-cs-api", applicationId: "app-2", applicationName: "billing-api" },
    ], nodes);
    expect(groupVisualGraphs(rows, "tenant").map(({ label }) => label)).toEqual(["CS", "FUND"]);
    expect(groupVisualGraphs(rows, "namespace").map(({ label }) => label)).toEqual([
      "CS · billing-cs-api",
      "FUND · payments-fund-admin",
      "FUND · payments-fund-core",
    ]);
    expect(groupVisualGraphs(rows, "application").map(({ label }) => label)).toEqual([
      "CS · billing-api",
      "FUND · payments-api",
    ]);
    expect(groupVisualGraphs(rows, "all")).toHaveLength(1);
  });
  it("builds paths in tenant → namespace → application → service → node order", () => {
    const [row] = buildVisualGraphRows(services, nodes);
    expect(row).toMatchObject({
      tenant: "fund",
      namespace: "payments-fund-core",
      applicationName: "payments-api",
      serviceName: "payments-api",
      port: 8080,
    });
    expect(row.workerNodes.map(({ node }) => node?._id)).toEqual([
      "node-1",
      "node-2",
    ]);
  });

  it("does not link a same-named node from a different application", () => {
    const [row] = buildVisualGraphRows(services, [
      { ...nodes[0], applicationId: "another-app" },
    ]);
    expect(row.workerNodes[0].node).toBeUndefined();
    expect(row.workerNodes[0].hostname).toBe("worker-01");
  });

  it("keeps a visible unresolved path when a selected node is absent", () => {
    const [row] = buildVisualGraphRows(services, []);
    expect(row.workerNodes).toEqual([
      { hostname: "worker-01", node: undefined },
      { hostname: "worker-02", node: undefined },
    ]);
  });

});
