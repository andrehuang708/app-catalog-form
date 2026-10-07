import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import {
  emptyNode,
  workerNodesSchema,
  type StageTwoValues,
} from "@/lib/onboarding-schema";
import { useAction } from "convex/react";
import { Loader2, Plus, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ApplicationRow, WorkerNodeRow } from "./types";

type Props = {
  application: ApplicationRow;
  initialNodes: WorkerNodeRow[];
  onBack: () => void;
  onSaved: (savedNodes: WorkerNodeRow[]) => void;
};

/**
 * Stage 2 — one row per worker node, exactly as many as stage 1 reserved.
 * Each row carries the IP address, hostname, and a joined-cluster check.
 */
export function StageTwoForm({
  application,
  initialNodes,
  onBack,
  onSaved,
}: Props) {
  const saveNodes = useAction(api.onboarding.saveWorkerNodes);
  const total = application.totalWorkerNodes;

  const form = useForm<StageTwoValues>({
    resolver: zodResolver(workerNodesSchema(total)),
    defaultValues: {
      nodes:
        initialNodes.length > 0
          ? initialNodes.map((node) => ({
              ipAddress: node.ipAddress,
              hostname: node.hostname,
              joinedCluster: node.joinedCluster,
            }))
          : Array.from({ length: total }, emptyNode),
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    name: "nodes",
    control: form.control,
  });

  const isSubmitting = form.formState.isSubmitting;
  const nodesError = form.formState.errors.nodes;
  const countMessage =
    nodesError !== undefined && !Array.isArray(nodesError)
      ? nodesError.message
      : undefined;

  const onSubmit = async (values: StageTwoValues) => {
    try {
      const saved = await saveNodes({
        applicationId: application._id,
        nodes: values.nodes.map((node) => ({
          ipAddress: node.ipAddress,
          hostname: node.hostname,
          joinedCluster: node.joinedCluster,
        })),
      });
      toast.success("Worker nodes saved", {
        description: `${saved.length} node${saved.length === 1 ? "" : "s"} saved for ${application.applicationName}.`,
      });
      onSaved(saved);
    } catch (error) {
      toast.error("Could not save the worker nodes", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium">Worker nodes</h3>
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
        List the {total} worker node{total === 1 ? "" : "s"} reserved for{" "}
        {application.applicationName} — IP address, hostname, and whether each
        node has joined the cluster.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="flex flex-col gap-3">
            {fields.map((row, index) => (
              <div key={row.id} className="rounded-md border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {`Node ${index + 1}`}
                  </p>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-7 px-2"
                      onClick={() => remove(index)}
                      disabled={isSubmitting}
                    >
                      <X className="size-3.5" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`nodes.${index}.ipAddress`}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>IP address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="10.0.0.12"
                            inputMode="decimal"
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

                  <FormField
                    control={form.control}
                    name={`nodes.${index}.hostname`}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Hostname</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="worker-01"
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
                  name={`nodes.${index}.joinedCluster`}
                  render={({ field }) => (
                    <FormItem className="mt-4 flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          id={`${row.id}-joined`}
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <Label
                        htmlFor={`${row.id}-joined`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        Joined cluster
                      </Label>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {`${fields.length} of ${total} worker node${total === 1 ? "" : "s"}`}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyNode())}
              disabled={isSubmitting}
            >
              <Plus className="size-3.5" />
              Add node
            </Button>
          </div>

          {countMessage && (
            <p className="text-destructive text-sm">{countMessage}</p>
          )}

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
              Exactly {total} rows are required — the list must match the total
              saved in stage 1.
            </p>
          </div>
        </form>
      </Form>

      <div className="mt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back to application details
        </Button>
      </div>
    </div>
  );
}
