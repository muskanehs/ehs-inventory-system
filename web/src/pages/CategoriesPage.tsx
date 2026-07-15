import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Ellipsis,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { CompactStatRow } from "@/components/enterprise/CompactStatRow";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { ExportButton } from "@/components/ExportButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
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
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/RequiredMark";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataPanel } from "@/components/ui/surface";
import {
  useCategories,
  useCategoryStats,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory
} from "@/hooks/use-products";
import { useGlobalSearch } from "@/hooks/use-global-search";
import type { Category } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 10;

type SortField = "name" | "description" | "products";
type SortDir = "asc" | "desc";

export default function CategoriesPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = role === "ADMIN" || role === "STORE_MANAGER";
  const isAdmin = role === "ADMIN";

  const [page, setPage] = useState(1);
  const { debouncedQuery } = useGlobalSearch();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: categories = [], isLoading, isError, refetch } = useCategories();
  const { data: categoryStats } = useCategoryStats();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const stats = useMemo(() => {
    return [
      { label: "Categories", value: formatNumber(categoryStats?.categoryCount ?? categories.length) },
      {
        label: "Products Categorized",
        value: formatNumber(categoryStats?.productsCategorized ?? 0)
      },
      { label: "Uncategorized", value: formatNumber(categoryStats?.uncategorized ?? 0) }
    ];
  }, [categories.length, categoryStats]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = categories.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false)
      );
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "description")
        cmp = (a.description ?? "").localeCompare(b.description ?? "");
      else cmp = (a._count?.products ?? 0) - (b._count?.products ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [categories, debouncedQuery, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

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
    setName("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setDialogOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          name: trimmedName,
          description: description.trim() || undefined
        });
        toast.success("Category updated");
      } else {
        await createCategory.mutateAsync({
          name: trimmedName,
          description: description.trim() || undefined
        });
        toast.success("Category created");
      }
      setDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(editing ? "Failed to update category" : "Failed to create category", {
        description: message
      });
    }
  };

  const onDelete = async (category: Category) => {
    const productCount = category._count?.products ?? 0;
    if (productCount > 0) {
      toast.error("Cannot delete category with products", {
        description: `Reassign ${productCount} product(s) first.`
      });
      return false;
    }
    if (!window.confirm(`Delete category "${category.name}"?`)) return false;

    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Category deleted");
      return true;
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to delete category", { description: message });
      return false;
    }
  };

  const isSaving = createCategory.isPending || updateCategory.isPending;

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

  const CategoryActions = ({ category }: { category: Category }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${category.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            openEdit(category);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={async (e) => {
              e.preventDefault();
              await onDelete(category);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Categories"
        description="Organize products into categories for easier inventory management."
        actions={
          <>
            <ExportButton
              path="/categories/export"
              filename="categories.xlsx"
              label="Export"
              className="h-9 px-3"
              variant="outline"
            />
            <Button className="h-9 px-3" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          </>
        }
      />

      <CompactStatRow stats={stats} loading={isLoading} />

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
            icon={FolderTree}
            title="Could not load categories"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No categories found"
            description={
              debouncedQuery
                ? "Try a different search term."
                : "Create categories to organize your product catalog."
            }
            actionLabel={!debouncedQuery ? "New Category" : undefined}
            onAction={!debouncedQuery ? openCreate : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <DataPanel>
              <Table embedded className="border-0">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 px-4 py-2">
                      <SortButton field="name" label="Category" />
                    </TableHead>
                    <TableHead className="h-9 px-4 py-2">
                      <SortButton field="description" label="Description" />
                    </TableHead>
                    <TableHead className="h-9 px-4 py-2 text-center">
                      <SortButton field="products" label="Products" />
                    </TableHead>
                    <TableHead className="h-9 w-12 px-4 py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((category) => (
                    <TableRow
                      key={category.id}
                      className="group cursor-pointer transition-colors duration-200 hover:bg-hover"
                      onClick={() => openEdit(category)}
                    >
                      <TableCell className="px-4 py-2.5 font-medium">{category.name}</TableCell>
                      <TableCell className="max-w-[240px] truncate px-4 py-2.5 text-muted-foreground">
                        {category.description || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center tabular-nums">
                        {category._count?.products ?? 0}
                      </TableCell>
                      <TableCell
                        className="px-4 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CategoryActions category={category} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                variant="footer"
                page={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
              </DataPanel>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {paginated.map((category) => (
                <div
                  key={category.id}
                  className="flex min-h-[88px] items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{category.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {category.description || "No description"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category._count?.products ?? 0} Products
                    </p>
                  </div>
                  <CategoryActions category={category} />
                </div>
              ))}
              <TablePagination
                variant="standalone"
                page={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>

            {filtered.length <= 3 && filtered.length > 0 && (
              <div className="hidden rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center md:block">
                <FolderTree className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">Tip: Use categories to filter inventory</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assign products to categories for faster filtering and reporting across the system.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update category details." : "Add a new product category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">
                Name
                <RequiredMark />
              </Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 min-w-[100px]"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-9 min-w-[100px]" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
