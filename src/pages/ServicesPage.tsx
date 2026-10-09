import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { format } from "date-fns";

type ServiceRow = {
  _id: string;
  namespace: string;
  serviceName: string;
  port: number;
  healthcheckUrl: string;
  nodeSelectors: string[];
  description: string;
  createdAt: number;
  applicationId: string;
  applicationName: string;
  tenant: string;
};

const columns: Array<DataTableColumn<ServiceRow>> = [
  {
    id: "serviceName",
    header: "Service Name",
    accessor: (row) => row.serviceName,
    cell: (row) => <span className="font-medium">{row.serviceName}</span>,
  },
  {
    id: "namespace",
    header: "Namespace",
    accessor: (row) => row.namespace,
    cell: (row) => (
      <span className="font-mono text-[13px]">{row.namespace}</span>
    ),
  },
  {
    id: "nodeSelectors",
    header: "Node Selector",
    accessor: (row) => row.nodeSelectors.join(", "),
    cell: (row) =>
      row.nodeSelectors.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {row.nodeSelectors.map((selector) => (
            <Badge key={selector} variant="outline" className="font-mono">
              {selector}
            </Badge>
          ))}
        </span>
      ),
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
  },
  {
    id: "application",
    header: "Application",
    accessor: (row) => row.applicationName,
    secondary: true,
  },
  {
    id: "port",
    header: "Port",
    accessor: (row) => row.port,
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
 * Service — every saved service with the columns the platform team needs at a
 * glance: name, namespace, node selectors, and tenant (plus application,
 * port, and created date on wider screens).
 */
export default function ServicesPage() {
  const services = useActionList(
    useAuthedAction(api.onboarding.listAllServices),
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Service
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Every service saved during onboarding, with its namespace, node
          selectors, and tenant.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={services.rows}
        rowKey={(row) => row._id}
        isLoading={services.isLoading}
        searchPlaceholder="Search services…"
        emptyMessage="No services yet — save them in stage 3 of the onboarding form."
        initialSort={{ id: "created", direction: "desc" }}
      />
      {services.error && (
        <p className="text-destructive mt-2 text-sm">{services.error}</p>
      )}
    </div>
  );
}
