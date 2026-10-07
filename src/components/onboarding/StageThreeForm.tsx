import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  buildNamespace,
  emptyService,
  namespacePart,
  namespaceSuffixOf,
  serviceSchema,
  type ServiceContext,
  type ServiceFormValues,
} from "@/lib/onboarding-schema";
import type { ApplicationRow, ServiceRow, WorkerNodeRow } from "./types";

type Props = {
  application: ApplicationRow;
  nodes: WorkerNodeRow[];
  savedServices: ServiceRow[];
  /** Omitted while saved services lock the worker node list. */
  onBack?: () => void;
  onSaved: (serviceCount: number) => void;
};

function Detail({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-5 break-words">{children}</p>
    </div>
  );
}

/**
 * Stage 3 — a free-length service list. Each entry stores a namespace built as
 * applicationname-tenant-(freetext), the service name, port, health check URL,
 * node selector (chosen from the stage 2 nodes), and a free-text description.
 * The whole list is saved in one mutation.
 */
export function StageThreeForm({
  application,
  nodes,
  savedServices,
  onBack,
  onSaved,
}: Props) {
  const saveServices = useMutation(api.onboarding.saveServices);
  const [draft, setDraft] = useState<ServiceFormValues[]>([]);

  const context: ServiceContext = {
    applicationName: application.applicationName,
    tenant: application.tenant,
    nodeHostnames: nodes.map((node) => node.hostname),
  };

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema(context)),
    defaultValues: emptyService(),
    mode: "onBlur",
  });

  const isSubmitting = form.formState.isSubmitting;
  const namespaceSuffix = useWatch({
    control: form.control,
    name: "namespaceSuffix",
  });
  const prefix = `${namespacePart(application.applicationName)}-${application.tenant}-`;
  const namespaceFor = (suffix: string) =>
    buildNamespace(application.applicationName, application.tenant, suffix);

  const savedValues: ServiceFormValues[] = savedServices.map((service) => ({
    namespaceSuffix: namespaceSuffixOf(
      application.applicationName,
      application.tenant,
      service.namespace,
    ),
    serviceName: service.serviceName,
    port: String(service.port),
    healthcheckUrl: service.healthcheckUrl,
    nodeSelectors: service.nodeSelectors,
    description: service.description,
  }));

  const combined = [...savedValues, ...draft];

  const onAdd = async (values: ServiceFormValues) => {
    const takenNames = new Set([
      ...savedServices.map((service) => service.serviceName),
      ...draft.map((service) => service.serviceName),
    ]);
    const takenNamespaces = new Set([
      ...savedServices.map((service) => service.namespace),
      ...draft.map((service) =>
        namespaceFor(service.namespaceSuffix),
      ),
    ]);

    if (takenNames.has(values.serviceName)) {
      form.setError("serviceName", {
        type: "manual",
        message: "This service name is already in the list.",
      });
      return;
    }
    const namespace = namespaceFor(values.namespaceSuffix);
    if (takenNamespaces.has(namespace)) {
      form.setError("namespaceSuffix", {
        type: "manual",
        message: "This namespace is already used by another service.",
      });
      return;
    }

    setDraft((current) => [...current, values]);
    form.reset(emptyService());
    form.setFocus("namespaceSuffix");
  };

  const onSave = async () => {
    try {
      const count = await saveServices({
        applicationId: application._id,
        services: combined.map((service) => ({
          namespaceSuffix: service.namespaceSuffix,
          serviceName: service.serviceName,
          port: Number(service.port),
          healthcheckUrl: service.healthcheckUrl,
          nodeSelectors: service.nodeSelectors,
          description: service.description,
        })),
      });
      setDraft([]);
      toast.success("Services saved", {
        description: `${count} service${count === 1 ? "" : "s"} saved for ${application.applicationName}.`,
      });
      onSaved(count);
    } catch (error) {
      toast.error("Could not save the services", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium">Services</h3>
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
        Add as many services as {application.applicationName} needs. Every
        namespace is saved as {prefix}(free text), then the list is saved in
        one go.
      </p>

      {savedServices.length > 0 && (
        <div className="border-border/70 bg-muted/40 mb-7 rounded-md border px-4 py-3 text-sm">
          {`${savedServices.length} service${savedServices.length === 1 ? "" : "s"} already saved`}
          {". Add more below and save again — the whole list is kept."}
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onAdd)}
          className="flex flex-col gap-6"
          noValidate
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="namespaceSuffix"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Namespace suffix</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="core"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {namespaceSuffix.trim().length > 0 ? (
                      <>
                        Saved namespace:{" "}
                        <span className="text-foreground font-mono">
                          {namespaceFor(namespaceSuffix)}
                        </span>
                      </>
                    ) : (
                      <>Free text — the namespace becomes {prefix}…</>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceName"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Service name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="billing-api"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="8080"
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="healthcheckUrl"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Health check URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://billing.internal/healthz"
                      type="url"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="nodeSelectors"
            render={({ field }) => (
              <FormItem className="grid gap-3">
                <FormLabel>Node selector</FormLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {nodes.map((node) => {
                    const inputId = `selector-${node._id}`;
                    const checked = field.value.includes(node.hostname);
                    return (
                      <div
                        key={node._id}
                        className="border-input flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors has-data-[state=checked]:bg-muted/60"
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          disabled={isSubmitting}
                          onCheckedChange={(value) =>
                            field.onChange(
                              value === true
                                ? [...field.value, node.hostname]
                                : field.value.filter(
                                    (name) => name !== node.hostname,
                                  ),
                            )
                          }
                        />
                        <Label
                          htmlFor={inputId}
                          className="min-w-0 cursor-pointer truncate text-sm font-normal"
                        >
                          <span className="font-mono">{node.hostname}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {node.ipAddress}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <FormDescription>
                  The stage 2 worker nodes this service may run on.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What this service does, and anything the platform team should know."
                    rows={3}
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Free text, optional.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={isSubmitting}
            >
              <Plus className="size-4" />
              Add to list
            </Button>
          </div>
        </form>
      </Form>

      <div className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h4 className="text-sm font-medium">Service list</h4>
          <p className="text-xs text-muted-foreground">
            {`${combined.length} in the list`}
          </p>
        </div>

        {combined.length === 0 ? (
          <div className="border-border/70 mt-5 rounded-md border px-6 py-9 text-center">
            <p className="text-sm font-medium">No services yet</p>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-6">
              Add the first service above — this list can hold as many as the
              application needs.
            </p>
          </div>
        ) : (
          <ul className="border-border/70 mt-5 border-t">
            {savedServices.map((service) => (
              <li
                key={`saved-${service._id}`}
                className="border-border/70 border-b py-5 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium tracking-tight">
                    {service.serviceName}
                  </p>
                  <span className="text-muted-foreground text-xs">
                    Saved · stage 3
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-[13px] break-all">
                  {service.namespace}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Detail label="Port">{service.port}</Detail>
                  <Detail label="Health check" className="col-span-2">
                    <a
                      href={service.healthcheckUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground inline-flex items-start gap-1 underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      <span className="break-all">
                        {service.healthcheckUrl}
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
                    </a>
                  </Detail>
                  <Detail label="Nodes" className="col-span-2 sm:col-span-1">
                    <span className="font-mono text-[13px]">
                      {service.nodeSelectors.join(", ")}
                    </span>
                  </Detail>
                  <Detail label="Description" className="col-span-2 sm:col-span-3">
                    {service.description || "—"}
                  </Detail>
                </div>
              </li>
            ))}

            {draft.map((service, index) => (
              <li
                key={`draft-${service.serviceName}-${index}`}
                className="border-border/70 border-b py-5 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium tracking-tight">
                    {service.serviceName}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      Not saved yet
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Remove ${service.serviceName} from the list`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-[13px] break-all">
                  {namespaceFor(service.namespaceSuffix)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Detail label="Port">{service.port}</Detail>
                  <Detail label="Health check" className="col-span-2">
                    <span className="text-muted-foreground break-all">
                      {service.healthcheckUrl}
                    </span>
                  </Detail>
                  <Detail label="Nodes" className="col-span-2 sm:col-span-1">
                    <span className="font-mono text-[13px]">
                      {service.nodeSelectors.join(", ")}
                    </span>
                  </Detail>
                  <Detail label="Description" className="col-span-2 sm:col-span-3">
                    {service.description || "—"}
                  </Detail>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            className="w-full"
            onClick={onSave}
            disabled={isSubmitting || combined.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save services"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Saving stores the whole list — {combined.length} service
            {combined.length === 1 ? "" : "s"} — and completes this onboarding.
          </p>
        </div>
      </div>

      {onBack && (
        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={isSubmitting}
          >
            Back to worker nodes
          </Button>
        </div>
      )}
    </div>
  );
}
