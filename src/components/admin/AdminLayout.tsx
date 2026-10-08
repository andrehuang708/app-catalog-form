import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Building2,
  FilePlus2,
  HardDrive,
  Home,
  LayoutGrid,
  LogOut,
  Server,
} from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

/** The admin menu — order matters: this is the sidebar’s navigation spec. */
const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/onboarding", label: "Request Onboarding", icon: FilePlus2 },
  { to: "/applications", label: "Application", icon: LayoutGrid },
  { to: "/namespaces", label: "Namespace", icon: Boxes },
  { to: "/services", label: "Service", icon: Server },
  { to: "/worker-nodes", label: "Worker Nodes", icon: HardDrive },
  { to: "/tenants", label: "Tenant", icon: Building2 },
];

/**
 * The Admin Panel shell every management page renders inside: sidebar on the
 * left (a slide-over sheet on phones), a slim top bar with the section name,
 * and the routed page content below. Home routes back to the dashboard.
 */
export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/" || location.pathname === "/dashboard";
  const activeLabel =
    (isHome
      ? NAV_ITEMS.find((item) => item.to === "/dashboard")
      : NAV_ITEMS.find((item) => item.to === location.pathname))?.label ??
    "Dashboard";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <img
              src={logo}
              alt=""
              width={26}
              height={26}
              className="rounded-[6px]"
            />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium tracking-tight">
                Kube App Onboarding
              </span>
              <span className="text-muted-foreground text-xs">
                Infrastructure
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.to === "/dashboard"
                        ? isHome
                        : location.pathname === item.to
                    }
                  >
                    <NavLink to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm">{user?.name || "Platform team"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {user?.email || "Signed in"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="border-border/70 flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium tracking-tight">{activeLabel}</h1>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            · Legacy → Kubernetes
          </span>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8",
          )}
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
