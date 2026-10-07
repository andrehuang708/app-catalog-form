import { describe, expect, it } from "bun:test";
import {
  buildNamespace,
  namespaceSuffixOf,
  serviceSchema,
  servicesSchema,
  stageOneSchema,
  workerNodesSchema,
  type ServiceContext,
  type ServiceFormValues,
} from "../src/lib/onboarding-schema";

/** Validation messages raised for a copy of the valid input with one override. */
function messagesOf(
  parse: (input: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } },
  input: unknown,
) {
  const result = parse(input);
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => issue.message);
}

/* ------------------------------------------------------------------ stage 1 */

const validStageOne = {
  applicationName: "billing-api",
  repositoryName: "platform/billing-api",
  tenant: "fund",
  totalWorkerNodes: "3",
};

const stageOne = (override: Record<string, unknown> = {}) =>
  (input: unknown) =>
    stageOneSchema.safeParse(input ?? { ...validStageOne, ...override });

const stageOneMessages = (override: Record<string, unknown> = {}) =>
  messagesOf(
    stageOne(override),
    { ...validStageOne, ...override },
  );

describe("stage 1 — application details", () => {
  it("accepts a complete, valid entry", () => {
    expect(stageOneSchema.safeParse(validStageOne).success).toBe(true);
  });

  it("requires application name, repository, and total worker nodes", () => {
    expect(stageOneMessages({ applicationName: "" })).toContain(
      "Application name is required.",
    );
    expect(stageOneMessages({ repositoryName: "" })).toContain(
      "Repository name is required.",
    );
    expect(stageOneMessages({ totalWorkerNodes: "" })).toContain(
      "Total worker nodes is required.",
    );
  });

  it("offers exactly four tenants", () => {
    for (const tenant of ["fund", "lend", "cs", "ds"]) {
      expect(stageOneSchema.safeParse({ ...validStageOne, tenant }).success).toBe(
        true,
      );
    }
    for (const tenant of ["", "payments", "Fund"]) {
      expect(stageOneMessages({ tenant })).toContain("Choose a tenant.");
    }
  });

  it("bounds total worker nodes to a whole number between 1 and 1000", () => {
    expect(stageOneMessages({ totalWorkerNodes: "three" })).toContain(
      "Total worker nodes must be a whole number.",
    );
    expect(stageOneMessages({ totalWorkerNodes: "0" })).toContain(
      "Total worker nodes must be between 1 and 1000.",
    );
    expect(stageOneMessages({ totalWorkerNodes: "1001" })).toContain(
      "Total worker nodes must be between 1 and 1000.",
    );
    expect(stageOneMessages({ totalWorkerNodes: "1" })).toEqual([]);
    expect(stageOneMessages({ totalWorkerNodes: "1000" })).toEqual([]);
  });

  it("enforces length limits and needs a usable name", () => {
    expect(stageOneMessages({ applicationName: "a".repeat(81) })).toContain(
      "80 characters or fewer.",
    );
    expect(stageOneMessages({ repositoryName: "r".repeat(201) })).toContain(
      "200 characters or fewer.",
    );
    expect(stageOneMessages({ applicationName: "???" })).toContain(
      "Must include at least one letter or number.",
    );
  });
});

/* ------------------------------------------------------------------ stage 2 */

function rows(count: number, overrides: Record<number, Record<string, unknown>> = {}) {
  return Array.from({ length: count }, (_, index) => ({
    ipAddress: `10.0.0.${index + 1}`,
    hostname: `worker-0${index + 1}`,
    joinedCluster: true,
    ...overrides[index],
  }));
}

function nodeMessages(total: number, input: unknown) {
  const result = workerNodesSchema(total).safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

describe("stage 2 — worker nodes", () => {
  it("accepts a list that matches the stage 1 total", () => {
    expect(workerNodesSchema(3).safeParse({ nodes: rows(3) }).success).toBe(
      true,
    );
    expect(workerNodesSchema(1).safeParse({ nodes: rows(1) }).success).toBe(
      true,
    );
  });

  it("requires exactly as many rows as stage 1 reserved", () => {
    expect(nodeMessages(3, { nodes: rows(2) })).toContain(
      "Enter exactly 3 worker nodes — you have 2.",
    );
    expect(nodeMessages(1, { nodes: rows(0) })).toContain(
      "Enter exactly 1 worker node — you have 0.",
    );
    expect(nodeMessages(3, { nodes: rows(4) })).toContain(
      "Enter exactly 3 worker nodes — you have 4.",
    );
  });

  it("validates IP addresses and hostnames", () => {
    expect(
      nodeMessages(3, { nodes: rows(3, { 0: { ipAddress: "999.1.1.1" } }) }),
    ).toContain("Enter a valid IPv4 address, for example 10.0.0.12.");
    expect(
      nodeMessages(3, { nodes: rows(3, { 0: { ipAddress: "" } }) }),
    ).toContain("IP address is required.");
    expect(
      nodeMessages(3, { nodes: rows(3, { 0: { hostname: "Worker 01" } }) }),
    ).toContain(
      "Use lowercase letters, numbers, dots, and hyphens, for example worker-01.",
    );
    expect(
      nodeMessages(3, { nodes: rows(3, { 0: { hostname: "" } }) }),
    ).toContain("Hostname is required.");
  });

  it("rejects duplicate IPs and hostnames", () => {
    expect(
      nodeMessages(3, { nodes: rows(3, { 2: { ipAddress: "10.0.0.1" } }) }),
    ).toContain("This IP address is already used in the list.");
    expect(
      nodeMessages(3, { nodes: rows(3, { 2: { hostname: "worker-01" } }) }),
    ).toContain("This hostname is already used in the list.");
  });

  it("requires the joined-cluster check to be a boolean", () => {
    expect(
      workerNodesSchema(1).safeParse({
        nodes: [{ ipAddress: "10.0.0.1", hostname: "worker-01" }],
      }).success,
    ).toBe(false);
    expect(
      workerNodesSchema(1).safeParse({
        nodes: [
          { ipAddress: "10.0.0.1", hostname: "worker-01", joinedCluster: false },
        ],
      }).success,
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ stage 3 */

const context: ServiceContext = {
  applicationName: "billing-api",
  tenant: "fund",
  nodeHostnames: ["worker-01", "worker-02"],
};

const validService: ServiceFormValues = {
  namespaceSuffix: "core",
  serviceName: "billing-api",
  port: "8080",
  healthcheckUrl: "https://billing.internal/healthz",
  nodeSelectors: ["worker-01"],
  description: "Public API for billing.",
};

const serviceMessages = (override: Record<string, unknown> = {}) => {
  const result = serviceSchema(context).safeParse({
    ...validService,
    ...override,
  });
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
};

const stageThreeMessages = (services: unknown[]) => {
  const result = servicesSchema(context).safeParse({ services });
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
};

describe("namespaces — applicationname-tenant-(freetext)", () => {
  it("builds the namespace from name, tenant, and free text", () => {
    expect(buildNamespace("Billing API", "fund", "core")).toBe(
      "billing-api-fund-core",
    );
    expect(buildNamespace("billing-api", "cs", "API v2")).toBe(
      "billing-api-cs-api-v2",
    );
  });

  it("recovers the free-text suffix from a saved namespace", () => {
    expect(namespaceSuffixOf("billing-api", "fund", "billing-api-fund-core")).toBe(
      "core",
    );
    expect(namespaceSuffixOf("other-app", "fund", "unrelated")).toBe(
      "unrelated",
    );
  });
});

describe("stage 3 — services", () => {
  it("accepts a complete, valid service", () => {
    expect(serviceSchema(context).safeParse(validService).success).toBe(true);
    expect(
      serviceSchema(context).safeParse({ ...validService, description: "" })
        .success,
    ).toBe(true);
  });

  it("requires the namespace suffix and service name", () => {
    expect(serviceMessages({ namespaceSuffix: "" })).toContain(
      "Namespace suffix is required.",
    );
    expect(serviceMessages({ namespaceSuffix: "Core API" })).toContain(
      "Lowercase letters, numbers, and hyphens only.",
    );
    expect(serviceMessages({ serviceName: "" })).toContain(
      "Service name is required.",
    );
    expect(serviceMessages({ serviceName: "Billing API" })).toContain(
      "Lowercase letters, numbers, and hyphens only.",
    );
  });

  it("keeps the full namespace within 63 characters", () => {
    const longContext: ServiceContext = {
      ...context,
      applicationName: "a".repeat(60),
    };
    const result = serviceSchema(longContext).safeParse(validService);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "The full namespace must be 63 characters or fewer.",
      );
    }
  });

  it("bounds the port to a whole number between 1 and 65535", () => {
    expect(serviceMessages({ port: "80.5" })).toContain(
      "Port must be a whole number.",
    );
    expect(serviceMessages({ port: "0" })).toContain(
      "Port must be between 1 and 65535.",
    );
    expect(serviceMessages({ port: "65536" })).toContain(
      "Port must be between 1 and 65535.",
    );
    expect(serviceMessages({ port: "" })).toContain("Port is required.");
    expect(serviceMessages({ port: "65535" })).toEqual([]);
  });

  it("requires a parseable http(s) health check URL", () => {
    expect(serviceMessages({ healthcheckUrl: "" })).toContain(
      "Health check URL is required.",
    );
    expect(serviceMessages({ healthcheckUrl: "not a url" })).toContain(
      "Enter a valid http:// or https:// URL.",
    );
    expect(serviceMessages({ healthcheckUrl: "ftp://host/healthz" })).toContain(
      "Enter a valid http:// or https:// URL.",
    );
    expect(
      serviceMessages({ healthcheckUrl: "http://billing.internal/healthz" }),
    ).toEqual([]);
  });

  it("requires node selectors from the stage 2 list", () => {
    expect(serviceMessages({ nodeSelectors: [] })).toContain(
      "Choose at least one worker node.",
    );
    expect(serviceMessages({ nodeSelectors: ["worker-99"] })).toContain(
      "Choose nodes from the stage 2 worker node list.",
    );
    expect(serviceMessages({ nodeSelectors: ["worker-01", "worker-02"] })).toEqual(
      [],
    );
  });

  it("caps the description at 500 characters", () => {
    expect(serviceMessages({ description: "d".repeat(501) })).toContain(
      "500 characters or fewer.",
    );
    expect(serviceMessages({ description: "d".repeat(500) })).toEqual([]);
  });

  it("requires at least one service before saving the list", () => {
    expect(stageThreeMessages([])).toContain(
      "Add at least one service before saving.",
    );
    expect(stageThreeMessages([validService])).toEqual([]);
  });

  it("rejects duplicate service names and namespaces in the list", () => {
    expect(
      stageThreeMessages([validService, { ...validService }]),
    ).toContain("This service name is already in the list.");
    expect(
      stageThreeMessages([
        validService,
        { ...validService, serviceName: "other-service" },
      ]),
    ).toContain("This namespace is already used by another service.");
    expect(
      stageThreeMessages([
        validService,
        { ...validService, serviceName: "other-service", namespaceSuffix: "web" },
      ]),
    ).toEqual([]);
  });
});
