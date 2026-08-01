import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductPicker } from "@/hooks/use-products";
import type { ProductPickerItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatProductLabel(product: Pick<ProductPickerItem, "name" | "sku">) {
  return product.sku ? `${product.name} (${product.sku})` : product.name;
}

type ProductComboboxProps = {
  value: string;
  onValueChange: (productId: string, product?: ProductPickerItem) => void;
  /** When set, only products with stock at this location are returned (transfer flow). */
  locationId?: string;
  /** Product IDs already selected on other rows. */
  excludeIds?: string[];
  /** Optional preloaded label when value is set before search results load. */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function ProductCombobox({
  value,
  onValueChange,
  locationId,
  excludeIds = [],
  selectedLabel,
  placeholder = "Select product",
  searchPlaceholder = "Type to search products…",
  disabled,
  className,
  "aria-label": ariaLabel
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductPickerItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search);

  const { data: products = [], isFetching } = useProductPicker({
    locationId,
    search: debouncedSearch,
    enabled: open || Boolean(value)
  });

  const options = useMemo(
    () =>
      products.filter(
        (product) => product.id === value || !excludeIds.includes(product.id)
      ),
    [products, excludeIds, value]
  );

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const match = products.find((product) => product.id === value);
    if (match) setSelected(match);
  }, [value, products]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const label =
    selected && selected.id === value
      ? formatProductLabel(selected)
      : selectedLabel || null;

  if (open) {
    return (
      <div
        ref={rootRef}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
          className
        )}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label="Search products"
            autoComplete="off"
          />
          {isFetching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close product search"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-48 overflow-y-auto p-1" role="listbox">
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {debouncedSearch ? "No products match your search." : "No products available."}
            </p>
          ) : (
            options.map((product) => {
              const isActive = product.id === value;
              return (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-primary-muted hover:text-primary",
                    isActive && "bg-primary-muted text-primary"
                  )}
                  onClick={() => {
                    setSelected(product);
                    onValueChange(product.id, product);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1 truncate">{formatProductLabel(product)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={false}
        aria-haspopup="listbox"
        className={cn(
          "h-11 w-full justify-between rounded-lg px-3 text-sm font-normal hover:bg-surface",
          !label && "text-muted-foreground"
        )}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{label ?? placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </div>
  );
}
