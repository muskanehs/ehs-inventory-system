import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { RequiredMark } from "@/components/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";

type LocationState = { email?: string };

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as LocationState | null)?.email?.trim() ?? "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = otp.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      toast.error("Enter the 8-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<ApiResponse<{ resetToken: string }>>("/auth/verify-otp", {
        email,
        otp: cleaned
      });
      navigate("/forgot-password/reset", {
        replace: true,
        state: { resetToken: response.data.data.resetToken, email }
      });
    } catch {
      toast.error("Invalid or expired OTP", {
        description: "Request a new code if you have exceeded attempts."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        title="Verify OTP"
        description={`Enter the 8-digit code sent for ${email}.`}
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="otp">
              One-time password
              <RequiredMark />
            </Label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="h-11 bg-muted/50 pl-10 tracking-[0.3em]"
                placeholder="00000000"
                autoComplete="one-time-code"
                disabled={loading}
                required
              />
            </div>
          </div>

          <Button type="submit" className="mt-2 h-11 w-full" disabled={loading} aria-busy={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="font-medium text-primary hover:text-primary/80">
              Resend code
            </Link>
            {" · "}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
