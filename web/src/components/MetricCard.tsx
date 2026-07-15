import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNumber } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
  className?: string;
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  loading,
  className
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 sm:p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <Card className={cn("hover:shadow-panel", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[1.75rem]">
              {displayValue}
            </p>
            {(description || trend) && (
              <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
                {trend && (
                  <span
                    className={cn(
                      "mr-2 font-medium",
                      trend.value >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {trend.label}
                  </span>
                )}
                {description}
              </p>
            )}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
