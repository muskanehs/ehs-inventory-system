import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthShell, validatePasswordClient } from "@/components/auth/AuthShell";
import { RequiredMark } from "@/components/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";

type LocationState = { resetToken?: string; email?: string };

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};
  const resetToken = state.resetToken ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
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
      const response = await api.post<ApiResponse<{ message: string }>>("/auth/reset-password", {
        resetToken,
        newPassword,
        confirmPassword
      });
      toast.success("Password reset", {
        description: response.data.data.message
      });
      navigate("/login", { replace: true });
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
            : "Request a new OTP and try again.";
      toast.error("Could not reset password", { description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard title="Set new password" description="Choose a strong password for your account.">
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
                Saving...
              </>
            ) : (
              "Reset password"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Back to sign in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
