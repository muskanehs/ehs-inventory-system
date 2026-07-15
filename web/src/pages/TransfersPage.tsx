import { useMemo, useState, useEffect } from "react";
import { ArrowLeftRight, CheckCheck, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { CompactStatRow } from "@/components/enterprise/CompactStatRow";
import { TablePagination } from "@/components/enterprise/TablePagination";
import { ExportButton } from "@/components/ExportButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { FilterBar } from "@/components/SearchInput";
import { CreateTransferDialog } from "@/components/transfers/CreateTransferDialog";
import { TransferCard } from "@/components/transfers/TransferCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { useTransferStats, useTransfers, useTransferActions } from "@/hooks/use-transfers";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useAuthStore } from "@/store/auth";
import { formatNumber } from "@/lib/utils";
import type { TransferStatus } from "@/lib/types";

type DateFilter = "all" | "7d" | "30d" | "90d";

const PAGE_SIZE = 20;

const DATE_FILTER_DAYS: Record<DateFilter, string | undefined> = {
  all: undefined,
  "7d": "7",
  "30d": "30",
  "90d": "90"
};

export default function TransfersPage() {
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [destFilter, setDestFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const { debouncedQuery } = useGlobalSearch();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [approveAllOpen, setApproveAllOpen] = useState(false);

  const { data: transferPage, isLoading, isError, refetch } = useTransfers({
    page,
    limit: PAGE_SIZE,
    status: statusFilter,
    fromLocationId: sourceFilter,
    toLocationId: destFilter,
    search: debouncedQuery,
    days: DATE_FILTER_DAYS[dateFilter]
  });
  const { data: transferStats } = useTransferStats();
  const { data: locations = [] } = useLocations();
  const { approve, approveAll, reject } = useTransferActions();
  const role = useAuthStore((s) => s.role);
  const { isGodownScoped, assignedLocationName } = useLocationScope();
  const isAdmin = role === "ADMIN";
  const pendingCount = transferStats?.pending ?? 0;

  const transfers = transferPage && "items" in transferPage ? transferPage.items : [];
  const totalPages = transferPage && "totalPages" in transferPage ? transferPage.totalPages : 1;
  const totalItems = transferPage && "total" in transferPage ? transferPage.total : transfers.length;

  const stats = useMemo(
    () => [
      {
        label: "Pending",
        value: formatNumber(transferStats?.pending ?? 0)
      },
      {
        label: "Approved",
        value: formatNumber((transferStats?.approved ?? 0) + (transferStats?.completed ?? 0))
      },
      {
        label: "Rejected",
        value: formatNumber(transferStats?.rejected ?? 0)
      }
    ],
    [transferStats]
  );

  const runAction = async (
    action: () => Promise<unknown>,
    success: string,
    error: string
  ) => {
    try {
      await action();
      toast.success(success);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(error, { description: message });
    }
  };

  const handleApproveAll = async () => {
    try {
      const result = await approveAll.mutateAsync();
      setApproveAllOpen(false);
      if (result.total === 0) {
        toast.message("No pending transfers to approve");
        return;
      }
      if (result.failedCount === 0) {
        toast.success(
          `Approved ${result.approvedCount} transfer${result.approvedCount === 1 ? "" : "s"}`
        );
        return;
      }
      toast.warning(`Approved ${result.approvedCount} of ${result.total}`, {
        description:
          result.failed[0]?.reason ??
          `${result.failedCount} transfer${result.failedCount === 1 ? "" : "s"} could not be approved`
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Approve all failed", { description: message });
    }
  };

  const busy = approve.isPending || reject.isPending || approveAll.isPending;

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  return (
    <PageShell>
      <PageHeader
        title="Transfers"
        description={
          isGodownScoped && assignedLocationName
            ? `Transfers involving ${assignedLocationName}.`
            : "Request, approve, and track stock movement between locations."
        }
        actions={
          <>
            {isAdmin && pendingCount > 0 && (
              <Button
                variant="outline"
                className="h-9 px-3"
                disabled={busy}
                onClick={() => setApproveAllOpen(true)}
              >
                <CheckCheck className="h-4 w-4" />
                Approve All ({pendingCount})
              </Button>
            )}
            <ExportButton
              path="/transfers/export"
              filename="transfers.xlsx"
              label="Export"
              className="h-9 px-3"
              variant="outline"
            />
            <Button className="h-9 px-3" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Transfer
            </Button>
          </>
        }
      />

      <CompactStatRow stats={stats} loading={isLoading} />

      <FilterBar>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as TransferStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={dateFilter}
            onValueChange={(v) => {
              setDateFilter(v as DateFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Filter by date">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Filter by source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={destFilter}
            onValueChange={(v) => {
              setDestFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Filter by destination">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All destinations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <section>
        {isLoading ? (
          <div className="flex flex-col gap-6 lg:gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Failed to load transfers"
            description="Could not fetch transfer requests."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers found"
            description={
              debouncedQuery || statusFilter !== "all"
                ? "Try adjusting your filters or search term."
                : "Create a transfer request to move stock between locations."
            }
            actionLabel={!debouncedQuery && statusFilter === "all" ? "New Transfer" : undefined}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="flex flex-col gap-6 lg:gap-8">
            {transfers.map((transfer) => (
              <TransferCard
                key={transfer.id}
                transfer={transfer}
                busy={busy}
                isAdmin={isAdmin}
                onApprove={() =>
                  runAction(
                    () => approve.mutateAsync(transfer.id),
                    "Transfer approved — stock updated",
                    "Approve failed"
                  )
                }
                onReject={() =>
                  runAction(
                    () => reject.mutateAsync({ id: transfer.id, reason: "Rejected" }),
                    "Transfer rejected",
                    "Reject failed"
                  )
                }
              />
            ))}
          </div>
        )}

        {transfers.length > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </section>

      <CreateTransferDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={approveAllOpen} onOpenChange={setApproveAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve all pending transfers?</DialogTitle>
            <DialogDescription>
              This will approve all {pendingCount} pending transfer
              {pendingCount === 1 ? "" : "s"} and update stock immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={approveAll.isPending}
              onClick={() => setApproveAllOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={approveAll.isPending}
              onClick={() => void handleApproveAll()}
            >
              {approveAll.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" />
              )}
              Yes, approve all
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
