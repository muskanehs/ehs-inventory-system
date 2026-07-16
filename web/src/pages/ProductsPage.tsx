import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Box,
  Ellipsis,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CompactStatRow } from "@/components/enterprise/CompactStatRow";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { ExportButton } from "@/components/ExportButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { FilterBar, SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { DataPanel } from "@/components/ui/surface";
import { useDeleteProduct, useProducts } from "@/hooks/use-products";
import type { Product } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 10;

type SortField = "name" | "sku" | "category" | "unit" | "minimumStockLevel";
type SortDir = "asc" | "desc";

export default function ProductsPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = role === "ADMIN" || role === "STORE_MANAGER";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: products = [], isLoading, isError, refetch } = useProducts(search);
  const deleteProduct = useDeleteProduct();

  const stats = useMemo(
    () => [{ label: "Total Products", value: formatNumber(products.length) }],
    [products]
  );

  const filtered = useMemo(() => {
    let list = [...products];

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "sku") cmp = (a.sku ?? "").localeCompare(b.sku ?? "");
      else if (sortField === "category")
        cmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
      else if (sortField === "unit") cmp = a.unit.localeCompare(b.unit);
      else cmp = a.minimumStockLevel - b.minimumStockLevel;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [products, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const onDelete = async (product: Product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return false;

    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success("Product deleted");
      return true;
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to delete product", { description: message });
      return false;
    }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowDownUp
        className={cn(
          "h-3 w-3",
          sortField === field ? "text-foreground" : "text-muted-foreground/50"
        )}
      />
    </button>
  );

  const ProductActions = ({ product }: { product: Product }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Product actions">
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEdit(product)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async (e) => {
            e.preventDefault();
            await onDelete(product);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Products"
        description="Manage your product catalog - add, edit, and remove products."
        actions={
          <>
            <ExportButton
              path="/products/export"
              filename="products.xlsx"
              label="Export"
              className="h-9 px-3"
              variant="outline"
            />
            <Button className="h-9 px-3" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          </>
        }
      />

      <CompactStatRow stats={stats} loading={isLoading} />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search products or SKU..."
          ariaLabel="Search products"
        />
      </FilterBar>

      <section className="space-y-3">
        {isLoading ? (
          <DataPanel className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b px-4 py-3 last:border-b-0">
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </DataPanel>
        ) : isError ? (
          <EmptyState
            icon={Box}
            title="Could not load products"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No products found"
            description={
              search
                ? "Try a different search term."
                : "Create products to build your catalog."
            }
            actionLabel={!search ? "New Product" : undefined}
            onAction={!search ? openCreate : undefined}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DataPanel>
                <Table embedded className="border-0">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 px-4 py-2">
                        <SortButton field="name" label="Product" />
                      </TableHead>
                      <TableHead className="h-9 px-4 py-2">
                        <SortButton field="sku" label="SKU" />
                      </TableHead>
                      <TableHead className="h-9 px-4 py-2">
                        <SortButton field="category" label="Category" />
                      </TableHead>
                      <TableHead className="h-9 px-4 py-2">
                        <SortButton field="unit" label="Unit" />
                      </TableHead>
                      <TableHead className="h-9 px-4 py-2 text-right">
                        <SortButton field="minimumStockLevel" label="Min Stock" />
                      </TableHead>
                      <TableHead className="h-9 w-12 px-4 py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="px-4 py-2.5 font-medium">{product.name}</TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {product.sku ?? "-"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-muted-foreground">
                          {product.category?.name ?? "-"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">{product.unit}</TableCell>
                        <TableCell className="px-4 py-2.5 text-right tabular-nums">
                          {formatNumber(product.minimumStockLevel)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          <ProductActions product={product} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataPanel>
            </div>

            <div className="space-y-3 md:hidden">
              {paginated.map((product) => (
                <DataPanel key={product.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight">{product.name}</p>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku ?? "-"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.category?.name ?? "Uncategorized"} · {product.unit} · Min{" "}
                        {formatNumber(product.minimumStockLevel)}
                      </p>
                    </div>
                    <ProductActions product={product} />
                  </div>
                </DataPanel>
              ))}
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />
    </PageShell>
  );
}
