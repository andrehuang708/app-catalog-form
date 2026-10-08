import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { format } from "date-fns";

type WorkerNodeRow = {
  _id: string;
  ipAddress: string;
  hostname: string;
  joinedCluster: boolean;
  createdAt: number;
  applicationId: string;
  applicationName: string;
  tenant: string;
};

const columns: Array<DataTableColumn<WorkerNodeRow>> = [
  {
    id: "hostname",
    header: "Hostname",
    accessor: (row) => row.hostname,
    cell: (row) => <span className="font-medium">{row.hostname}</span>,
  },
  {
    id: "ip",
    header: "IP Address",
    accessor: (row) => row.ipAddress,
    cell: (row) => (
      <span className="font-mono text-[13px]">{row.ipAddress}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessor: (row) => (row.joinedCluster ? "Joined" : "Pending"),
    cell: (row) => (
      <Badge variant={row.joinedCluster ? "default" : "secondary"}>
        {row.joinedCluster ? "Joined" : "Pending"}
      </Badge>
    ),
  },
  {
    id: "application",
    header: "Application",
    accessor: (row) => row.applicationName,
  },
  {
    id: "tenant",
    header: "Tenant",
    accessor: (row) => row.tenant,
    cell: (row) => (
      <Badge variant="outline" className="uppercase">
        {tenantLabel(row.tenant)}
      </Badge>
    ),
    secondary: true,
  },
  {
    id: "created",
    header: "Created",
    accessor: (row) => row.createdAt,
    cell: (row) => format(row.createdAt, "d MMM yyyy, HH:mm"),
    secondary: true,
  },
];

/**
 * Worker Nodes — every node reserved during onboarding with its full detail:
 * hostname, IP address, cluster-join status, owning application, and tenant.
 */
export default function WorkerNodesPage() {
  const nodes = useActionList(
    useAuthedAction(api.onboarding.listAllWorkerNodes),
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Worker Nodes
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Every worker node across applications — status, IP address, and the
          application it belongs to.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={nodes.rows}
        rowKey={(row) => row._id}
        isLoading={nodes.isLoading}
        searchPlaceholder="Search worker nodes…"
        emptyMessage="No worker nodes yet — save them in stage 2 of the onboarding form."
        initialSort={{ id: "created", direction: "desc" }}
      />
      {nodes.error && (
        <p className="text-destructive mt-2 text-sm">{nodes.error}</p>
      )}
    </div>
  );
}
