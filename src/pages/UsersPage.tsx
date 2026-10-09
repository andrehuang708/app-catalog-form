import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api } from "@/api";
import { useActionList } from "@/hooks/use-action-list";
import { useAuth } from "@/hooks/use-auth";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { format } from "date-fns";
import { Loader2, Plus, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

/** One account row as the Users table renders it (never carries the hash). */
export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  createdAt: number;
  isAdmin: boolean;
  revokedAt: number | null;
};

function displayName(row: UserRow): string {
  return row.name.trim() || row.email || row.id;
}

/**
 * Users — the account administration table. Administrators create accounts
 * here (the new user signs in with the password set at creation), and revoke
 * or restore them; revoking ends every live session in the same transaction.
 */
export default function UsersPage() {
  const { user } = useAuth();
  const users = useActionList(useAuthedAction(api.auth.listUsers));
  const createUser = useAuthedAction(api.auth.createUser);
  const revokeUser = useAuthedAction(api.auth.revokeUser);
  const restoreUser = useAuthedAction(api.auth.restoreUser);

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [revoking, setRevoking] = useState<UserRow | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const columns: Array<DataTableColumn<UserRow>> = [
    {
      id: "name",
      header: "Name",
      accessor: (row) => displayName(row),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{displayName(row)}</span>
          {row.name.trim() && row.email && (
            <span className="text-muted-foreground text-xs">{row.email}</span>
          )}
        </div>
      ),
    },
    {
      id: "id",
      header: "User ID",
      accessor: (row) => row.id,
      cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
    },
    {
      id: "role",
      header: "Role",
      accessor: (row) => (row.isAdmin ? "Administrator" : "Member"),
      cell: (row) => (
        <Badge variant={row.isAdmin ? "default" : "secondary"}>
          {row.isAdmin ? "Administrator" : "Member"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (row.revokedAt === null ? "Active" : "Revoked"),
      cell: (row) =>
        row.revokedAt === null ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="destructive">Revoked</Badge>
        ),
    },
    {
      id: "created",
      header: "Added",
      accessor: (row) => row.createdAt,
      cell: (row) => format(row.createdAt, "d MMM yyyy"),
      secondary: true,
    },
    {
      id: "actions",
      header: "Actions",
      accessor: (row) => displayName(row),
      cell: (row) => {
        const isSelf = row.id === user?.id;
        if (row.revokedAt === null) {
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isSelf}
              title={
                isSelf
                  ? "You can't revoke your own account."
                  : `Revoke ${displayName(row)}`
              }
              onClick={() => setRevoking(row)}
            >
              <ShieldOff className="size-3.5" />
              Revoke
            </Button>
          );
        }
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={restoringId === row.id}
            title={`Restore ${displayName(row)}`}
            onClick={async () => {
              setRestoringId(row.id);
              try {
                await restoreUser({ userId: row.id });
                toast.success("Account restored", {
                  description: `${displayName(row)} can sign in again.`,
                });
                users.reload();
              } catch (error) {
                toast.error("Could not restore the account", {
                  description:
                    error instanceof Error ? error.message : "Try again.",
                });
              } finally {
                setRestoringId(null);
              }
            }}
          >
            <RotateCcw className="size-3.5" />
            Restore
          </Button>
        );
      },
      className: "w-32",
    },
  ];

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const created = await createUser({
        userId: String(form.get("userId") ?? ""),
        email: String(form.get("email") ?? ""),
        name: String(form.get("name") ?? ""),
        password: String(form.get("password") ?? ""),
        isAdmin: newIsAdmin,
      });
      toast.success("Account created", {
        description: `${displayName(created)} can now sign in with their user ID or email.`,
      });
      setOpen(false);
      users.reload();
    } catch (error) {
      toast.error("Could not create the account", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await revokeUser({ userId: revoking.id });
      toast.success("Account revoked", {
        description: `${displayName(revoking)} was signed out everywhere and can no longer sign in.`,
      });
      setRevoking(null);
      users.reload();
    } catch (error) {
      toast.error("Could not revoke the account", {
        description: error instanceof Error ? error.message : "Try again.",
      });
      setRevoking(null);
    }
  };

  // The server rejects non-admins independently (defense in depth); this
  // guard just keeps the page from showing a table it could never fill.
  if (!user?.isAdmin) {
    return (
      <div className="border-border/70 rounded-md border border-dashed p-8 text-center">
        <ShieldCheck className="text-muted-foreground mx-auto size-8" />
        <h2 className="mt-3 text-lg font-medium tracking-tight">
          Administrator access required
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Managing user accounts is limited to administrators. Ask an
          administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          Users
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Accounts that can sign in to the onboarding form — create one, or
          revoke access without deleting history.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={users.rows}
        rowKey={(row) => row.id}
        isLoading={users.isLoading}
        searchPlaceholder="Search users…"
        emptyMessage="No accounts yet."
        initialSort={{ id: "created", direction: "desc" }}
        toolbar={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add user
          </Button>
        }
      />
      {users.error && (
        <p className="text-destructive mt-2 text-sm">{users.error}</p>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setNewIsAdmin(false);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              They'll sign in with the user ID or email and this password — 8
              characters minimum.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                name="userId"
                placeholder="e.g. j.smith"
                autoComplete="off"
                disabled={isSaving}
                autoFocus
                required
              />
              <p className="text-muted-foreground text-xs">
                Lowercase letters, numbers, dot, dash, or underscore — up to 32
                characters.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                name="name"
                placeholder="Jane Smith"
                autoComplete="off"
                disabled={isSaving}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                placeholder="jane@example.com"
                autoComplete="off"
                disabled={isSaving}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                disabled={isSaving}
                required
              />
            </div>
            <label className="flex items-start gap-2">
              <Checkbox
                checked={newIsAdmin}
                onCheckedChange={(next) => setNewIsAdmin(next === true)}
                disabled={isSaving}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Administrator</span>
                <span className="text-muted-foreground text-xs">
                  Administrators can create, revoke, and restore accounts.
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(next) => {
          if (!next) setRevoking(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking ? displayName(revoking) : "This account"} will be signed
              out everywhere and won't be able to sign in until an
              administrator restores it. Their onboarding history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-background hover:bg-destructive/90"
              onClick={handleRevoke}
            >
              Revoke account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
