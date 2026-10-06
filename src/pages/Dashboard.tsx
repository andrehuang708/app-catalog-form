import { SubmissionForm } from "@/components/catalog/SubmissionForm";
import { SubmissionList } from "@/components/catalog/SubmissionList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

/**
 * The whole of version 1 lives here: the six-field intake form on the left,
 * the saved submissions list on the right, split by a single hairline rule.
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="/"
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-70"
          >
            <img
              src={logo}
              alt=""
              width={22}
              height={22}
              className="rounded-[5px]"
            />
            <span className="text-sm font-medium tracking-tight">
              Service Catalog
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              / Platform onboarding
            </span>
          </a>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:inline">
              {user?.name || user?.email || ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16">
        <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Legacy → Kubernetes
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
          Migration intake
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          One short form per application. File it once and the details are saved
          to the service catalog for the whole platform team.
        </p>
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-border/70 px-5 sm:px-8">
        <div className="grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
          <section className="border-b border-border/70 py-10 lg:border-r lg:border-b-0 lg:pr-10">
            <h2 className="text-sm font-medium">New submission</h2>
            <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
              Describe the application as it should run on the cluster.
            </p>
            <SubmissionForm />
          </section>

          <section className="py-10 lg:pl-10">
            <SubmissionList />
          </section>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-6xl border-t border-border/70 px-5 py-8 sm:px-8">
        <p className="text-xs text-muted-foreground">
          Service Catalog · internal tool for the platform team
        </p>
      </footer>
    </main>
  );
}
