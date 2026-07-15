import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClipboardList,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Trash2,
  Truck,
  User,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { RequiredMark } from "@/components/RequiredMark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProductPicker } from "@/hooks/use-products";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { useCreateTransfer } from "@/hooks/use-transfers";
import { downloadDispatchSlip, downloadTransferSlip } from "@/lib/export";
import type { TransferType } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type LineRow = { productId: string; quantity: string };

type CreateTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const emptyLine = (): LineRow => ({ productId: "", quantity: "1" });

const fieldInputClass = "h-11 rounded-lg text-sm";
const selectTriggerClass = "h-11 rounded-lg text-sm";

function FormSection({
  title,
  icon: Icon,
  children,
  className
}: {
  title: string;
  icon: typeof MapPin;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children}
    </label>
  );
}

export function CreateTransferDialog({ open, onOpenChange }: CreateTransferDialogProps) {
  const { data: locations = [] } = useLocations({ enabled: open });
  const createTransfer = useCreateTransfer();
  const { isGodownScoped, scopedLocationId, assignedLocationName } = useLocationScope();

  const sourceLocations = isGodownScoped && scopedLocationId
    ? locations.filter((location) => location.id === scopedLocationId)
    : locations;

  const [transferType, setTransferType] = useState<TransferType>("INTERNAL");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleContact, setVehicleContact] = useState("");
  const [showVehicle, setShowVehicle] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  const { data: pickerProducts = [] } = useProductPicker({
    locationId: fromLocationId || undefined,
    enabled: open && !!fromLocationId
  });

  const stockAtSource = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of pickerProducts) {
      map.set(product.id, product.availableQty ?? 0);
    }
    return map;
  }, [pickerProducts]);

  const availableProducts = pickerProducts;

  useEffect(() => {
    if (open && isGodownScoped && scopedLocationId && !fromLocationId) {
      setFromLocationId(scopedLocationId);
    }
  }, [open, isGodownScoped, scopedLocationId, fromLocationId]);

  useEffect(() => {
    if (!open || transferType !== "CUSTOMER") return;
    if (isGodownScoped && scopedLocationId) {
      setFromLocationId(scopedLocationId);
      return;
    }
    if (!fromLocationId && locations.length > 0) {
      const defaultLocation = locations.find((l) => l.type === "GODOWN") ?? locations[0];
      setFromLocationId(defaultLocation.id);
    }
  }, [open, transferType, isGodownScoped, scopedLocationId, locations, fromLocationId]);

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        if (!line.productId) return line;
        const available = stockAtSource.get(line.productId) ?? 0;
        if (available <= 0) return { ...line, productId: "" };
        const qty = Number(line.quantity) || 1;
        if (qty > available) return { ...line, quantity: String(available) };
        return line;
      })
    );
  }, [fromLocationId, stockAtSource]);

  const resetForm = () => {
    setTransferType("INTERNAL");
    setFromLocationId(isGodownScoped && scopedLocationId ? scopedLocationId : "");
    setToLocationId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDriverName("");
    setVehicleNumber("");
    setVehicleContact("");
    setShowVehicle(false);
    setRemarks("");
    setLines([emptyLine()]);
  };

  const updateLine = (index: number, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const adjustQuantity = (index: number, delta: number) => {
    const line = lines[index];
    const available = line?.productId ? stockAtSource.get(line.productId) ?? 0 : Infinity;
    const current = Number(line?.quantity) || 1;
    const next = Math.max(1, Math.min(available || 1, current + delta));
    updateLine(index, { quantity: String(next) });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fromLocationId) {
      toast.error("Source location is not available");
      return;
    }
    if (transferType === "INTERNAL") {
      if (!toLocationId) {
        toast.error("Select destination location");
        return;
      }
      if (fromLocationId === toLocationId) {
        toast.error("Source and destination must differ");
        return;
      }
    }

    const items = lines
      .filter((l) => l.productId)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));

    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    const productIds = items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      toast.error("Duplicate products are not allowed");
      return;
    }

    if (items.some((i) => !Number.isFinite(i.quantity) || i.quantity < 1)) {
      toast.error("Each quantity must be at least 1");
      return;
    }

    const overStock = items.find((item) => {
      const available = stockAtSource.get(item.productId) ?? 0;
      return item.quantity > available;
    });
    if (overStock) {
      const product = pickerProducts.find((p) => p.id === overStock.productId);
      const available = stockAtSource.get(overStock.productId) ?? 0;
      toast.error("Insufficient stock", {
        description: `${product?.name ?? "Product"} has only ${formatNumber(available)} available at source.`
      });
      return;
    }

    try {
      const created = await createTransfer.mutateAsync({
        transferType,
        fromLocationId,
        toLocationId: transferType === "INTERNAL" ? toLocationId : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        driverName: driverName.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        vehicleContact: vehicleContact.trim() || undefined,
        remarks: remarks || undefined,
        items
      });

      if (transferType === "CUSTOMER") {
        try {
          await downloadDispatchSlip(created.id);
          toast.success("Transfer requested", { description: "Dispatch slip downloaded." });
        } catch {
          toast.success("Transfer requested", {
            description: "Dispatch slip could not be downloaded. Use the transfer card to retry."
          });
        }
      } else {
        try {
          await downloadTransferSlip(created.id);
          toast.success("Transfer requested", { description: "Transfer slip downloaded." });
        } catch {
          toast.success("Transfer requested", {
            description: "Transfer slip could not be downloaded. Use the transfer card to retry."
          });
        }
      }

      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to create transfer", { description: message });
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
      <DialogContent className="flex max-h-[min(90vh,100dvh-2rem)] w-[calc(100%-2rem)] max-w-[680px] flex-col gap-0 overflow-hidden p-0 duration-200">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Request Transfer</DialogTitle>
          <DialogDescription>Move stock between locations or dispatch to a customer.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1">
              <Button
                type="button"
                variant={transferType === "INTERNAL" ? "secondary" : "ghost"}
                className="h-10"
                onClick={() => setTransferType("INTERNAL")}
              >
                Internal
              </Button>
              <Button
                type="button"
                variant={transferType === "CUSTOMER" ? "secondary" : "ghost"}
                className="h-10"
                onClick={() => setTransferType("CUSTOMER")}
              >
                Customer
              </Button>
            </div>

            {transferType === "INTERNAL" && (
              <FormSection title="Transfer Details" icon={MapPin}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <FieldLabel>
                      From
                      <RequiredMark />
                    </FieldLabel>
                    <Select
                      value={fromLocationId}
                      onValueChange={(value) => {
                        setFromLocationId(value);
                        setLines([emptyLine()]);
                      }}
                      disabled={isGodownScoped}
                    >
                      <SelectTrigger className={selectTriggerClass} aria-label="From location">
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <FieldLabel>
                      To
                      <RequiredMark />
                    </FieldLabel>
                    <Select value={toLocationId} onValueChange={setToLocationId}>
                      <SelectTrigger className={selectTriggerClass} aria-label="To location">
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter((location) => location.id !== fromLocationId)
                          .map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>
            )}

            {transferType === "CUSTOMER" && isGodownScoped && assignedLocationName && (
              <p className="text-xs text-muted-foreground">
                Stock will be dispatched from {assignedLocationName}.
              </p>
            )}

            {transferType === "CUSTOMER" && (
              <FormSection title="Customer Details" icon={Users}>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="customer-name">Customer Name</FieldLabel>
                    <Input
                      id="customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Optional"
                      className={fieldInputClass}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="customer-phone">Phone</FieldLabel>
                      <Input
                        id="customer-phone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Optional"
                        className={fieldInputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="customer-address">Address</FieldLabel>
                      <Input
                        id="customer-address"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Optional"
                        className={fieldInputClass}
                      />
                    </div>
                  </div>
                </div>
              </FormSection>
            )}

            {transferType === "INTERNAL" && (
              <FormSection title="Vehicle Details (Optional)" icon={Truck}>
                {!showVehicle ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => setShowVehicle(true)}
                  >
                    Add vehicle details
                  </Button>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="driver">Driver Name</FieldLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="driver"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Optional"
                          className={cn(fieldInputClass, "pl-9")}
                        />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="vehicle">Vehicle Number</FieldLabel>
                        <div className="relative">
                          <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="vehicle"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            placeholder="Optional"
                            className={cn(fieldInputClass, "pl-9")}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="contact">Contact Number</FieldLabel>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="contact"
                            value={vehicleContact}
                            onChange={(e) => setVehicleContact(e.target.value)}
                            placeholder="Optional"
                            className={cn(fieldInputClass, "pl-9")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </FormSection>
            )}

            <FormSection title="Products" icon={Package}>
              {!fromLocationId ? (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  Select a source location to see products with available stock.
                </p>
              ) : availableProducts.length === 0 ? (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  No products with available stock at the selected location.
                </p>
              ) : (
              <div className="space-y-2">
                {lines.map((line, index) => {
                  const available = line.productId ? stockAtSource.get(line.productId) ?? 0 : 0;
                  const selectedIds = lines
                    .map((row, rowIndex) => (rowIndex === index ? null : row.productId))
                    .filter(Boolean) as string[];
                  const productOptions = availableProducts.filter(
                    (product) =>
                      product.id === line.productId || !selectedIds.includes(product.id)
                  );

                  const selectedProduct = pickerProducts.find((p) => p.id === line.productId);

                  return (
                  <div key={index} className="animate-in fade-in-0 slide-in-from-top-1 space-y-1.5 duration-200">
                    {index === 0 && (
                      <FieldLabel>
                        Product
                        <RequiredMark />
                      </FieldLabel>
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="min-w-0 flex-1 basis-0">
                        <Select
                          value={line.productId}
                          onValueChange={(value) => updateLine(index, { productId: value, quantity: "1" })}
                        >
                          <SelectTrigger className={selectTriggerClass} aria-label={`Product ${index + 1}`}>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4}>
                            {productOptions.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}{product.sku ? ` (${product.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                        <span className="sr-only">
                          Quantity
                          <RequiredMark />
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-8 shrink-0 rounded-lg sm:w-9"
                          onClick={() => adjustQuantity(index, -1)}
                          disabled={!line.productId}
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
                            if (raw === "") {
                              updateLine(index, { quantity: "" });
                              return;
                            }
                            const parsed = Number(raw);
                            if (!line.productId || !Number.isFinite(parsed)) {
                              updateLine(index, { quantity: raw });
                              return;
                            }
                            const capped = Math.min(parsed, available || parsed);
                            updateLine(index, { quantity: String(capped) });
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
                          disabled={!line.productId || Number(line.quantity) >= available}
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {line.productId && (
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(available)} {selectedProduct?.unit ?? "units"} available at source
                      </p>
                    )}
                  </div>
                );
                })}

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-lg border-dashed"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                  disabled={lines.length >= availableProducts.length}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>
              )}
            </FormSection>

            <FormSection title="Remarks" icon={ClipboardList}>
              <Textarea
                id="tremarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any notes for this transfer..."
                className="min-h-[80px] resize-none rounded-lg text-sm"
              />
            </FormSection>
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-12 min-h-11 w-full rounded-lg sm:w-auto sm:px-6"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-12 min-h-11 w-full rounded-lg sm:w-auto sm:px-6"
                disabled={createTransfer.isPending}
              >
                {createTransfer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Request
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
