import { api } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionList } from "@/hooks/use-action-list";
import { useAuthedAction } from "@/hooks/use-authed-action";
import {
  buildVisualGraphRows,
  groupVisualGraphs,
  type GraphGrouping,
  type GraphNodeKind,
  type VisualGraph,
  type VisualGraphNode,
} from "@/lib/visual-graph";
import {
  Boxes,
  Building2,
  HardDrive,
  Network,
  Search,
  Server,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

const stages: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Tenant", icon: Building2 },
  { label: "Namespace", icon: Boxes },
  { label: "Application", icon: Server },
  { label: "Service", icon: Network },
  { label: "Worker node", icon: HardDrive },
];

const nodeIcons: Record<GraphNodeKind, LucideIcon> = {
  tenant: Building2,
  namespace: Boxes,
  application: Server,
  service: Network,
  worker: HardDrive,
  missing: HardDrive,
};

const groupingOptions: Array<{ value: GraphGrouping; label: string }> = [
  { value: "all", label: "All" },
  { value: "tenant", label: "Tenant" },
  { value: "namespace", label: "Namespace" },
  { value: "application", label: "Application" },
];

function edgePath(source: VisualGraphNode, target: VisualGraphNode) {
  const startX = source.x + 194;
  const startY = source.y + 32;
  const endX = target.x;
  const endY = target.y + 32;
  const controlX = startX + (endX - startX) / 2;
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
}

function GraphCanvas({ graph }: { graph: VisualGraph }) {
  const markerId = `graph-arrow-${useId().replace(/:/g, "")}`;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  return (
    <div className="graph-scroll">
      <div
        className="graph-canvas"
        style={{ width: graph.width, height: graph.height }}
        role="img"
        aria-label={`${graph.nodes.length} graph nodes connected by ${graph.edges.length} relationships`}
      >
        <svg
          className="graph-edges"
          width={graph.width}
          height={graph.height}
          aria-hidden="true"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="graph-arrow" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            if (!source || !target) return null;
            return (
              <path
                key={edge.id}
                d={edgePath(source, target)}
                className="graph-connection"
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
        </svg>
        {graph.nodes.map((node) => {
          const Icon = nodeIcons[node.kind];
          return (
            <div
              key={node.id}
              className={`graph-visual-node graph-visual-node-${node.kind}`}
              style={{ left: node.x, top: node.y }}
              title={node.detail ? `${node.label} · ${node.detail}` : node.label}
            >
              <span className="graph-visual-icon"><Icon className="size-4" /></span>
              <span className="graph-visual-copy">
                <span className="graph-visual-label">{node.label}</span>
                {node.detail && <span className="graph-visual-detail">{node.detail}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VisualGraphPage() {
  const services = useActionList(useAuthedAction(api.onboarding.listAllServices));
  const nodes = useActionList(useAuthedAction(api.onboarding.listAllWorkerNodes));
  const [query, setQuery] = useState("");
  const [grouping, setGrouping] = useState<GraphGrouping>("all");

  const rows = useMemo(
    () => buildVisualGraphRows(services.rows, nodes.rows),
    [services.rows, nodes.rows],
  );
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.tenant, row.namespace, row.applicationName, row.serviceName,
        ...row.workerNodes.map((item) => item.hostname)]
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [rows, query]);
  const groups = useMemo(
    () => groupVisualGraphs(filteredRows, grouping),
    [filteredRows, grouping],
  );

  const isLoading = services.isLoading || nodes.isLoading;
  const error = services.error ?? nodes.error;
  const stats = [
    ["Tenants", new Set(rows.map((row) => row.tenant)).size],
    ["Namespaces", new Set(rows.map((row) => JSON.stringify([row.tenant, row.namespace]))).size],
    ["Applications", new Set(rows.map((row) => row.applicationId)).size],
    ["Services", rows.length],
  ] as const;
  const graphNodeCount = groups.reduce((total, group) => total + group.graph.nodes.length, 0);
  const graphEdgeCount = groups.reduce((total, group) => total + group.graph.edges.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <Network className="size-4" />
          <span className="text-xs font-medium uppercase tracking-[0.16em]">Infrastructure map</span>
        </div>
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Visual Graph</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Explore how tenants, namespaces, applications, services, and worker nodes connect.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {isLoading ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {stages.map(({ label, icon: Icon }, index) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" />{label}</span>
              {index < stages.length - 1 && <span aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter graph…"
            aria-label="Filter graph"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground text-sm">Group graph by</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Group graph by">
          {groupingOptions.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={grouping === value ? "default" : "outline"}
              aria-pressed={grouping === value}
              onClick={() => setGrouping(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="graph-empty">Loading infrastructure graph…</div>
        ) : error ? (
          <div className="graph-empty text-destructive">Could not load graph: {error}</div>
        ) : groups.length === 0 ? (
          <div className="graph-empty">
            {rows.length === 0
              ? "No saved services yet. The graph appears after onboarding services and worker nodes are saved."
              : "No relationships match your filter."}
          </div>
        ) : (
          groups.map((group) => (
            <section className="graph-visual-group" key={group.key}>
              <header className="graph-visual-group-heading">
                <div className="flex min-w-0 items-center gap-2">
                  {grouping !== "all" && <Network className="size-4" />}
                  <h3 className="truncate text-sm font-semibold">{group.label}</h3>
                </div>
                <span className="text-muted-foreground text-xs">
                  {group.graph.nodes.length} nodes · {group.graph.edges.length} connections
                </span>
              </header>
              <GraphCanvas graph={group.graph} />
            </section>
          ))
        )}
      </div>

      {!isLoading && !error && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{graphNodeCount} graph nodes</Badge>
          <Badge variant="outline">{graphEdgeCount} connections</Badge>
          <span>Each connection shows a direct relationship; shared entities appear once within each graph.</span>
        </div>
      )}
    </div>
  );
}
