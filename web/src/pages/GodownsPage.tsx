import { FormEvent, useMemo, useState } from "react";
import { Building2, Ellipsis, Loader2, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { CompactStatRow } from "@/components/enterprise/CompactStatRow";
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
  useCreateGodown,
  useDeleteGodown,
  useGodownsSummary,
  useUpdateGodown
} from "@/hooks/use-locations";
import { useGlobalSearch } from "@/hooks/use-global-search";
import type { GodownSummary } from "@/lib/types";
import { formatNumber, formatRelativeDate } from "@/lib/utils";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

function GodownCard({
  godown,
  onEdit,
  onDelete
}: {
  godown: GodownSummary;
  onEdit: (godown: GodownSummary) => void;
  onDelete: (godown: GodownSummary) => void;
}) {
  const updatedLabel = godown.updatedAt ? formatRelativeDate(godown.updatedAt) : "-";

  return (
    <div className="flex min-h-[96px] min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/20 sm:px-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{godown.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {godown.managerEmail ?? "No login assigned"}
          </p>
        </div>
        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground">Products</p>
          <p className="text-sm font-medium tabular-nums">{godown.productCount}</p>
        </div>
        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground">Stock Units</p>
          <p className="text-sm font-medium tabular-nums">{formatNumber(godown.totalUnits)}</p>
        </div>
        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground">Updated</p>
          <p className="text-sm">{updatedLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground lg:hidden">
          <span>{godown.productCount} Products</span>
          <span aria-hidden="true">•</span>
          <span>{formatNumber(godown.totalUnits)} Units</span>
          <span aria-hidden="true">•</span>
          <span>Updated {updatedLabel}</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Godown actions">
            <Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(godown)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit name
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(godown)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete godown
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function GodownsPage() {
  const role = useAuthStore((s) => s.role);
  const { debouncedQuery } = useGlobalSearch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GodownSummary | null>(null);
  const [editing, setEditing] = useState<GodownSummary | null>(null);
  const [name, setName] = useState("");

  const { data: summary, isLoading, isError, refetch } = useGodownsSummary();
  const createGodown = useCreateGodown();
  const updateGodown = useUpdateGodown();
  const deleteGodown = useDeleteGodown();

  const godowns = summary?.godowns ?? [];
  const isEditMode = Boolean(editing);
  const saving = createGodown.isPending || updateGodown.isPending;
  const deleting = deleteGodown.isPending;

  const stats = useMemo(
    () => [
      { label: "Godowns", value: formatNumber(summary?.totals.godownCount ?? 0) },
      { label: "Products Stored", value: formatNumber(summary?.totals.productCount ?? 0) },
      { label: "Total Units", value: formatNumber(summary?.totals.totalUnits ?? 0) }
    ],
    [summary]
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return godowns;
    return godowns.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.managerEmail?.toLowerCase().includes(q) ?? false)
    );
  }, [godowns, debouncedQuery]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  };

  const openEdit = (godown: GodownSummary) => {
    setEditing(godown);
    setName(godown.name);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Godown name is required");
      return;
    }

    try {
      if (editing) {
        await updateGodown.mutateAsync({ id: editing.id, name: trimmed });
        toast.success("Godown updated", {
          description: `Renamed to "${trimmed}".`
        });
      } else {
        await createGodown.mutateAsync(trimmed);
        toast.success("Godown created", {
          description: `"${trimmed}" is now available as a location.`
        });
      }
      closeDialog();
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(isEditMode ? "Could not update godown" : "Could not create godown", {
        description: message ?? "Please try a different name."
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGodown.mutateAsync(deleteTarget.id);
      toast.success("Godown deleted", {
        description: `"${deleteTarget.name}" was removed. Past transfers remain visible in Activity.`
      });
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: { message?: string } | string } } }).response
              ?.data?.error
          : undefined;
      const description =
        typeof message === "string"
          ? message
          : message && typeof message === "object" && "message" in message
            ? String((message as { message?: string }).message)
            : "This godown may still have stock on hand.";
      toast.error("Could not delete godown", { description });
    }
  };

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Godowns"
        description="Manage warehouse locations for inventory storage."
        actions={
          <>
            <ExportButton
              path="/locations/export"
              filename="locations.xlsx"
              label="Export"
              className="h-9 px-3"
              variant="outline"
            />
            <Button className="h-9 px-3" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Godown
            </Button>
          </>
        }
      />

      <CompactStatRow stats={stats} loading={isLoading} />

      <section>
        {isLoading ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[96px] rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={Warehouse}
            title="Failed to load godowns"
            description="We couldn't fetch the godown list. Please try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={debouncedQuery ? "No godowns found" : "No godowns yet"}
            description={
              debouncedQuery
                ? "Try a different search term."
                : "Create your first godown to start storing inventory."
            }
            actionLabel={!debouncedQuery ? "New Godown" : undefined}
            onAction={!debouncedQuery ? openCreate : undefined}
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {filtered.map((godown) => (
              <GodownCard
                key={godown.id}
                godown={godown}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Godown" : "New Godown"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the godown name. It will update across inventory and transfers."
                : "Add a new warehouse location. It will appear across inventory and transfers."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="godown-name">
                Godown Name
                <RequiredMark />
              </Label>
              <Input
                id="godown-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Godown 3"
                required
                minLength={2}
                className="h-9"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" className="h-9 min-w-[100px]" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isEditMode ? (
                  <Pencil className="mr-2 h-4 w-4" />
                ) : (
                  <Building2 className="mr-2 h-4 w-4" />
                )}
                {isEditMode ? "Save changes" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete godown?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" can only be deleted when it has no stock on hand. Past transfers involving this godown will remain visible in Activity and Transfers.`
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
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
