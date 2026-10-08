import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { useAction } from "convex/react";
import { Boxes } from "lucide-react";

type NamespaceRow = {
  namespace: string;
  tenant: string;
  services: number;
  applications: string[];
};

const columns: Array<DataTableColumn<NamespaceRow>> = [
  {
    id: "namespace",
    header: "Namespace",
    accessor: (row) => row.namespace,
    cell: (row) => <span className="font-mono text-[13px]">{row.namespace}</span>,
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
    id: "services",
    header: "Services",
    accessor: (row) => row.services,
    cell: (row) => `${row.services} service${row.services === 1 ? "" : "s"}`,
  },
  {
    id: "applications",
    header: "Applications",
    accessor: (row) => row.applications.join(", "),
    cell: (row) => row.applications.join(", "),
    secondary: true,
  },
];

/**
 * Namespace — every namespace in use across the platform. Namespaces are
 * tenant-scoped and shared: the service column shows how many services live
 * in each one.
 */
export default function NamespacesPage() {
  const namespaces = useActionList(useAction(api.onboarding.listNamespaces));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Namespace
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Distinct namespaces across all applications — any number of services
          may share one.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={namespaces.rows}
        rowKey={(row) => row.namespace}
        isLoading={namespaces.isLoading}
        searchPlaceholder="Search namespaces…"
        emptyMessage="No namespaces yet — they appear once services are saved."
        initialSort={{ id: "namespace", direction: "asc" }}
        toolbar={
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Boxes className="size-3.5" />
            {namespaces.rows.length} in use
          </span>
        }
      />
      {namespaces.error && (
        <p className="text-destructive mt-2 text-sm">{namespaces.error}</p>
      )}
    </div>
  );
}
