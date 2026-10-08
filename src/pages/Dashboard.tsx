import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { statusOf, type ApplicationRow } from "@/components/onboarding/types";
import { useAction } from "convex/react";
import { format } from "date-fns";
import { Boxes, Building2, Server } from "lucide-react";
import { useEffect, useState } from "react";

type Stats = {
  totalTenants: number;
  totalNamespaces: number;
  totalServices: number;
  totalApplications: number;
};

const SUMMARY_CARDS: Array<{
  key: keyof Stats;
  label: string;
  icon: typeof Building2;
}> = [
  { key: "totalTenants", label: "Total Tenant", icon: Building2 },
  { key: "totalNamespaces", label: "Total Namespace", icon: Boxes },
  { key: "totalServices", label: "Total Service", icon: Server },
];

const recentColumns: Array<DataTableColumn<ApplicationRow>> = [
  {
    id: "application",
    header: "Application",
    accessor: (row) => row.applicationName,
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.applicationName}</span>
        <span className="text-muted-foreground text-xs">
          {row.repositoryName}
        </span>
      </div>
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
    id: "status",
    header: "Stage",
    accessor: (row) => statusOf(row).label,
    cell: (row) => {
      const status = statusOf(row);
      return (
        <Badge variant={status.complete ? "default" : "secondary"}>
          {status.label}
        </Badge>
      );
    },
  },
  {
    id: "nodes",
    header: "Nodes",
    accessor: (row) => row.nodeCount,
    cell: (row) => `${row.nodeCount}/${row.totalWorkerNodes}`,
    secondary: true,
  },
  {
    id: "services",
    header: "Services",
    accessor: (row) => row.serviceCount,
    secondary: true,
  },
  {
    id: "created",
    header: "Onboarded",
    accessor: (row) => row.createdAt,
    cell: (row) => format(row.createdAt, "d MMM yyyy, HH:mm"),
    secondary: true,
  },
];

/**
 * Home — the dashboard the login page lands on: three counters across the
 * infrastructure (tenants, namespaces, services) and, beneath them, one table
 * of the most recent onboarding runs.
 */
export default function Dashboard() {
  const fetchStats = useAction(api.onboarding.dashboardStats);
  const applications = useActionList(
    useAction(api.onboarding.listApplications),
  );
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStats({})
      .then((value) => {
        if (!cancelled) setStats(value);
      })
      .catch(() => {
        /* cards fall back to “—” below */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchStats]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Infrastructure dashboard
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Live counters across the platform and the latest application
          onboarding runs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                  {card.label}
                </CardTitle>
                <card.icon className="text-muted-foreground size-4" />
              </div>
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-medium tracking-tight">
                  {stats[card.key]}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">Recent Onboarding</h3>
          <span className="text-muted-foreground text-xs">
            Latest applications, newest first
          </span>
        </div>
        <DataTable
          columns={recentColumns}
          rows={applications.rows}
          rowKey={(row) => row._id}
          isLoading={applications.isLoading}
          searchPlaceholder="Search recent onboarding…"
          emptyMessage="No onboarding yet — start one from Request Onboarding."
          initialSort={{ id: "created", direction: "desc" }}
          maxRows={8}
        />
        {applications.error && (
          <p className="text-destructive mt-2 text-sm">{applications.error}</p>
        )}
      </section>
    </div>
  );
}
