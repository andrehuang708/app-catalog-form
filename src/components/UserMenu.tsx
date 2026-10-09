import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Home, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

/**
 * The signed-in account as a menu: who you are, which account you are, and
 * the two things you can do about it. Rendered in the sidebar footer and in
 * the top bar, so the identity stays visible however the sidebar is open.
 */
export function UserMenu({ compact = false }: { compact?: boolean } = {}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const name = user?.name?.trim() || user?.email || user?.id || "Signed in";
  const initials =
    name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={compact ? `Account menu for ${name}` : undefined}
          className={
            compact
              ? "ring-offset-background hover:bg-accent focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
              : "hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2"
          }
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">
                  {name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {user?.email || "Signed in"}
                </span>
              </span>
              <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={compact ? "end" : "start"}
        className="w-56"
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {user?.email || "No email on file"}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            ID · {user?.id ?? "—"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => navigate("/")}
        >
          <Home className="mr-2 h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
