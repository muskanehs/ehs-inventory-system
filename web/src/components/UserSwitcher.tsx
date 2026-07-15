import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { ApiResponse, AuthUser } from "@/lib/types";
import { SWITCH_USER_ACCOUNTS } from "@/lib/switch-users";
import { useAuthStore } from "@/store/auth";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function UserSwitcher() {
  const [switching, setSwitching] = useState(false);
  const email = useAuthStore((s) => s.email);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const setAuth = useAuthStore((s) => s.setAuth);

  if (mustChangePassword) {
    return null;
  }

  const currentAccount =
    SWITCH_USER_ACCOUNTS.find((account) => account.email === email) ?? SWITCH_USER_ACCOUNTS[0];

  const handleSwitch = async (accountId: string) => {
    const account = SWITCH_USER_ACCOUNTS.find((item) => item.id === accountId);
    if (!account || account.email === email) return;

    setSwitching(true);
    try {
      const response = await api.post<ApiResponse<LoginResponse>>("/auth/login", {
        email: account.email,
        password: account.password
      });
      const { user } = response.data.data;
      setAuth(
        user.role,
        user.name,
        account.email,
        user.assignedLocationId,
        user.assignedLocation?.name,
        user.mustChangePassword ?? false
      );
      if (user.mustChangePassword) {
        window.location.href = "/change-password";
        return;
      }
      toast.success(`Switched to ${account.label}`, {
        description: `Now viewing as ${user.name}`
      });
    } catch {
      toast.error("Switch failed", {
        description: `Could not sign in as ${account.label}. Run prisma:seed if demo users are missing.`
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/60 text-muted-foreground"
          disabled={switching}
          aria-label="Switch user"
        >
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          <span className="max-w-[88px] truncate sm:max-w-[120px]">{currentAccount.label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SWITCH_USER_ACCOUNTS.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => handleSwitch(account.id)}
            disabled={switching || account.email === email}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span>{account.label}</span>
              <span className="text-xs text-muted-foreground">{account.role.replace(/_/g, " ")}</span>
            </div>
            {account.email === email && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
