import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Package,
  ShieldCheck,
  Warehouse
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { RequiredMark } from "@/components/RequiredMark";
import type { ApiResponse, AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const DEMO_EMAIL = "admin@inventory.local";
const DEMO_PASSWORD = "Admin@123";
const isDev = import.meta.env.DEV;

function EnterpriseBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-primary/[0.12] blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-[360px] w-[360px] rounded-full bg-sky-300/20 blur-3xl dark:bg-primary/10" />
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)"
        }}
      />
    </div>
  );
}

function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-12 w-12" };
  const icon = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-5 w-5" };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft",
        dims[size]
      )}
      aria-hidden="true"
    >
      <Warehouse className={icon[size]} strokeWidth={1.75} />
    </div>
  );
}

function AppHeader({ className }: { className?: string }) {
  return (
    <header className={cn("flex flex-col items-center text-center", className)}>
      <AppLogo size="lg" />
      <h1 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        EHS
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Inventory platform</p>
    </header>
  );
}

function PageFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("flex flex-col items-center text-center", className)}>
      <div className="mb-4 h-px w-16 bg-border" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        Secure access for store and godown operations.
      </p>
    </footer>
  );
}

type FilledInputProps = {
  id: string;
  name: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  icon: "email" | "password";
  trailing?: React.ReactNode;
};

function FilledInput({
  id,
  name,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  icon,
  trailing
}: FilledInputProps) {
  const Icon = icon === "email" ? Mail : Lock;

  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        disabled={disabled}
        className={cn("h-11 bg-muted/40 pl-10", trailing && "pr-10")}
      />
      {trailing}
    </div>
  );
}

function DemoCredentials() {
  const [open, setOpen] = useState(false);

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${DEMO_EMAIL}\nPassword: ${DEMO_PASSWORD}`);
      toast.success("Credentials copied");
    } catch {
      toast.error("Could not copy credentials");
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
        aria-expanded={open}
      >
        Development credentials
        <span className="flex items-center gap-1">
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-muted-foreground">
            Admin · <span className="text-foreground">{DEMO_EMAIL}</span>
          </p>
          <button
            type="button"
            onClick={copyCredentials}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary/80"
          >
            <Copy className="h-3 w-3" />
            Copy credentials
          </button>
        </div>
      )}
    </div>
  );
}

function LoginCard({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post<ApiResponse<LoginResponse>>("/auth/login", {
        email,
        password
      });
      const { user } = response.data.data;
      setAuth(
        user.role,
        user.name,
        user.email ?? email,
        user.assignedLocationId,
        user.assignedLocation?.name,
        user.mustChangePassword ?? false,
        user.canSwitchUsers ?? user.role === "ADMIN"
      );
      toast.success("Welcome back!", { description: `Signed in as ${user.name}` });
      navigate(user.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch {
      toast.error("Login failed", {
        description: "Please check your credentials and try again."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-[400px] animate-fade-up rounded-xl border border-border/80 bg-surface p-6 shadow-panel sm:p-7",
        className
      )}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Sign in to your account to continue.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">
            Email
            <RequiredMark />
          </Label>
          <FilledInput
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={loading}
            icon="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Password
            <RequiredMark />
          </Label>
          <FilledInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={loading}
            icon="password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-sm text-muted-foreground">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary transition-colors duration-200 hover:text-primary/80"
          >
            Forgot password
          </Link>
        </div>

        <Button type="submit" className="mt-2 h-11 w-full" disabled={loading} aria-busy={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {isDev && (
        <div className="hidden sm:block">
          <DemoCredentials />
        </div>
      )}
    </div>
  );
}

const DESKTOP_FEATURES = [
  { icon: Package, text: "Real-time stock across stores and godowns" },
  { icon: ShieldCheck, text: "Role-based access for internal teams" },
  { icon: Warehouse, text: "Transfers, movements, and audit trails" }
];

function DesktopBrandPanel() {
  return (
    <aside
      className="relative hidden min-h-0 flex-col justify-between overflow-hidden border-r border-border/80 bg-surface lg:flex"
      aria-label="Application branding"
    >
      <EnterpriseBackdrop />
      <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
        <div className="flex items-center gap-3">
          <AppLogo size="md" />
          <div>
            <p className="text-sm font-semibold text-foreground">EHS</p>
            <p className="text-xs text-muted-foreground">Inventory platform</p>
          </div>
        </div>

        <h2 className="mt-10 max-w-sm text-[28px] font-semibold leading-snug tracking-tight text-foreground xl:text-[32px]">
          Built for teams managing inventory at scale.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Secure access for employees. Track stock, warehouses, and transfers from one operational
          platform.
        </p>

        <ul className="mt-8 space-y-4">
          {DESKTOP_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="pt-1 text-sm text-foreground/80">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 px-12 pb-10 xl:px-16">
        <PageFooter className="items-start text-left" />
      </div>
    </aside>
  );
}

function MobileLoginLayout() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-y-auto">
      <EnterpriseBackdrop />
      <div className="relative z-10 flex min-h-[100dvh] flex-col px-5 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
        <AppHeader className="mb-6 sm:mb-8" />
        <div className="flex flex-1 flex-col items-center justify-center py-2">
          <LoginCard />
        </div>
        <PageFooter className="mt-6 shrink-0 sm:mt-8" />
      </div>
    </div>
  );
}

function TabletLoginLayout() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-8 py-12">
      <EnterpriseBackdrop />
      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center">
        <AppHeader className="mb-10" />
        <LoginCard />
        <PageFooter className="mt-10" />
      </div>
    </div>
  );
}

function DesktopLoginLayout() {
  return (
    <div className="relative grid min-h-[100dvh] lg:grid-cols-[40%_60%] lg:overflow-hidden">
      <DesktopBrandPanel />
      <main
        className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-8 py-12 lg:min-h-0"
        aria-label="Sign in"
      >
        <EnterpriseBackdrop />
        <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">
          <div className="mb-8 hidden w-full text-center lg:block">
            <div className="mx-auto w-fit">
              <AppLogo size="md" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">EHS</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Inventory platform</p>
          </div>
          <LoginCard />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const updateOverflow = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    updateOverflow();
    mq.addEventListener("change", updateOverflow);
    return () => {
      document.body.style.overflow = "";
      mq.removeEventListener("change", updateOverflow);
    };
  }, []);

  if (hasHydrated && isAuthenticated) {
    return <Navigate to={mustChangePassword ? "/change-password" : "/"} replace />;
  }

  return (
    <>
      <div className="md:hidden">
        <MobileLoginLayout />
      </div>
      <div className="hidden md:block lg:hidden">
        <TabletLoginLayout />
      </div>
      <div className="hidden lg:block">
        <DesktopLoginLayout />
      </div>
    </>
  );
}
