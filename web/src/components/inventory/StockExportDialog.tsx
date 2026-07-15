import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useCategories } from "@/hooks/use-products";
import { useLocations } from "@/hooks/use-locations";
import { useLocationScope } from "@/hooks/use-location-scope";
import { downloadExport } from "@/lib/export";
import { cn } from "@/lib/utils";

type GroupBy = "none" | "category" | "location";

type StockExportDialogProps = {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
};

export function StockExportDialog({
  className,
  variant = "outline",
  label = "Export"
}: StockExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [loading, setLoading] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();
  const { scopedLocationId } = useLocationScope();

  useEffect(() => {
    if (open && scopedLocationId) {
      setLocationId(scopedLocationId);
    }
  }, [open, scopedLocationId]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {
        groupBy: groupBy === "none" ? undefined : groupBy,
        categoryId: categoryId === "all" ? undefined : categoryId,
        locationId: locationId === "all" ? undefined : locationId
      };

      const filename =
        groupBy === "category"
          ? "inventory-by-category.xlsx"
          : groupBy === "location"
            ? "inventory-by-location.xlsx"
            : "inventory-report.xlsx";

      await downloadExport("/reports/inventory/export", filename, params);
      toast.success("Export downloaded");
      setOpen(false);
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={cn("h-9 px-3", className)}>
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Stock</DialogTitle>
          <DialogDescription>Filter and group inventory data before export.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Export mode</label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Flat list</SelectItem>
                <SelectItem value="category">Group by category (sheets)</SelectItem>
                <SelectItem value="location">Group by location (sheets)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="h-9" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-9" disabled={loading} onClick={handleExport}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
