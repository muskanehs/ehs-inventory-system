import { Link } from "react-router-dom";
import type { ProductVelocity } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const PREVIEW_COUNT = 3;

type VelocityListProps = {
  title: string;
  description: string;
  items: ProductVelocity[];
  emptyTitle: string;
  icon: typeof TrendingUp;
  viewMoreTo: string;
};

export function VelocityList({
  title,
  description,
  items,
  emptyTitle,
  icon: Icon,
  viewMoreTo
}: VelocityListProps) {
  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-1 p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className="text-[11px] sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-3 sm:pb-4">
        {items.length === 0 ? (
          <EmptyState icon={Icon} title={emptyTitle} description="" className="py-6 sm:py-8" />
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              {preview.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50 sm:px-4"
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
            <div className="px-3 sm:px-4">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={viewMoreTo}>View more</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
