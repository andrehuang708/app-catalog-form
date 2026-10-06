import { describe, expect, it } from "bun:test";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import AuthPage from "../src/pages/Auth";
import Dashboard from "../src/pages/Dashboard";
import Landing from "../src/pages/Landing";

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
    expect(html).toContain("Complete the form");
    expect(html).toContain("Saved for the team");
    expect(html).toContain("Onboard your first application");
  });

  it("lists all six form fields", () => {
    for (const field of [
      "Application name",
      "Namespace",
      "Total requested worker nodes",
      "Port network",
      "Repository name",
      "Health check URL",
    ]) {
      expect(html).toContain(field);
    }
  });

  it("no longer shows the old catalog wording", () => {
    expect(html).not.toContain("Service Catalog");
    expect(html).not.toContain("Open the service catalog");
    expect(html).not.toContain("What version 1 collects");
    expect(html).not.toContain("File your first intake");
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

  it("carries the product name and new headings", () => {
    expect(html).toContain("Kube App Onboarding Form");
    expect(html).toContain("Legacy application onboarding");
    expect(html).toContain("New application");
    expect(html).toContain("Saved applications");
    expect(html).toContain("internal platform tool");
  });

  it("uses the save flow wording", () => {
    expect(html).toContain("Save application");
    expect(html).toContain(
      "Six fields describing how the application should run on",
    );
  });

  it("no longer shows the old wording", () => {
    expect(html).not.toContain("Migration intake");
    expect(html).not.toContain("Add to catalog");
    expect(html).not.toContain("New submission");
    expect(html).not.toContain("Service Catalog");
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

  it("routes sign-in back to the dashboard with product-specific copy", () => {
    const main = fromRoot("src/main.tsx");
    expect(main).toContain('redirectAfterAuth="/dashboard"');
    expect(main).toContain('title="Sign in to the onboarding form"');
    expect(main).toContain(
      "The Kube App Onboarding Form is internal to the platform team.",
    );
  });
});
