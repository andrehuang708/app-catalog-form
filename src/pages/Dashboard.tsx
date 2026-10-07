import { ApplicationList } from "@/components/onboarding/ApplicationList";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import type { ApplicationRow } from "@/components/onboarding/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

/**
 * The whole onboarding flow lives here: the three-stage wizard on the left
 * (application details → worker nodes → services), the saved list on the
 * right, split by a single hairline rule. Selecting a list row resumes that
 * application at its first incomplete stage.
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

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
            <span className="min-w-0 truncate text-sm font-medium tracking-tight">
              Kube App Onboarding Form
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · Internal
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
          Legacy application onboarding
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-6">
          Three stages — application details, worker nodes, then services.
          Every stage is saved as you go and listed here for the whole
          platform team.
        </p>
      </div>

      <div className="border-border/70 mx-auto w-full max-w-6xl border-t px-5 sm:px-8">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          <section className="border-border/70 border-b py-10 lg:border-r lg:border-b-0 lg:pr-10">
            <h2 className="text-sm font-medium">Onboarding</h2>
            <p className="text-muted-foreground mt-1.5 mb-7 text-sm">
              {selected
                ? `Continuing “${selected.applicationName}” — close the tab and resume any time from the list.`
                : "Start with the application details; each stage unlocks the next."}
            </p>
            <OnboardingWizard
              key={selected?._id ?? "new"}
              application={selected}
              onApplicationChange={setSelected}
            />
          </section>

          <section className="py-10 lg:pl-10">
            <ApplicationList
              selectedId={selected?._id ?? null}
              onSelect={setSelected}
            />
          </section>
        </div>
      </div>

      <footer className="border-border/70 mx-auto w-full max-w-6xl border-t px-5 py-8 sm:px-8">
        <p className="text-muted-foreground text-xs">
          Kube App Onboarding Form · internal platform tool
        </p>
      </footer>
    </main>
  );
}
