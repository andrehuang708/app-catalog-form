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

/** The three onboarding stages, mirroring the real form one-to-one. */
const STAGE_GROUPS: Array<{
  stage: string;
  title: string;
  fields: Array<{ name: string; description: string }>;
}> = [
  {
    stage: "Stage 1",
    title: "Application details",
    fields: [
      {
        name: "Application name",
        description:
          "The legacy application you are onboarding, and the name it is listed under.",
      },
      {
        name: "Repository name",
        description:
          "The container image or source repository the deployment is built from.",
      },
      {
        name: "Tenant",
        description:
          "Which team owns the workload — fund, lend, cs, or ds.",
      },
      {
        name: "Total worker nodes",
        description:
          "How many nodes to reserve; stage 2 must list exactly this many.",
      },
    ],
  },
  {
    stage: "Stage 2",
    title: "Worker nodes",
    fields: [
      {
        name: "IP address",
        description:
          "The node's address in the cluster network, checked as a valid IPv4 address.",
      },
      {
        name: "Hostname",
        description:
          "The node's name as Kubernetes will know it — lowercase letters, numbers, dots, and hyphens.",
      },
      {
        name: "Joined cluster",
        description:
          "A single check confirming the node has already joined the cluster.",
      },
    ],
  },
  {
    stage: "Stage 3",
    title: "Services",
    fields: [
      {
        name: "Namespace",
        description:
          "Built as applicationname-tenant-(free text), so every service lands in the right place.",
      },
      {
        name: "Service name",
        description:
          "The Kubernetes service name, validated as a DNS label before it is saved.",
      },
      {
        name: "Port",
        description:
          "The port the service exposes, checked against the valid 1–65535 range.",
      },
      {
        name: "Health check URL",
        description:
          "The endpoint Kubernetes will probe to decide whether the service is healthy.",
      },
      {
        name: "Node selector",
        description:
          "Chosen from the stage 2 worker nodes, so the service is scheduled where it should run.",
      },
      {
        name: "Description",
        description: "Free text, so the whole team knows what the service does.",
      },
    ],
  },
];

const SPEC_ROWS: Array<{ label: string; value: string }> = [
  {
    label: "Stage 1 · Application details",
    value: "Name · Repository · Tenant · Nodes",
  },
  {
    label: "Stage 2 · Worker nodes",
    value: "IP · Hostname · Joined cluster",
  },
  {
    label: "Stage 3 · Services",
    value: "Namespace · Port · Health check · Node selector",
  },
];

const STEPS: Array<{ number: string; title: string; body: string }> = [
  {
    number: "01",
    title: "Sign in",
    body: "The form is internal: your team signs in with their own account before anything can be saved.",
  },
  {
    number: "02",
    title: "Work through three stages",
    body: "Application details first, then the worker node list, then as many services as the application needs — each stage checked before it is saved.",
  },
  {
    number: "03",
    title: "Saved for the team",
    body: "Every application appears in the shared list with its status, ready to finish any time.",
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
                Kube App Onboarding Form
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
                <Link to="/dashboard">Open the form</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
          <motion.div {...reveal}>
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Internal · Platform team
            </p>
            <h1 className="text-balance text-4xl leading-[1.06] font-medium tracking-tight sm:text-5xl">
              Onboard legacy applications to Kubernetes.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-base leading-7">
              Kube App Onboarding Form collects what your platform team needs to
              migrate a legacy application — application details and tenant,
              the worker node list, then every service with its namespace,
              port, health check, and node selector — and keeps every saved
              entry in one clean, ordered list.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">Open the form</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?returnTo=%2Fdashboard">Sign in</Link>
              </Button>
            </div>
          </motion.div>

          {/* Form preview — the actual six fields, as a spec sheet */}
          <motion.div
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.12 }}
            className="bg-card border-border/70 mt-16 overflow-hidden rounded-lg border"
          >
            <div className="border-border/70 flex items-center justify-between border-b px-5 py-3">
              <span className="text-[11px] font-medium tracking-[0.16em] uppercase">
                Form preview
              </span>
              <span className="text-muted-foreground text-[11px]">
                3 stages
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

        {/* What the form collects */}
        <section className="border-border/70 border-t">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
            <motion.div {...reveal}>
              <h2 className="text-2xl font-medium tracking-tight">
                What the form collects
              </h2>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                Three stages, and nothing else. Application details first, the
                worker nodes they reserve, then the services — every value
                checked before it can be saved.
              </p>
            </motion.div>

            <motion.div {...reveal} className="border-border/70 border-t">
              {STAGE_GROUPS.map((group) => (
                <div
                  key={group.stage}
                  className="border-border/70 border-b py-7"
                >
                  <div className="flex items-baseline gap-3">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-[0.2em] uppercase">
                      {group.stage}
                    </p>
                    <h3 className="text-sm font-medium">{group.title}</h3>
                  </div>
                  <dl className="mt-4 grid gap-5 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <div key={field.name}>
                        <dt className="text-sm font-medium">{field.name}</dt>
                        <dd className="text-muted-foreground mt-1 text-sm leading-6">
                          {field.description}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </motion.div>
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
              Onboard your first application
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
              Start an application, list its worker nodes, add its services —
              finish in one sitting or resume any time. Everyone on the
              platform team sees it the moment it is saved.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">Open the form</Link>
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
            <span>
              Kube App Onboarding Form · Legacy → Kubernetes migration
            </span>
            <span>Built for the platform team</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
