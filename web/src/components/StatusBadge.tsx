import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { TransferStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  TransferStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]> }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "info" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  COMPLETED: { label: "Approved", variant: "success" }
};

type StatusBadgeProps = {
  status: TransferStatus;
  className?: string;
  compact?: boolean;
  pendingLabel?: "Pending" | "Requested";
};

export function StatusBadge({
  status,
  className,
  compact = false,
  pendingLabel = "Pending"
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const label = status === "PENDING" ? pendingLabel : config.label;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        compact && "h-5 shrink-0 rounded-md px-2 py-0 text-[11px] font-medium",
        className
      )}
    >
      {label}
    </Badge>
  );
}
