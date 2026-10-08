import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statusOf, type ApplicationRow } from "@/components/onboarding/types";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { useAction } from "convex/react";
import { format } from "date-fns";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

/** Which stage buttons the Edit dialog offers, mirroring the wizard’s locks. */
function stageOptions(application: ApplicationRow) {
  const nodesOk =
    application.nodeCount === application.totalWorkerNodes &&
    application.nodeCount > 0;
  return [
    {
      stage: 1 as const,
      label: "Stage 1 · Application details",
      hint: "Name, repository, tenant, and the worker node budget.",
      disabled: false,
    },
    {
      stage: 2 as const,
      label: "Stage 2 · Worker nodes",
      hint:
        application.serviceCount > 0
          ? "Locked — services already reference these nodes."
          : "IP addresses, hostnames, and cluster join status.",
      disabled: application.serviceCount > 0,
    },
    {
      stage: 3 as const,
      label: "Stage 3 · Services",
      hint: nodesOk
        ? "Namespaces, ports, health checks, and node selectors."
        : "Needs the full worker node list saved first.",
      disabled: !nodesOk,
    },
  ];
}

/**
 * Application — every onboarded application as a searchable, sortable table.
 * The row Edit action opens the stage picker and routes straight into the
 * onboarding form at stage 1, 2, or 3.
 */
export default function ApplicationsPage() {
  const applications = useActionList(
    useAction(api.onboarding.listApplications),
  );
  const navigate = useNavigate();
  const [editing, setEditing] = useState<ApplicationRow | null>(null);

  const columns: Array<DataTableColumn<ApplicationRow>> = [
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
      header: "Status",
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
    },
    {
      id: "services",
      header: "Services",
      accessor: (row) => row.serviceCount,
    },
    {
      id: "submitted",
      header: "Submitted by",
      accessor: (row) => row.submittedByName,
      secondary: true,
    },
    {
      id: "created",
      header: "Created",
      accessor: (row) => row.createdAt,
      cell: (row) => format(row.createdAt, "d MMM yyyy, HH:mm"),
      secondary: true,
    },
    {
      id: "actions",
      header: "Actions",
      accessor: (row) => row.applicationName,
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(row)}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
      ),
      className: "w-24",
    },
  ];

  const openStage = (stage: 1 | 2 | 3) => {
    if (!editing) return;
    const id = editing._id;
    setEditing(null);
    navigate(`/onboarding?application=${id}&stage=${stage}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Application
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Applications that have been onboarded — search, sort, or edit a row
          to jump back into any stage of its form.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={applications.rows}
        rowKey={(row) => row._id}
        isLoading={applications.isLoading}
        searchPlaceholder="Search applications…"
        emptyMessage="No applications onboarded yet."
        initialSort={{ id: "created", direction: "desc" }}
        toolbar={
          <Button type="button" onClick={() => navigate("/onboarding")}>
            <Plus className="size-4" />
            New onboarding
          </Button>
        }
      />
      {applications.error && (
        <p className="text-destructive mt-2 text-sm">{applications.error}</p>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit “{editing?.applicationName ?? ""}”
            </DialogTitle>
            <DialogDescription>
              Pick the stage to open in the onboarding form. Everything is
              saved as you go.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            {editing &&
              stageOptions(editing).map((option) => (
                <button
                  key={option.stage}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => openStage(option.stage)}
                  className="border-border/70 hover:bg-muted/60 focus-visible:ring-ring rounded-md border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {option.hint}
                  </span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
