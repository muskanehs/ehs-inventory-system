import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useCreateMovement } from "@/hooks/use-inventory";
import { useProductPicker } from "@/hooks/use-products";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import type { MovementType } from "@/lib/types";

type AddStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProductId?: string;
};

export function AddStockDialog({ open, onOpenChange, initialProductId }: AddStockDialogProps) {
  const { data: products = [] } = useProductPicker({ enabled: open });
  const { data: locations = [] } = useLocations({ enabled: open });
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();
  const createMovement = useCreateMovement();

  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("PURCHASE");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open) {
      setProductId(initialProductId ?? "");
      setQuantity("");
      if (isGodownScoped && scopedLocationId) {
        setLocationId(scopedLocationId);
      }
    }
  }, [open, initialProductId, isGodownScoped, scopedLocationId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetLocationId = isGodownScoped && scopedLocationId ? scopedLocationId : locationId;

    if (!productId || !targetLocationId) {
      toast.error("Select product and location");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Enter a quantity of at least 1");
      return;
    }

    try {
      await createMovement.mutateAsync({
        productId,
        toLocationId: targetLocationId,
        quantity: qty,
        movementType,
        remarks: remarks || undefined
      });
      toast.success("Stock updated");
      onOpenChange(false);
      setProductId("");
      setLocationId("");
      setQuantity("");
      setRemarks("");
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to add stock", { description: message ?? "Check quantity and try again." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Stock</DialogTitle>
          <DialogDescription>Record incoming stock at a location.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>
              Product
              <RequiredMark />
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.sku ? ` (${p.sku})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                className="bg-muted/50"
              />
            ) : (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qty">
                Quantity
                <RequiredMark />
              </Label>
              <Input
                id="qty"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, "");
                  setQuantity(next);
                }}
                placeholder="Enter quantity"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Movement type</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as MovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURCHASE">Purchase</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={createMovement.isPending}>
            {createMovement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Stock
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
