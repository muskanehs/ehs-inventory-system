import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2, Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/ExportButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { RequiredMark } from "@/components/RequiredMark";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPanel } from "@/components/ui/surface";
import { StatusBadge } from "@/components/StatusBadge";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useLocations } from "@/hooks/use-locations";
import { useMovements, useUpdateMovement } from "@/hooks/use-movements";
import { useTransfers } from "@/hooks/use-transfers";
import { useAuthStore } from "@/store/auth";
import type { StockMovement } from "@/lib/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type ActivityTab = "stock" | "transfers";

const PAGE_SIZE = 25;

const EDITABLE_MOVEMENT_TYPES = new Set(["PURCHASE", "RETURN", "ADJUSTMENT"]);

function locationName(
  id: string | null | undefined,
  map: Map<string, string>
): string {
  if (!id) return "-";
  return map.get(id) ?? "Unknown";
}

export default function ActivityPage() {
  const [tab, setTab] = useState<ActivityTab>("stock");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<StockMovement | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const { debouncedQuery } = useGlobalSearch();
  const { data: locations = [] } = useLocations();
  const role = useAuthStore((s) => s.role);
  const canEditStock =
    role === "ADMIN" || role === "STORE_MANAGER" || role === "GODOWN_MANAGER";
  const updateMovement = useUpdateMovement();

  const { data: movementPage, isLoading: movementsLoading } = useMovements(
    { page, limit: PAGE_SIZE, search: debouncedQuery },
    { enabled: tab === "stock" }
  );

  const { data: transferPage, isLoading: transfersLoading } = useTransfers(
    {
      page,
      limit: PAGE_SIZE,
      status: "all",
      fromLocationId: "all",
      toLocationId: "all",
      search: debouncedQuery
    },
    { enabled: tab === "transfers" }
  );

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations]
  );

  const movements =
    movementPage && "items" in movementPage ? movementPage.items : [];
  const movementTotal =
    movementPage && "total" in movementPage ? movementPage.total : movements.length;
  const movementTotalPages =
    movementPage && "totalPages" in movementPage ? movementPage.totalPages : 1;

  const transfers = transferPage && "items" in transferPage ? transferPage.items : [];
  const transferTotal =
    transferPage && "total" in transferPage ? transferPage.total : transfers.length;
  const transferTotalPages =
    transferPage && "totalPages" in transferPage ? transferPage.totalPages : 1;

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, tab]);

  useEffect(() => {
    if (editTarget) {
      setEditQuantity(String(editTarget.quantity));
    }
  }, [editTarget]);

  const isLoading = tab === "stock" ? movementsLoading : transfersLoading;

  const onSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const qty = Number(editQuantity);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Enter a quantity of at least 1");
      return;
    }
    try {
      await updateMovement.mutateAsync({ id: editTarget.id, quantity: qty });
      toast.success("Stock entry updated");
      setEditTarget(null);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to update stock entry", {
        description: message ?? "Check quantity and try again."
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        actions={
          tab === "stock" ? (
            <ExportButton path="/movements/export" filename="movements.xlsx" label="Export" />
          ) : (
            <ExportButton path="/transfers/export" filename="transfers.xlsx" label="Export" />
          )
        }
      />

      <div className="flex w-full max-w-md rounded-md border border-border/70 bg-muted/30 p-0.5">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-8 flex-1 rounded-sm px-3 text-xs font-medium sm:text-sm",
            tab === "stock" &&
              "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => setTab("stock")}
        >
          Stock Entries
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-8 flex-1 rounded-sm px-3 text-xs font-medium sm:text-sm",
            tab === "transfers" &&
              "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => setTab("transfers")}
        >
          Transfers
        </Button>
      </div>

      <section className="space-y-3">
        {isLoading ? (
          <DataPanel className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 sm:px-4">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-1.5 h-3 w-3/5" />
              </div>
            ))}
          </DataPanel>
        ) : tab === "stock" ? (
          movementTotal === 0 ? (
            <EmptyState
              icon={Package}
              title="No stock entries"
              description={
                debouncedQuery
                  ? "Try a different search term."
                  : "Stock additions and adjustments will appear here with their entry date."
              }
            />
          ) : (
            <DataPanel>
              <div className="divide-y divide-border/60">
                {movements.map((movement) => {
                  const canEdit =
                    canEditStock && EDITABLE_MOVEMENT_TYPES.has(movement.movementType);

                  return (
                    <article
                      key={movement.id}
                      className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{movement.product.name}</p>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] sm:text-[11px]">
                            {movement.movementType}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                          <span className="font-mono">{movement.product.sku ?? "-"}</span>
                          <span aria-hidden="true"> · </span>
                          {formatNumber(movement.quantity)} pieces
                          {movement.fromLocationId || movement.toLocationId ? (
                            <>
                              <span aria-hidden="true"> · </span>
                              {movement.fromLocationId
                                ? locationName(movement.fromLocationId, locationMap)
                                : "-"}{" "}
                              → {locationName(movement.toLocationId, locationMap)}
                            </>
                          ) : null}
                          <span aria-hidden="true"> · </span>
                          {movement.user.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={`Edit ${movement.product.name} stock entry`}
                            onClick={() => setEditTarget(movement)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <time
                          dateTime={movement.createdAt}
                          className="text-[11px] font-medium text-muted-foreground sm:text-xs"
                        >
                          {formatDate(movement.createdAt)}
                        </time>
                      </div>
                    </article>
                  );
                })}
              </div>
              <TablePagination
                variant="footer"
                page={page}
                totalPages={movementTotalPages}
                totalItems={movementTotal}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </DataPanel>
          )
        ) : transferTotal === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers"
            description={
              debouncedQuery
                ? "Try a different search term."
                : "Transfer requests and completions will appear here with their dates."
            }
          />
        ) : (
          <DataPanel>
            <div className="divide-y divide-border/60">
              {transfers.map((transfer) => {
                const itemCount = transfer.items.length;
                const totalQty = transfer.items.reduce((sum, i) => sum + i.quantity, 0);
                const eventDate = transfer.completedAt ?? transfer.createdAt;

                return (
                  <article
                    key={transfer.id}
                    className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {transfer.fromLocation?.name ?? "-"} →{" "}
                          {transfer.toLocation?.name ?? transfer.customerName ?? "Customer"}
                        </p>
                        <StatusBadge status={transfer.status} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                        {formatNumber(itemCount)} {itemCount === 1 ? "product" : "products"} ·{" "}
                        {formatNumber(totalQty)} units ·{" "}
                        {transfer.requestedByUser?.name ?? "Unknown"}
                      </p>
                    </div>
                    <time
                      dateTime={eventDate}
                      className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs"
                    >
                      {formatDate(eventDate)}
                    </time>
                  </article>
                );
              })}
            </div>
            <TablePagination
              variant="footer"
              page={page}
              totalPages={transferTotalPages}
              totalItems={transferTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </DataPanel>
        )}
      </section>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit stock entry</DialogTitle>
            <DialogDescription>
              Change the quantity for {editTarget?.product.name}. Inventory will be adjusted by the
              difference from the original entry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-qty">
                Quantity
                <RequiredMark />
              </Label>
              <Input
                id="edit-qty"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value.replace(/[^\d]/g, ""))}
                required
              />
              {editTarget ? (
                <p className="text-xs text-muted-foreground">
                  Original quantity: {formatNumber(editTarget.quantity)}{" "}
                  {editTarget.product.unit}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={updateMovement.isPending}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMovement.isPending}>
                {updateMovement.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
