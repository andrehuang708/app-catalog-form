import { describe, expect, it } from "bun:test";
import { formSchema, type FormValues } from "../src/lib/onboarding-schema";

const validEntry: FormValues = {
  applicationName: "billing-api",
  namespace: "payments",
  totalRequestedWorkerNodes: "3",
  portNetwork: "8080",
  repositoryName: "platform/billing-api",
  healthcheckUrl: "https://billing.internal/healthz",
};

/** Validation messages raised for a copy of the valid entry with one override. */
function messagesFor(override: Partial<FormValues>) {
  const result = formSchema.safeParse({ ...validEntry, ...override });
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

describe("onboarding form schema", () => {
  it("accepts a complete, valid entry", () => {
    expect(formSchema.safeParse(validEntry).success).toBe(true);
  });

  it("accepts http as well as https health check URLs", () => {
    expect(
      formSchema.safeParse({
        ...validEntry,
        healthcheckUrl: "http://billing.internal/healthz",
      }).success,
    ).toBe(true);
  });

  it("requires every field", () => {
    expect(messagesFor({ applicationName: "" })).toContain(
      "Application name is required.",
    );
    expect(messagesFor({ namespace: "" })).toContain("Namespace is required.");
    expect(messagesFor({ totalRequestedWorkerNodes: "" })).toContain(
      "Total requested worker nodes is required.",
    );
    expect(messagesFor({ portNetwork: "" })).toContain(
      "Port network is required.",
    );
    expect(messagesFor({ repositoryName: "" })).toContain(
      "Repository name is required.",
    );
    expect(messagesFor({ healthcheckUrl: "" })).toContain(
      "Health check URL is required.",
    );
  });

  it("validates the namespace as a Kubernetes DNS label", () => {
    expect(messagesFor({ namespace: "Payments" })).toContain(
      "Lowercase letters, numbers, and hyphens only.",
    );
    expect(messagesFor({ namespace: "-payments" })).toContain(
      "Lowercase letters, numbers, and hyphens only.",
    );
    expect(messagesFor({ namespace: "pay ments" })).toContain(
      "Lowercase letters, numbers, and hyphens only.",
    );
    expect(messagesFor({ namespace: "payments-2" })).toEqual([]);
  });

  it("bounds worker nodes to a whole number between 1 and 1000", () => {
    expect(messagesFor({ totalRequestedWorkerNodes: "three" })).toContain(
      "Total requested worker nodes must be a whole number.",
    );
    expect(messagesFor({ totalRequestedWorkerNodes: "0" })).toContain(
      "Total requested worker nodes must be between 1 and 1000.",
    );
    expect(messagesFor({ totalRequestedWorkerNodes: "1001" })).toContain(
      "Total requested worker nodes must be between 1 and 1000.",
    );
    expect(messagesFor({ totalRequestedWorkerNodes: "1" })).toEqual([]);
    expect(messagesFor({ totalRequestedWorkerNodes: "1000" })).toEqual([]);
  });

  it("bounds the port to a whole number between 1 and 65535", () => {
    expect(messagesFor({ portNetwork: "80.5" })).toContain(
      "Port network must be a whole number.",
    );
    expect(messagesFor({ portNetwork: "0" })).toContain(
      "Port network must be between 1 and 65535.",
    );
    expect(messagesFor({ portNetwork: "65536" })).toContain(
      "Port network must be between 1 and 65535.",
    );
    expect(messagesFor({ portNetwork: "65535" })).toEqual([]);
  });

  it("requires a parseable http(s) health check URL", () => {
    expect(messagesFor({ healthcheckUrl: "not a url" })).toContain(
      "Enter a valid http:// or https:// URL.",
    );
    expect(messagesFor({ healthcheckUrl: "ftp://host/healthz" })).toContain(
      "Enter a valid http:// or https:// URL.",
    );
    expect(
      messagesFor({ healthcheckUrl: "billing.internal/healthz" }),
    ).toContain("Enter a valid http:// or https:// URL.");
  });

  it("enforces length limits on name and repository", () => {
    expect(messagesFor({ applicationName: "a".repeat(81) })).toContain(
      "80 characters or fewer.",
    );
    expect(messagesFor({ repositoryName: "r".repeat(201) })).toContain(
      "200 characters or fewer.",
    );
  });
});
