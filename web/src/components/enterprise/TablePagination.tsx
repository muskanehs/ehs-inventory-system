import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** `footer` — bottom of a panel; `standalone` — below a list outside a panel */
  variant?: "footer" | "standalone";
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  variant = "standalone",
  className
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const listStart = (page - 1) * pageSize + 1;
  const listEnd = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 sm:text-sm",
        variant === "footer"
          ? "border-t border-border/60 bg-muted/20"
          : "mt-4 rounded-lg border border-border/70 bg-card",
        className
      )}
    >
      <span className="text-center">
        Showing {listStart}–{listEnd} of {totalItems}
      </span>
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-[3.5rem] text-center text-[11px] tabular-nums sm:text-xs">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
