import { z } from "zod";

/**
 * The form collects exactly six fields. Numeric fields are kept as strings so
 * partial input ("808", " ") never becomes a number, and are only converted
 * right before the mutation runs.
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

export const formSchema = z.object({
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

export type FormValues = z.infer<typeof formSchema>;

export const defaultValues: FormValues = {
  applicationName: "",
  namespace: "",
  totalRequestedWorkerNodes: "",
  portNetwork: "",
  repositoryName: "",
  healthcheckUrl: "",
};
