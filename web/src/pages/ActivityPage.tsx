import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Package } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPanel } from "@/components/ui/surface";
import { StatusBadge } from "@/components/StatusBadge";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { useMovements } from "@/hooks/use-movements";
import { useTransfers } from "@/hooks/use-transfers";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type ActivityTab = "stock" | "transfers";

const PAGE_SIZE = 20;

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
  const { debouncedQuery } = useGlobalSearch();
  const { isGodownScoped, assignedLocationName } = useLocationScope();
  const { data: locations = [] } = useLocations();

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

  const isLoading = tab === "stock" ? movementsLoading : transfersLoading;

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        description={
          isGodownScoped && assignedLocationName
            ? `Stock entries and transfers for ${assignedLocationName}.`
            : "Dates and details for stock entries and transfers."
        }
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
                {movements.map((movement) => (
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
                    <time
                      dateTime={movement.createdAt}
                      className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs"
                    >
                      {formatDate(movement.createdAt)}
                    </time>
                  </article>
                ))}
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
                        {formatNumber(totalQty)} pieces
                        {transfer.requestedByUser?.name ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            {transfer.requestedByUser.name}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
                      <time
                        dateTime={eventDate}
                        className="text-[11px] font-medium text-muted-foreground sm:text-xs"
                      >
                        {formatDate(eventDate)}
                      </time>
                      {transfer.completedAt && transfer.createdAt !== transfer.completedAt && (
                        <span className="text-[10px] text-muted-foreground/80">
                          Requested {formatDate(transfer.createdAt)}
                        </span>
                      )}
                    </div>
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
    </PageShell>
  );
}
