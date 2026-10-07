import { z } from "zod";

/**
 * Onboarding runs in three stages:
 *  1. Application details — name, repository, tenant, total worker nodes.
 *  2. Worker nodes — one row per node reserved in stage 1.
 *  3. Services — a free-length list; every namespace follows the
 *     applicationname-tenant-(freetext) format.
 *
 * Numeric fields stay strings inside forms so partial input never becomes a
 * number, and are converted right before a mutation runs.
 */

/** The four tenants an application can belong to. */
export const TENANTS = ["fund", "lend", "cs", "ds"] as const;
export type Tenant = (typeof TENANTS)[number];

export const TENANT_LABELS: Record<Tenant, string> = {
  fund: "Fund",
  lend: "Lend",
  cs: "CS",
  ds: "DS",
};

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .regex(/^\d+$/, `${label} must be a whole number.`)
    .refine(
      (value) => Number(value) >= min && Number(value) <= max,
      `${label} must be between ${min} and ${max}.`,
    );

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Lowercase a fragment and replace anything Kubernetes would reject. */
export function namespacePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Builds the stored namespace: applicationname-tenant-(freetext). */
export function buildNamespace(
  applicationName: string,
  tenant: string,
  suffix: string,
): string {
  return [namespacePart(applicationName), tenant.toLowerCase(), namespacePart(suffix)]
    .filter((part) => part.length > 0)
    .join("-");
}

/** Recovers the free-text suffix from a previously saved namespace. */
export function namespaceSuffixOf(
  applicationName: string,
  tenant: string,
  namespace: string,
): string {
  const prefix = `${namespacePart(applicationName)}-${tenant.toLowerCase()}-`;
  return namespace.startsWith(prefix) ? namespace.slice(prefix.length) : namespace;
}

/* ------------------------------------------------------------------ stage 1 */

export const stageOneSchema = z.object({
  applicationName: z
    .string()
    .min(1, "Application name is required.")
    .max(80, "80 characters or fewer.")
    .refine(
      (value) => namespacePart(value).length > 0,
      "Must include at least one letter or number.",
    ),
  repositoryName: z
    .string()
    .min(1, "Repository name is required.")
    .max(200, "200 characters or fewer."),
  tenant: z.enum(TENANTS, { error: "Choose a tenant." }),
  totalWorkerNodes: wholeNumber("Total worker nodes", 1, 1000),
});

export type StageOneValues = z.infer<typeof stageOneSchema>;

/* ------------------------------------------------------------------ stage 2 */

export const workerNodeSchema = z.object({
  ipAddress: z
    .string()
    .trim()
    .min(1, "IP address is required.")
    .refine(
      (value) => IPV4.test(value),
      "Enter a valid IPv4 address, for example 10.0.0.12.",
    ),
  hostname: z
    .string()
    .trim()
    .min(1, "Hostname is required.")
    .max(253, "253 characters or fewer.")
    .refine(
      (value) => DNS_SUBDOMAIN.test(value),
      "Use lowercase letters, numbers, dots, and hyphens, for example worker-01.",
    ),
  joinedCluster: z.boolean(),
});

export type WorkerNodeValues = z.infer<typeof workerNodeSchema>;
export type StageTwoValues = { nodes: WorkerNodeValues[] };

export const emptyNode = (): WorkerNodeValues => ({
  ipAddress: "",
  hostname: "",
  joinedCluster: false,
});

/**
 * Stage 2 must list exactly the number of nodes reserved in stage 1, and no
 * two rows may share an IP address or hostname.
 */
export function workerNodesSchema(totalWorkerNodes: number) {
  return z
    .object({ nodes: z.array(workerNodeSchema) })
    .superRefine((values, ctx) => {
      const expected = `${totalWorkerNodes} worker node${totalWorkerNodes === 1 ? "" : "s"}`;
      if (values.nodes.length !== totalWorkerNodes) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes"],
          message: `Enter exactly ${expected} — you have ${values.nodes.length}.`,
        });
        return;
      }

      const seenIp = new Set<string>();
      const seenHost = new Set<string>();
      values.nodes.forEach((node, index) => {
        if (seenIp.has(node.ipAddress)) {
          ctx.addIssue({
            code: "custom",
            path: ["nodes", index, "ipAddress"],
            message: "This IP address is already used in the list.",
          });
        }
        seenIp.add(node.ipAddress);

        if (seenHost.has(node.hostname)) {
          ctx.addIssue({
            code: "custom",
            path: ["nodes", index, "hostname"],
            message: "This hostname is already used in the list.",
          });
        }
        seenHost.add(node.hostname);
      });
    });
}

/* ------------------------------------------------------------------ stage 3 */

export type ServiceContext = {
  applicationName: string;
  tenant: Tenant;
  /** Hostnames saved in stage 2 — the only valid node selectors. */
  nodeHostnames: string[];
};

export function serviceSchema(context: ServiceContext) {
  return z
    .object({
      namespaceSuffix: z
        .string()
        .trim()
        .min(1, "Namespace suffix is required.")
        .max(40, "40 characters or fewer.")
        .regex(DNS_LABEL, "Lowercase letters, numbers, and hyphens only."),
      serviceName: z
        .string()
        .trim()
        .min(1, "Service name is required.")
        .max(63, "63 characters or fewer.")
        .regex(DNS_LABEL, "Lowercase letters, numbers, and hyphens only."),
      port: wholeNumber("Port", 1, 65535),
      healthcheckUrl: z
        .string()
        .trim()
        .min(1, "Health check URL is required.")
        .refine((value) => {
          try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
          } catch {
            return false;
          }
        }, "Enter a valid http:// or https:// URL."),
      nodeSelectors: z
        .array(z.string())
        .min(1, "Choose at least one worker node.")
        .refine(
          (values) => values.every((value) => context.nodeHostnames.includes(value)),
          "Choose nodes from the stage 2 worker node list.",
        ),
      description: z.string().max(500, "500 characters or fewer."),
    })
    .superRefine((values, ctx) => {
      const namespace = buildNamespace(
        context.applicationName,
        context.tenant,
        values.namespaceSuffix,
      );
      if (namespace.length > 63) {
        ctx.addIssue({
          code: "custom",
          path: ["namespaceSuffix"],
          message: "The full namespace must be 63 characters or fewer.",
        });
      }
    });
}

export type ServiceFormValues = z.infer<ReturnType<typeof serviceSchema>>;
export type StageThreeValues = { services: ServiceFormValues[] };

export const emptyService = (): ServiceFormValues => ({
  namespaceSuffix: "",
  serviceName: "",
  port: "",
  healthcheckUrl: "",
  nodeSelectors: [],
  description: "",
});

/** Validates the whole stage 3 list before it is saved in one mutation. */
export function servicesSchema(context: ServiceContext) {
  return z
    .object({ services: z.array(serviceSchema(context)) })
    .superRefine((values, ctx) => {
      if (values.services.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["services"],
          message: "Add at least one service before saving.",
        });
        return;
      }

      const names = new Set<string>();
      const namespaces = new Set<string>();
      values.services.forEach((service, index) => {
        if (names.has(service.serviceName)) {
          ctx.addIssue({
            code: "custom",
            path: ["services", index, "serviceName"],
            message: "This service name is already in the list.",
          });
        }
        names.add(service.serviceName);

        const namespace = buildNamespace(
          context.applicationName,
          context.tenant,
          service.namespaceSuffix,
        );
        if (namespaces.has(namespace)) {
          ctx.addIssue({
            code: "custom",
            path: ["services", index, "namespaceSuffix"],
            message: "This namespace is already used by another service.",
          });
        }
        namespaces.add(namespace);
      });
    });
}
