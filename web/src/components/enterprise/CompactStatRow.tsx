import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CompactStat = {
  label: string;
  value: string | number;
};

type CompactStatRowProps = {
  stats: CompactStat[];
  loading?: boolean;
  className?: string;
};

export function CompactStatRow({ stats, loading, className }: CompactStatRowProps) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3", className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border/80 bg-surface p-3 shadow-soft sm:p-4"
          >
            <Skeleton className="mb-1.5 h-2.5 w-16 sm:mb-2 sm:h-3 sm:w-20" />
            <Skeleton className="h-6 w-12 sm:h-7 sm:w-14" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3", className)}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border/80 bg-surface p-3 shadow-soft transition-shadow duration-150 hover:shadow-panel sm:p-4"
        >
          <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">{stat.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:mt-1.5 sm:text-2xl">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
