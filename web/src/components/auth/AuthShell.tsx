import type { ReactNode } from "react";
import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />
    </div>
  );
}

export function AuthLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-12 w-12" };
  const icon = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-5 w-5" };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        dims[size]
      )}
      aria-hidden="true"
    >
      <Warehouse className={icon[size]} />
    </div>
  );
}

export function AuthHeader({ className }: { className?: string }) {
  return (
    <header className={cn("flex flex-col items-center text-center", className)}>
      <AuthLogo size="lg" />
      <h1 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Economic Hardware Store
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Enterprise Inventory Platform</p>
    </header>
  );
}

export function AuthFooter({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      Secure inventory access for store and godown operations.
    </p>
  );
}

export function AuthCard({
  title,
  description,
  children,
  className
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[400px] animate-fade-up rounded-lg border border-border/70 bg-card p-6 shadow-panel sm:p-7",
        className
      )}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center gap-6">
        <AuthHeader />
        {children}
        <AuthFooter />
      </div>
    </div>
  );
}

export function validatePasswordClient(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must include at least one number";
  return null;
}
