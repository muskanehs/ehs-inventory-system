import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Package,
  PackagePlus,
  Plus
} from "lucide-react";
import { StockExportDialog } from "@/components/inventory/StockExportDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { FilterBar } from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { AddStockDialog } from "@/components/inventory/StockDialogs";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { useGroupedInventory } from "@/hooks/use-inventory";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { mapApiProductStockGroup } from "@/lib/inventory";
import type { ProductStockGroup } from "@/lib/inventory";
import { DataPanel } from "@/components/ui/surface";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { cn, formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSearchStore } from "@/store/search";

const PAGE_SIZE = 10;

type StockViewMode = "scoped" | "overall";

type ProductStatus = "HEALTHY" | "LOW_STOCK" | "OUT_OF_STOCK" | "INACTIVE";

const STATUS_META: Record<
  ProductStatus,
  { label: string; badgeVariant: "success" | "warning" | "destructive" | "secondary" }
> = {
  HEALTHY: { label: "Healthy", badgeVariant: "success" },
  LOW_STOCK: { label: "Low stock", badgeVariant: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", badgeVariant: "destructive" },
  INACTIVE: { label: "Inactive", badgeVariant: "secondary" }
};

function getProductStatus(group: ProductStockGroup): ProductStatus {
  if (!group.product.isActive) return "INACTIVE";
  if (group.totalQuantity <= 0) return "OUT_OF_STOCK";
  if (group.isLowStock || group.totalQuantity <= group.product.minimumStockLevel) return "LOW_STOCK";
  return "HEALTHY";
}

export default function InventoryPage() {
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();
  const role = useAuthStore((s) => s.role);
  const canManageProducts = role === "ADMIN" || role === "STORE_MANAGER";

  const [searchParams] = useSearchParams();
  const setQuery = useSearchStore((s) => s.setQuery);
  const { debouncedQuery } = useGlobalSearch();
  const [page, setPage] = useState(1);
  const [stockView, setStockView] = useState<StockViewMode>(isGodownScoped ? "scoped" : "overall");
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  const listLocationId =
    stockView === "scoped" && scopedLocationId ? scopedLocationId : undefined;

  const { data: groupedPage, isLoading, isError, refetch } = useGroupedInventory({
    page,
    limit: PAGE_SIZE,
    search: debouncedQuery,
    locationId: listLocationId
  });
  const { data: locations = [] } = useLocations();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams, setQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const paginated = useMemo(() => {
    const items = groupedPage?.items ?? [];
    return items.map((group) => {
      const mapped = mapApiProductStockGroup(group, locations);
      return {
        group: mapped,
        status: getProductStatus(mapped),
        distribution: [...mapped.storeLocations, ...mapped.godownLocations]
      };
    });
  }, [groupedPage?.items, locations]);

  const totalPages = groupedPage?.totalPages ?? 1;
  const totalItems = groupedPage?.total ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        description={
          stockView === "scoped" && assignedLocationName
            ? `Stock at ${assignedLocationName}. Switch to overall view to see all locations.`
            : "Manage stock across all stores and godowns."
        }
        actions={
          <>
            {canManageProducts && (
              <Button variant="outline" onClick={() => setAddProductOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedProductId(undefined);
                setAddStockOpen(true);
              }}
            >
              <PackagePlus className="h-4 w-4" />
              Add Stock
            </Button>
            <StockExportDialog label="Export" variant="outline" />
          </>
        }
      />

      {isGodownScoped && (
        <FilterBar>
          <div className="flex w-full max-w-xs shrink-0 rounded-md border border-border/70 bg-muted/30 p-0.5">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-8 flex-1 rounded-sm px-3 text-xs font-medium sm:h-9 sm:text-sm",
                stockView === "scoped" &&
                  "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
              )}
              onClick={() => {
                setStockView("scoped");
                setPage(1);
              }}
            >
              My Godown
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-8 flex-1 rounded-sm px-3 text-xs font-medium sm:h-9 sm:text-sm",
                stockView === "overall" &&
                  "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
              )}
              onClick={() => {
                setStockView("overall");
                setPage(1);
              }}
            >
              Overall Stock
            </Button>
          </div>
        </FilterBar>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Inventory List</h2>
        </div>

        {isLoading ? (
          <DataPanel className="divide-y divide-border/60">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-2 gap-x-3 gap-y-1.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-14 justify-self-end" />
                  <Skeleton className="col-span-2 h-3 w-2/5" />
                </div>
              </div>
            ))}
          </DataPanel>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load inventory"
            description="Could not fetch stock data."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : totalItems === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description="Try a different search or add a product to get started."
            actionLabel="Add Stock"
            onAction={() => setAddStockOpen(true)}
          />
        ) : (
          <>
            <DataPanel>
            <Accordion type="multiple" className="divide-y divide-border/60">
              {paginated.map(({ group, status, distribution }) => {
                const categoryName = group.product.category?.name ?? "Uncategorized";
                const displayDistribution =
                  stockView === "scoped" && listLocationId
                    ? distribution.filter(({ location }) => location.id === listLocationId)
                    : distribution;

                return (
                <AccordionItem
                  key={group.product.id}
                  value={group.product.id}
                  className="group border-b transition-colors duration-200 hover:bg-hover last:border-b-0"
                >
                  <AccordionTrigger className="gap-2 px-3 py-2.5 text-left hover:no-underline sm:px-4 sm:py-3 [&>svg]:ml-0.5 [&>svg]:shrink-0">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold leading-tight">
                            {group.product.name}
                          </p>
                          <Badge
                            variant={STATUS_META[status].badgeVariant}
                            className="h-5 shrink-0 px-1.5 py-0 text-[11px] font-medium"
                          >
                            {STATUS_META[status].label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          <span className="font-mono">{group.product.sku ?? "—"}</span>
                          <span aria-hidden="true"> • </span>
                          {categoryName}
                        </p>
                      </div>
                      <p className="shrink-0 self-center text-right text-sm font-semibold tabular-nums leading-tight">
                        {formatNumber(group.totalQuantity)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {group.product.unit}
                        </span>
                      </p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-3">
                    <div className="space-y-2 px-3 sm:px-4">
                      <p className="text-xs font-medium text-muted-foreground">Stock Distribution</p>
                      {displayDistribution.length === 0 ? (
                        <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          No stock at any location
                        </p>
                      ) : (
                        <div className="divide-y rounded-lg border bg-background">
                          {displayDistribution.map(({ location, quantity }) => (
                            <div
                              key={location.id}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <span className="min-w-0 truncate text-sm">{location.name}</span>
                              <span className="shrink-0 text-sm font-medium tabular-nums">
                                {formatNumber(quantity)}{" "}
                                <span className="font-normal text-muted-foreground">
                                  {group.product.unit}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
              <TablePagination
                variant="footer"
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </DataPanel>
          </>
        )}
      </section>

      <AddStockDialog
        open={addStockOpen}
        onOpenChange={(open) => {
          setAddStockOpen(open);
          if (!open) setSelectedProductId(undefined);
        }}
        initialProductId={selectedProductId}
      />

      {canManageProducts && (
        <ProductFormDialog open={addProductOpen} onOpenChange={setAddProductOpen} />
      )}
    </PageShell>
  );
}
