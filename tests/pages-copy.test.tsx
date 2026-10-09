import { describe, expect, it } from "bun:test";
import { AuthProvider } from "../src/components/AuthProvider";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import AuthPage from "../src/pages/Auth";
import Dashboard from "../src/pages/Dashboard";
import Landing from "../src/pages/Landing";
import OnboardingPage from "../src/pages/OnboardingPage";
import UsersPage from "../src/pages/UsersPage";

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
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>
    </AuthProvider>,
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
    <AuthProvider>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <OnboardingPage />
      </MemoryRouter>
    </AuthProvider>,
  );

  it("carries the request heading and the saved list", () => {
    expect(html).toContain("Request Onboarding");
    expect(html).toContain("Saved applications");
  });
});

describe("users page (admin)", () => {
  const html = renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={["/users"]}>
        <UsersPage />
      </MemoryRouter>
    </AuthProvider>,
  );

  it("shows the admin-access guard when signed out or non-admin", () => {
    // The default useAuth context is signed out: user is null, so the page
    // renders the guard instead of the account table.
    expect(html).toContain("Administrator access required");
    expect(html).not.toContain("Add user");
  });
});

describe("auth page", () => {
  const html = renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthPage redirectAfterAuth="/dashboard" />
      </MemoryRouter>
    </AuthProvider>,
  );

  it("uses the onboarding-form sign-in copy", () => {
    expect(html).toContain("Sign in");
    expect(html).toContain(
      "Use your team email or user ID to open the onboarding form",
    );
    expect(html).not.toContain("Get Started");
    // The email one-time-code flow is gone: sign-in is a password now.
    expect(html).not.toContain("Check your email");
    expect(html).not.toContain("Continue as Guest");
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
    expect(main).toContain(
      '<Route path="/dashboard" element={<Dashboard />} />',
    );
    expect(main).toContain("redirectImmediately");
    // The auth route is its own entry outside the admin shell. Matched
    // loosely on whitespace so formatting changes do not break it.
    expect(main).toMatch(
      /<Route\s+path="\/auth"\s+element=\{<AuthPage redirectAfterAuth="\/dashboard"\s*\/>\s*\}\s*\/>/,
    );
  });

  it("routes /users to the account administration page", () => {
    const main = fromRoot("src/main.tsx");
    expect(main).toContain('path="/users"');
    expect(main).toContain("./pages/UsersPage.tsx");
  });
});
