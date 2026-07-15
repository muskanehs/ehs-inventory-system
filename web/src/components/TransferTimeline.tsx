import { Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransferStatus } from "@/lib/types";

const steps: { status: TransferStatus; label: string }[] = [
  { status: "PENDING", label: "Requested" },
  { status: "COMPLETED", label: "Approved" }
];

const statusOrder: Record<TransferStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: -1,
  COMPLETED: 1
};

type TransferTimelineProps = {
  status: TransferStatus;
  className?: string;
  compact?: boolean;
};

export function TransferTimeline({ status, className, compact }: TransferTimelineProps) {
  if (status === "REJECTED") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive",
          className
        )}
      >
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium">Transfer rejected</span>
      </div>
    );
  }

  const current = statusOrder[status];
  const nodeSize = compact ? "h-[18px] w-[18px]" : "h-5 w-5";
  const checkSize = compact ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <div
      className={cn("w-full rounded-lg border border-primary/10 bg-primary-muted/30 p-3", className)}
      role="list"
      aria-label="Transfer progress"
    >
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const stepIndex = statusOrder[step.status];
          const done = stepIndex <= current;
          const isCurrent = stepIndex === current;
          const isLast = index === steps.length - 1;
          const connectorDone = done && stepIndex < current;

          return (
            <li
              key={step.status}
              className={cn("flex min-w-0 items-start", !isLast && "flex-1")}
              role="listitem"
            >
              <div className="flex min-w-0 flex-col items-center gap-1.5 sm:gap-2">
                <span
                  className={cn(
                    "whitespace-nowrap font-medium leading-none transition-colors duration-200",
                    compact ? "text-[10px] sm:text-[11px]" : "text-[11px] sm:text-xs",
                    isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 transition-all duration-200",
                    nodeSize,
                    done
                      ? "border-primary/40 bg-primary-muted text-primary"
                      : "border-border bg-surface text-transparent",
                    isCurrent && "ring-2 ring-primary/30 ring-offset-2 ring-offset-primary-muted/30"
                  )}
                  aria-hidden="true"
                >
                  {done && <Check className={checkSize} strokeWidth={2.5} />}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1.5 mt-[calc(0.625rem+9px)] h-0.5 min-w-[12px] flex-1 rounded-full transition-colors duration-200 sm:mx-3 sm:mt-[calc(0.75rem+10px)] sm:min-w-[32px]",
                    connectorDone ? "bg-primary/45" : "bg-border/80"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
