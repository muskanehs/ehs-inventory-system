import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  useCategories,
  useCreateProduct,
  useProductUnits,
  useUpdateProduct
} from "@/hooks/use-products";
import type { Product } from "@/lib/types";
import { DEFAULT_PRODUCT_UNIT, PRODUCT_UNITS } from "@/lib/product-units";
import { cn } from "@/lib/utils";

const CUSTOM_UNIT_VALUE = "__custom_unit__";

function UnitSelect({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const isCustom = !options.includes(value);

  return (
    <div className="space-y-2">
      <Select
        value={isCustom ? CUSTOM_UNIT_VALUE : value}
        onValueChange={(next) => onChange(next === CUSTOM_UNIT_VALUE ? "" : next)}
      >
        <SelectTrigger className="h-9" aria-label={ariaLabel}>
          <SelectValue placeholder="Select unit" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_UNIT_VALUE}>Custom unit…</SelectItem>
        </SelectContent>
      </Select>
      {isCustom ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter custom unit"
          maxLength={30}
          required
          aria-label={`${ariaLabel} custom value`}
          className="h-9"
        />
      ) : null}
    </div>
  );
}

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
};

type DraftProduct = {
  key: string;
  name: string;
  sku: string;
  categoryId: string;
  unit: string;
  minimumStockLevel: string;
};

function emptyDraft(defaultCategoryId = ""): DraftProduct {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    sku: "",
    categoryId: defaultCategoryId,
    unit: DEFAULT_PRODUCT_UNIT,
    minimumStockLevel: "0"
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product
}: ProductFormDialogProps) {
  const isEditing = Boolean(product);
  const { data: categories = [] } = useCategories();
  const { data: savedUnits = [] } = useProductUnits();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState<string>(DEFAULT_PRODUCT_UNIT);
  const [minimumStockLevel, setMinimumStockLevel] = useState("0");
  const [rows, setRows] = useState<DraftProduct[]>([emptyDraft()]);
  const [submitting, setSubmitting] = useState(false);

  const unitOptions = useMemo(() => {
    const options = [...PRODUCT_UNITS, ...savedUnits];
    if (product?.unit) options.push(product.unit);
    return Array.from(new Set(options.filter(Boolean)));
  }, [product?.unit, savedUnits]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setSku(product.sku ?? "");
      setCategoryId(product.categoryId);
      setUnit(product.unit);
      setMinimumStockLevel(String(product.minimumStockLevel));
    } else {
      setRows([emptyDraft()]);
    }
  }, [open, product]);

  const updateRow = (index: number, patch: Partial<DraftProduct>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    const lastCategory = rows[rows.length - 1]?.categoryId ?? "";
    setRows((prev) => [...prev, emptyDraft(lastCategory)]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const onSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();

    const filled = rows.filter((row) => row.name.trim());
    if (filled.length === 0) {
      toast.error("Add at least one product name");
      return;
    }

    const missingCategory = filled.find((row) => !row.categoryId);
    if (missingCategory) {
      toast.error("Select a category for each product");
      return;
    }

    const missingUnit = filled.find((row) => !row.unit.trim());
    if (missingUnit) {
      toast.error("Select or enter a unit for each product");
      return;
    }

    const names = filled.map((row) => row.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error("Duplicate product names in the list");
      return;
    }

    const skus = filled.map((row) => row.sku.trim().toLowerCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      toast.error("Duplicate SKUs in the list");
      return;
    }

    setSubmitting(true);
    try {
      let created = 0;
      for (const row of filled) {
        const trimmedSku = row.sku.trim();
        await createProduct.mutateAsync({
          name: row.name.trim(),
          ...(trimmedSku ? { sku: trimmedSku } : {}),
          categoryId: row.categoryId,
          unit: row.unit.trim(),
          minimumStockLevel: Number(row.minimumStockLevel) || 0
        });
        created += 1;
      }
      toast.success(created === 1 ? "Product created" : `${created} products created`);
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to create products", {
        description: message ?? "Please check the form and try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error("Select a category");
      return;
    }
    if (!unit.trim()) {
      toast.error("Select or enter a unit");
      return;
    }

    try {
      const trimmedSku = sku.trim();
      const payload = {
        name: name.trim(),
        ...(trimmedSku ? { sku: trimmedSku } : { sku: "" }),
        categoryId,
        unit: unit.trim(),
        minimumStockLevel: Number(minimumStockLevel) || 0
      };

      if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...payload });
        toast.success("Product updated");
      }

      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error("Failed to update product", {
        description: message ?? "Please check the form."
      });
    }
  };

  const isPending = submitting || createProduct.isPending || updateProduct.isPending;
  const filledCount = rows.filter((r) => r.name.trim()).length;
  const createLabel = filledCount > 1 ? `Create ${filledCount} products` : "Create products";

  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details in the catalog.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pname">
                Product name
                <RequiredMark />
              </Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Category
                <RequiredMark />
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Quantity type
                <RequiredMark />
              </Label>
              <UnitSelect
                value={unit}
                options={unitOptions}
                onChange={setUnit}
                ariaLabel="Product unit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min">Minimum stock level</Label>
              <Input
                id="min"
                type="number"
                min={0}
                value={minimumStockLevel}
                onChange={(e) => setMinimumStockLevel(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-14 text-left">
          <DialogTitle>Add Products</DialogTitle>
          <DialogDescription>
            Add one or more products. Each row is a product - use Add product for more lines.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmitCreate} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="hidden gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_120px_72px_36px]">
              <span>
                Name
                <RequiredMark />
              </span>
              <span>SKU</span>
              <span>
                Category
                <RequiredMark />
              </span>
              <span>
                Unit
                <RequiredMark />
              </span>
              <span>Min</span>
              <span className="sr-only">Remove</span>
            </div>

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className={cn(
                    "grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_120px_72px_36px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
                  )}
                >
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="sm:hidden">
                      Name
                      <RequiredMark />
                    </Label>
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="Product name"
                      aria-label={`Product name ${index + 1}`}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="sm:hidden">SKU</Label>
                    <Input
                      value={row.sku}
                      onChange={(e) => updateRow(index, { sku: e.target.value })}
                      placeholder="Optional"
                      aria-label={`SKU ${index + 1}`}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="sm:hidden">
                      Category
                      <RequiredMark />
                    </Label>
                    <Select
                      value={row.categoryId}
                      onValueChange={(value) => updateRow(index, { categoryId: value })}
                    >
                      <SelectTrigger className="h-9" aria-label={`Category ${index + 1}`}>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="sm:hidden">
                      Unit
                      <RequiredMark />
                    </Label>
                    <UnitSelect
                      value={row.unit}
                      options={unitOptions}
                      onChange={(value) => updateRow(index, { unit: value })}
                      ariaLabel={`Unit ${index + 1}`}
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="sm:hidden">Min stock</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.minimumStockLevel}
                      onChange={(e) => updateRow(index, { minimumStockLevel: e.target.value })}
                      aria-label={`Min stock ${index + 1}`}
                      className="h-9"
                    />
                  </div>
                  <div className="flex justify-end sm:justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(index)}
                      aria-label={`Remove product ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 w-full border-dashed"
              onClick={addRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add product
            </Button>
          </div>

          <div className="shrink-0 border-t px-4 py-4 sm:px-6">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {createLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
