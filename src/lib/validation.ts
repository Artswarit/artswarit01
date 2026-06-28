import { z } from "zod";

/**
 * Canonical Zod schemas + helpers for client-side validation.
 *
 * Replaces hand-rolled `if (!field.trim()) toast.error(...)` chains. Use these
 * schemas inside form components or pass parsed results into `safeParse` for
 * inline error messages.
 *
 * Server-side validation in edge functions stays the source of truth —
 * these schemas mirror the rules for fast feedback.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email is too long" });

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password is too long" });

/** Strong-ish password — enforce in signup/reset flows. */
export const strongPasswordSchema = passwordSchema
  .refine((v) => /[A-Z]/.test(v), { message: "Add an uppercase letter" })
  .refine((v) => /[a-z]/.test(v), { message: "Add a lowercase letter" })
  .refine((v) => /[0-9]/.test(v), { message: "Add a number" });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { message: "Name must be at least 2 characters" })
  .max(100, { message: "Name is too long" });

export const optionalUrlSchema = z
  .string()
  .trim()
  .max(2048, { message: "URL is too long" })
  .url({ message: "Enter a valid URL" })
  .optional()
  .or(z.literal("").transform(() => undefined));

export const bioSchema = z
  .string()
  .trim()
  .max(1000, { message: "Bio must be under 1000 characters" })
  .optional();

export const projectTitleSchema = z
  .string()
  .trim()
  .min(3, { message: "Title must be at least 3 characters" })
  .max(120, { message: "Title is too long" });

export const projectDescriptionSchema = z
  .string()
  .trim()
  .min(10, { message: "Description must be at least 10 characters" })
  .max(5000, { message: "Description is too long" });

export const reasonSchema = z
  .string()
  .trim()
  .min(1, { message: "Please choose a reason" });

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, { message: "Message cannot be empty" })
  .max(4000, { message: "Message is too long" });

/**
 * Convenience: extract the first error message from a flattened result.
 * Pair with `schema.safeParse(...)` for inline rendering.
 */
export const firstError = (result: z.SafeParseReturnType<unknown, unknown>): string | undefined => {
  if (result.success) return undefined;
  const issue = result.error.issues[0];
  return issue?.message;
};
