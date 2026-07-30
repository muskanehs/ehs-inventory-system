import { FormEvent, useEffect, useState } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/RequiredMark";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBatchMovements } from "@/hooks/use-inventory";
import { useProductPicker } from "@/hooks/use-products";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import type { MovementType } from "@/lib/types";
import { cn } from "@/lib/utils";

type AddStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProductId?: string;
};

type LineRow = { productId: string; quantity: string };

const emptyLine = (): LineRow => ({ productId: "", quantity: "1" });

const fieldInputClass = "h-11 rounded-lg text-sm";
const selectTriggerClass = "h-11 rounded-lg text-sm";

export function AddStockDialog({ open, onOpenChange, initialProductId }: AddStockDialogProps) {
  // "all" skips location stock filter so zero-qty products remain selectable (esp. godown managers).
  const { data: products = [] } = useProductPicker({ enabled: open, locationId: "all" });
  const { data: locations = [] } = useLocations({ enabled: open });
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();
  const createBatch = useCreateBatchMovements();

  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [locationId, setLocationId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("PURCHASE");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open) {
      setLines([{ productId: initialProductId ?? "", quantity: "1" }]);
      setMovementType("PURCHASE");
      setRemarks("");
      if (isGodownScoped && scopedLocationId) {
        setLocationId(scopedLocationId);
      } else if (!initialProductId) {
        setLocationId("");
      }
    }
  }, [open, initialProductId, isGodownScoped, scopedLocationId]);

  const updateLine = (index: number, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const adjustQuantity = (index: number, delta: number) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const current = Number(line.quantity) || 0;
        const next = Math.max(1, current + delta);
        return { ...line, quantity: String(next) };
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const resetForm = () => {
    setLines([emptyLine()]);
    setLocationId(isGodownScoped && scopedLocationId ? scopedLocationId : "");
    setMovementType("PURCHASE");
    setRemarks("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetLocationId = isGodownScoped && scopedLocationId ? scopedLocationId : locationId;

    if (!targetLocationId) {
      toast.error("Select a location");
      return;
    }

    const items: { productId: string; quantity: number }[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line.productId) {
        toast.error(`Select a product for row ${index + 1}`);
        return;
      }
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error(`Enter a quantity of at least 1 for row ${index + 1}`);
        return;
      }
      items.push({ productId: line.productId, quantity: qty });
    }

    const uniqueIds = new Set(items.map((item) => item.productId));
    if (uniqueIds.size !== items.length) {
      toast.error("Each product can only appear once");
      return;
    }

    try {
      await createBatch.mutateAsync({
        toLocationId: targetLocationId,
        movementType,
        remarks: remarks || undefined,
        items
      });
      toast.success(
        items.length === 1 ? "Stock updated" : `Stock updated for ${items.length} products`
      );
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to add stock", { description: message ?? "Check quantity and try again." });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) resetForm();
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-14 text-left">
          <DialogTitle>Add Stock</DialogTitle>
          <DialogDescription>
            Record incoming stock for one or more products at a location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label>
                Location
                <RequiredMark />
              </Label>
              {isGodownScoped && scopedLocationId ? (
                <Input
                  value={assignedLocationName ?? "Your godown"}
                  readOnly
                  disabled
                  className={cn(fieldInputClass, "bg-muted/50")}
                />
              ) : (
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Movement type</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as MovementType)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURCHASE">Purchase</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => {
                const selectedIds = lines
                  .map((row, rowIndex) => (rowIndex === index ? null : row.productId))
                  .filter(Boolean) as string[];
                const productOptions = products.filter(
                  (product) => product.id === line.productId || !selectedIds.includes(product.id)
                );

                return (
                  <div key={index} className="space-y-1.5">
                    {index === 0 && (
                      <Label>
                        Products
                        <RequiredMark />
                      </Label>
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="min-w-0 flex-1 basis-0">
                        <Select
                          value={line.productId}
                          onValueChange={(value) =>
                            updateLine(index, { productId: value, quantity: "1" })
                          }
                        >
                          <SelectTrigger
                            className={selectTriggerClass}
                            aria-label={`Product ${index + 1}`}
                          >
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {productOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {p.sku ? ` (${p.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-8 shrink-0 rounded-lg sm:w-9"
                          onClick={() => adjustQuantity(index, -1)}
                          disabled={!line.productId || Number(line.quantity) <= 1}
                          aria-label={`Decrease quantity for product ${index + 1}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={cn(fieldInputClass, "h-11 w-9 shrink-0 px-0.5 text-center sm:w-12")}
                          value={line.quantity}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, "");
                            updateLine(index, { quantity: raw });
                          }}
                          onBlur={() => {
                            if (!line.quantity || Number(line.quantity) < 1) {
                              updateLine(index, { quantity: "1" });
                            }
                          }}
                          aria-label={`Quantity for product ${index + 1}`}
                          disabled={!line.productId}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-8 shrink-0 rounded-lg sm:w-9"
                          onClick={() => adjustQuantity(index, 1)}
                          disabled={!line.productId}
                          aria-label={`Increase quantity for product ${index + 1}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-8 shrink-0 text-muted-foreground hover:text-destructive sm:w-9"
                          disabled={lines.length === 1}
                          onClick={() => removeLine(index)}
                          aria-label={`Remove product ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-dashed"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                disabled={products.length > 0 && lines.length >= products.length}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes for this stock entry"
                className="min-h-[80px] resize-none rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="submit" className="h-11 w-full" disabled={createBatch.isPending}>
              {createBatch.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Stock
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
