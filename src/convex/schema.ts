import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Stage 1 — one row per application being onboarded.
    applications: defineTable({
      applicationName: v.string(), // legacy application being migrated
      repositoryName: v.string(), // container image / source repository
      tenant: v.union(
        v.literal("fund"),
        v.literal("lend"),
        v.literal("cs"),
        v.literal("ds"),
      ), // owning tenant
      totalWorkerNodes: v.number(), // nodes reserved by stage 1
      submittedBy: v.id("users"), // who started the onboarding
      submittedByName: v.string(), // denormalized display name for the list
      createdAt: v.number(), // when the onboarding was started
    }).index("by_createdAt", ["createdAt"]),

    // Stage 2 — one row per worker node, exactly totalWorkerNodes per app.
    workerNodes: defineTable({
      applicationId: v.id("applications"),
      ipAddress: v.string(),
      hostname: v.string(),
      joinedCluster: v.boolean(), // checked once the node joined the cluster
    }).index("by_application", ["applicationId"]),

    // Stage 3 — a free-length list of services per application.
    services: defineTable({
      applicationId: v.id("applications"),
      namespace: v.string(), // applicationname-tenant-(freetext)
      serviceName: v.string(),
      port: v.number(),
      healthcheckUrl: v.string(),
      nodeSelectors: v.array(v.string()), // hostnames chosen from stage 2
      description: v.string(), // free text
      createdAt: v.number(),
    }).index("by_application", ["applicationId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
