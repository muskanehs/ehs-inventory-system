import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { StockExportDialog } from "@/components/inventory/StockExportDialog";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useInventory } from "@/hooks/use-inventory";
import { useProducts } from "@/hooks/use-products";
import { useVelocityReport } from "@/hooks/use-velocity-report";
import { useLocationScope } from "@/hooks/use-location-scope";
import { VELOCITY_REPORT_DAYS } from "@/lib/product-units";
import { filterInventoryByLocation } from "@/lib/location-scope";
import { formatNumber } from "@/lib/utils";
import type { ProductVelocity } from "@/lib/types";
import { Boxes, MapPin, Package } from "lucide-react";

function VelocityTable({
  title,
  description,
  items,
  emptyTitle
}: {
  title: string;
  description: string;
  items: ProductVelocity[];
  emptyTitle: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState icon={BarChart3} title={emptyTitle} description="" className="py-8" />
        ) : (
          <>
            <div className="hidden md:block">
              <Table embedded>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.sku ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{item.activityScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex min-h-[72px] items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.sku ?? "-"} · {item.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{item.activityScore}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { data: inventory = [], isLoading } = useInventory();
  const { data: products = [] } = useProducts();
  const { data: velocity, isLoading: velocityLoading } = useVelocityReport(VELOCITY_REPORT_DAYS);
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();

  const scopedInventory = filterInventoryByLocation(inventory, scopedLocationId);

  const totalUnits = scopedInventory.reduce((sum, i) => sum + i.quantity, 0);
  const locationCount = new Set(scopedInventory.map((i) => i.locationId)).size;

  const chartData = useMemo(() => {
    const byLocation = new Map<string, number>();
    for (const item of scopedInventory) {
      byLocation.set(
        item.location.name,
        (byLocation.get(item.location.name) ?? 0) + item.quantity
      );
    }
    return [...byLocation.entries()].map(([name, quantity]) => ({ name, quantity }));
  }, [scopedInventory]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description={
          isGodownScoped && assignedLocationName
            ? `Inventory summaries for ${assignedLocationName}.`
            : "Inventory summaries, velocity analysis, and exports."
        }
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }]}
        actions={<StockExportDialog label="Export Stock" />}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          title="Total Products"
          value={
            isGodownScoped
              ? new Set(scopedInventory.map((item) => item.productId)).size
              : products.length
          }
          icon={Package}
        />
        <MetricCard title="Total Stock Units" value={totalUnits} icon={Boxes} />
        <MetricCard title="Active Locations" value={locationCount} icon={MapPin} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Product Velocity</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Fast and slow movers based on transfers and customer sales (last {velocity?.periodDays ?? VELOCITY_REPORT_DAYS} days).
          </p>
        </div>
        {velocityLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <VelocityTable
              title="Fast-moving Items"
              description="Top 25% by activity score"
              items={velocity?.fast ?? []}
              emptyTitle="No fast-moving items yet"
            />
            <VelocityTable
              title="Slow-moving Items"
              description="Bottom 25% among stocked products"
              items={velocity?.slow ?? []}
              emptyTitle="No slow-moving items identified"
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Stock by Location
            </CardTitle>
            <CardDescription>Total units per location</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No chart data"
                description="Add inventory to see location breakdown."
                className="py-8"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Inventory Summary
            </CardTitle>
            <CardDescription>Current stock levels</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto p-0">
            <Table embedded>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedInventory.slice(0, 15).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.product.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.location.name}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNumber(item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
