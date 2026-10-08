import { describe, expect, it } from "bun:test";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import AuthPage from "../src/pages/Auth";
import Dashboard from "../src/pages/Dashboard";
import Landing from "../src/pages/Landing";
import OnboardingPage from "../src/pages/OnboardingPage";

const client = new ConvexReactClient("https://example.convex.cloud");

const fromRoot = (relative: string) =>
  readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

describe("landing page", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <Landing />
    </MemoryRouter>,
  );

  it("carries the product name and internal positioning", () => {
    expect(html).toContain("Kube App Onboarding Form");
    expect(html).toContain("Internal · Platform team");
    expect(html).toContain("Onboard legacy applications to Kubernetes.");
  });

  it("uses the onboarding-form wording throughout", () => {
    expect(html).toContain("Open the form");
    expect(html).toContain("Form preview");
    expect(html).toContain("What the form collects");
    expect(html).toContain("Work through three stages");
    expect(html).toContain("Saved for the team");
    expect(html).toContain("Onboard your first application");
  });

  it("describes all three stages with their fields", () => {
    for (const heading of [
      "Stage 1 · Application details",
      "Stage 2 · Worker nodes",
      "Stage 3 · Services",
    ]) {
      expect(html).toContain(heading);
    }
    for (const field of [
      // stage 1
      "Application name",
      "Repository name",
      "Tenant",
      "Total worker nodes",
      // stage 2
      "IP address",
      "Hostname",
      "Joined cluster",
      // stage 3
      "Namespace",
      "Service name",
      "Port",
      "Health check URL",
      "Node selector",
      "Description",
    ]) {
      expect(html).toContain(field);
    }
  });

  it("no longer shows the old single-form wording", () => {
    expect(html).not.toContain("Service Catalog");
    expect(html).not.toContain("Open the service catalog");
    expect(html).not.toContain("What version 1 collects");
    expect(html).not.toContain("File your first intake");
    expect(html).not.toContain("Port network");
    expect(html).not.toContain("Total requested worker nodes");
    expect(html).not.toContain("Complete the form");
    expect(html).not.toContain("6 fields");
  });
});

describe("dashboard page", () => {
  const html = renderToString(
    <ConvexAuthProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>
    </ConvexAuthProvider>,
  );

  it("shows the three summary counters and the recent onboarding table", () => {
    expect(html).toContain("Infrastructure dashboard");
    expect(html).toContain("Total Tenant");
    expect(html).toContain("Total Namespace");
    expect(html).toContain("Total Service");
    expect(html).toContain("Recent Onboarding");
  });

  it("no longer shows the old wording", () => {
    expect(html).not.toContain("Migration intake");
    expect(html).not.toContain("Add to catalog");
    expect(html).not.toContain("New submission");
    expect(html).not.toContain("Service Catalog");
    expect(html).not.toContain("New application");
    expect(html).not.toContain("Port network");
    expect(html).not.toContain("Health check URL");
    expect(html).not.toContain("Six fields describing");
  });
});

describe("request onboarding page", () => {
  const html = renderToString(
    <ConvexAuthProvider client={client}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <OnboardingPage />
      </MemoryRouter>
    </ConvexAuthProvider>,
  );

  it("carries the request heading and the saved list", () => {
    expect(html).toContain("Request Onboarding");
    expect(html).toContain("Saved applications");
  });
});

describe("auth page", () => {
  const html = renderToString(
    <ConvexAuthProvider client={client}>
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthPage redirectAfterAuth="/dashboard" />
      </MemoryRouter>
    </ConvexAuthProvider>,
  );

  it("uses the onboarding-form sign-in copy", () => {
    expect(html).toContain("Sign in");
    expect(html).toContain("Use your team email to open the onboarding form");
    expect(html).not.toContain("Get Started");
  });
});

describe("app shell files", () => {
  it("titles the document with the product name", () => {
    expect(fromRoot("index.html")).toContain(
      "<title>Kube App Onboarding Form</title>",
    );
  });

  it("names the installed app", () => {
    const manifest = fromRoot("public/manifest.webmanifest");
    expect(manifest).toContain('"name": "Kube App Onboarding Form"');
    expect(manifest).toContain('"short_name": "Kube Onboarding"');
  });

  it("routes `/` to the dashboard (behind sign-in) and `/auth` back to it", () => {
    const main = fromRoot("src/main.tsx");
    expect(main).toContain('redirectAfterAuth="/dashboard"');
    expect(main).toContain('title="Sign in to the onboarding form"');
    expect(main).toContain(
      "The Kube App Onboarding Form is internal to the platform team.",
    );
    // `/` and `/dashboard` both render the dashboard inside the admin shell,
    // and unsigned visitors bounce straight to /auth.
    expect(main).toContain('<Route path="/" element={<Dashboard />} />');
    expect(main).toContain('<Route path="/dashboard" element={<Dashboard />} />');
    expect(main).toContain("redirectImmediately");
    expect(main).toContain('<Route\n                path="/auth"');
  });
});
