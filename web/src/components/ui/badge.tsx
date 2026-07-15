import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border/60 bg-secondary text-secondary-foreground",
        outline: "border-border/70 bg-surface text-foreground",
        success: "border-success/35 bg-success/15 text-success",
        warning: "border-warning/35 bg-warning/15 text-warning",
        destructive: "border-destructive/35 bg-destructive/15 text-destructive",
        info: "border-primary/30 bg-primary-muted text-primary"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
