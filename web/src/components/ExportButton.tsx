import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadExport } from "@/lib/export";
import { cn } from "@/lib/utils";

type ExportButtonProps = {
  path: string;
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export function ExportButton({
  path,
  filename,
  label = "Export Excel",
  variant = "outline",
  size = "default",
  className
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await downloadExport(path, filename);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed", { description: "Could not download the file." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={loading}
      className={cn(className)}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
