export type GraphService = {
  _id: string;
  applicationId: string;
  applicationName: string;
  tenant: string;
  namespace: string;
  serviceName: string;
  port: number;
  nodeSelectors: string[];
};

export type GraphWorkerNode = {
  _id: string;
  applicationId: string;
  hostname: string;
  ipAddress: string;
  joinedCluster: boolean;
};

export type VisualGraphRow = {
  serviceId: string;
  applicationId: string;
  applicationName: string;
  tenant: string;
  namespace: string;
  serviceName: string;
  port: number;
  workerNodes: Array<{
    hostname: string;
    node: GraphWorkerNode | undefined;
  }>;
};

export type GraphGrouping = "all" | "tenant" | "namespace" | "application";
export type GraphNodeKind =
  | "tenant"
  | "namespace"
  | "application"
  | "service"
  | "worker"
  | "missing";

export type VisualGraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  detail?: string;
  x: number;
  y: number;
};

export type VisualGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type VisualGraph = {
  nodes: VisualGraphNode[];
  edges: VisualGraphEdge[];
  width: number;
  height: number;
};

export type VisualGraphGroup = {
  key: string;
  label: string;
  graph: VisualGraph;
};

const NODE_WIDTH = 194;
const COLUMN_GAP = 72;
const ROW_GAP = 98;
const GRAPH_PADDING = 24;
const GRAPH_WIDTH = GRAPH_PADDING * 2 + NODE_WIDTH * 5 + COLUMN_GAP * 4;

function keyOf(kind: string, ...parts: string[]): string {
  return JSON.stringify([kind, ...parts]);
}

/**
 * Make a deduplicated directed graph for the relationship:
 * Tenant → Namespace → Application → Service → selected Worker Node.
 */
export function buildVisualGraph(
  rows: VisualGraphRow[],
): VisualGraph {
  const nodeMap = new Map<string, Omit<VisualGraphNode, "x" | "y"> & { layer: number }>();
  const edgeMap = new Map<string, VisualGraphEdge>();

  const addNode = (
    id: string,
    layer: number,
    kind: GraphNodeKind,
    label: string,
    detail?: string,
  ) => {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, layer, kind, label, detail });
  };
  const addEdge = (source: string, target: string) => {
    const id = JSON.stringify([source, target]);
    if (!edgeMap.has(id)) edgeMap.set(id, { id, source, target });
  };

  for (const row of rows) {
    const tenantId = keyOf("tenant", row.tenant);
    const namespaceId = keyOf("namespace", row.tenant, row.namespace);
    const applicationId = keyOf("application", row.applicationId);
    const serviceId = keyOf("service", row.serviceId);

    addNode(tenantId, 0, "tenant", row.tenant.toUpperCase());
    addNode(namespaceId, 1, "namespace", row.namespace);
    addNode(applicationId, 2, "application", row.applicationName);
    addNode(serviceId, 3, "service", row.serviceName, `Port ${row.port}`);
    addEdge(tenantId, namespaceId);
    addEdge(namespaceId, applicationId);
    addEdge(applicationId, serviceId);

    for (const { hostname, node } of row.workerNodes) {
      const workerId = keyOf("worker", row.applicationId, hostname);
      addNode(
        workerId,
        4,
        node ? "worker" : "missing",
        hostname,
        node
          ? `${node.ipAddress} · ${node.joinedCluster ? "Joined" : "Pending"}`
          : "Node not found",
      );
      addEdge(serviceId, workerId);
    }
  }

  const edges = [...edgeMap.values()];
  const layers = Array.from({ length: 5 }, (_, layer) =>
    [...nodeMap.values()].filter((node) => node.layer === layer),
  );

  // Order downstream nodes around their upstream parents to keep the graph
  // readable and reduce edge crossings while preserving stable labels.
  for (let layer = 1; layer < layers.length; layer += 1) {
    const previous = new Map(layers[layer - 1].map((node, index) => [node.id, index]));
    const parentPositions = new Map<string, number[]>();
    for (const edge of edges) {
      const parentPosition = previous.get(edge.source);
      if (parentPosition === undefined) continue;
      const positions = parentPositions.get(edge.target) ?? [];
      positions.push(parentPosition);
      parentPositions.set(edge.target, positions);
    }
    layers[layer].sort((left, right) => {
      const leftParents = parentPositions.get(left.id) ?? [];
      const rightParents = parentPositions.get(right.id) ?? [];
      const leftCenter = leftParents.length
        ? leftParents.reduce((sum, value) => sum + value, 0) / leftParents.length
        : Number.MAX_SAFE_INTEGER;
      const rightCenter = rightParents.length
        ? rightParents.reduce((sum, value) => sum + value, 0) / rightParents.length
        : Number.MAX_SAFE_INTEGER;
      return leftCenter - rightCenter || left.label.localeCompare(right.label);
    });
  }

  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((layerNodes, layer) => {
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: GRAPH_PADDING + layer * (NODE_WIDTH + COLUMN_GAP),
        y: GRAPH_PADDING + index * ROW_GAP,
      });
    });
  });

  const nodes = [...nodeMap.values()].map((node) => ({
    id: node.id,
    kind: node.kind,
    label: node.label,
    detail: node.detail,
    ...positions.get(node.id)!,
  }));
  const maxNodesInLayer = Math.max(0, ...layers.map((layer) => layer.length));

  return {
    nodes,
    edges,
    width: GRAPH_WIDTH,
    height: GRAPH_PADDING * 2 + Math.max(1, maxNodesInLayer) * ROW_GAP,
  };
}

export function groupVisualGraphs(
  rows: VisualGraphRow[],
  grouping: GraphGrouping,
): VisualGraphGroup[] {
  const keyAndLabel = (row: VisualGraphRow): [string, string] => {
    if (grouping === "tenant") return [row.tenant, row.tenant.toUpperCase()];
    if (grouping === "namespace") {
      const key = keyOf("namespace-group", row.tenant, row.namespace);
      return [key, `${row.tenant.toUpperCase()} · ${row.namespace}`];
    }
    if (grouping === "application") {
      return [row.applicationId, `${row.tenant.toUpperCase()} · ${row.applicationName}`];
    }
    return ["all", "All relationships"];
  };

  const groups = new Map<string, { label: string; rows: VisualGraphRow[] }>();
  for (const row of rows) {
    const [key, label] = keyAndLabel(row);
    const group = groups.get(key) ?? { label, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .sort(([, left], [, right]) => left.label.localeCompare(right.label))
    .map(([key, group]) => ({
      key,
      label: group.label,
      graph: buildVisualGraph(group.rows),
    }));
}

/** Join service node selectors to actual nodes without crossing applications. */
export function buildVisualGraphRows(
  services: GraphService[],
  nodes: GraphWorkerNode[],
): VisualGraphRow[] {
  const nodesByApplicationAndHostname = new Map<string, GraphWorkerNode>();
  for (const node of nodes) {
    nodesByApplicationAndHostname.set(
      keyOf("worker", node.applicationId, node.hostname),
      node,
    );
  }

  return services.map((service) => ({
    serviceId: service._id,
    applicationId: service.applicationId,
    applicationName: service.applicationName,
    tenant: service.tenant,
    namespace: service.namespace,
    serviceName: service.serviceName,
    port: service.port,
    workerNodes: service.nodeSelectors.map((hostname) => ({
      hostname,
      node: nodesByApplicationAndHostname.get(
        keyOf("worker", service.applicationId, hostname),
      ),
    })),
  }));
}
