import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Download,
  Loader2,
  Phone,
  Truck,
  User
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/ui/surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { downloadDispatchSlip, downloadTransferSlip } from "@/lib/export";
import type { Transfer } from "@/lib/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type TransferCardProps = {
  transfer: Transfer;
  busy: boolean;
  isAdmin: boolean;
  onApprove: () => void;
  onReject: () => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-header">{children}</p>;
}

function CompactInfoItem({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="truncate text-sm font-medium leading-snug text-foreground">{value}</p>
    </div>
  );
}

function RouteHeader({
  from,
  to,
  isCustomer,
  customerName
}: {
  from: string;
  to: string;
  isCustomer: boolean;
  customerName?: string | null;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
          <span className="truncate">{from}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{isCustomer ? "Customer" : to}</span>
        </h3>
        {isCustomer && (
          <Badge variant="secondary" className="h-5 shrink-0 text-[11px] font-medium">
            Customer
          </Badge>
        )}
      </div>
      {isCustomer && customerName && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{customerName}</p>
      )}
    </div>
  );
}

export function TransferCard({
  transfer,
  busy,
  isAdmin,
  onApprove,
  onReject
}: TransferCardProps) {
  const requester = transfer.requestedByUser?.name ?? "Unknown";
  const isCustomer = transfer.transferType === "CUSTOMER";
  const fromName = transfer.fromLocation?.name ?? "—";
  const toName = transfer.toLocation?.name ?? "—";
  const itemCount = transfer.items.length;
  const totalQty = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

  const isRejected = transfer.status === "REJECTED";
  const canApprove = isAdmin && transfer.status === "PENDING";
  const showRejectionDetail =
    isRejected &&
    Boolean(transfer.rejectionReason?.trim()) &&
    transfer.rejectionReason!.trim().toLowerCase() !== "rejected";
  const hasDriverInfo =
    !isCustomer &&
    Boolean(transfer.driverName || transfer.vehicleNumber || transfer.vehicleContact);

  const handleDownloadSlip = async () => {
    try {
      if (isCustomer) {
        await downloadDispatchSlip(transfer.id);
        toast.success("Dispatch slip downloaded");
      } else {
        await downloadTransferSlip(transfer.id);
        toast.success("Transfer slip downloaded");
      }
    } catch {
      toast.error(isCustomer ? "Could not download dispatch slip" : "Could not download transfer slip");
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm",
        "transition-all duration-200 hover:border-primary/15 hover:shadow-panel"
      )}
    >
      <div className="border-b border-primary/10 bg-primary-muted/35 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <RouteHeader
            from={fromName}
            to={toName}
            isCustomer={isCustomer}
            customerName={transfer.customerName}
          />
          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
            <StatusBadge
              status={transfer.status}
              compact
              pendingLabel="Requested"
              className="transition-opacity duration-200 hover:opacity-90"
            />
            <time
              dateTime={transfer.createdAt}
              className="text-xs tabular-nums text-muted-foreground"
            >
              {formatDate(transfer.createdAt)}
            </time>
          </div>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Requested by{" "}
          <span className="font-medium text-foreground/80">{requester}</span>
          <span aria-hidden="true"> · </span>
          {formatNumber(itemCount)} {itemCount === 1 ? "product" : "products"} ·{" "}
          {formatNumber(totalQty)} total units
        </p>

        {canApprove && (
          <div
            className="mt-3 flex w-full flex-row gap-2 justify-end"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="destructive"
              className="h-9 flex-1 px-4 text-xs font-medium sm:flex-none sm:min-w-[88px]"
              disabled={busy}
              onClick={onReject}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className="h-9 flex-1 bg-success px-4 text-xs font-medium text-success-foreground hover:bg-success/90 sm:flex-none sm:min-w-[96px]"
              disabled={busy}
              onClick={onApprove}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
        {showRejectionDetail && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-2.5 text-sm leading-relaxed text-destructive">
            {transfer.rejectionReason}
          </div>
        )}

        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border-0">
            <AccordionTrigger className="justify-center gap-1.5 rounded-lg border border-border/60 bg-primary-muted/25 px-4 py-2.5 text-xs font-medium text-primary hover:bg-primary-muted/50 hover:text-primary hover:no-underline [&>svg]:text-primary/70">
              View details
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {isCustomer && (
                <section>
                  <SectionLabel>Customer Details</SectionLabel>
                  <div className="info-tint flex flex-col gap-4 px-4 py-3 sm:flex-row sm:px-5 sm:py-4">
                    <CompactInfoItem
                      icon={User}
                      label="Customer"
                      value={transfer.customerName ?? "Not provided"}
                    />
                    <CompactInfoItem
                      icon={Phone}
                      label="Phone"
                      value={transfer.customerPhone ?? "—"}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-9 gap-1.5 text-xs"
                    onClick={handleDownloadSlip}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Dispatch Slip
                  </Button>
                </section>
              )}

              {!isCustomer && (
                <section>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    onClick={handleDownloadSlip}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Transfer Slip
                  </Button>
                </section>
              )}

              <section>
                <SectionLabel>Products</SectionLabel>
                <DataPanel className="shadow-none hover:shadow-none">
                  <div className="hidden md:block">
                    <Table embedded>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-9 px-4 py-2">Product</TableHead>
                          <TableHead className="h-9 px-4 py-2">SKU</TableHead>
                          <TableHead className="h-9 px-4 py-2 text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfer.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="px-4 py-2.5 font-medium">
                              {item.product?.name ?? "—"}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                              {item.product?.sku ?? "—"}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-right tabular-nums">
                              <span className="font-medium">{formatNumber(item.quantity)}</span>{" "}
                              <span className="text-xs text-muted-foreground">
                                {item.product?.unit ?? ""}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="divide-y divide-border/60 md:hidden">
                    {transfer.items.map((item) => (
                      <div
                        key={item.id}
                        className="interactive-row flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-snug">
                            {item.product?.name ?? "—"}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {item.product?.sku ?? "—"}
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-sm tabular-nums">
                          <span className="font-semibold">{formatNumber(item.quantity)}</span>{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {item.product?.unit ?? ""}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </DataPanel>
              </section>

              {hasDriverInfo && (
                <section>
                  <div className="info-tint flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-start sm:gap-6 sm:px-5 sm:py-4">
                    <CompactInfoItem icon={User} label="Driver" value={transfer.driverName ?? "—"} />
                    <CompactInfoItem
                      icon={Truck}
                      label="Vehicle"
                      value={transfer.vehicleNumber ?? "—"}
                    />
                    <CompactInfoItem
                      icon={Phone}
                      label="Contact"
                      value={transfer.vehicleContact ?? "—"}
                    />
                  </div>
                </section>
              )}

              {transfer.remarks && (
                <section>
                  <SectionLabel>Remarks</SectionLabel>
                  <div className="rounded-lg border border-border/60 bg-primary-muted/25 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                    {transfer.remarks}
                  </div>
                </section>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </article>
  );
}
