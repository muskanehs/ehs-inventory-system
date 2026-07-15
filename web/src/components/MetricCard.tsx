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
    <Card
      className={cn(
        "transition-all duration-200 hover:border-primary/15 hover:shadow-soft",
        className
      )}
    >
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-3">
            <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">{title}</p>
            <p className="text-lg font-semibold tracking-tight tabular-nums text-foreground sm:text-3xl">
              {displayValue}
            </p>
            {(description || trend) && (
              <p className="hidden text-[10px] leading-relaxed text-muted-foreground sm:block sm:text-xs">
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
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary sm:h-9 sm:w-9 sm:rounded-lg">
            <Icon className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
