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
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/**
 * The form collects exactly six fields. Numeric fields are kept as strings
 * here so partial input ("808", " ") never becomes a number, and are only
 * converted right before the mutation runs.
 */
const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .regex(/^\d+$/, `${label} must be a whole number.`)
    .refine(
      (value) => Number(value) >= min && Number(value) <= max,
      `${label} must be between ${min} and ${max}.`,
    );

const formSchema = z.object({
  applicationName: z
    .string()
    .min(1, "Application name is required.")
    .max(80, "80 characters or fewer."),
  namespace: z
    .string()
    .min(1, "Namespace is required.")
    .max(63, "63 characters or fewer.")
    .regex(
      /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
      "Lowercase letters, numbers, and hyphens only.",
    ),
  totalRequestedWorkerNodes: wholeNumber(
    "Total requested worker nodes",
    1,
    1000,
  ),
  portNetwork: wholeNumber("Port network", 1, 65535),
  repositoryName: z
    .string()
    .min(1, "Repository name is required.")
    .max(200, "200 characters or fewer."),
  healthcheckUrl: z
    .string()
    .min(1, "Health check URL is required.")
    .refine((value) => {
      try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a valid http:// or https:// URL."),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  applicationName: "",
  namespace: "",
  totalRequestedWorkerNodes: "",
  portNetwork: "",
  repositoryName: "",
  healthcheckUrl: "",
};

export function SubmissionForm() {
  const create = useMutation(api.catalog.create);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onBlur",
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: FormValues) => {
    try {
      await create({
        applicationName: values.applicationName.trim(),
        namespace: values.namespace.trim(),
        totalRequestedWorkerNodes: Number(values.totalRequestedWorkerNodes),
        portNetwork: Number(values.portNetwork),
        repositoryName: values.repositoryName.trim(),
        healthcheckUrl: values.healthcheckUrl.trim(),
      });
      form.reset(defaultValues);
      toast.success("Application saved", {
        description: `${values.applicationName.trim()} was added to the onboarding list.`,
      });
    } catch (error) {
      toast.error("Could not save this application", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
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
          name="namespace"
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>Namespace</FormLabel>
              <FormControl>
                <Input
                  placeholder="payments"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The Kubernetes namespace the application will run in —
                lowercase, numbers, hyphens.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="totalRequestedWorkerNodes"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Total requested worker nodes</FormLabel>
                <FormControl>
                  <Input
                    placeholder="3"
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
            name="portNetwork"
            render={({ field }) => (
              <FormItem className="grid gap-2">
                <FormLabel>Port network</FormLabel>
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
        </div>

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
              <FormDescription>
                The endpoint Kubernetes will probe to confirm the application is
                healthy.
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
              "Save application"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            All six fields are required. Everything you save is visible to the
            whole platform team.
          </p>
        </div>
      </form>
    </Form>
  );
}
