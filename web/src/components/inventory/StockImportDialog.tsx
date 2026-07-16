import { useRef, useState } from "react";
import { Download, FileUp, Loader2, Package, PackagePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { downloadExport, uploadImport } from "@/lib/export";
import { useAuthStore } from "@/store/auth";

type ImportKind = "products" | "stock" | null;

type StockImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StockImportDialog({ open, onOpenChange }: StockImportDialogProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const canImportProducts = role === "ADMIN" || role === "STORE_MANAGER";

  const [kind, setKind] = useState<ImportKind>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setKind(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDownloadTemplate = async () => {
    if (!kind) return;
    setDownloading(true);
    try {
      const path = kind === "products" ? "/import/products/template" : "/import/stock/template";
      const filename = kind === "products" ? "product-import-template.xlsx" : "stock-import-template.xlsx";
      await downloadExport(path, filename);
    } catch (error) {
      toast.error("Could not download template", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!kind) return;
    setUploading(true);
    try {
      const path = kind === "products" ? "/import/products" : "/import/stock";
      const result = await uploadImport(path, file);
      const errorCount = result.errors.length;
      if (result.created > 0 || result.skipped > 0) {
        toast.success("Import finished", {
          description: `${result.created} imported${result.skipped ? `, ${result.skipped} skipped` : ""}${errorCount ? `, ${errorCount} failed` : ""}.`
        });
      } else if (errorCount > 0) {
        toast.error("Import failed", {
          description: result.errors[0]?.message ?? "No rows were imported."
        });
      } else {
        toast.info("No rows to import");
      }

      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      handleClose(false);
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Please check your file and try again."
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import data</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file. Stock imports add to existing quantities — they never
            overwrite current stock.
          </DialogDescription>
        </DialogHeader>

        {!kind ? (
          <div className="grid gap-2">
            {canImportProducts ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3"
                onClick={() => setKind("products")}
              >
                <Package className="h-5 w-5 shrink-0 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Import products</p>
                  <p className="text-xs text-muted-foreground">Add new products from a spreadsheet</p>
                </div>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => setKind("stock")}
            >
              <PackagePlus className="h-5 w-5 shrink-0 text-primary" />
              <div className="text-left">
                <p className="font-medium">Import stock</p>
                <p className="text-xs text-muted-foreground">
                  Increase stock levels at a location
                </p>
              </div>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {kind === "products" ? "Import products" : "Import stock"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={() => void handleDownloadTemplate()}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download template
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Choose file
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setKind(null)}>
                Back
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats: .xlsx, .csv (max 5 MB)
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
