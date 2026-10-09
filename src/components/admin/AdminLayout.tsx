import logo from "@/assets/logo.svg";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/UserMenu";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  Boxes,
  Building2,
  FilePlus2,
  HardDrive,
  Home,
  LayoutGrid,
  Server,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

/** The admin menu — order matters: this is the sidebar’s navigation spec. */
const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Only rendered for administrators (the server enforces it too). */
  adminOnly?: boolean;
}> = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/onboarding", label: "Request Onboarding", icon: FilePlus2 },
  { to: "/applications", label: "Application", icon: LayoutGrid },
  { to: "/namespaces", label: "Namespace", icon: Boxes },
  { to: "/services", label: "Service", icon: Server },
  { to: "/worker-nodes", label: "Worker Nodes", icon: HardDrive },
  { to: "/tenants", label: "Tenant", icon: Building2 },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
];

/**
 * The Admin Panel shell every management page renders inside: sidebar on the
 * left (a slide-over sheet on phones), a slim top bar with the section name,
 * and the routed page content below. Home routes back to the dashboard.
 */
export function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.isAdmin,
  );

  const isHome =
    location.pathname === "/" || location.pathname === "/dashboard";
  const activeLabel =
    (isHome
      ? visibleItems.find((item) => item.to === "/dashboard")
      : visibleItems.find((item) => item.to === location.pathname)
    )?.label ?? "Dashboard";

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
              {visibleItems.map((item) => (
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
          <div className="px-1">
            <UserMenu />
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
          <div className="ml-auto">
            <UserMenu compact />
          </div>
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
