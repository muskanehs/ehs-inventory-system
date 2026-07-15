import * as React from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: boolean;
};

export function Surface({ className, padding = true, children, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-surface shadow-sm transition-all duration-200 hover:shadow-soft",
        padding && "p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DataPanel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm transition-all duration-200 hover:shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function FilterBar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Surface padding className={cn("bg-primary-muted/20", className)} {...props}>
      {children}
    </Surface>
  );
}

export function SectionHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-primary-muted/30 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
