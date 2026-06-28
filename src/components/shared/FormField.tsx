import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Canonical form-field wrapper (label + control + hint + error).
 *
 * Lightweight alternative to shadcn's <Form /> + react-hook-form stack, for
 * the many places in this app that build forms with plain useState. Does NOT
 * replace shadcn `FormField` from `@/components/ui/form` — that one is bound
 * to react-hook-form contexts and remains the right choice when RHF is used.
 */
export interface FormFieldProps {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

let uid = 0;
const useFallbackId = (provided?: string) => {
  const ref = React.useRef<string>();
  if (!ref.current) ref.current = provided ?? `ff-${++uid}`;
  return provided ?? ref.current;
};

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  hint,
  error,
  required,
  optional,
  className,
  labelClassName,
  children,
}) => {
  const fieldId = useFallbackId(id);
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  // Inject id + aria into a single child input/control if it doesn't have them.
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? fieldId,
        "aria-invalid": error ? true : (children.props as { ["aria-invalid"]?: boolean })["aria-invalid"],
        "aria-describedby":
          [errorId, hintId, (children.props as { ["aria-describedby"]?: string })["aria-describedby"]]
            .filter(Boolean)
            .join(" ") || undefined,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label
          htmlFor={fieldId}
          className={cn("text-sm font-semibold text-foreground", labelClassName)}
        >
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
          {optional ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          ) : null}
        </Label>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default FormField;
