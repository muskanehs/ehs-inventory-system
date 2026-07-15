import type { ProductVelocity } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type VelocityListProps = {
  title: string;
  description: string;
  items: ProductVelocity[];
  emptyTitle: string;
  icon: typeof TrendingUp;
};

export function VelocityList({
  title,
  description,
  items,
  emptyTitle,
  icon: Icon
}: VelocityListProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-1 p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className="text-[11px] sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pb-1 sm:pb-2">
        {items.length === 0 ? (
          <EmptyState icon={Icon} title={emptyTitle} description="" className="py-6 sm:py-8" />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.slice(0, 8).map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium sm:text-sm">{item.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                    {item.sku} · {item.category}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold tabular-nums sm:text-sm">{item.activityScore}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    {formatNumber(item.currentStock)} pcs
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
