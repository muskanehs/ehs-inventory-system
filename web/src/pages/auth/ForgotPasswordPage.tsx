import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { RequiredMark } from "@/components/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your login email");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<ApiResponse<{ message: string }>>("/auth/forgot-password", {
        email: trimmed
      });
      toast.success("Request received", {
        description: response.data.data.message
      });
      navigate("/forgot-password/verify", { replace: true, state: { email: trimmed } });
    } catch {
      toast.error("Could not start password reset", {
        description: "Please try again in a moment."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        title="Forgot password"
        description="Enter your login email. If the account exists, an OTP will be sent to the recovery inbox."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">
              Login email
              <RequiredMark />
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-muted/50 pl-10"
                placeholder="admin@inventory.local"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <Button type="submit" className="mt-2 h-11 w-full" disabled={loading} aria-busy={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              "Send OTP"
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
