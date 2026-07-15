import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, AuthCard, validatePasswordClient } from "@/components/auth/AuthShell";
import { RequiredMark } from "@/components/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ApiResponse, AuthUser } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

type ChangePasswordResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!hasHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const strengthError = validatePasswordClient(newPassword);
    if (strengthError) {
      toast.error(strengthError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<ApiResponse<ChangePasswordResponse>>(
        "/auth/change-password",
        { newPassword, confirmPassword }
      );
      const { user } = response.data.data;
      setAuth(
        user.role,
        user.name,
        user.email,
        user.assignedLocationId,
        user.assignedLocation?.name,
        user.mustChangePassword ?? false
      );
      toast.success("Password updated", {
        description: "You can now continue using the application."
      });
      navigate("/", { replace: true });
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: { message?: string } | string } } })
              .response?.data?.error
          : undefined;
      const description =
        typeof message === "string"
          ? message
          : message && typeof message === "object"
            ? message.message
            : "Please check your password and try again.";
      toast.error("Could not update password", { description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        title="Change password"
        description="You must set a new password before continuing."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              New password
              <RequiredMark />
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 bg-muted/50 pl-10 pr-10"
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirm password
              <RequiredMark />
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 bg-muted/50 pl-10"
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              At least 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <Button type="submit" className="mt-2 h-11 w-full" disabled={loading} aria-busy={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating...
              </>
            ) : (
              "Update password"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Need to use a different account?{" "}
            <Link
              to="/login"
              replace
              className="font-medium text-primary hover:text-primary/80"
              onClick={() => {
                void api
                  .post("/auth/logout")
                  .catch(() => undefined)
                  .finally(() => useAuthStore.getState().clear());
              }}
            >
              Sign out
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
