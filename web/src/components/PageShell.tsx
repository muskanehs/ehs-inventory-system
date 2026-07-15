import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("animate-fade-in space-y-6 sm:space-y-7", className)}>{children}</div>;
}
