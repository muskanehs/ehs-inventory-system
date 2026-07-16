import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Ellipsis,
  FileUp,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { StockExportDialog } from "@/components/inventory/StockExportDialog";
import { StockImportDialog } from "@/components/inventory/StockImportDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { AddStockDialog } from "@/components/inventory/StockDialogs";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { useGroupedInventory, type StockListFilter } from "@/hooks/use-inventory";
import { useDeleteProduct } from "@/hooks/use-products";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { mapApiProductStockGroup, type ProductStockGroup } from "@/lib/inventory";
import type { Product } from "@/lib/types";
import { DataPanel } from "@/components/ui/surface";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSearchStore } from "@/store/search";

const PAGE_SIZE = 10;

const STOCK_FILTERS: { value: StockListFilter; label: string }[] = [
  { value: "all", label: "All stock" },
  { value: "low", label: "Low stock" },
  { value: "fast", label: "Fast moving" },
  { value: "slow", label: "Slow moving" }
];

function parseStockFilter(value: string | null): StockListFilter {
  if (value === "low" || value === "fast" || value === "slow") return value;
  return "all";
}

type ProductStatus = "HEALTHY" | "LOW_STOCK" | "OUT_OF_STOCK";

const STATUS_META: Record<
  ProductStatus,
  { label: string; badgeVariant: "success" | "warning" | "destructive" | "secondary" }
> = {
  HEALTHY: { label: "Healthy", badgeVariant: "success" },
  LOW_STOCK: { label: "Low stock", badgeVariant: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", badgeVariant: "destructive" }
};

function getProductStatus(group: ProductStockGroup): ProductStatus {
  if (group.totalQuantity <= 0) return "OUT_OF_STOCK";
  if (group.isLowStock || group.totalQuantity <= group.product.minimumStockLevel) return "LOW_STOCK";
  return "HEALTHY";
}

export default function InventoryPage() {
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();
  const role = useAuthStore((s) => s.role);
  const canManageProducts = role === "ADMIN" || role === "STORE_MANAGER";
  const canImport = canManageProducts || role === "GODOWN_MANAGER";

  const [searchParams, setSearchParams] = useSearchParams();
  const setQuery = useSearchStore((s) => s.setQuery);
  const { debouncedQuery } = useGlobalSearch();
  const [page, setPage] = useState(1);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  const deleteProduct = useDeleteProduct();

  const stockFilter = parseStockFilter(searchParams.get("filter"));

  // Godown managers are locked to their assigned location (no overall-stock toggle).
  const listLocationId = isGodownScoped && scopedLocationId ? scopedLocationId : undefined;

  const { data: groupedPage, isLoading, isError, refetch } = useGroupedInventory({
    page,
    limit: PAGE_SIZE,
    search: debouncedQuery,
    locationId: listLocationId,
    filter: stockFilter
  });
  const { data: locations = [] } = useLocations();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams, setQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, stockFilter]);

  const setStockFilter = (next: StockListFilter) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "all") params.delete("filter");
        else params.set("filter", next);
        return params;
      },
      { replace: true }
    );
    setPage(1);
  };

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

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      toast.success("Product deleted", {
        description: `"${deleteTarget.name}" was removed. Add it again anytime to restore the catalog entry.`
      });
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Could not delete product", {
        description: message ?? "This product may still have stock or transfer history."
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        description={
          isGodownScoped && assignedLocationName
            ? `Stock at ${assignedLocationName}.`
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
            <Select value={stockFilter} onValueChange={(v) => setStockFilter(parseStockFilter(v))}>
              <SelectTrigger className="h-9 w-[160px] bg-surface sm:w-[180px]" aria-label="Stock filter">
                <SelectValue placeholder="All stock" />
              </SelectTrigger>
              <SelectContent>
                {STOCK_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <StockExportDialog label="Export" variant="outline" />
            {canImport ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="h-4 w-4" />
                Import
              </Button>
            ) : null}
          </>
        }
      />

      <StockImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {STOCK_FILTERS.find((f) => f.value === stockFilter)?.label ?? "Inventory List"}
          </h2>
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
            description={
              stockFilter === "all"
                ? "Try a different search or add a product to get started."
                : "No products match this stock filter. Try another filter or clear it."
            }
            actionLabel={stockFilter === "all" ? "Add Stock" : "Show all stock"}
            onAction={() => {
              if (stockFilter === "all") setAddStockOpen(true);
              else setStockFilter("all");
            }}
          />
        ) : (
          <>
            <DataPanel>
            <Accordion type="multiple" className="divide-y divide-border/60">
              {paginated.map(({ group, status, distribution }) => {
                const categoryName = group.product.category?.name ?? "Uncategorized";
                const displayDistribution =
                  isGodownScoped && listLocationId
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
                          <span className="font-mono">{group.product.sku ?? "-"}</span>
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
                      {canManageProducts && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              aria-label={`Actions for ${group.product.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Ellipsis className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                openEditProduct(group.product);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit name
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                setDeleteTarget(group.product);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
        <>
          <ProductFormDialog open={addProductOpen} onOpenChange={setAddProductOpen} />
          <ProductFormDialog
            open={Boolean(editingProduct)}
            onOpenChange={(open) => {
              if (!open) setEditingProduct(null);
            }}
            product={editingProduct}
            renameOnly
          />
          <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete product?</DialogTitle>
                <DialogDescription>
                  {deleteTarget
                    ? `"${deleteTarget.name}" will be removed from the catalog. You can add it again later to restore it. Products with stock on hand or transfer history cannot be deleted.`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteProduct.isPending}
                  onClick={() => void handleDeleteProduct()}
                >
                  {deleteProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </PageShell>
  );
}
