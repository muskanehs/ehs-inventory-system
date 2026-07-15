import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  MapPin,
  Package,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { VelocityList } from "@/components/VelocityList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useLocationScope } from "@/hooks/use-location-scope";
import { useVelocityReport } from "@/hooks/use-velocity-report";
import { useAuthStore } from "@/store/auth";
import { VELOCITY_REPORT_DAYS } from "@/lib/product-units";
import { cn, formatNumber } from "@/lib/utils";

function DashboardSkeleton() {
  return (
    <PageShell>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCard key={i} title="" value={0} icon={Package} loading />
        ))}
      </div>
    </PageShell>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { stats, isLoading, isError, refetch } = useDashboardStats();
  const { data: velocity, isLoading: velocityLoading } = useVelocityReport(VELOCITY_REPORT_DAYS, {
    enabled: !isLoading && !isError
  });
  const { isGodownScoped, assignedLocationName } = useLocationScope();
  const role = useAuthStore((s) => s.role);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load dashboard"
        description="We couldn't fetch your inventory data. Please check your connection and try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={
          isGodownScoped && assignedLocationName
            ? `Overview for ${assignedLocationName}: stock, transfers, and activity at your godown.`
            : "Overview of your inventory health and operations at a glance."
        }
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}
        actions={<ExportButton path="/movements/export" filename="movements.xlsx" />}
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MetricCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          description="Active products in catalog"
        />
        <MetricCard
          title="Total Stock Units"
          value={stats.totalStockUnits}
          icon={Boxes}
          description={
            isGodownScoped
              ? `At ${assignedLocationName ?? "your godown"}`
              : `Across ${stats.locationCount} locations`
          }
        />
        <MetricCard
          title="Low Stock Items"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          description="At or below minimum level"
          trend={
            stats.lowStockCount > 0
              ? { value: -1, label: "Needs attention" }
              : { value: 1, label: "All healthy" }
          }
        />
        <MetricCard
          title="Pending Transfers"
          value={stats.pendingTransfers}
          icon={ArrowLeftRight}
          description="Awaiting approval"
        />
      </section>

      <section
        aria-label="Stock insights"
        className="grid gap-3 sm:gap-4 lg:grid-cols-3"
      >
        <Card className="min-w-0">
          <CardHeader className="space-y-1 p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Low Stock Alerts</CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">
              Products that need restocking soon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {stats.lowStockItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No low stock items"
                description="All products are above their minimum stock levels."
                actionLabel="View inventory"
                onAction={() => navigate("/inventory?filter=low")}
                className="border-0 bg-transparent py-4 sm:py-6"
              />
            ) : (
              <>
                <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
                  {stats.lowStockItems.slice(0, 3).map((item) => (
                    <li
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50 sm:gap-4 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium sm:text-sm">{item.product.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground sm:text-xs">
                          {item.product.sku ?? "-"}
                        </p>
                      </div>
                      <Badge variant="warning" className="text-[10px] sm:text-xs">
                        {formatNumber(item.totalQuantity)} /{" "}
                        {formatNumber(item.product.minimumStockLevel)}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/inventory?filter=low">View more</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {velocityLoading ? (
          <>
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </>
        ) : (
          <>
            <VelocityList
              title="Fast-moving Stock"
              description={`Top movers in the last ${velocity?.periodDays ?? VELOCITY_REPORT_DAYS} days`}
              items={velocity?.fast ?? []}
              emptyTitle="No fast movers yet"
              icon={TrendingUp}
              viewMoreTo="/inventory?filter=fast"
            />
            <VelocityList
              title="Slow-moving Stock"
              description={`Bottom movers in the last ${velocity?.periodDays ?? VELOCITY_REPORT_DAYS} days`}
              items={velocity?.slow ?? []}
              emptyTitle="No slow movers identified"
              icon={TrendingDown}
              viewMoreTo="/inventory?filter=slow"
            />
          </>
        )}
      </section>

      <Card>
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
          <CardDescription className="text-[11px] sm:text-sm">Jump to common tasks</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "View Inventory", href: "/inventory", icon: Boxes },
              { label: "Manage Transfers", href: "/transfers", icon: ArrowLeftRight },
              { label: "View Activity", href: "/activity", icon: Package },
              ...(role === "ADMIN"
                ? [{ label: "Manage Godowns", href: "/godowns", icon: MapPin }]
                : [])
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.href)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-3 py-2 text-left text-xs font-medium shadow-soft sm:gap-3 sm:px-4 sm:py-3 sm:text-sm",
                  "transition-all duration-150 hover:border-primary/25 hover:bg-primary-muted/40 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary sm:h-8 sm:w-8">
                  <action.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                {action.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
