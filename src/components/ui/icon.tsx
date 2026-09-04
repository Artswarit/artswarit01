import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon sizes, mirroring the --icon-* tokens in index.css.
 *
 * Apple's HIG treats icons as a family: they share an optical weight and sit
 * on a shared scale rather than each call site inventing a size. Before this
 * existed the codebase used 20+ distinct icon dimensions.
 *
 * Pick by the text the icon sits beside, not by eye:
 *   xs  12px — dense chips, inline metadata
 *   sm  14px — buttons, tabs, list rows
 *   md  16px — default; aligns with 15-17px body text
 *   lg  20px — section headers, toolbars
 *   xl  24px — feature and empty-state glyphs
 */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClass: Record<IconSize, string> = {
  xs: "size-icon-xs",
  sm: "size-icon-sm",
  md: "size-icon-md",
  lg: "size-icon-lg",
  xl: "size-icon-xl",
};

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  /** The lucide icon component, e.g. `as={Search}`. */
  as: LucideIcon;
  size?: IconSize;
  /**
   * Accessible name. Omit for decorative icons — they are then hidden from
   * assistive tech, which is the right default: HIG treats an icon beside a
   * visible label as decoration, and announcing both is noise. Provide it
   * only when the icon is the *sole* carrier of meaning (an icon-only button
   * should generally label the button instead).
   */
  label?: string;
}

/**
 * Consistent icon rendering.
 *
 * Stroke weight is normalised globally in index.css (`.lucide`), so this
 * component's job is the size scale and the accessibility default.
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ as: Component, size = "md", label, className, ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(sizeClass[size], "shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...props}
    />
  ),
);
Icon.displayName = "Icon";

export default Icon;
