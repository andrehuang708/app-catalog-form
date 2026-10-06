import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { MotionConfig, motion } from "framer-motion";
import { Link } from "react-router";

/** Section entrance: short, quiet, and disabled for reduced-motion users. */
const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: "easeOut" },
} as const;

/** The six fields, mirroring the real intake form one-to-one. */
const FIELDS: Array<{ name: string; description: string }> = [
  {
    name: "Application name",
    description:
      "The legacy application being migrated — the name the catalog is indexed by.",
  },
  {
    name: "Namespace",
    description:
      "The Kubernetes namespace it will run in, validated as a DNS label before it is saved.",
  },
  {
    name: "Total requested worker nodes",
    description:
      "How many worker nodes the platform team should reserve for the workload.",
  },
  {
    name: "Port network",
    description:
      "The network port the service exposes, checked against the valid 1–65535 range.",
  },
  {
    name: "Repository name",
    description:
      "The container image or source repository the deployment is built from.",
  },
  {
    name: "Health check URL",
    description:
      "The endpoint Kubernetes will probe to decide whether the service is healthy.",
  },
];

const SPEC_ROWS: Array<{ label: string; value: string }> = [
  { label: "Application name", value: "billing-api" },
  { label: "Namespace", value: "payments" },
  { label: "Total requested worker nodes", value: "3" },
  { label: "Port network", value: "8080" },
  { label: "Repository name", value: "platform/billing-api" },
  { label: "Health check URL", value: "https://billing.internal/healthz" },
];

const STEPS: Array<{ number: string; title: string; body: string }> = [
  {
    number: "01",
    title: "Sign in",
    body: "Platform team members sign in with their account — the catalog is not public.",
  },
  {
    number: "02",
    title: "Fill the intake",
    body: "Six fields, no pagination and no tickets. Each one is checked before it can be saved.",
  },
  {
    number: "03",
    title: "Saved to the catalog",
    body: "The submission appears instantly in the shared list, with who filed it and when.",
  },
];

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground">
        {/* Nav */}
        <header className="border-b border-border/70">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-70"
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
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                to="/auth?returnTo=%2Fdashboard"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Sign in
              </Link>
              <Button asChild size="sm">
                <Link to="/dashboard">Open catalog</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
          <motion.div {...reveal}>
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              For platform teams
            </p>
            <h1 className="text-balance text-4xl leading-[1.06] font-medium tracking-tight sm:text-5xl">
              Onboard legacy applications to Kubernetes.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-base leading-7">
              Six fields, one shared catalog. Capture what the platform team
              needs to schedule a migration — namespace, worker nodes, port,
              repository, health check — and keep every submission in one quiet,
              ordered list.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">Open the service catalog</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?returnTo=%2Fdashboard">Sign in</Link>
              </Button>
            </div>
          </motion.div>

          {/* Intake preview — the actual six fields, as a spec sheet */}
          <motion.div
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.12 }}
            className="bg-card border-border/70 mt-16 overflow-hidden rounded-lg border"
          >
            <div className="border-border/70 flex items-center justify-between border-b px-5 py-3">
              <span className="text-[11px] font-medium tracking-[0.16em] uppercase">
                Intake · Version 1
              </span>
              <span className="text-muted-foreground text-[11px]">
                6 fields
              </span>
            </div>
            <dl className="divide-border/70 divide-y">
              {SPEC_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-6 px-5 py-3.5"
                >
                  <dt className="text-muted-foreground text-sm">{row.label}</dt>
                  <dd className="text-right text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </section>

        {/* What version 1 collects */}
        <section className="border-border/70 border-t">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
            <motion.div {...reveal}>
              <h2 className="text-2xl font-medium tracking-tight">
                What version 1 collects
              </h2>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                Deliberately small: the intake form and the list of saved
                submissions. Nothing else ships in this version.
              </p>
            </motion.div>

            <motion.dl {...reveal} className="border-border/70 border-t">
              {FIELDS.map((field) => (
                <div
                  key={field.name}
                  className="border-border/70 grid gap-1.5 border-b py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="text-sm font-medium">{field.name}</dt>
                  <dd className="text-muted-foreground text-sm leading-6">
                    {field.description}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>
        </section>

        {/* How it works */}
        <section className="border-border/70 border-t">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
            <motion.h2
              {...reveal}
              className="text-2xl font-medium tracking-tight"
            >
              How it works
            </motion.h2>

            <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STEPS.map((step, index) => (
                <motion.div
                  key={step.number}
                  {...reveal}
                  transition={{
                    ...reveal.transition,
                    delay: 0.06 * index,
                  }}
                  className="border-border/70 border-t pt-6"
                >
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.2em]">
                    {step.number}
                  </p>
                  <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {step.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-border/70 border-t">
          <motion.div
            {...reveal}
            className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8"
          >
            <h2 className="max-w-lg text-2xl font-medium tracking-tight">
              File your first intake
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
              Add an application to the service catalog in under a minute. The
              whole platform team sees it the moment it is saved.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">Open the service catalog</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/auth?returnTo=%2Fdashboard">Sign in first</Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-border/70 border-t">
          <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Service Catalog · Legacy → Kubernetes onboarding</span>
            <span>Built for the platform team</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
