import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useActionList } from "@/hooks/use-action-list";
import { tenantLabel } from "@/lib/onboarding-schema";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

type TenantRow = {
  _id: string;
  name: string;
  createdAt: number;
  applications: number;
};

const columns: Array<DataTableColumn<TenantRow>> = [
  {
    id: "name",
    header: "Tenant",
    accessor: (row) => row.name,
    cell: (row) => (
      <Badge variant="outline" className="uppercase">
        {tenantLabel(row.name)}
      </Badge>
    ),
  },
  {
    id: "applications",
    header: "Applications",
    accessor: (row) => row.applications,
    cell: (row) =>
      `${row.applications} application${row.applications === 1 ? "" : "s"}`,
  },
  {
    id: "created",
    header: "Added",
    accessor: (row) => row.createdAt,
    cell: (row) => format(row.createdAt, "d MMM yyyy"),
    secondary: true,
  },
];

/**
 * Tenant — the shared tenant list (the onboarding form picks from it).
 * “Add New Tenant” opens a modal and persists straight to Postgres.
 */
export default function TenantsPage() {
  const tenants = useActionList(useAuthedAction(api.onboarding.listTenants));
  const addTenant = useAuthedAction(api.onboarding.addTenant);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const created = await addTenant({ name });
      toast.success("Tenant added", {
        description: `${tenantLabel(created.name)} is now available in the onboarding form.`,
      });
      setName("");
      setOpen(false);
      tenants.reload();
    } catch (error) {
      toast.error("Could not add the tenant", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Tenant
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Tenants that own workloads — add one here and it becomes selectable in
          the onboarding form.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={tenants.rows}
        rowKey={(row) => row._id}
        isLoading={tenants.isLoading}
        searchPlaceholder="Search tenants…"
        emptyMessage="No tenants yet."
        initialSort={{ id: "name", direction: "asc" }}
        toolbar={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add New Tenant
          </Button>
        }
      />
      {tenants.error && (
        <p className="text-destructive mt-2 text-sm">{tenants.error}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
            <DialogDescription>
              Lowercase letters, numbers, and hyphens — up to 30 characters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tenant-name">Tenant name</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. payments"
                autoComplete="off"
                disabled={isSaving}
                autoFocus
              />
              {name.trim() && (
                <p className="text-muted-foreground text-xs">
                  Will be added as{" "}
                  <span className="font-mono">{name.trim().toLowerCase()}</span>
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  "Add tenant"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
