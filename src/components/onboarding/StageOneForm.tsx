import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/api";
import {
  TENANTS,
  stageOneSchemaFor,
  tenantLabel,
  type StageOneValues,
} from "@/lib/onboarding-schema";
import { useAuthedAction } from "@/hooks/use-authed-action";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { toast } from "sonner";
import type { ApplicationRow } from "./types";

type Props = {
  application: ApplicationRow | null;
  onSaved: (application: ApplicationRow) => void;
};

const emptyDefaults: DefaultValues<StageOneValues> = {
  applicationName: "",
  repositoryName: "",
  totalWorkerNodes: "",
};

/**
 * Stage 1 — application name, repository, tenant, and the total number of
 * worker nodes. Saving unlocks stage 2 (or updates the application in place
 * when one is already selected).
 */
export function StageOneForm({ application, onSaved }: Props) {
  const create = useAuthedAction(api.onboarding.createApplication);
  const update = useAuthedAction(api.onboarding.updateApplication);
  const fetchTenants = useAuthedAction(api.onboarding.listTenants);
  const tenantGroupId = useId();

  // The tenant list lives in Postgres (the Tenant page can add to it). Until
  // it answers — and if it never does — the four seeded names render, so the
  // form is usable (and stable) from the very first paint.
  const [tenants, setTenants] = useState<string[]>([...TENANTS]);
  useEffect(() => {
    let cancelled = false;
    fetchTenants()
      .then((rows) => {
        if (!cancelled && rows.length > 0)
          setTenants(rows.map((row) => row.name));
      })
      .catch(() => {
        /* keep the seeded four */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchTenants]);

  const form = useForm<StageOneValues>({
    resolver: zodResolver(stageOneSchemaFor(tenants)),
    defaultValues: application
      ? {
          applicationName: application.applicationName,
          repositoryName: application.repositoryName,
          tenant: application.tenant,
          totalWorkerNodes: String(application.totalWorkerNodes),
        }
      : emptyDefaults,
    mode: "onBlur",
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: StageOneValues) => {
    try {
      const row = await (application
        ? update({
            applicationId: application._id,
            applicationName: values.applicationName.trim(),
            repositoryName: values.repositoryName.trim(),
            tenant: values.tenant,
            totalWorkerNodes: Number(values.totalWorkerNodes),
          })
        : create({
            applicationName: values.applicationName.trim(),
            repositoryName: values.repositoryName.trim(),
            tenant: values.tenant,
            totalWorkerNodes: Number(values.totalWorkerNodes),
          }));
      toast.success("Application saved", {
        description: `${row.applicationName} moved on to worker nodes.`,
      });
      onSaved(row);
    } catch (error) {
      toast.error("Could not save this application", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium">Application details</h3>
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
        Start here — name the application, pick its tenant, and reserve the
        worker nodes stage 2 will list.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
          noValidate
        >
          <FormField
            control={form.control}
            name="applicationName"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Application name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="billing-api"
                    autoComplete="off"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  The legacy application you are onboarding.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repositoryName"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Repository name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="platform/billing-api"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Container image or source repository for the application.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tenant"
            render={({ field }) => (
              <FormItem className="grid gap-3">
                <FormLabel>Tenant</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={isSubmitting}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {tenants.map((tenant) => (
                      <div
                        key={tenant}
                        className="border-input flex items-center gap-2 rounded-md border px-3 py-2.5 transition-colors has-data-[state=checked]:bg-muted/60"
                      >
                        <RadioGroupItem
                          value={tenant}
                          id={`${tenantGroupId}-${tenant}`}
                        />
                        <Label
                          htmlFor={`${tenantGroupId}-${tenant}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {tenantLabel(tenant)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  The team that owns the workload.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalWorkerNodes"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Total worker nodes</FormLabel>
                <FormControl>
                  <Input
                    placeholder="3"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  How many nodes to reserve — stage 2 must list exactly this
                  many.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save and continue"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              All four fields are required. Everything you save is visible to
              the whole platform team.
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}
